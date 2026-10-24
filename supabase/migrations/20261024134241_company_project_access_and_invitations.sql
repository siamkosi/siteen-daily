-- LOCAL/STAGING ONLY until coordinated deployment with the new application.
begin;

create table private.company_access_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  actor_id uuid references auth.users(id),
  action text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index company_access_events_workspace_idx on private.company_access_events(workspace_id,created_at desc,id desc);
alter table private.company_access_events enable row level security;
revoke all on private.company_access_events from public,anon,authenticated;
create policy access_events_no_direct_access on private.company_access_events as restrictive for all to authenticated using(false) with check(false);

-- Preserve the old role in an operator/Owner-readable audit; never grant all projects.
insert into private.company_access_events(workspace_id,action,details)
select workspace_id,'legacy_membership_migrated',jsonb_build_object('user_id',user_id,'old_role',role)
from public.memberships where role in ('editor','viewer');
alter table public.memberships drop constraint memberships_role_check;
update public.memberships set role='member' where role in ('editor','viewer');
alter table public.memberships add constraint memberships_role_check check(role in ('owner','member'));

create table public.project_memberships (
  workspace_id uuid not null,
  project_id uuid not null,
  user_id uuid not null,
  role text check(role in ('editor','viewer')),
  row_version integer not null default 1 check(row_version>0),
  updated_at timestamptz not null default now(),
  primary key(workspace_id,project_id,user_id),
  foreign key(workspace_id,project_id) references public.projects(workspace_id,id),
  foreign key(workspace_id,user_id) references public.memberships(workspace_id,user_id) on delete cascade
);
create index project_memberships_user_idx on public.project_memberships(user_id,workspace_id,project_id);
alter table public.project_memberships enable row level security;
revoke all on public.project_memberships from public,anon,authenticated;
grant select on public.project_memberships to authenticated;
create policy project_membership_read on public.project_memberships for select to authenticated
using(user_id=(select auth.uid()) or private.is_company_owner(workspace_id));

create or replace function private.has_access(target uuid,write_access boolean default false)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.memberships m
  where m.workspace_id=target and m.user_id=auth.uid() and (not write_access or m.role='owner'));
$$;
create function private.project_access(target_workspace uuid,target_project uuid,write_access boolean default false)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.memberships m
    where m.workspace_id=target_workspace and m.user_id=auth.uid() and
    (m.role='owner' or (m.role='member' and exists(select 1 from public.project_memberships pm
      where pm.workspace_id=m.workspace_id and pm.project_id=target_project and pm.user_id=m.user_id
      and pm.role in ('editor','viewer') and (not write_access or pm.role='editor')))));
$$;
revoke all on function private.project_access(uuid,uuid,boolean) from public,anon;
grant execute on function private.project_access(uuid,uuid,boolean) to authenticated;

alter policy project_read on public.projects using(private.project_access(workspace_id,id));
alter policy project_insert on public.projects with check(private.is_company_owner(workspace_id));
alter policy project_update on public.projects using(private.project_access(workspace_id,id,true)) with check(private.project_access(workspace_id,id,true));
create function private.guard_project_identity() returns trigger language plpgsql set search_path='' as $$
begin
  if (new.id,new.workspace_id,new.created_at) is distinct from (old.id,old.workspace_id,old.created_at) then
    raise exception 'Project identity cannot change' using errcode='42501';
  end if;
  return new;
end; $$;
revoke all on function private.guard_project_identity() from public,anon,authenticated;
create trigger project_identity before update on public.projects for each row execute function private.guard_project_identity();

