-- Owner-only company membership removal. Local until separately deployed.
begin;
set local lock_timeout='10s';
set local statement_timeout='60s';

-- A new value on every join makes a confirmation invalid after removal/rejoin.
alter table public.memberships add column membership_version uuid not null default gen_random_uuid();

create function private.company_member_assignment_snapshot(target_workspace uuid,target_user uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('assignments',assignments,'hash',md5(assignments::text))
  from (select coalesce(jsonb_agg(jsonb_build_object('project_id',pm.project_id,'role',pm.role,'row_version',pm.row_version) order by pm.project_id),'[]'::jsonb) as assignments
    from public.project_memberships pm where pm.workspace_id=target_workspace and pm.user_id=target_user) s;
$$;
revoke all on function private.company_member_assignment_snapshot(uuid,uuid) from public,anon,authenticated;

create function private.preview_company_member_removal(target_workspace uuid,target_user uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare member_row public.memberships; snapshot jsonb; member_email text; company_name text; projects jsonb;
begin
  perform private.require_company_owner(target_workspace);
  perform private.confirmed_user_email();
  if target_user is null then raise exception 'Member required' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended(target_workspace::text,0));
  select * into member_row from public.memberships where workspace_id=target_workspace and user_id=target_user for share;
  if not found then raise exception 'Membership changed; reload' using errcode='40001';end if;
  if member_row.role<>'member' or target_user=auth.uid() then raise exception 'Owners cannot be removed' using errcode='42501';end if;
  snapshot=private.company_member_assignment_snapshot(target_workspace,target_user);
  select email into member_email from auth.users where id=target_user;
  select name into company_name from public.workspaces where id=target_workspace;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'role',pm.role) order by p.name,p.id),'[]'::jsonb) into projects
    from public.project_memberships pm join public.projects p on p.workspace_id=pm.workspace_id and p.id=pm.project_id
    where pm.workspace_id=target_workspace and pm.user_id=target_user and pm.role is not null;
  return jsonb_build_object('workspace_id',target_workspace,'company_name',company_name,'user_id',target_user,'email',member_email,'membership_version',member_row.membership_version,'assignments_hash',snapshot->>'hash','projects',projects);
end; $$;
revoke all on function private.preview_company_member_removal(uuid,uuid) from public,anon;
grant execute on function private.preview_company_member_removal(uuid,uuid) to authenticated;

create function private.remove_company_member(target_workspace uuid,target_user uuid,expected_membership_version uuid,expected_assignments_hash text)
returns void language plpgsql security definer set search_path='' as $$
declare member_row public.memberships; snapshot jsonb; member_email text; cancelled jsonb; cancelled_id uuid; project_ids jsonb;
begin
  perform private.require_company_owner(target_workspace);
  perform private.confirmed_user_email();
  if target_user is null or expected_membership_version is null or expected_assignments_hash is null or expected_assignments_hash !~ '^[a-f0-9]{32}$' then
    raise exception 'Confirmation snapshot required' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_workspace::text,0));
  select * into member_row from public.memberships where workspace_id=target_workspace and user_id=target_user for update;
  if not found then raise exception 'Membership changed; reload' using errcode='40001';end if;
  if member_row.role<>'member' or target_user=auth.uid() then raise exception 'Owners cannot be removed' using errcode='42501';end if;
  snapshot=private.company_member_assignment_snapshot(target_workspace,target_user);
  if member_row.membership_version is distinct from expected_membership_version or snapshot->>'hash' is distinct from expected_assignments_hash then
    raise exception 'Membership or assignments changed; reload and confirm again' using errcode='40001';
  end if;
  select email into member_email from auth.users where id=target_user;
  -- Prevent an outstanding old offer from restoring the access just withdrawn.
  with changed as (
    update private.company_invitations set status='cancelled',row_version=row_version+1
    where workspace_id=target_workspace and email=lower(btrim(member_email)) and status='pending' returning id
  ) select coalesce(jsonb_agg(id),'[]'::jsonb) into cancelled from changed;
  for cancelled_id in select value::uuid from jsonb_array_elements_text(cancelled) loop
    insert into private.company_access_events(workspace_id,actor_id,action,details)
      values(target_workspace,auth.uid(),'invitation_cancelled',jsonb_build_object('invitation_id',cancelled_id,'reason','member_removed','user_id',target_user,'email',member_email));
  end loop;
  select coalesce(jsonb_agg(item->'project_id'),'[]'::jsonb) into project_ids from jsonb_array_elements(snapshot->'assignments') item where item->>'role' is not null;
  -- Only this company's membership and its FK-cascaded assignments are deleted.
  delete from public.memberships where workspace_id=target_workspace and user_id=target_user;
  insert into private.company_access_events(workspace_id,actor_id,action,details)
    values(target_workspace,auth.uid(),'company_member_removed',jsonb_build_object('user_id',target_user,'email',member_email,'membership_version',member_row.membership_version,'project_ids',project_ids,'removed_assignments',snapshot->'assignments','cancelled_invitation_ids',cancelled));
