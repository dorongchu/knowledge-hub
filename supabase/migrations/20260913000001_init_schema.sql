-- ============================================================================
-- 지식정리 웹앱 — 초기 스키마 (Phase 1 / MVP)
-- 근거: 지식정리앱_설계문서.md 6장(데이터 모델), 10.1장(RLS)
-- 규칙: 테이블 생성 직후 그 자리에서 RLS 활성화 + 정책 작성 (CLAUDE.md 절대 규칙 2)
-- MVP RLS 기준: workspaces.owner_id = auth.uid() (Phase 2에서 workspace_members 기준으로 확장)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Extensions
-- ----------------------------------------------------------------------------
create extension if not exists vector with schema extensions;

-- ----------------------------------------------------------------------------
-- 1. Enum 타입
-- ----------------------------------------------------------------------------
create type public.node_type   as enum ('card', 'doc');
create type public.provenance  as enum ('ai', 'manual');
create type public.edge_status as enum ('suggested', 'confirmed', 'rejected');
create type public.member_role as enum ('owner');  -- Phase 2: alter type ... add value 'editor' | 'viewer'

-- ----------------------------------------------------------------------------
-- 2. 공용 헬퍼 함수
-- ----------------------------------------------------------------------------

-- updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 소유권 검증 헬퍼(is_workspace_owner / is_node_owner)는 language sql이라 생성 시점에
-- 참조 테이블이 존재해야 하므로, 각각 workspaces / nodes 테이블 생성 직후에 정의한다.

-- ----------------------------------------------------------------------------
-- 3. workspaces
-- ----------------------------------------------------------------------------
create table public.workspaces (
  id         uuid        primary key default gen_random_uuid(),
  owner_id   uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  name       text        not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()  -- 홈 화면 "최근 수정순" 정렬용 (PRD 4.1)
);

create index workspaces_owner_id_idx on public.workspaces (owner_id);

-- 요청자가 해당 workspace의 소유자인지 확인.
-- security definer: 하위 테이블 정책에서 workspaces RLS를 다시 타지 않도록 함.
-- Phase 2에서 workspace_members 조회를 여기에 추가하면 모든 정책에 일괄 반영됨.
create or replace function public.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = p_workspace_id
      and w.owner_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_workspace_owner(uuid) from public, anon;
grant  execute on function public.is_workspace_owner(uuid) to authenticated, service_role;

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

alter table public.workspaces enable row level security;

create policy "workspaces: owner can select"
  on public.workspaces for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "workspaces: owner can insert"
  on public.workspaces for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "workspaces: owner can update"
  on public.workspaces for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "workspaces: owner can delete"
  on public.workspaces for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- 4. workspace_members  (Phase 2 협업 대비. MVP에서는 owner 행만 존재)
