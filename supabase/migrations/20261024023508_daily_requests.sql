begin;
create table public.daily_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  project_id uuid not null,
  -- Same date key as Daily Report: date of planned work, including future days.
  report_date date not null,
  weather text not null default 'ยังไม่บันทึก' check(weather='ยังไม่บันทึก'),
  workers integer not null default 0 check(workers between 0 and 10000),
  work_done text not null check(char_length(btrim(work_done)) between 1 and 10000),
  materials text not null default '' check(char_length(materials)<=10000),
  equipment text not null default '' check(char_length(equipment)<=10000),
  issues text not null default '' check(char_length(issues)<=10000),
  tomorrow text not null default '' check(char_length(tomorrow)<=10000),
  status text not null default 'draft' check(status in ('draft','submitted')),
  report_details jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(workspace_id,project_id) references public.projects(workspace_id,id),
  unique(project_id,report_date),
  check(private.valid_report_details(report_details)),
  check(private.valid_material_rows(report_details))
);
create index requests_workspace_date_idx on public.daily_requests(workspace_id,report_date desc);
create trigger request_identity before update on public.daily_requests
  for each row execute function private.guard_report_update();
create trigger derive_request_workers before insert or update on public.daily_requests
  for each row execute function private.derive_report_workers();
alter table public.daily_requests enable row level security;
revoke all on public.daily_requests from public,anon,authenticated;
grant select,insert,update on public.daily_requests to authenticated;
create policy request_read on public.daily_requests for select to authenticated
  using(private.has_access(workspace_id));
create policy request_insert on public.daily_requests for insert to authenticated
  with check(private.has_access(workspace_id,true) and created_by=(select auth.uid()));
create policy request_update on public.daily_requests for update to authenticated
  using(private.has_access(workspace_id,true)) with check(private.has_access(workspace_id,true));
commit;
