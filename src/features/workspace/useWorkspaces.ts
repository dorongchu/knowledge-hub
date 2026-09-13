import { useCallback, useEffect, useState } from 'react'
import { createWorkspace, deleteWorkspace, listWorkspaces, renameWorkspace, type WorkspaceSummary } from './api'

interface State {
  items: WorkspaceSummary[]
  loading: boolean
  error: string | null
}

/** 워크스페이스 목록 + CRUD. 변경 후에는 목록을 다시 불러와 서버 상태(정렬, 노드 수)와 맞춘다. */
export function useWorkspaces() {
  const [state, setState] = useState<State>({ items: [], loading: true, error: null })

  const refresh = useCallback(async () => {
    try {
      const items = await listWorkspaces()
      setState({ items, loading: false, error: null })
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: toMessage(e) }))
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const create = useCallback(
    async (name: string) => {
      const ws = await createWorkspace(name)
      await refresh()
      return ws
    },
    [refresh],
  )

  const rename = useCallback(
    async (id: string, name: string) => {
      await renameWorkspace(id, name)
      await refresh()
    },
    [refresh],
  )

  const remove = useCallback(
    async (id: string) => {
      await deleteWorkspace(id)
      await refresh()
    },
    [refresh],
  )

  return { ...state, refresh, create, rename, remove }
}

export function toMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'object' && e && 'message' in e && typeof e.message === 'string') return e.message
  return '알 수 없는 오류'
}