end; $$;
revoke all on function private.remove_company_member(uuid,uuid,uuid,text) from public,anon;
grant execute on function private.remove_company_member(uuid,uuid,uuid,text) to authenticated;

create function public.preview_company_member_removal(target_workspace uuid,target_user uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.preview_company_member_removal(target_workspace,target_user)$$;
revoke all on function public.preview_company_member_removal(uuid,uuid) from public,anon;
grant execute on function public.preview_company_member_removal(uuid,uuid) to authenticated;
create function public.remove_company_member(target_workspace uuid,target_user uuid,expected_membership_version uuid,expected_assignments_hash text)
returns void language sql security invoker set search_path='' as $$select private.remove_company_member(target_workspace,target_user,expected_membership_version,expected_assignments_hash)$$;
revoke all on function public.remove_company_member(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.remove_company_member(uuid,uuid,uuid,text) to authenticated;

-- An accepted offer is idempotent only while membership remains active.
create or replace function private.accept_company_invitation(target_invitation uuid,expected_version integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare target_email text; offer private.company_invitations; company_id uuid;
begin
  target_email=private.confirmed_user_email();
  select workspace_id into company_id from private.company_invitations where id=target_invitation and email=target_email;
  if not found then raise exception 'Invitation not found for verified email' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended(company_id::text,0));
  select * into offer from private.company_invitations where id=target_invitation for update;
  if offer.status='accepted' and offer.accepted_by=auth.uid() then
    if exists(select 1 from public.memberships where workspace_id=offer.workspace_id and user_id=auth.uid()) then return offer.workspace_id;end if;
    raise exception 'Membership was removed; ask Owner for a new invitation' using errcode='40001';
  end if;
  if offer.status<>'pending' or offer.expires_at<=now() or offer.row_version is distinct from expected_version then raise exception 'Invitation changed or expired' using errcode='40001';end if;
  perform 1 from public.memberships where workspace_id=offer.workspace_id and user_id=offer.invited_by and role='owner' for share;
  if not found then raise exception 'Inviter is no longer an Owner' using errcode='42501';end if;
  if exists(select 1 from public.memberships where workspace_id=offer.workspace_id and user_id=auth.uid()) then raise exception 'Membership changed; ask Owner to review assignments' using errcode='40001';end if;
  if (select count(*) from public.projects where workspace_id=offer.workspace_id and id=any(offer.project_ids))<>cardinality(offer.project_ids) then raise exception 'Invitation projects changed' using errcode='40001';end if;
  insert into public.memberships(workspace_id,user_id,role) values(offer.workspace_id,auth.uid(),'member');
  insert into public.project_memberships(workspace_id,project_id,user_id,role) select offer.workspace_id,p,auth.uid(),offer.role from unnest(offer.project_ids) p;
  update private.company_invitations set status='accepted',accepted_by=auth.uid(),accepted_at=now(),row_version=row_version+1 where id=offer.id;
  insert into private.company_access_events(workspace_id,actor_id,action,details) values(offer.workspace_id,auth.uid(),'invitation_accepted',jsonb_build_object('invitation_id',offer.id,'role',offer.role,'project_ids',offer.project_ids));
  return offer.workspace_id;
end; $$;

-- Bind assignment confirmations to the current membership, including after rejoin.
create function private.list_company_members_with_revisions(target_workspace uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform private.require_company_owner(target_workspace);
  return (select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'email',u.email,'role',m.role,'membership_version',m.membership_version,'assignments',(select coalesce(jsonb_agg(jsonb_build_object('user_id',pm.user_id,'project_id',pm.project_id,'role',pm.role,'row_version',pm.row_version) order by pm.project_id),'[]'::jsonb) from public.project_memberships pm where pm.workspace_id=m.workspace_id and pm.user_id=m.user_id)) order by u.email,m.user_id),'[]'::jsonb)
    from public.memberships m join auth.users u on u.id=m.user_id where m.workspace_id=target_workspace);
