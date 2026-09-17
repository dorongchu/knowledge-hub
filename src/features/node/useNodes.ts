import { useCallback, useEffect, useState } from 'react'
import { toMessage } from '@/features/workspace/useWorkspaces'
import { createNode, createNodes, deleteNode, listNodes, updateNode, type KnowledgeNode, type NodePatch, type NodeType } from './api'

interface State {
  items: KnowledgeNode[]
  loading: boolean
  error: string | null
}

export interface NodesApi extends State {
  refresh: () => Promise<void>
  create: (type: NodeType) => Promise<KnowledgeNode>
  /** 가져오기용 일괄 생성. 일부만 성공하고 실패해도 성공한 만큼은 목록에 반영한다 */
  createMany: (
    inputs: Array<{ type: NodeType; title: string; content: string }>,
    onProgress?: (done: number, total: number) => void,
  ) => Promise<KnowledgeNode[]>
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

  const createMany = useCallback<NodesApi['createMany']>(
    async (inputs, onProgress) => {
      try {
        const created = await createNodes(workspaceId, inputs, onProgress)
        setState((s) => ({ ...s, items: [...created, ...s.items] }))
        return created
      } catch (e) {
        const partial = (e as { createdSoFar?: KnowledgeNode[] }).createdSoFar ?? []
        if (partial.length > 0) setState((s) => ({ ...s, items: [...partial, ...s.items] }))
        throw e
      }
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

  return { ...state, refresh, create, createMany, update, remove }
}
