import { useCallback, useEffect, useMemo, useState } from 'react'
import { toMessage } from '@/features/workspace/useWorkspaces'
import { createFolder, deleteFolder, listFolders, reorderFolders, updateFolder, type Folder } from './api'

interface State {
  items: Folder[]
  loading: boolean
  error: string | null
}

export interface FoldersApi extends State {
  byId: ReadonlyMap<string, Folder>
  nameOf: (folderId: string | null) => string | null
  refresh: () => Promise<void>
  create: (name: string) => Promise<Folder>
  rename: (id: string, name: string) => Promise<void>
  /** 목록에서 한 칸 위/아래로. sort_order 를 다시 매겨 저장한다 */
  move: (id: string, direction: 'up' | 'down') => Promise<void>
  remove: (id: string) => Promise<void>
}

const sortFolders = (a: Folder, b: Folder) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'ko')

/** 워크스페이스 하나의 폴더 목록 + CRUD. WorkspaceBody 에서 한 번 만들어 하위 뷰가 공유한다. */
export function useFolders(workspaceId: string): FoldersApi {
  const [state, setState] = useState<State>({ items: [], loading: true, error: null })

  const refresh = useCallback(async () => {
    try {
      const items = await listFolders(workspaceId)
      setState({ items, loading: false, error: null })
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: toMessage(e) }))
    }
  }, [workspaceId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const byId = useMemo(() => new Map(state.items.map((f) => [f.id, f])), [state.items])
  const nameOf = useCallback((id: string | null) => (id ? (byId.get(id)?.name ?? null) : null), [byId])

  const create = useCallback(
    async (name: string) => {
      // 맨 뒤에 붙인다
      const last = state.items.reduce((m, f) => Math.max(m, f.sort_order), -1)
      const folder = await createFolder(workspaceId, name, last + 1)
      setState((s) => ({ ...s, items: [...s.items, folder].sort(sortFolders) }))
      return folder
    },
    [workspaceId, state.items],
  )

  const rename = useCallback(async (id: string, name: string) => {
    const folder = await updateFolder(id, { name })
    setState((s) => ({ ...s, items: s.items.map((f) => (f.id === id ? folder : f)).sort(sortFolders) }))
  }, [])

  const move = useCallback(
    async (id: string, direction: 'up' | 'down') => {
      const idx = state.items.findIndex((f) => f.id === id)
      const target = direction === 'up' ? idx - 1 : idx + 1
      if (idx < 0 || target < 0 || target >= state.items.length) return
      const next = [...state.items]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      const orders = next.map((f, i) => ({ id: f.id, sort_order: i }))
      await reorderFolders(orders)
      setState((s) => ({ ...s, items: next.map((f, i) => ({ ...f, sort_order: i })) }))
    },
    [state.items],
  )

  const remove = useCallback(async (id: string) => {
    await deleteFolder(id)
    setState((s) => ({ ...s, items: s.items.filter((f) => f.id !== id) }))
  }, [])

  return { ...state, byId, nameOf, refresh, create, rename, move, remove }
}
