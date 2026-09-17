import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useOutletContext, useParams } from 'react-router'
import { cn } from '@/lib/utils'
import { useNodes, type NodesApi } from '@/features/node/useNodes'
import { useTags, type TagsApi } from '@/features/tag/useTags'
import { useTagFilter, type TagFilterApi } from '@/features/tag/useTagFilter'
import { useEdges, type EdgesApi } from '@/features/edge/useEdges'
import { getWorkspace, type Workspace } from './api'
import { toMessage } from './useWorkspaces'

/** 하위 라우트(그래프뷰/문서뷰)에서 `useWorkspaceContext()` 로 현재 워크스페이스, 노드 목록, 태그 체계에 접근 */
export interface WorkspaceOutletContext {
  /** URL 의 워크스페이스 id. 항상 있다 */
  workspaceId: string
  /** 워크스페이스 행. 조회가 끝나기 전에는 null (하위 뷰는 데이터 조회를 기다리지 않고 먼저 마운트된다) */
  workspace: Workspace | null
  nodes: NodesApi
  tags: TagsApi
  edges: EdgesApi
  /** 태그 필터 상태 (PRD 4.5). 탭을 오가도 유지되도록 여기 둔다 */
  tagFilter: TagFilterApi
}

export function useWorkspaceContext() {
  return useOutletContext<WorkspaceOutletContext>()
}

type Loaded = { status: 'ready'; workspace: Workspace } | { status: 'missing' } | { status: 'error'; message: string }
type LoadState = { status: 'loading' } | Loaded

/**
 * 워크스페이스 상세 (PRD 4.2). 그래프뷰 ↔ 문서뷰를 탭으로 전환.
 * 탭 상태는 URL(/w/:workspaceId/graph | /doc)에 두어 새로고침·공유 시 유지된다.
 */
export function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  // 결과를 "어떤 id에 대한 결과인지"와 함께 저장하고, id가 바뀌면 렌더 중에 loading 으로 파생시킨다
  const [loaded, setLoaded] = useState<{ id: string; result: Loaded } | null>(null)
  const state: LoadState = loaded && loaded.id === workspaceId ? loaded.result : { status: 'loading' }

  useEffect(() => {
    if (!workspaceId) return
    let cancelled = false
    getWorkspace(workspaceId)
      .then((ws) => {
        if (cancelled) return
        setLoaded({ id: workspaceId, result: ws ? { status: 'ready', workspace: ws } : { status: 'missing' } })
      })
      .catch((e) => {
        if (!cancelled) setLoaded({ id: workspaceId, result: { status: 'error', message: toMessage(e) } })
      })
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'rounded-md px-3 py-1.5 text-sm transition-colors',
      isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
    )

  if (state.status === 'missing' || state.status === 'error') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {state.status === 'missing' ? '워크스페이스를 찾을 수 없습니다. 삭제되었거나 접근 권한이 없습니다.' : state.message}
        </p>
        <Link to="/" className="text-sm underline">
          워크스페이스 목록으로
        </Link>
      </main>
    )
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-4 border-b px-4 py-2">
        <Link to="/" className="shrink-0 text-sm text-muted-foreground hover:underline">
          ← 워크스페이스
        </Link>
        <h1 className="truncate font-medium">{state.status === 'ready' ? state.workspace.name : '불러오는 중…'}</h1>
        <nav className="ml-auto flex gap-1">
          <NavLink to="graph" className={tabClass}>
            그래프뷰
          </NavLink>
          <NavLink to="doc" className={tabClass}>
            문서뷰
          </NavLink>
        </nav>
      </header>
      <div className="min-h-0 flex-1">
        {workspaceId && (
          // key: 다른 워크스페이스로 바뀌면 이전 노드/태그/엣지 상태를 버리고 새로 시작
          <WorkspaceBody key={workspaceId} workspaceId={workspaceId} workspace={state.status === 'ready' ? state.workspace : null} />
        )}
      </div>
    </div>
  )
}

/**
 * 워크스페이스 행 조회를 기다리지 않고 URL 의 id 만으로 바로 마운트된다 (2026-09-17 성능 개선 B).
 * → getWorkspace / nodes / tags(3) / edges 요청이 모두 동시에 나가고, 하위 뷰의 lazy 청크도 같은 시점에 받기 시작한다.
 * 권한은 RLS 가 요청마다 검사하므로 id 만으로 조회해도 남의 데이터는 빈 결과가 된다.
 * 없는/남의 워크스페이스면 상위가 "찾을 수 없음" 화면으로 바뀌면서 이 컴포넌트는 언마운트된다.
 */
function WorkspaceBody({ workspaceId, workspace }: { workspaceId: string; workspace: Workspace | null }) {
  const nodes = useNodes(workspaceId)
  const tags = useTags(workspaceId)
  const edges = useEdges(workspaceId)
  const tagFilter = useTagFilter(tags.tags, tags.links)
  return <Outlet context={{ workspaceId, workspace, nodes, tags, edges, tagFilter } satisfies WorkspaceOutletContext} />
}
