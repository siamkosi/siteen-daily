begin;
alter table public.projects add column cover_path text;
alter table public.projects add constraint project_cover_path_valid check (
  cover_path is null or cover_path ~ ('^' || workspace_id::text || '/' || id::text || '/[0-9a-f-]{36}\.(jpeg|png|webp)$')
);
grant update(cover_path) on public.projects to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('project-covers','project-covers',false,5242880,array['image/jpeg','image/png','image/webp']);

-- Invoker keeps project RLS in effect; malformed paths deny without UUID casts.
create function private.can_access_project_cover(object_name text, write_access boolean default false)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.projects p
    where p.workspace_id::text=split_part(object_name,'/',1)
      and p.id::text=split_part(object_name,'/',2)
      and private.has_access(p.workspace_id,write_access)
      and object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpeg|png|webp)$'
  );
$$;
revoke all on function private.can_access_project_cover(text,boolean) from public,anon;
grant execute on function private.can_access_project_cover(text,boolean) to authenticated;
create policy project_cover_read on storage.objects for select to authenticated
using (bucket_id='project-covers' and private.can_access_project_cover(name));
create policy project_cover_upload on storage.objects for insert to authenticated
with check (bucket_id='project-covers' and private.can_access_project_cover(name,true));
create policy project_cover_delete on storage.objects for delete to authenticated
using (bucket_id='project-covers' and private.can_access_project_cover(name,true));
-- Replacements receive new object names, with no UPDATE/upsert policy.
commit;
