import { useCallback, useEffect, useMemo, useState } from 'react'
import { toMessage } from '@/features/workspace/useWorkspaces'
import {
  attachTag,
  createCategory,
  createTag,
  deleteCategory,
  deleteTag,
  detachTag,
  listCategories,
  listNodeTagLinks,
  listTags,
  renameCategory,
  updateTag,
  type Category,
  type NodeTagLink,
  type Provenance,
  type Tag,
} from './api'

interface State {
  categories: Category[]
  tags: Tag[]
  links: NodeTagLink[]
  loading: boolean
  error: string | null
}

export interface TagsApi extends State {
  /** nodeId → 그 노드에 붙은 태그(이름순)와 출처 */
  tagsOfNode: (nodeId: string) => Array<{ tag: Tag; source: Provenance }>
  /** tagId → 붙어 있는 노드 수 */
  usageCount: (tagId: string) => number
  categoryName: (categoryId: string | null) => string | null
  refresh: () => Promise<void>
  createCategory: (name: string) => Promise<Category>
  renameCategory: (id: string, name: string) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  createTag: (name: string, categoryId?: string | null) => Promise<Tag>
  updateTag: (id: string, patch: { name?: string; category_id?: string | null }) => Promise<void>
  deleteTag: (id: string) => Promise<void>
  attach: (nodeId: string, tagId: string, source?: Provenance) => Promise<void>
  detach: (nodeId: string, tagId: string) => Promise<void>
  /** 노드가 삭제됐을 때 로컬 연결 정보 정리 (DB 는 cascade 로 이미 삭제됨) */
  forgetNode: (nodeId: string) => void
}

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'ko')

/** 워크스페이스 하나의 카테고리/태그/노드-태그 연결. WorkspacePage 에서 한 번 만들어 하위 뷰가 공유한다. */
export function useTags(workspaceId: string): TagsApi {
  const [state, setState] = useState<State>({ categories: [], tags: [], links: [], loading: true, error: null })

  const refresh = useCallback(async () => {
    try {
      const [categories, tags, links] = await Promise.all([
        listCategories(workspaceId),
        listTags(workspaceId),
        listNodeTagLinks(workspaceId),
      ])
      setState({ categories, tags, links, loading: false, error: null })
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: toMessage(e) }))
    }
  }, [workspaceId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const tagById = useMemo(() => new Map(state.tags.map((t) => [t.id, t])), [state.tags])
  const categoryById = useMemo(() => new Map(state.categories.map((c) => [c.id, c])), [state.categories])

  const linksByNode = useMemo(() => {
    const m = new Map<string, NodeTagLink[]>()
    for (const l of state.links) {
      const arr = m.get(l.node_id)
      if (arr) arr.push(l)
      else m.set(l.node_id, [l])
    }
    return m
  }, [state.links])

  const usage = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of state.links) m.set(l.tag_id, (m.get(l.tag_id) ?? 0) + 1)
    return m
  }, [state.links])

  const tagsOfNode = useCallback(
    (nodeId: string) =>
      (linksByNode.get(nodeId) ?? [])
        .flatMap((l) => {
          const tag = tagById.get(l.tag_id)
          return tag ? [{ tag, source: l.source }] : []
        })
        .sort((a, b) => byName(a.tag, b.tag)),
    [linksByNode, tagById],
  )

  const usageCount = useCallback((tagId: string) => usage.get(tagId) ?? 0, [usage])
  const categoryName = useCallback((id: string | null) => (id ? (categoryById.get(id)?.name ?? null) : null), [categoryById])

  return {
    ...state,
    tagsOfNode,
    usageCount,
    categoryName,
    refresh,

    createCategory: useCallback(
      async (name) => {
        const c = await createCategory(workspaceId, name)
        setState((s) => ({ ...s, categories: [...s.categories, c].sort(byName) }))
        return c
      },
      [workspaceId],
    ),
    renameCategory: useCallback(async (id, name) => {
      const c = await renameCategory(id, name)
      setState((s) => ({ ...s, categories: s.categories.map((x) => (x.id === id ? c : x)).sort(byName) }))
    }, []),
    deleteCategory: useCallback(async (id) => {
      await deleteCategory(id)
      // DB 의 on delete set null 과 동일하게 로컬도 자유 태그로 돌린다
      setState((s) => ({
        ...s,
        categories: s.categories.filter((x) => x.id !== id),
        tags: s.tags.map((t) => (t.category_id === id ? { ...t, category_id: null } : t)),
      }))
    }, []),

    createTag: useCallback(
      async (name, categoryId = null) => {
        const t = await createTag(workspaceId, name, categoryId)
        setState((s) => ({ ...s, tags: [...s.tags, t].sort(byName) }))
        return t
      },
      [workspaceId],
    ),
    updateTag: useCallback(async (id, patch) => {
      const t = await updateTag(id, patch)
      setState((s) => ({ ...s, tags: s.tags.map((x) => (x.id === id ? t : x)).sort(byName) }))
    }, []),
    deleteTag: useCallback(async (id) => {
      await deleteTag(id)
      setState((s) => ({ ...s, tags: s.tags.filter((x) => x.id !== id), links: s.links.filter((l) => l.tag_id !== id) }))
    }, []),

    attach: useCallback(async (nodeId, tagId, source = 'manual') => {
      const link = await attachTag(nodeId, tagId, source)
      setState((s) =>
        s.links.some((l) => l.node_id === nodeId && l.tag_id === tagId) ? s : { ...s, links: [...s.links, link] },
      )
    }, []),
    detach: useCallback(async (nodeId, tagId) => {
      await detachTag(nodeId, tagId)
      setState((s) => ({ ...s, links: s.links.filter((l) => !(l.node_id === nodeId && l.tag_id === tagId)) }))
    }, []),
    forgetNode: useCallback((nodeId) => {
      setState((s) => ({ ...s, links: s.links.filter((l) => l.node_id !== nodeId) }))
    }, []),
  }
}
