-- ============================================================================
-- Storage: attachments 버킷 (private) + storage.objects RLS 정책
-- 근거: 지식정리앱_설계문서.md 10.2장, CLAUDE.md 절대 규칙 4
--
-- 경로 규칙: {workspace_id}/{node_id}/{file_name}
--   - 클라이언트는 storage_path로 직접 접근 불가 (public = false)
--   - 읽기는 signed URL로만. signed URL 발급(createSignedUrl)도 아래 select 정책을 통과해야 함
--   - 업로드/삭제는 경로의 workspace 소유자이면서 node가 그 workspace에 실제로 속할 때만 허용
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,
  10485760,  -- 10 MiB
  null       -- MIME 제한은 MVP에서 두지 않음. 필요 시 배열로 지정
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- 오브젝트 경로가 규칙에 맞고, 그 workspace의 소유자이며, node가 그 workspace 소속인지 검증
create or replace function public.is_attachment_path_owner(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parts text[];
  v_uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  v_parts := storage.foldername(p_object_name);  -- 파일명을 제외한 폴더 세그먼트 배열

  if v_parts is null or array_length(v_parts, 1) <> 2 then
    return false;
  end if;
  if v_parts[1] !~ v_uuid_re or v_parts[2] !~ v_uuid_re then
    return false;
  end if;

  return exists (
    select 1
    from public.nodes n
    join public.workspaces w on w.id = n.workspace_id
    where n.id = v_parts[2]::uuid
      and w.id = v_parts[1]::uuid
      and w.owner_id = (select auth.uid())
  );
end;
$$;

revoke execute on function public.is_attachment_path_owner(text) from public, anon;
grant  execute on function public.is_attachment_path_owner(text) to authenticated, service_role;

-- storage.objects는 Supabase가 이미 RLS를 켜 둠. 정책만 추가.
create policy "attachments bucket: owner can select"
  on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.is_attachment_path_owner(name));

create policy "attachments bucket: owner can insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.is_attachment_path_owner(name));

create policy "attachments bucket: owner can update"
  on storage.objects for update to authenticated
  using (bucket_id = 'attachments' and public.is_attachment_path_owner(name))
  with check (bucket_id = 'attachments' and public.is_attachment_path_owner(name));

create policy "attachments bucket: owner can delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and public.is_attachment_path_owner(name));
