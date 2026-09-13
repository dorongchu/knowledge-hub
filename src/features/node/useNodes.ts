import { useCallback, useEffect, useState } from 'react'
import { toMessage } from '@/features/workspace/useWorkspaces'
import { createNode, deleteNode, listNodes, updateNode, type KnowledgeNode, type NodePatch, type NodeType } from './api'

interface State {
  items: KnowledgeNode[]
  loading: boolean
  error: string | null
}

export interface NodesApi extends State {
  refresh: () => Promise<void>
  create: (type: NodeType) => Promise<KnowledgeNode>
  update: (id: string, patch: NodePatch) => Promise<KnowledgeNode>
  remove: (id: string) => Promise<void>
}

/**
 * 워크스페이스 하나의 노드 목록 + CRUD. WorkspacePage 에서 한 번 만들어 그래프뷰/문서뷰가 공유한다.
 * 변경은 로컬 목록에 바로 반영한다 (편집 중 자동 저장마다 재조회하면 목록이 튀므로 정렬은 유지).
 */
export function useNodes(workspaceId: string): NodesApi {
  const [state, setState] = useState<State>({ items: [], loading: true, error: null })

  const refresh = useCallback(async () => {
    try {
      const items = await listNodes(workspaceId)
      setState({ items, loading: false, error: null })
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: toMessage(e) }))
    }
  }, [workspaceId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const create = useCallback(
    async (type: NodeType) => {
      const node = await createNode({ workspace_id: workspaceId, type })
      setState((s) => ({ ...s, items: [node, ...s.items] }))
      return node
    },
    [workspaceId],
  )

  const update = useCallback(async (id: string, patch: NodePatch) => {
    const node = await updateNode(id, patch)
    setState((s) => ({ ...s, items: s.items.map((n) => (n.id === id ? node : n)) }))
    return node
  }, [])

  const remove = useCallback(async (id: string) => {
    await deleteNode(id)
    setState((s) => ({ ...s, items: s.items.filter((n) => n.id !== id) }))
  }, [])

  return { ...state, refresh, create, update, remove }
}
