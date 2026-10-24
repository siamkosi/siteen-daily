-- SITE DAILY TH. Apply only to an isolated development Supabase project.
begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 150),
  created_at timestamptz not null default now()
);
create table public.memberships (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  primary key (workspace_id,user_id)
);
create index memberships_user_idx on public.memberships(user_id,workspace_id);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  location text not null default '' check (char_length(location)<=300),
  client text not null default '' check (char_length(client)<=200),
  status text not null default 'active' check (status in ('active','completed')),
  created_at timestamptz not null default now(),
  unique(workspace_id,id)
);
create table public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  report_date date not null check(report_date <= (now() at time zone 'Asia/Bangkok')::date),
  weather text not null check(weather in ('แดดออก','มีเมฆมาก','ฝนตก','ฝนตกหนัก / หยุดงาน')),
  workers integer not null default 0 check(workers between 0 and 10000),
  work_done text not null check(char_length(btrim(work_done)) between 1 and 10000),
  materials text not null default '' check(char_length(materials)<=10000),
  equipment text not null default '' check(char_length(equipment)<=10000),
  issues text not null default '' check(char_length(issues)<=10000),
  tomorrow text not null default '' check(char_length(tomorrow)<=10000),
  status text not null default 'draft' check(status in ('draft','submitted')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(workspace_id,project_id) references public.projects(workspace_id,id),
  unique(project_id,report_date),
  unique(workspace_id,project_id,id)
);
create index projects_workspace_idx on public.projects(workspace_id);
create index reports_workspace_date_idx on public.daily_reports(workspace_id,report_date desc);
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  report_id uuid not null,
  path text not null unique,
  caption text not null default '' check(char_length(caption)<=500),
  created_at timestamptz not null default now(),
  foreign key(workspace_id,project_id,report_id) references public.daily_reports(workspace_id,project_id,id),
  check(path ~ ('^' || workspace_id::text || '/' || project_id::text || '/' || report_id::text || '/' || id::text || '\.(jpeg|png|webp)$'))
);
create index photos_report_idx on public.photos(workspace_id,project_id,report_id);

-- Internal lookup deliberately bypasses membership RLS to avoid recursive policies.
-- Identity always comes from auth.uid(), never user-supplied metadata.
create function private.has_access(target uuid, write_access boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.memberships m where m.workspace_id=target and m.user_id=auth.uid()
    and (not write_access or m.role in ('owner','editor'))
  );
$$;
revoke all on function private.has_access(uuid,boolean) from public, anon;
grant execute on function private.has_access(uuid,boolean) to authenticated;

create function private.bootstrap_workspace(workspace_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if char_length(btrim(workspace_name)) not between 1 and 150 then raise exception 'Invalid workspace name'; end if;
  insert into public.workspaces(name) values(btrim(workspace_name)) returning id into new_id;
  insert into public.memberships(workspace_id,user_id,role) values(new_id,auth.uid(),'owner');
  return new_id;
end;
$$;
revoke all on function private.bootstrap_workspace(text) from public, anon;
grant execute on function private.bootstrap_workspace(text) to authenticated;
-- Minimal exposed RPC wrapper. No arbitrary membership or role mutation endpoint.
create function public.create_workspace(workspace_name text)
returns uuid language sql security invoker set search_path = '' as $$
  select private.bootstrap_workspace(workspace_name);
$$;
revoke all on function public.create_workspace(text) from public, anon;
grant execute on function public.create_workspace(text) to authenticated;

create function private.guard_report_update() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if (new.id,new.workspace_id,new.project_id,new.created_by,new.created_at)
     is distinct from (old.id,old.workspace_id,old.project_id,old.created_by,old.created_at)
  then raise exception 'Report identity and author are immutable'; end if;
  new.updated_at=now(); return new;
end;
$$;
revoke all on function private.guard_report_update() from public, anon;
create trigger report_update before update on public.daily_reports for each row execute function private.guard_report_update();

alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.projects enable row level security;
alter table public.daily_reports enable row level security;
alter table public.photos enable row level security;
revoke all on public.workspaces,public.memberships,public.projects,public.daily_reports,public.photos from anon,authenticated;
grant select on public.workspaces,public.memberships to authenticated;
grant select,insert,update on public.projects,public.daily_reports to authenticated;
grant select,insert,delete on public.photos to authenticated;
create policy workspace_read on public.workspaces for select to authenticated using (private.has_access(id));
create policy membership_read on public.memberships for select to authenticated using (user_id=(select auth.uid()));
create policy project_read on public.projects for select to authenticated using (private.has_access(workspace_id));
create policy project_insert on public.projects for insert to authenticated with check (private.has_access(workspace_id,true));
create policy project_update on public.projects for update to authenticated using (private.has_access(workspace_id,true)) with check (private.has_access(workspace_id,true));
-- Column grants prevent changing project tenant/id even for multi-company editors.
revoke update on public.projects from authenticated;
grant update(name,location,client,status) on public.projects to authenticated;
create policy report_read on public.daily_reports for select to authenticated using (private.has_access(workspace_id));
create policy report_insert on public.daily_reports for insert to authenticated with check (private.has_access(workspace_id,true) and created_by=(select auth.uid()));
create policy report_update on public.daily_reports for update to authenticated using (private.has_access(workspace_id,true)) with check (private.has_access(workspace_id,true));
create policy photo_read on public.photos for select to authenticated using (private.has_access(workspace_id));
create policy photo_insert on public.photos for insert to authenticated with check (private.has_access(workspace_id,true));
create policy photo_delete on public.photos for delete to authenticated using (private.has_access(workspace_id,true));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('site-photos','site-photos',false,5242880,array['image/jpeg','image/png','image/webp']);
-- Require an existing report and exact workspace/project/report/file identity.
-- Compare UUIDs as text to make malformed paths deny access without cast errors.
create function private.can_access_photo(object_name text, write_access boolean default false)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.daily_reports r
    where r.workspace_id::text=split_part(object_name,'/',1)
      and r.project_id::text=split_part(object_name,'/',2)
      and r.id::text=split_part(object_name,'/',3)
      and private.has_access(r.workspace_id,write_access)
      and object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpeg|png|webp)$'
  );
$$;
revoke all on function private.can_access_photo(text,boolean) from public,anon;
grant execute on function private.can_access_photo(text,boolean) to authenticated;
create policy site_photo_read on storage.objects for select to authenticated using (bucket_id='site-photos' and private.can_access_photo(name));
create policy site_photo_upload on storage.objects for insert to authenticated with check (bucket_id='site-photos' and private.can_access_photo(name,true));
create policy site_photo_delete on storage.objects for delete to authenticated using (bucket_id='site-photos' and private.can_access_photo(name,true));
-- No UPDATE: immutable object names, no upsert/replacement or cross-tenant move.
commit;
