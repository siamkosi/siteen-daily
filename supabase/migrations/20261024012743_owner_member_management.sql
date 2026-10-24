begin;

-- Emails are available only through an owner-scoped RPC, never a public view.
create function private.company_members(target_workspace uuid)
returns table(user_id uuid, email text, role text)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.memberships m
    where m.workspace_id=target_workspace and m.user_id=auth.uid() and m.role='owner'
  ) then raise exception 'Owner permission required' using errcode='42501'; end if;
  return query select m.user_id,u.email::text,m.role
    from public.memberships m join auth.users u on u.id=m.user_id
    where m.workspace_id=target_workspace
    order by (m.role='owner') desc,u.email;
end;
$$;
revoke all on function private.company_members(uuid) from public,anon;
grant execute on function private.company_members(uuid) to authenticated;

create function public.list_company_members(target_workspace uuid)
returns table(user_id uuid,email text,role text)
language sql security invoker set search_path = '' as $$
  select * from private.company_members(target_workspace);
$$;
revoke all on function public.list_company_members(uuid) from public,anon;
grant execute on function public.list_company_members(uuid) to authenticated;

create function private.change_company_member_role(
  target_workspace uuid,target_user uuid,new_role text,expected_role text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Lock the caller's ownership until the transaction completes.
  perform 1 from public.memberships m
    where m.workspace_id=target_workspace and m.user_id=auth.uid() and m.role='owner'
    for share;
  if auth.uid() is null or not found then
    raise exception 'Owner permission required' using errcode='42501';
  end if;
  if new_role is null or new_role not in ('editor','viewer')
    or expected_role is null or expected_role not in ('editor','viewer') then
    raise exception 'Only editor and viewer roles can be changed' using errcode='22023';
  end if;
  if target_user=auth.uid() then
    raise exception 'Cannot change your own role' using errcode='42501';
  end if;
  update public.memberships m set role=new_role
    where m.workspace_id=target_workspace and m.user_id=target_user
      and m.role=expected_role and m.role in ('editor','viewer');
  if not found then
    raise exception 'Member changed or cannot be edited; reload the list' using errcode='40001';
  end if;
end;
$$;
revoke all on function private.change_company_member_role(uuid,uuid,text,text) from public,anon;
grant execute on function private.change_company_member_role(uuid,uuid,text,text) to authenticated;

create function public.set_company_member_role(
  target_workspace uuid,target_user uuid,new_role text,expected_role text
) returns void language sql security invoker set search_path = '' as $$
  select private.change_company_member_role(target_workspace,target_user,new_role,expected_role);
$$;
revoke all on function public.set_company_member_role(uuid,uuid,text,text) from public,anon;
grant execute on function public.set_company_member_role(uuid,uuid,text,text) to authenticated;

-- No direct membership INSERT/UPDATE/DELETE grants and no invitations.
commit;