alter policy report_read on public.daily_reports using(private.project_access(workspace_id,project_id) and (deleted_at is null or private.is_company_owner(workspace_id) or (private.project_access(workspace_id,project_id,true) and created_by=(select auth.uid()))));
alter policy report_insert on public.daily_reports with check(private.project_access(workspace_id,project_id,true) and created_by=(select auth.uid()));
alter policy report_update on public.daily_reports using(private.project_access(workspace_id,project_id,true)) with check(private.project_access(workspace_id,project_id,true));
alter policy request_read on public.daily_requests using(private.project_access(workspace_id,project_id) and (deleted_at is null or private.is_company_owner(workspace_id) or (private.project_access(workspace_id,project_id,true) and created_by=(select auth.uid()))));
alter policy request_insert on public.daily_requests with check(private.project_access(workspace_id,project_id,true) and created_by=(select auth.uid()));
alter policy request_update on public.daily_requests using(private.project_access(workspace_id,project_id,true)) with check(private.project_access(workspace_id,project_id,true));
alter policy photo_read on public.photos using(private.project_access(workspace_id,project_id) and exists(select 1 from public.daily_reports r where r.id=report_id and r.workspace_id=photos.workspace_id));
alter policy photo_insert on public.photos with check(private.project_access(workspace_id,project_id,true) and private.can_access_photo(path,true));
alter policy photo_delete on public.photos using(private.project_access(workspace_id,project_id,true) and private.can_access_photo(path,true));
-- Document history already joins the RLS-protected document before revealing snapshots.

create or replace function private.can_access_photo(object_name text,write_access boolean default false)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from public.daily_reports r where r.workspace_id::text=split_part(object_name,'/',1)
    and r.project_id::text=split_part(object_name,'/',2) and r.id::text=split_part(object_name,'/',3)
    and private.project_access(r.workspace_id,r.project_id,write_access)
    and (not write_access or (r.deleted_at is null and r.status<>'cancelled'))
    and object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}(\.(jpeg|png|webp)|\.thumb\.jpeg)$');
$$;
create or replace function private.can_access_project_cover(object_name text,write_access boolean default false)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from public.projects p where p.workspace_id::text=split_part(object_name,'/',1)
    and p.id::text=split_part(object_name,'/',2) and private.project_access(p.workspace_id,p.id,write_access)
    and object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpeg|png|webp)$');
$$;

