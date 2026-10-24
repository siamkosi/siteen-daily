begin;
-- Shared admission control, not a per-process JavaScript counter.
create table private.pdf_export_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null,
  lease_until timestamptz not null,
  released_at timestamptz
);
create index pdf_export_jobs_user_time_idx on private.pdf_export_jobs(user_id,requested_at);
alter table private.pdf_export_jobs enable row level security;
revoke all on private.pdf_export_jobs from public,anon,authenticated;

create function private.begin_pdf_export()
returns table(allowed boolean,lease_id uuid,retry_after integer,reason text)
language plpgsql security definer set search_path = '' as $$
declare caller uuid:=auth.uid(); stamp timestamptz; new_lease uuid; next_time timestamptz;
begin
  if caller is null or not exists(select 1 from public.memberships m where m.user_id=caller) then
    raise exception 'Company membership required' using errcode='42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('siteen-pdf-export'),1);
  stamp:=pg_catalog.clock_timestamp();
  delete from private.pdf_export_jobs j where j.requested_at<stamp-interval '10 minutes' and j.lease_until<stamp;
  if (select count(*) from private.pdf_export_jobs j where j.user_id=caller and j.requested_at>stamp-interval '60 seconds')>=6 then
    select min(j.requested_at)+interval '60 seconds' into next_time from private.pdf_export_jobs j where j.user_id=caller and j.requested_at>stamp-interval '60 seconds';
    return query select false,null::uuid,greatest(1,ceil(extract(epoch from (next_time-stamp)))::integer),'rate'::text;return;
  end if;
  select min(j.lease_until) into next_time from private.pdf_export_jobs j where j.user_id=caller and j.released_at is null and j.lease_until>stamp;
  if next_time is not null then
    return query select false,null::uuid,greatest(1,ceil(extract(epoch from (next_time-stamp)))::integer),'user_busy'::text;return;
  end if;
  if (select count(*) from private.pdf_export_jobs j where j.released_at is null and j.lease_until>stamp)>=2 then
    select min(j.lease_until) into next_time from private.pdf_export_jobs j where j.released_at is null and j.lease_until>stamp;
    return query select false,null::uuid,greatest(1,ceil(extract(epoch from (next_time-stamp)))::integer),'global_busy'::text;return;
  end if;
  insert into private.pdf_export_jobs(user_id,requested_at,lease_until) values(caller,stamp,stamp+interval '90 seconds') returning id into new_lease;
  return query select true,new_lease,0,'ok'::text;
end;
$$;
revoke all on function private.begin_pdf_export() from public,anon;
grant execute on function private.begin_pdf_export() to authenticated;
create function public.begin_pdf_export()
returns table(allowed boolean,lease_id uuid,retry_after integer,reason text)
language sql security invoker set search_path = '' as $$select * from private.begin_pdf_export();$$;
revoke all on function public.begin_pdf_export() from public,anon;
grant execute on function public.begin_pdf_export() to authenticated;

create function private.finish_pdf_export(target_lease uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
  update private.pdf_export_jobs j set released_at=pg_catalog.clock_timestamp()
    where j.id=target_lease and j.user_id=auth.uid() and j.released_at is null;
end;
$$;
revoke all on function private.finish_pdf_export(uuid) from public,anon;
grant execute on function private.finish_pdf_export(uuid) to authenticated;
create function public.finish_pdf_export(target_lease uuid) returns void
language sql security invoker set search_path = '' as $$select private.finish_pdf_export(target_lease);$$;
revoke all on function public.finish_pdf_export(uuid) from public,anon;
grant execute on function public.finish_pdf_export(uuid) to authenticated;
commit;