-- ----------------------------------------------------------------------------
create table public.workspace_members (
  workspace_id uuid               not null references public.workspaces(id) on delete cascade,
  user_id      uuid               not null references auth.users(id)        on delete cascade,
  role         public.member_role not null default 'owner',
  created_at   timestamptz        not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_id_idx on public.workspace_members (user_id);

alter table public.workspace_members enable row level security;

-- PRD 10.1: 본인 레코드만 SELECT, INSERT/UPDATE(/DELETE)는 workspace owner만
create policy "workspace_members: user can select own rows"
  on public.workspace_members for select to authenticated
  using (user_id = (select auth.uid()));

create policy "workspace_members: workspace owner can insert"
  on public.workspace_members for insert to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy "workspace_members: workspace owner can update"
  on public.workspace_members for update to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "workspace_members: workspace owner can delete"
  on public.workspace_members for delete to authenticated
  using (public.is_workspace_owner(workspace_id));

-- workspace 생성 시 owner 멤버 행 자동 삽입
create or replace function public.add_workspace_owner_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

create trigger workspaces_add_owner_member
  after insert on public.workspaces
  for each row execute function public.add_workspace_owner_member();

-- ----------------------------------------------------------------------------
-- 5. nodes  (card | doc — 같은 엔티티의 하위 타입, PRD 3장)
-- ----------------------------------------------------------------------------
create table public.nodes (
  id           uuid                     primary key default gen_random_uuid(),
  workspace_id uuid                     not null references public.workspaces(id) on delete cascade,
  type         public.node_type         not null default 'card',
  title        text                     not null default '' check (char_length(title) <= 300),
  content      text                     not null default '',  -- Markdown
  embedding    extensions.vector(1024),                       -- Voyage voyage-3 계열 (1024차원). doc 타입은 요약본을 임베딩
  created_at   timestamptz              not null default now(),
  updated_at   timestamptz              not null default now(),
  -- edges에서 (node_id, workspace_id) 복합 FK로 "같은 workspace 소속"을 강제하기 위한 유니크
  unique (id, workspace_id)
);

create index nodes_workspace_id_idx on public.nodes (workspace_id);
create index nodes_workspace_updated_idx on public.nodes (workspace_id, updated_at desc);
create index nodes_embedding_hnsw_idx on public.nodes
  using hnsw (embedding extensions.vector_cosine_ops);

-- 요청자가 해당 node가 속한 workspace의 소유자인지 확인 (node_tags, attachments 등 2단계 참조용)
create or replace function public.is_node_owner(p_node_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.nodes n
    join public.workspaces w on w.id = n.workspace_id
    where n.id = p_node_id
      and w.owner_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_node_owner(uuid) from public, anon;
grant  execute on function public.is_node_owner(uuid) to authenticated, service_role;

create trigger nodes_set_updated_at
  before update on public.nodes
  for each row execute function public.set_updated_at();

-- 노드 변경 시 상위 workspace.updated_at 갱신 (홈 화면 최근 수정순)
create or replace function public.touch_workspace_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.workspaces
     set updated_at = now()
   where id = coalesce(new.workspace_id, old.workspace_id);
  return null;
end;
$$;

create trigger nodes_touch_workspace
  after insert or update or delete on public.nodes
  for each row execute function public.touch_workspace_updated_at();

alter table public.nodes enable row level security;

create policy "nodes: workspace owner can select"
  on public.nodes for select to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "nodes: workspace owner can insert"
  on public.nodes for insert to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy "nodes: workspace owner can update"
  on public.nodes for update to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "nodes: workspace owner can delete"
  on public.nodes for delete to authenticated
  using (public.is_workspace_owner(workspace_id));

-- ----------------------------------------------------------------------------
-- 6. categories  (워크스페이스별 사전 정의 카테고리, 예: "언어", "난이도")
-- ----------------------------------------------------------------------------
create table public.categories (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references public.workspaces(id) on delete cascade,
  name         text        not null check (char_length(name) between 1 and 50),
  created_at   timestamptz not null default now(),
  unique (workspace_id, name),
  unique (id, workspace_id)  -- tags 복합 FK용
);

create index categories_workspace_id_idx on public.categories (workspace_id);

alter table public.categories enable row level security;

create policy "categories: workspace owner can select"
  on public.categories for select to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "categories: workspace owner can insert"
  on public.categories for insert to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy "categories: workspace owner can update"
  on public.categories for update to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "categories: workspace owner can delete"
  on public.categories for delete to authenticated
  using (public.is_workspace_owner(workspace_id));

-- ----------------------------------------------------------------------------
-- 7. tags  (workspace 스코프. category_id 있으면 카테고리 태그, 없으면 자유 태그)
-- ----------------------------------------------------------------------------
create table public.tags (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        not null references public.workspaces(id) on delete cascade,
  name         text        not null check (char_length(name) between 1 and 50),
  category_id  uuid,
  created_at   timestamptz not null default now(),
  unique (workspace_id, name),
  -- 카테고리는 반드시 같은 workspace 소속이어야 함 (복합 FK)
  foreign key (category_id, workspace_id)
    references public.categories(id, workspace_id) on delete set null (category_id)
);

create index tags_workspace_id_idx on public.tags (workspace_id);
create index tags_category_id_idx  on public.tags (category_id);

alter table public.tags enable row level security;

create policy "tags: workspace owner can select"
  on public.tags for select to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "tags: workspace owner can insert"
  on public.tags for insert to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy "tags: workspace owner can update"
  on public.tags for update to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "tags: workspace owner can delete"
  on public.tags for delete to authenticated
  using (public.is_workspace_owner(workspace_id));

-- ----------------------------------------------------------------------------
-- 8. node_tags  (source: ai | manual)
-- ----------------------------------------------------------------------------
create table public.node_tags (
  node_id    uuid              not null references public.nodes(id) on delete cascade,
  tag_id     uuid              not null references public.tags(id)  on delete cascade,
  source     public.provenance not null default 'manual',
  created_at timestamptz       not null default now(),
  primary key (node_id, tag_id)
);

create index node_tags_tag_id_idx on public.node_tags (tag_id);

-- node와 tag가 같은 workspace 소속인지 검증 (workspace 간 태그 혼입 방지, PRD 6장)
create or replace function public.check_node_tag_same_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_node_ws uuid;
  v_tag_ws  uuid;
begin
  select workspace_id into v_node_ws from public.nodes where id = new.node_id;
  select workspace_id into v_tag_ws  from public.tags  where id = new.tag_id;
  if v_node_ws is null or v_tag_ws is null or v_node_ws <> v_tag_ws then
    raise exception 'node % and tag % must belong to the same workspace', new.node_id, new.tag_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger node_tags_check_same_workspace
  before insert or update on public.node_tags
  for each row execute function public.check_node_tag_same_workspace();

alter table public.node_tags enable row level security;

create policy "node_tags: node owner can select"
  on public.node_tags for select to authenticated
  using (public.is_node_owner(node_id));

create policy "node_tags: node owner can insert"
  on public.node_tags for insert to authenticated
  with check (public.is_node_owner(node_id));

create policy "node_tags: node owner can update"
  on public.node_tags for update to authenticated
  using (public.is_node_owner(node_id))
  with check (public.is_node_owner(node_id));

create policy "node_tags: node owner can delete"
  on public.node_tags for delete to authenticated
  using (public.is_node_owner(node_id));

-- ----------------------------------------------------------------------------
-- 9. edges  (source: ai | manual, status: suggested | confirmed | rejected)
--    AI 제안은 반드시 status = 'suggested'로 저장, 사용자 승인 시 'confirmed' (CLAUDE.md 규칙 5)
-- ----------------------------------------------------------------------------
create table public.edges (
  id             uuid               primary key default gen_random_uuid(),
  workspace_id   uuid               not null references public.workspaces(id) on delete cascade,
  source_node_id uuid               not null,
  target_node_id uuid               not null,
  label          text               check (label is null or char_length(label) <= 100),
  source         public.provenance  not null default 'manual',
  status         public.edge_status not null default 'confirmed',
  created_at     timestamptz        not null default now(),
  updated_at     timestamptz        not null default now(),
  -- 양 끝 노드가 이 edge의 workspace에 속함을 복합 FK로 강제 (MVP: 워크스페이스 간 연결 없음, PRD 3장)
  foreign key (source_node_id, workspace_id) references public.nodes(id, workspace_id) on delete cascade,
  foreign key (target_node_id, workspace_id) references public.nodes(id, workspace_id) on delete cascade,
  check (source_node_id <> target_node_id),
  unique (source_node_id, target_node_id)
);

create index edges_workspace_id_idx     on public.edges (workspace_id);
create index edges_source_node_id_idx   on public.edges (source_node_id);
create index edges_target_node_id_idx   on public.edges (target_node_id);
create index edges_workspace_status_idx on public.edges (workspace_id, status);

create trigger edges_set_updated_at
  before update on public.edges
  for each row execute function public.set_updated_at();

alter table public.edges enable row level security;

create policy "edges: workspace owner can select"
  on public.edges for select to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy "edges: workspace owner can insert"
  on public.edges for insert to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy "edges: workspace owner can update"
  on public.edges for update to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "edges: workspace owner can delete"
  on public.edges for delete to authenticated
  using (public.is_workspace_owner(workspace_id));

-- ----------------------------------------------------------------------------
-- 10. attachments  (Supabase Storage 파일 참조. 버킷/Storage 정책은 다음 마이그레이션)
-- ----------------------------------------------------------------------------
create table public.attachments (
  id           uuid        primary key default gen_random_uuid(),
  node_id      uuid        not null references public.nodes(id) on delete cascade,
  storage_path text        not null unique,  -- 규칙: {workspace_id}/{node_id}/{file_name}
  file_name    text        not null check (char_length(file_name) between 1 and 255),
  mime_type    text        not null,
  created_at   timestamptz not null default now()
);

create index attachments_node_id_idx on public.attachments (node_id);

alter table public.attachments enable row level security;

create policy "attachments: node owner can select"
  on public.attachments for select to authenticated
  using (public.is_node_owner(node_id));

create policy "attachments: node owner can insert"
  on public.attachments for insert to authenticated
  with check (public.is_node_owner(node_id));

create policy "attachments: node owner can update"
  on public.attachments for update to authenticated
  using (public.is_node_owner(node_id))
  with check (public.is_node_owner(node_id));

create policy "attachments: node owner can delete"
  on public.attachments for delete to authenticated
  using (public.is_node_owner(node_id));