create function private.require_company_owner(target_workspace uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.memberships m where m.workspace_id=target_workspace and m.user_id=auth.uid() and m.role='owner' for share;
  if auth.uid() is null or not found then raise exception 'Owner permission required' using errcode='42501'; end if;
end; $$;
revoke all on function private.require_company_owner(uuid) from public,anon,authenticated;

create function private.list_project_assignments(target_workspace uuid)
returns table(user_id uuid,project_id uuid,role text,row_version integer)
language plpgsql security definer set search_path='' as $$
begin
  perform private.require_company_owner(target_workspace);
  return query select pm.user_id,pm.project_id,pm.role,pm.row_version from public.project_memberships pm where pm.workspace_id=target_workspace order by pm.user_id,pm.project_id;
end; $$;
create function private.set_project_assignment(target_workspace uuid,target_project uuid,target_user uuid,new_role text,expected_version integer)
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
  select row_version into current_version from public.project_memberships where workspace_id=target_workspace and project_id=target_project and user_id=target_user for update;
  if coalesce(current_version,0)<>expected_version then raise exception 'Assignment changed; reload' using errcode='40001'; end if;
  insert into public.project_memberships(workspace_id,project_id,user_id,role) values(target_workspace,target_project,target_user,new_role)
    on conflict(workspace_id,project_id,user_id) do update set role=excluded.role,row_version=public.project_memberships.row_version+1,updated_at=now();
  insert into private.company_access_events(workspace_id,actor_id,action,details)
    values(target_workspace,auth.uid(),'project_assignment_changed',jsonb_build_object('project_id',target_project,'user_id',target_user,'role',new_role,'previous_version',expected_version));
end; $$;
-- Disable the old global editor/viewer mutation; no stale client can restore broad rights.
create or replace function private.change_company_member_role(target_workspace uuid,target_user uuid,new_role text,expected_role text)
returns void language plpgsql security definer set search_path='' as $$
begin raise exception 'Use project assignments; company-wide Editor/Viewer is disabled' using errcode='42501'; end; $$;

create table private.company_invitations (
  id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),
  email text not null check(email=lower(btrim(email)) and char_length(email)<=254),
  project_ids uuid[] not null check(cardinality(project_ids) between 1 and 100),
  role text not null check(role in ('editor','viewer')),
  invited_by uuid not null references auth.users(id),
  status text not null default 'pending' check(status in ('pending','accepted','cancelled','expired')),
  delivery_status text not null default 'sending' check(delivery_status in ('sending','sent','failed','unknown')),
  created_at timestamptz not null default now(),expires_at timestamptz not null default (now()+interval '7 days'),
  accepted_by uuid references auth.users(id),accepted_at timestamptz,row_version integer not null default 1
);
create unique index company_invitation_pending_key on private.company_invitations(workspace_id,email) where status='pending';
create index company_invitation_email_idx on private.company_invitations(email,status,created_at desc,id desc);
create index company_invitation_workspace_idx on private.company_invitations(workspace_id,created_at desc,id desc);
create table private.invitation_send_attempts (
  id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),
  invitation_id uuid not null references private.company_invitations(id),owner_id uuid not null references auth.users(id),request_id uuid not null,
  outcome text not null default 'sending' check(outcome in ('sending','sent','failed','unknown')),
  created_at timestamptz not null default now(),unique(workspace_id,request_id)
);
create index invitation_attempt_owner_idx on private.invitation_send_attempts(owner_id,created_at desc);
create index invitation_attempt_workspace_idx on private.invitation_send_attempts(workspace_id,created_at desc);
create index invitation_attempt_invitation_idx on private.invitation_send_attempts(invitation_id,created_at desc);
alter table private.company_invitations enable row level security;
alter table private.invitation_send_attempts enable row level security;
revoke all on private.company_invitations,private.invitation_send_attempts from public,anon,authenticated;
create policy invitations_no_direct_access on private.company_invitations as restrictive for all to authenticated using(false) with check(false);
create policy invitation_attempts_no_direct_access on private.invitation_send_attempts as restrictive for all to authenticated using(false) with check(false);

create function private.confirmed_user_email() returns text language plpgsql security definer set search_path='' as $$
declare result text;
begin
  select lower(btrim(u.email)) into result from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false);
  if result is null then raise exception 'Verified email required' using errcode='42501'; end if;
  return result;
end; $$;
revoke all on function private.confirmed_user_email() from public,anon,authenticated;

