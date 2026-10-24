begin;
create or replace function private.derive_report_workers() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not private.valid_report_details(new.report_details) then raise exception 'Invalid structured report data'; end if;
  if new.report_details->'version'='1'::jsonb and jsonb_array_length(new.report_details->'labor')>0 then
    select coalesce(sum((item->>'count')::integer),0) into new.workers
    from jsonb_array_elements(new.report_details->'labor') item
    where item->>'group' in ('daily','subcontract');
  end if;
  return new;
end; $$;
-- Backfill derived totals only when they differ; keep unstructured legacy totals intact.
update public.daily_reports r
set workers=(select coalesce(sum((x->>'count')::integer),0)
             from jsonb_array_elements(r.report_details->'labor') x
             where x->>'group' in ('daily','subcontract'))
where r.report_details->'version'='1'::jsonb
  and jsonb_array_length(r.report_details->'labor')>0
  and r.workers is distinct from
    (select coalesce(sum((x->>'count')::integer),0)
     from jsonb_array_elements(r.report_details->'labor') x
     where x->>'group' in ('daily','subcontract'));
commit;
