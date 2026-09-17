import { useCallback, useEffect, useState } from 'react'
import { toMessage } from '@/features/workspace/useWorkspaces'
import { createManualEdge, deleteEdge, listEdges, updateEdgeLabel, type KnowledgeEdge } from './api'

interface State {
  items: KnowledgeEdge[]
  loading: boolean
  error: string | null
}

export interface EdgesApi extends State {
  refresh: () => Promise<void>
  /** 같은 방향 연결이 이미 있는지 (DB unique 제약과 동일 기준) */
  exists: (sourceId: string, targetId: string) => boolean
  /** 이 노드가 source 또는 target 인 연결들 */
  ofNode: (nodeId: string) => KnowledgeEdge[]
  connect: (sourceId: string, targetId: string, label?: string | null) => Promise<KnowledgeEdge>
  setLabel: (id: string, label: string | null) => Promise<void>
  remove: (id: string) => Promise<void>
  /** 노드가 삭제됐을 때 로컬 정리 (DB 는 cascade 로 이미 삭제됨) */
  forgetNode: (nodeId: string) => void
}

/** 워크스페이스 하나의 엣지 목록 + 수동 연결 CRUD. WorkspacePage 에서 한 번 만들어 하위 뷰가 공유한다. */
export function useEdges(workspaceId: string): EdgesApi {
  const [state, setState] = useState<State>({ items: [], loading: true, error: null })

  const refresh = useCallback(async () => {
    try {
      const items = await listEdges(workspaceId)
      setState({ items, loading: false, error: null })
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: toMessage(e) }))
    }
  }, [workspaceId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const { items } = state

  const exists = useCallback(
    (sourceId: string, targetId: string) => items.some((e) => e.source_node_id === sourceId && e.target_node_id === targetId),
    [items],
  )

  const ofNode = useCallback((nodeId: string) => items.filter((e) => e.source_node_id === nodeId || e.target_node_id === nodeId), [items])

  const connect = useCallback(
    async (sourceId: string, targetId: string, label: string | null = null) => {
      const edge = await createManualEdge({ workspace_id: workspaceId, source_node_id: sourceId, target_node_id: targetId, label })
      setState((s) => ({ ...s, items: [...s.items, edge] }))
      return edge
    },
    [workspaceId],
  )

  const setLabel = useCallback(async (id: string, label: string | null) => {
    const edge = await updateEdgeLabel(id, label)
    setState((s) => ({ ...s, items: s.items.map((e) => (e.id === id ? edge : e)) }))
  }, [])

  const remove = useCallback(async (id: string) => {
    await deleteEdge(id)
    setState((s) => ({ ...s, items: s.items.filter((e) => e.id !== id) }))
  }, [])

  const forgetNode = useCallback((nodeId: string) => {
    setState((s) => ({ ...s, items: s.items.filter((e) => e.source_node_id !== nodeId && e.target_node_id !== nodeId) }))
  }, [])

  return { ...state, refresh, exists, ofNode, connect, setLabel, remove, forgetNode }
}
