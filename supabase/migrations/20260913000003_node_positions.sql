-- ============================================================================
-- 그래프뷰 노드 위치 영구 저장 (2026-09-13 결정)
-- - nodes.position_x / position_y: null 이면 클라이언트가 자동 배치
-- - 위치 이동은 "내용 수정"이 아니므로 updated_at / workspaces.updated_at 갱신 트리거를
--   제목·본문·타입이 바뀐 경우로 제한한다 (임베딩 갱신도 제외됨)
-- ============================================================================

alter table public.nodes
  add column position_x double precision,
  add column position_y double precision;

-- updated_at: 내용이 바뀐 경우에만
drop trigger if exists nodes_set_updated_at on public.nodes;
create trigger nodes_set_updated_at
  before update on public.nodes
  for each row
  when ((old.title, old.content, old.type) is distinct from (new.title, new.content, new.type))
  execute function public.set_updated_at();

-- workspaces.updated_at: insert/delete 는 항상, update 는 내용이 바뀐 경우에만
drop trigger if exists nodes_touch_workspace on public.nodes;
create trigger nodes_touch_workspace_ins_del
  after insert or delete on public.nodes
  for each row execute function public.touch_workspace_updated_at();
create trigger nodes_touch_workspace_upd
  after update on public.nodes
  for each row
  when ((old.title, old.content, old.type) is distinct from (new.title, new.content, new.type))
  execute function public.touch_workspace_updated_at();
