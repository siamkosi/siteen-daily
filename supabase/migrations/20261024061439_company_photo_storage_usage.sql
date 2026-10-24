begin;
create table private.company_photo_quotas (
  workspace_id uuid primary key references public.workspaces(id),
  quota_bytes bigint check(quota_bytes between 1000000 and 1000000000000000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table private.company_photo_quotas enable row level security;
revoke all on private.company_photo_quotas from public,anon,authenticated;

-- Aggregate only the requested member company. Definer access is necessary to
-- include retained files hidden by per-document trash RLS and legacy byte sizes.
-- Storage is READ ONLY here; no object paths/metadata leave this function.
create function private.company_photo_storage(target_workspace uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare project_usage jsonb; totals jsonb; quota bigint;
begin
  if auth.uid() is null or not private.has_access(target_workspace) then
    raise exception 'Company membership required' using errcode='42501';
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
revoke all on function private.company_photo_storage(uuid) from public,anon;
grant execute on function private.company_photo_storage(uuid) to authenticated;
create function public.company_photo_storage(target_workspace uuid) returns jsonb
language sql security invoker set search_path = '' as $$select private.company_photo_storage(target_workspace);$$;
revoke all on function public.company_photo_storage(uuid) from public,anon;
grant execute on function public.company_photo_storage(uuid) to authenticated;

create function private.set_company_photo_quota(target_workspace uuid,new_quota_bytes bigint,expected_quota_bytes bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare current_quota bigint;
begin
  perform 1 from public.memberships m where m.workspace_id=target_workspace and m.user_id=auth.uid() and m.role='owner' for share;
  if auth.uid() is null or not found then raise exception 'Owner permission required' using errcode='42501'; end if;
  if new_quota_bytes is not null and new_quota_bytes not between 1000000 and 1000000000000000 then
    raise exception 'Quota must be between 1 MB and 1 PB' using errcode='22023';
  end if;
  insert into private.company_photo_quotas(workspace_id) values(target_workspace) on conflict do nothing;
  select q.quota_bytes into current_quota from private.company_photo_quotas q where q.workspace_id=target_workspace for update;
  if current_quota is distinct from expected_quota_bytes then raise exception 'Quota changed; reload before saving' using errcode='40001'; end if;
  update private.company_photo_quotas set quota_bytes=new_quota_bytes,updated_at=now(),updated_by=auth.uid() where workspace_id=target_workspace;
end;
$$;
revoke all on function private.set_company_photo_quota(uuid,bigint,bigint) from public,anon;
grant execute on function private.set_company_photo_quota(uuid,bigint,bigint) to authenticated;
create function public.set_company_photo_quota(target_workspace uuid,new_quota_bytes bigint,expected_quota_bytes bigint)
returns void language sql security invoker set search_path = '' as $$select private.set_company_photo_quota(target_workspace,new_quota_bytes,expected_quota_bytes);$$;
revoke all on function public.set_company_photo_quota(uuid,bigint,bigint) from public,anon;
grant execute on function public.set_company_photo_quota(uuid,bigint,bigint) to authenticated;
commit;
