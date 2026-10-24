-- Monotonic, server-owned versions; expected_version is an UPDATE-only input.
-- A BEFORE trigger clears that input so it never persists in rows or audit data.
alter table public.daily_reports
  add column row_version integer not null default 1 check (row_version > 0),
  add column expected_version integer check (expected_version is null);
alter table public.daily_requests
  add column row_version integer not null default 1 check (row_version > 0),
  add column expected_version integer check (expected_version is null);

create function private.guard_document_version() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare lifecycle_change boolean;
begin
  if tg_op = 'INSERT' then
    if new.row_version <> 1 or new.expected_version is not null then
      raise exception 'New documents must start at version 1' using errcode = '22023';
    end if;
    return new;
  end if;
  if new.row_version is distinct from old.row_version then
    raise exception 'Document version is server managed' using errcode = '22023';
  end if;

  -- Runs AFTER zz_*_lifecycle: that guard already validates authorization,
  -- state transitions and forbids any content edits in the same operation.
  -- change_document_state separately checks the opened updated_at atomically.
  lifecycle_change := new.deleted_at is distinct from old.deleted_at
    or new.cancelled_at is distinct from old.cancelled_at;
  if not lifecycle_change and current_user not in ('postgres','supabase_admin','service_role')
    and new.expected_version is distinct from old.row_version then
    raise exception 'Document changed since it was opened' using errcode = '40001';
  end if;
  new.row_version := old.row_version + 1;
  new.expected_version := null;
  return new;
end;
$$;
revoke all on function private.guard_document_version() from public,anon,authenticated;
create trigger zzzz_report_concurrency before insert or update on public.daily_reports
  for each row execute function private.guard_document_version();
create trigger zzzz_request_concurrency before insert or update on public.daily_requests
  for each row execute function private.guard_document_version();
