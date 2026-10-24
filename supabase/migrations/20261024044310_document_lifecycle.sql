begin;

-- Recoverable drafts and immutable cancellation records. No physical DELETE API.
alter table public.daily_reports
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users(id),
  add column cancelled_at timestamptz,
  add column cancelled_by uuid references auth.users(id),
  add column cancellation_reason text;
alter table public.daily_requests
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users(id),
  add column cancelled_at timestamptz,
  add column cancelled_by uuid references auth.users(id),
  add column cancellation_reason text;
alter table public.daily_reports drop constraint daily_reports_status_check;
alter table public.daily_requests drop constraint daily_requests_status_check;
alter table public.daily_reports add constraint report_status_check check(status in ('draft','submitted','cancelled'));
alter table public.daily_requests add constraint request_status_check check(status in ('draft','submitted','cancelled'));
alter table public.daily_reports drop constraint daily_reports_project_id_report_date_key;
alter table public.daily_requests drop constraint daily_requests_project_id_report_date_key;
create unique index reports_active_date_key on public.daily_reports(project_id,report_date) where deleted_at is null and status <> 'cancelled';
create unique index requests_active_date_key on public.daily_requests(project_id,report_date) where deleted_at is null and status <> 'cancelled';

create function private.is_company_owner(target uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from public.memberships where workspace_id=target and user_id=(select auth.uid()) and role='owner');
$$;
revoke all on function private.is_company_owner(uuid) from public,anon;
grant execute on function private.is_company_owner(uuid) to authenticated;

create function private.guard_document_lifecycle() returns trigger
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
    if auth.uid() is null or not private.has_access(old.workspace_id,true) then
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
revoke all on function private.guard_document_lifecycle() from public,anon,authenticated;
create trigger zz_report_lifecycle before insert or update on public.daily_reports for each row execute function private.guard_document_lifecycle();
create trigger zz_request_lifecycle before insert or update on public.daily_requests for each row execute function private.guard_document_lifecycle();

create table public.document_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  document_kind text not null check(document_kind in ('report','request')),
  document_id uuid not null,
  action text not null check(action in ('created','edited','submitted','trashed','restored','cancelled')),
  actor_id uuid references auth.users(id),
  occurred_at timestamptz not null default now(),
  reason text,
  before_data jsonb,
  after_data jsonb not null,
  photos jsonb not null default '[]'::jsonb
);
create index document_events_lookup_idx on public.document_events(workspace_id,document_kind,document_id,occurred_at desc,id);
alter table public.document_events enable row level security;
revoke all on public.document_events from public,anon,authenticated;
grant select on public.document_events to authenticated;
create policy document_events_read on public.document_events for select to authenticated using (
  private.has_access(workspace_id) and (
    (document_kind='report' and exists(select 1 from public.daily_reports r where r.id=document_id and r.workspace_id=document_events.workspace_id))
    or (document_kind='request' and exists(select 1 from public.daily_requests r where r.id=document_id and r.workspace_id=document_events.workspace_id))
  )
);
-- Definer is limited to appending trusted trigger snapshots; it is not an RPC.
create function private.audit_document_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare event_action text; previous jsonb; attached jsonb := '[]'::jsonb;
begin
  if tg_op='INSERT' then event_action='created';
  else
    if (to_jsonb(new)-'updated_at') is not distinct from (to_jsonb(old)-'updated_at') then return new; end if;
    previous=to_jsonb(old);
    event_action=case when new.deleted_at is not null and old.deleted_at is null then 'trashed'
      when new.deleted_at is null and old.deleted_at is not null then 'restored'
      when new.status='cancelled' then 'cancelled'
      when new.status='submitted' and old.status='draft' then 'submitted' else 'edited' end;
  end if;
  if tg_table_name='daily_reports' then
    select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at,p.id),'[]'::jsonb) into attached
      from public.photos p where p.report_id=new.id and p.workspace_id=new.workspace_id;
  end if;
  insert into public.document_events(workspace_id,document_kind,document_id,action,actor_id,reason,before_data,after_data,photos)
    values(new.workspace_id,case when tg_table_name='daily_reports' then 'report' else 'request' end,
      new.id,event_action,auth.uid(),new.cancellation_reason,previous,to_jsonb(new),attached);
  return new;
end;
$$;
revoke all on function private.audit_document_change() from public,anon,authenticated;
create trigger audit_report after insert or update on public.daily_reports for each row execute function private.audit_document_change();
create trigger audit_request after insert or update on public.daily_requests for each row execute function private.audit_document_change();

alter policy report_read on public.daily_reports using(private.has_access(workspace_id) and (deleted_at is null or private.is_company_owner(workspace_id) or (private.has_access(workspace_id,true) and created_by=(select auth.uid()))));
alter policy request_read on public.daily_requests using(private.has_access(workspace_id) and (deleted_at is null or private.is_company_owner(workspace_id) or (private.has_access(workspace_id,true) and created_by=(select auth.uid()))));

-- Preserve attachments in trash/cancellation, including against direct API calls.
create or replace function private.can_access_photo(object_name text, write_access boolean default false)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from public.daily_reports r
    where r.workspace_id::text=split_part(object_name,'/',1) and r.project_id::text=split_part(object_name,'/',2)
      and r.id::text=split_part(object_name,'/',3) and private.has_access(r.workspace_id,write_access)
      and (not write_access or (r.deleted_at is null and r.status<>'cancelled'))
      and object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpeg|png|webp)$');
$$;
alter policy photo_read on public.photos using(private.has_access(workspace_id) and exists(select 1 from public.daily_reports r where r.id=report_id and r.workspace_id=photos.workspace_id));
alter policy photo_insert on public.photos with check(private.has_access(workspace_id,true) and private.can_access_photo(path,true));
alter policy photo_delete on public.photos using(private.has_access(workspace_id,true) and private.can_access_photo(path,true));

-- Atomic, tenant-scoped, optimistic action. Trigger owns clock/actor and permission checks.
create function public.change_document_state(target_workspace uuid,document_kind text,target_document uuid,
  action text,expected_updated_at timestamptz,reason text default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare target_table text; changed uuid;
begin
  if document_kind not in ('report','request') or action not in ('trash','restore','cancel') or expected_updated_at is null then
    raise exception 'Invalid document action' using errcode='22023';
  end if;
  target_table=case when document_kind='report' then 'daily_reports' else 'daily_requests' end;
  execute format('update public.%I set deleted_at=case when $1=''trash'' then now() when $1=''restore'' then null else deleted_at end,
    status=case when $1=''cancel'' then ''cancelled'' else status end,
    cancellation_reason=case when $1=''cancel'' then $2 else cancellation_reason end
    where id=$3 and workspace_id=$4 and updated_at=$5
      and (($1=''trash'' and deleted_at is null and status=''draft'')
        or ($1=''restore'' and deleted_at is not null)
        or ($1=''cancel'' and deleted_at is null and status=''submitted'')) returning id',target_table)
    into changed using action,reason,target_document,target_workspace,expected_updated_at;
  if changed is null then raise exception 'Document changed or access denied; reload before retrying' using errcode='40001'; end if;
end;
$$;
revoke all on function public.change_document_state(uuid,text,uuid,text,timestamptz,text) from public,anon;
grant execute on function public.change_document_state(uuid,text,uuid,text,timestamptz,text) to authenticated;
commit;