create function private.prepare_company_invitation(target_workspace uuid,target_email text,target_projects uuid[],new_role text,request_id uuid,existing_invitation uuid default null,expected_version integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare offer private.company_invitations; attempt private.invitation_send_attempts; normalized text:=lower(btrim(target_email)); selected uuid[];
begin
  perform private.require_company_owner(target_workspace);
  perform private.confirmed_user_email();
  perform pg_advisory_xact_lock(hashtextextended(target_workspace::text,0));
  select array_agg(distinct p order by p) into selected from unnest(target_projects) p;
  if request_id is null or normalized is null or char_length(normalized)>254 or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or new_role is null or new_role not in ('editor','viewer') or coalesce(cardinality(selected),0) not between 1 and 100
    or array_position(selected,null) is not null then raise exception 'Invalid invitation' using errcode='22023'; end if;
  if (select count(*) from public.projects where workspace_id=target_workspace and id=any(selected))<>cardinality(selected) then raise exception 'Project not found' using errcode='42501'; end if;
  select * into attempt from private.invitation_send_attempts a where a.workspace_id=target_workspace and a.request_id=prepare_company_invitation.request_id;
  if found then
    select * into offer from private.company_invitations where id=attempt.invitation_id;
    if attempt.owner_id<>auth.uid() or offer.email<>normalized or offer.project_ids<>selected or offer.role<>new_role then raise exception 'Request changed' using errcode='40001'; end if;
    return jsonb_build_object('id',offer.id,'attempt_id',attempt.id,'email',offer.email,'send',false,'status',offer.status,'delivery_status',case when attempt.outcome='sending' then 'unknown' else attempt.outcome end,'expires_at',offer.expires_at,'row_version',offer.row_version);
  end if;
  if exists(select 1 from public.memberships m join auth.users u on u.id=m.user_id where m.workspace_id=target_workspace and lower(btrim(u.email))=normalized) then raise exception 'Already a member; manage project assignments' using errcode='23505'; end if;
  if (select count(*) from private.invitation_send_attempts where owner_id=auth.uid() and created_at>now()-interval '1 hour')>=10
    or (select count(*) from private.invitation_send_attempts where workspace_id=target_workspace and created_at>now()-interval '1 hour')>=30 then raise exception 'Invitation email limit reached' using errcode='P0429'; end if;
  if exists(select 1 from private.invitation_send_attempts a join private.company_invitations i on i.id=a.invitation_id
    where i.email=normalized and a.workspace_id=target_workspace and a.created_at>now()-interval '60 seconds') then raise exception 'Wait 60 seconds before resend' using errcode='P0429'; end if;
  update private.company_invitations set status='expired',row_version=row_version+1 where workspace_id=target_workspace and email=normalized and status='pending' and expires_at<=now();
  if existing_invitation is not null then
    select * into offer from private.company_invitations where workspace_id=target_workspace and id=existing_invitation for update;
    if not found or offer.status<>'pending' or offer.expires_at<=now() or offer.row_version is distinct from expected_version
      or offer.email<>normalized or offer.project_ids<>selected or offer.role<>new_role then raise exception 'Invitation changed; reload' using errcode='40001'; end if;
  else
    if (select count(*) from private.company_invitations where workspace_id=target_workspace and status='pending' and expires_at>now())>=100 then raise exception 'Pending invitation limit reached' using errcode='P0429'; end if;
    insert into private.company_invitations(workspace_id,email,project_ids,role,invited_by)
      values(target_workspace,normalized,selected,new_role,auth.uid()) returning * into offer;
  end if;
  insert into private.invitation_send_attempts(workspace_id,invitation_id,owner_id,request_id)
    values(target_workspace,offer.id,auth.uid(),prepare_company_invitation.request_id) returning * into attempt;
  update private.company_invitations set delivery_status='sending' where id=offer.id;
  insert into private.company_access_events(workspace_id,actor_id,action,details) values(target_workspace,auth.uid(),'invitation_send_requested',jsonb_build_object('invitation_id',offer.id,'attempt_id',attempt.id,'email',normalized,'role',new_role,'project_ids',selected));
  return jsonb_build_object('id',offer.id,'attempt_id',attempt.id,'email',normalized,'send',true,'status',offer.status,'delivery_status','sending','expires_at',offer.expires_at,'row_version',offer.row_version);
end; $$;

create function private.complete_company_invitation_delivery(target_workspace uuid,target_attempt uuid,delivery_result text)
returns void language plpgsql security definer set search_path='' as $$
declare attempt private.invitation_send_attempts;
begin
  perform private.require_company_owner(target_workspace);
  if delivery_result is null or delivery_result not in ('sent','failed','unknown') then raise exception 'Invalid delivery result' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_workspace::text,0));
  select * into attempt from private.invitation_send_attempts where workspace_id=target_workspace and id=target_attempt and owner_id=auth.uid() for update;
  if not found then raise exception 'Attempt not found' using errcode='42501'; end if;
  if attempt.outcome<>'sending' then
    if attempt.outcome=delivery_result then return; end if;
    raise exception 'Delivery already recorded' using errcode='40001';
  end if;
  update private.invitation_send_attempts set outcome=delivery_result where id=attempt.id;
  -- An older slow response must not overwrite a newer delivery attempt.
  if not exists(select 1 from private.invitation_send_attempts a where a.invitation_id=attempt.invitation_id and (a.created_at,a.id)>(attempt.created_at,attempt.id)) then
    update private.company_invitations set delivery_status=delivery_result where id=attempt.invitation_id;
  end if;
  insert into private.company_access_events(workspace_id,actor_id,action,details) values(target_workspace,auth.uid(),'invitation_delivery_recorded',jsonb_build_object('invitation_id',attempt.invitation_id,'attempt_id',attempt.id,'result',delivery_result));
