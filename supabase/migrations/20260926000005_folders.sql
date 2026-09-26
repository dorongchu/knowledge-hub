-- ============================================================================
-- 폴더 (PRD 12장, v0.4): 워크스페이스 안의 선택적 1단계 노드 묶음
-- - 노드는 폴더 하나에 속하거나(folder_id) 어디에도 속하지 않는다(null)
-- - 폴더 삭제 시 노드는 삭제되지 않고 folder_id 만 null 이 된다
-- - 폴더 이동은 "내용 수정"이 아니므로 nodes.updated_at 갱신 조건에 포함하지 않는다 (0003 의 트리거 조건 그대로)
-- ============================================================================

create table public.folders (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references public.workspaces(id) on delete cascade,
  name         text        not null check (char_length(name) between 1 and 100),
  sort_order   integer     not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, name),
  unique (id, workspace_id)  -- nodes 복합 FK 용
);

create index folders_workspace_order_idx on public.folders (workspace_id, sort_order, name);

create trigger folders_set_updated_at
  before update on public.folders
  for each row execute function public.set_updated_at();

alter table public.folders enable row level security;

create policy "folders: workspace owner can select"
  on public.folders for select to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "folders: workspace owner can insert"
  on public.folders for insert to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy "folders: workspace owner can update"
  on public.folders for update to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "folders: workspace owner can delete"
  on public.folders for delete to authenticated
  using (public.is_workspace_owner(workspace_id));

-- 노드 → 폴더. 같은 workspace 의 폴더만 지정 가능 (복합 FK). 폴더 삭제 시 folder_id 만 null.
alter table public.nodes
  add column folder_id uuid,
  add constraint nodes_folder_fkey
    foreign key (folder_id, workspace_id) references public.folders(id, workspace_id)
    on delete set null (folder_id);

create index nodes_folder_id_idx on public.nodes (folder_id);