end; $$;
revoke all on function private.list_company_members_with_revisions(uuid) from public,anon;
grant execute on function private.list_company_members_with_revisions(uuid) to authenticated;
create function public.list_company_members_with_revisions(target_workspace uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.list_company_members_with_revisions(target_workspace)$$;
revoke all on function public.list_company_members_with_revisions(uuid) from public,anon;
grant execute on function public.list_company_members_with_revisions(uuid) to authenticated;

create function private.set_project_assignment(target_workspace uuid,target_project uuid,target_user uuid,new_role text,expected_version integer,expected_membership_version uuid)
returns void language plpgsql security definer set search_path='' as $$
declare current_version integer;
begin
  perform private.require_company_owner(target_workspace);
  perform pg_advisory_xact_lock(hashtextextended(target_workspace::text,0));
  if expected_version is null or expected_version<0 or (new_role is not null and new_role not in ('editor','viewer')) then raise exception 'Invalid assignment' using errcode='22023'; end if;
  if not exists(select 1 from public.projects where workspace_id=target_workspace and id=target_project)
    or not exists(select 1 from public.memberships where workspace_id=target_workspace and user_id=target_user and role='member') then
    raise exception 'Project or ordinary member not found' using errcode='42501';
  end if;
  if expected_membership_version is null or not exists(select 1 from public.memberships where workspace_id=target_workspace and user_id=target_user and membership_version=expected_membership_version) then
    raise exception 'Membership changed; reload' using errcode='40001';
  end if;
  select row_version into current_version from public.project_memberships where workspace_id=target_workspace and project_id=target_project and user_id=target_user for update;
  if coalesce(current_version,0)<>expected_version then raise exception 'Assignment changed; reload' using errcode='40001'; end if;
  insert into public.project_memberships(workspace_id,project_id,user_id,role) values(target_workspace,target_project,target_user,new_role)
    on conflict(workspace_id,project_id,user_id) do update set role=excluded.role,row_version=public.project_memberships.row_version+1,updated_at=now();
  insert into private.company_access_events(workspace_id,actor_id,action,details)
    values(target_workspace,auth.uid(),'project_assignment_changed',jsonb_build_object('project_id',target_project,'user_id',target_user,'role',new_role,'previous_version',expected_version));
end; $$;
revoke all on function private.set_project_assignment(uuid,uuid,uuid,text,integer,uuid) from public,anon;
grant execute on function private.set_project_assignment(uuid,uuid,uuid,text,integer,uuid) to authenticated;
create function public.set_project_assignment(target_workspace uuid,target_project uuid,target_user uuid,new_role text,expected_version integer,expected_membership_version uuid)
returns void language sql security invoker set search_path='' as $$select private.set_project_assignment(target_workspace,target_project,target_user,new_role,expected_version,expected_membership_version)$$;
revoke all on function public.set_project_assignment(uuid,uuid,uuid,text,integer,uuid) from public,anon;
grant execute on function public.set_project_assignment(uuid,uuid,uuid,text,integer,uuid) to authenticated;

-- Old loaded clients cannot modify a newly rejoined membership using a reset row_version.
create or replace function private.set_project_assignment(target_workspace uuid,target_project uuid,target_user uuid,new_role text,expected_version integer)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.require_company_owner(target_workspace);
  raise exception 'Membership snapshot required; reload' using errcode='40001';
end; $$;

commit;
