begin;
alter table public.photos
  add column thumbnail_path text unique,
  add column image_width integer,
  add column image_height integer,
  add column byte_size integer,
  add column thumbnail_byte_size integer,
  add column source_byte_size integer,
  add constraint photo_variant_metadata check (
    (thumbnail_path is null and image_width is null and image_height is null and byte_size is null and thumbnail_byte_size is null and source_byte_size is null)
    or (thumbnail_path = workspace_id::text || '/' || project_id::text || '/' || report_id::text || '/' || id::text || '.thumb.jpeg'
      and thumbnail_path is not null and image_width between 1 and 2560 and image_width is not null
      and image_height between 1 and 2560 and image_height is not null
      and byte_size between 1 and 5242880 and byte_size is not null
      and thumbnail_byte_size between 1 and 5242880 and thumbnail_byte_size is not null
      and source_byte_size between 1 and 20971520 and source_byte_size is not null)
  );
create index photos_workspace_created_idx on public.photos(workspace_id,created_at desc,id desc);
create index photos_project_created_idx on public.photos(workspace_id,project_id,created_at desc,id desc);

-- Thumbnails inherit exactly the same report/tenant/lifecycle policy as print images.
create or replace function private.can_access_photo(object_name text, write_access boolean default false)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from public.daily_reports r
    where r.workspace_id::text=split_part(object_name,'/',1) and r.project_id::text=split_part(object_name,'/',2)
      and r.id::text=split_part(object_name,'/',3) and private.has_access(r.workspace_id,write_access)
      and (not write_access or (r.deleted_at is null and r.status<>'cancelled'))
      and object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}(\.(jpeg|png|webp)|\.thumb\.jpeg)$');
$$;
commit;
