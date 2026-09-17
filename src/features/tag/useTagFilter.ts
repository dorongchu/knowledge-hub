import { useCallback, useMemo, useState } from 'react'
import type { NodeTagLink, Tag } from './api'

/** 여러 태그를 골랐을 때: and = 모두 붙은 노드, or = 하나라도 붙은 노드 (PRD 4.5, 기본 and) */
export type TagFilterMode = 'and' | 'or'

export interface TagFilterApi {
  /** 현재 존재하는 태그 중 선택된 것 (삭제된 태그는 자동으로 빠진다) */
  selected: Tag[]
  selectedIds: Set<string>
  mode: TagFilterMode
  active: boolean
  toggle: (tagId: string) => void
  /** 이 태그 하나로만 필터 (칩 클릭용) */
  only: (tagId: string) => void
  clear: () => void
  setMode: (mode: TagFilterMode) => void
  /** 필터를 통과하는 노드인지. 필터가 꺼져 있으면 항상 true */
  matches: (nodeId: string) => boolean
}

/** 순수 함수: 테스트·재사용을 위해 훅과 분리 */
export function nodeMatchesTags(nodeTagIds: ReadonlySet<string> | undefined, selectedIds: ReadonlySet<string>, mode: TagFilterMode): boolean {
  if (selectedIds.size === 0) return true
  if (!nodeTagIds || nodeTagIds.size === 0) return false
  if (mode === 'or') {
    for (const id of selectedIds) if (nodeTagIds.has(id)) return true
    return false
  }
  for (const id of selectedIds) if (!nodeTagIds.has(id)) return false
  return true
}

/**
 * 태그 필터 상태. WorkspaceBody 에서 한 번 만들어 Outlet context 로 공유한다
 * → 그래프뷰/문서뷰 탭을 오가도 유지되고, 이후 그래프뷰 연동(강조/흐리게)에도 그대로 쓴다.
 */
export function useTagFilter(tags: Tag[], links: NodeTagLink[]): TagFilterApi {
  const [rawIds, setRawIds] = useState<string[]>([])
  const [mode, setMode] = useState<TagFilterMode>('and')

  const selected = useMemo(() => {
    const byId = new Map(tags.map((t) => [t.id, t]))
    return rawIds.flatMap((id) => byId.get(id) ?? [])
  }, [rawIds, tags])
  const selectedIds = useMemo(() => new Set(selected.map((t) => t.id)), [selected])

  const tagIdsByNode = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const l of links) {
      const set = m.get(l.node_id)
      if (set) set.add(l.tag_id)
      else m.set(l.node_id, new Set([l.tag_id]))
    }
    return m
  }, [links])

  const toggle = useCallback((tagId: string) => setRawIds((prev) => (prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId])), [])
  const only = useCallback((tagId: string) => setRawIds([tagId]), [])
  const clear = useCallback(() => setRawIds([]), [])
  const matches = useCallback((nodeId: string) => nodeMatchesTags(tagIdsByNode.get(nodeId), selectedIds, mode), [tagIdsByNode, selectedIds, mode])

  return { selected, selectedIds, mode, active: selectedIds.size > 0, toggle, only, clear, setMode, matches }
}
