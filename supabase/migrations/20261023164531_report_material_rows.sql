begin;
create function private.valid_material_rows(d jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare item jsonb;
begin
  if not (d ? 'material_rows') then return true; end if;
  if jsonb_typeof(d->'material_rows') is distinct from 'array' then return false; end if;
  if jsonb_array_length(d->'material_rows')>40 then return false; end if;
  for item in select value from jsonb_array_elements(d->'material_rows') loop
    if jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'label') is distinct from 'string' or char_length(btrim(item->>'label')) not between 1 and 200
      or coalesce(item->>'kind','') not in ('used','received') or jsonb_typeof(item->'unit') is distinct from 'string' or char_length(btrim(item->>'unit')) not between 1 and 30
      or jsonb_typeof(item->'notes') is distinct from 'string' or char_length(item->>'notes')>300 then return false; end if;
    if item->'quantity' is distinct from 'null'::jsonb then
      if jsonb_typeof(item->'quantity') is distinct from 'number' then return false; end if;
      if (item->>'quantity')::numeric not between 0 and 1000000000 then return false; end if;
    end if;
  end loop;
  return true;
end; $$;
revoke all on function private.valid_material_rows(jsonb) from public,anon;
grant execute on function private.valid_material_rows(jsonb) to authenticated;
alter table public.daily_reports add constraint valid_report_material_rows check(private.valid_material_rows(report_details));
commit;