end; $$;

create function private.invitation_json(offer private.company_invitations) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',offer.id,'workspace_id',offer.workspace_id,'company_name',w.name,'email',offer.email,'role',offer.role,
    'projects',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name,p.id),'[]') from public.projects p where p.workspace_id=offer.workspace_id and p.id=any(offer.project_ids)),
    'status',case when offer.status='pending' and offer.expires_at<=now() then 'expired' else offer.status end,
    'delivery_status',offer.delivery_status,'expires_at',offer.expires_at,'created_at',offer.created_at,'row_version',offer.row_version)
  from public.workspaces w where w.id=offer.workspace_id;
$$;
revoke all on function private.invitation_json(private.company_invitations) from public,anon,authenticated;

create function private.list_company_invitations(target_workspace uuid,before_created timestamptz default null,before_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare items jsonb; next_cursor jsonb; rows private.company_invitations[]; last_row private.company_invitations;
begin
  perform private.require_company_owner(target_workspace);
  if (before_created is null)<>(before_id is null) then raise exception 'Invalid cursor' using errcode='22023'; end if;
  select array_agg(i order by i.created_at desc,i.id desc) into rows from
    (select * from private.company_invitations where workspace_id=target_workspace and (before_created is null or (created_at,id)<(before_created,before_id)) order by created_at desc,id desc limit 51) i;
  if cardinality(rows)>50 then last_row=rows[50];next_cursor=jsonb_build_object('created_at',last_row.created_at,'id',last_row.id);rows=rows[1:50];end if;
  select coalesce(jsonb_agg(private.invitation_json(i) order by i.created_at desc,i.id desc),'[]') into items from unnest(rows) i;
  return jsonb_build_object('items',items,'next_cursor',next_cursor);
end; $$;
create function private.list_my_company_invitations(before_created timestamptz default null,before_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target_email text; items jsonb;next_cursor jsonb;rows private.company_invitations[];last_row private.company_invitations;
begin
  target_email=private.confirmed_user_email();
  if (before_created is null)<>(before_id is null) then raise exception 'Invalid cursor' using errcode='22023'; end if;
  select array_agg(i order by i.created_at desc,i.id desc) into rows from
    (select i.* from private.company_invitations i where i.email=target_email and i.status='pending' and i.expires_at>now()
      and exists(select 1 from public.memberships m where m.workspace_id=i.workspace_id and m.user_id=i.invited_by and m.role='owner')
      and (before_created is null or (i.created_at,i.id)<(before_created,before_id)) order by i.created_at desc,i.id desc limit 51) i;
  if cardinality(rows)>50 then last_row=rows[50];next_cursor=jsonb_build_object('created_at',last_row.created_at,'id',last_row.id);rows=rows[1:50];end if;
  select coalesce(jsonb_agg(private.invitation_json(i) order by i.created_at desc,i.id desc),'[]') into items from unnest(rows) i;
  return jsonb_build_object('items',items,'next_cursor',next_cursor);
end; $$;

create function private.accept_company_invitation(target_invitation uuid,expected_version integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare target_email text; offer private.company_invitations; company_id uuid;
begin
  target_email=private.confirmed_user_email();
  select workspace_id into company_id from private.company_invitations where id=target_invitation and email=target_email;
  if not found then raise exception 'Invitation not found for verified email' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended(company_id::text,0));
  select * into offer from private.company_invitations where id=target_invitation for update;
  if offer.status='accepted' and offer.accepted_by=auth.uid() then return offer.workspace_id;end if;
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
create function private.cancel_company_invitation(target_workspace uuid,target_invitation uuid,expected_version integer)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.require_company_owner(target_workspace);
  perform pg_advisory_xact_lock(hashtextextended(target_workspace::text,0));
  update private.company_invitations set status='cancelled',row_version=row_version+1 where workspace_id=target_workspace and id=target_invitation and status='pending' and row_version=expected_version;
  if not found then raise exception 'Invitation changed; reload' using errcode='40001';end if;
  insert into private.company_access_events(workspace_id,actor_id,action,details) values(target_workspace,auth.uid(),'invitation_cancelled',jsonb_build_object('invitation_id',target_invitation));
end; $$;
create function private.list_company_access_events(target_workspace uuid,before_created timestamptz default null,before_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare items jsonb; next_cursor jsonb;last_row private.company_access_events;rows private.company_access_events[];
begin
  perform private.require_company_owner(target_workspace);
  if (before_created is null)<>(before_id is null) then raise exception 'Invalid cursor' using errcode='22023';end if;
  select array_agg(e order by e.created_at desc,e.id desc) into rows from
    (select * from private.company_access_events where workspace_id=target_workspace and (before_created is null or (created_at,id)<(before_created,before_id)) order by created_at desc,id desc limit 51) e;
  if cardinality(rows)>50 then last_row=rows[50];next_cursor=jsonb_build_object('created_at',last_row.created_at,'id',last_row.id);rows=rows[1:50];end if;
  select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc,e.id desc),'[]') into items from unnest(rows) e;
  return jsonb_build_object('items',items,'next_cursor',next_cursor);
end; $$;

-- Expose only the guarded RPCs through unprivileged wrappers. No direct writes.
do $wrap$
declare f record;arguments text;
begin
  for f in select p.oid,p.proname,p.pronargs from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname in ('list_project_assignments','set_project_assignment','prepare_company_invitation','complete_company_invitation_delivery','list_company_invitations','list_my_company_invitations','accept_company_invitation','cancel_company_invitation','list_company_access_events') loop
    select string_agg('$'||i::text,',' order by i) into arguments from generate_series(1,f.pronargs) i;
    execute format('revoke all on function private.%I(%s) from public,anon',f.proname,pg_get_function_identity_arguments(f.oid));
    execute format('grant execute on function private.%I(%s) to authenticated',f.proname,pg_get_function_identity_arguments(f.oid));
    execute format('create function public.%I(%s) returns %s language sql security invoker set search_path='''' as $body$ select * from private.%I(%s); $body$',f.proname,pg_get_function_arguments(f.oid),pg_get_function_result(f.oid),f.proname,coalesce(arguments,''));
    execute format('revoke all on function public.%I(%s) from public,anon',f.proname,pg_get_function_identity_arguments(f.oid));
    execute format('grant execute on function public.%I(%s) to authenticated',f.proname,pg_get_function_identity_arguments(f.oid));
  end loop;
end;
$wrap$;

-- Additional function replacements below retain lifecycle and aggregate behavior,
-- while replacing company-wide write/read authorization with the new gates.

create or replace function private.guard_document_lifecycle() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare owner_access boolean; lifecycle_change boolean;
begin
  if tg_op='INSERT' then
    if new.status='cancelled' or new.deleted_at is not null or new.deleted_by is not null
      or new.cancelled_at is not null or new.cancelled_by is not null or new.cancellation_reason is not null then
      raise exception 'New documents cannot be deleted or cancelled' using errcode='42501';
    end if;
    return new;
  end if;
  owner_access := private.is_company_owner(old.workspace_id);
  lifecycle_change := (new.deleted_at,new.deleted_by,new.cancelled_at,new.cancelled_by,new.cancellation_reason)
    is distinct from (old.deleted_at,old.deleted_by,old.cancelled_at,old.cancelled_by,old.cancellation_reason)
    or new.status='cancelled';
  if old.status='cancelled' then
    raise exception 'Cancelled documents are immutable' using errcode='42501';
  end if;
  if old.status='submitted' and new.status='draft' then
    raise exception 'Submitted documents cannot return to draft; cancel with a reason' using errcode='42501';
  end if;
  if old.deleted_at is not null and new.deleted_at is not null then
    raise exception 'Documents in trash cannot be edited' using errcode='42501';
  end if;
  if lifecycle_change then
    -- A lifecycle action cannot smuggle content edits into its audit snapshot.
    if (to_jsonb(new)-array['updated_at','deleted_at','deleted_by','cancelled_at','cancelled_by','cancellation_reason','status'])
      is distinct from (to_jsonb(old)-array['updated_at','deleted_at','deleted_by','cancelled_at','cancelled_by','cancellation_reason','status']) then
      raise exception 'Save content separately before changing document state' using errcode='22023';
    end if;
    if auth.uid() is null or not private.project_access(old.workspace_id,old.project_id,true) then
      raise exception 'Document permission required' using errcode='42501';
    end if;
    if old.deleted_at is null and new.deleted_at is not null then
      if old.status<>'draft' or new.status<>'draft' or not(owner_access or old.created_by=auth.uid()) then
        raise exception 'Only owner or draft author can move a draft to trash' using errcode='42501';
      end if;
      new.deleted_at=now(); new.deleted_by=auth.uid();
      new.cancelled_at=null; new.cancelled_by=null; new.cancellation_reason=null;
    elsif old.deleted_at is not null and new.deleted_at is null then
      if not owner_access then raise exception 'Only owner can restore drafts' using errcode='42501'; end if;
      if now() >= old.deleted_at + interval '30 days' then
        raise exception 'The 30-day restore period has expired' using errcode='22023';
      end if;
      if new.status<>old.status then raise exception 'Restore keeps draft status' using errcode='22023'; end if;
      new.deleted_by=null; new.cancelled_at=null; new.cancelled_by=null; new.cancellation_reason=null;
    elsif old.status='submitted' and new.status='cancelled' and new.deleted_at is null then
      if not owner_access then raise exception 'Only owner can cancel submitted documents' using errcode='42501'; end if;
      if new.cancellation_reason is null or char_length(btrim(new.cancellation_reason)) not between 1 and 1000 then
        raise exception 'Cancellation reason is required (1-1000 characters)' using errcode='22023';
      end if;
      new.cancellation_reason=btrim(new.cancellation_reason);
      new.cancelled_at=now(); new.cancelled_by=auth.uid(); new.deleted_by=null;
    else
      raise exception 'Invalid document state transition' using errcode='22023';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.company_photo_storage(target_workspace uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare project_usage jsonb; totals jsonb; quota bigint;
begin
  if auth.uid() is null or not private.is_company_owner(target_workspace) then
    raise exception 'Owner permission required' using errcode='42501';
  end if;
  select q.quota_bytes into quota from private.company_photo_quotas q where q.workspace_id=target_workspace;
  with objects as (
    select o.bucket_id,o.name,o.metadata
    from storage.objects o
    where o.bucket_id in ('site-photos','project-covers')
      and o.name like target_workspace::text || '/%'
  ), classified as (
    select pr.id as project_id,
      case when o.metadata->>'size' ~ '^[0-9]{1,18}$' then (o.metadata->>'size')::bigint
        when o.bucket_id='site-photos' and o.name=p.path then p.byte_size::bigint
        when o.bucket_id='site-photos' and o.name=p.thumbnail_path then p.thumbnail_byte_size::bigint else null end as bytes,
      case when o.bucket_id='site-photos' and o.name=p.path then 'report'
        when o.bucket_id='site-photos' and o.name=p.thumbnail_path then 'thumbnail'
        when o.bucket_id='project-covers' and cp.id is not null then 'cover' else 'other' end as kind,
      r.deleted_at is not null as trashed,r.status='cancelled' as cancelled
    from objects o
    left join public.projects pr on pr.workspace_id=target_workspace and pr.id::text=split_part(o.name,'/',2)
    left join public.photos p on p.workspace_id=target_workspace and o.bucket_id='site-photos' and (p.path=o.name or p.thumbnail_path=o.name)
    left join public.projects cp on cp.workspace_id=target_workspace and o.bucket_id='project-covers' and cp.cover_path=o.name
    left join public.daily_reports r on r.workspace_id=target_workspace and o.bucket_id='site-photos'
      and r.project_id::text=split_part(o.name,'/',2) and r.id::text=split_part(o.name,'/',3)
  ), grouped as (
    select project_id,count(*) as total_files,count(*) filter(where kind='report') as photo_count,
      coalesce(sum(bytes),0) as total_bytes,
      coalesce(sum(bytes) filter(where kind='report'),0) as report_bytes,
      coalesce(sum(bytes) filter(where kind='thumbnail'),0) as thumbnail_bytes,
      coalesce(sum(bytes) filter(where kind='cover'),0) as cover_bytes,
      coalesce(sum(bytes) filter(where kind='other'),0) as other_bytes,
      coalesce(sum(bytes) filter(where trashed),0) as trash_bytes,
      coalesce(sum(bytes) filter(where cancelled),0) as cancelled_bytes,
      count(*) filter(where bytes is null) as unknown_files
    from classified group by project_id
  ), project_rows as (
    select pr.id as project_id,pr.name as project_name,pr.status as project_status,
      coalesce(g.total_files,0) as total_files,coalesce(g.photo_count,0) as photo_count,
      coalesce(g.total_bytes,0) as total_bytes,coalesce(g.report_bytes,0) as report_bytes,
      coalesce(g.thumbnail_bytes,0) as thumbnail_bytes,coalesce(g.cover_bytes,0) as cover_bytes,
      coalesce(g.other_bytes,0) as other_bytes,coalesce(g.trash_bytes,0) as trash_bytes,
      coalesce(g.cancelled_bytes,0) as cancelled_bytes,coalesce(g.unknown_files,0) as unknown_files
    from public.projects pr left join grouped g on g.project_id=pr.id where pr.workspace_id=target_workspace
    union all
    select null,'ไฟล์ที่ไม่ผูกกับโครงการ',null,g.total_files,g.photo_count,g.total_bytes,g.report_bytes,
      g.thumbnail_bytes,g.cover_bytes,g.other_bytes,g.trash_bytes,g.cancelled_bytes,g.unknown_files
    from grouped g where g.project_id is null
  )
  select (select coalesce(jsonb_agg(to_jsonb(pr) order by pr.total_bytes desc,pr.project_name,pr.project_id),'[]'::jsonb) from project_rows pr),
    (select jsonb_build_object('total_bytes',coalesce(sum(g.total_bytes),0),'total_files',coalesce(sum(g.total_files),0),
      'photo_count',coalesce(sum(g.photo_count),0),'report_bytes',coalesce(sum(g.report_bytes),0),
      'thumbnail_bytes',coalesce(sum(g.thumbnail_bytes),0),'cover_bytes',coalesce(sum(g.cover_bytes),0),
      'other_bytes',coalesce(sum(g.other_bytes),0),'trash_bytes',coalesce(sum(g.trash_bytes),0),
      'cancelled_bytes',coalesce(sum(g.cancelled_bytes),0),'unknown_files',coalesce(sum(g.unknown_files),0)) from grouped g)
  into project_usage,totals;
  return jsonb_build_object('workspace_id',target_workspace,'quota_bytes',quota,'warning_percent',80,'critical_percent',95,
    'checked_at',now(),'projects',project_usage,'totals',totals);
end;
$$;

commit;
