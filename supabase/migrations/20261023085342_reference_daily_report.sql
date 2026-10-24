begin;
-- Additive change: old reports keep their text and remain readable.
alter table public.daily_reports add column report_details jsonb not null default '{}'::jsonb;
create function private.valid_report_details(d jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare item jsonb; entry record; total numeric:=0;
begin
  if jsonb_typeof(d) is distinct from 'object' or octet_length(d::text)>131072 then return false; end if;
  if d='{}'::jsonb then return true; end if;
  if d->'version' is distinct from '1'::jsonb or jsonb_typeof(d->'meta') is distinct from 'object'
    or jsonb_typeof(d->'labor') is distinct from 'array' or jsonb_typeof(d->'equipment') is distinct from 'array'
    or jsonb_typeof(d->'progress') is distinct from 'array' then return false; end if;
  if jsonb_array_length(d->'labor')>50 or jsonb_array_length(d->'equipment')>40 or jsonb_array_length(d->'progress')>60 then return false; end if;
  for entry in select * from jsonb_each(d->'meta') loop
    if jsonb_typeof(entry.value) is distinct from 'string' or char_length(entry.value #>> '{}') > (case when entry.key in ('solution','notes') then 10000 else 300 end) then return false; end if;
  end loop;
  for item in select value from jsonb_array_elements((d->'labor')||(d->'equipment')) loop
    if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'label') is distinct from 'string'
      or char_length(btrim(item->>'label')) not between 1 and 200
      or jsonb_typeof(item->'count') is distinct from 'number' or jsonb_typeof(item->'hours') is distinct from 'number' then return false; end if;
    if (item->>'count')::numeric not between 0 and 10000 or (item->>'count')::numeric<>trunc((item->>'count')::numeric)
      or (item->>'hours')::numeric not between 0 and 24 then return false; end if;
  end loop;
  for item in select value from jsonb_array_elements(d->'labor') loop
    if coalesce(item->>'group','') not in ('staff','daily','subcontract') then return false; end if;
    total:=total+(item->>'count')::numeric;
  end loop;
  if total>10000 then return false; end if;
  for item in select value from jsonb_array_elements(d->'equipment') loop
    if coalesce(item->>'kind','') not in ('machine','tool') then return false; end if;
  end loop;
  for item in select value from jsonb_array_elements(d->'progress') loop
    if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'description') is distinct from 'string'
      or char_length(btrim(item->>'description')) not between 1 and 1000 or jsonb_typeof(item->'time') is distinct from 'string'
      or char_length(item->>'time')>50 or jsonb_typeof(item->'unit') is distinct from 'string' or char_length(item->>'unit')>30 then return false; end if;
    if item->'quantity' is distinct from 'null'::jsonb then
      if jsonb_typeof(item->'quantity') is distinct from 'number' then return false; end if;
      if (item->>'quantity')::numeric not between 0 and 1000000000 then return false; end if;
    end if;
  end loop;
  return true;
end; $$;
revoke all on function private.valid_report_details(jsonb) from public,anon;
grant execute on function private.valid_report_details(jsonb) to authenticated;
alter table public.daily_reports add constraint valid_daily_report_details check (private.valid_report_details(report_details));

create function private.derive_report_workers() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if not private.valid_report_details(new.report_details) then raise exception 'Invalid structured report data'; end if;
  if new.report_details->'version'='1'::jsonb and jsonb_array_length(new.report_details->'labor')>0 then
    select coalesce(sum((item->>'count')::integer),0) into new.workers from jsonb_array_elements(new.report_details->'labor') item;
  end if;
  return new;
end; $$;
revoke all on function private.derive_report_workers() from public,anon;
create trigger derive_report_workers before insert or update on public.daily_reports for each row execute function private.derive_report_workers();
commit;
