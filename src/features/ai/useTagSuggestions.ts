import { useCallback, useState } from 'react'
import type { AutoTagResult, TagSuggestion } from './autoTag'

/** 노드 하나에 대한 마지막 AI 제안 (아직 승인/거절하지 않은 후보만 남는다) */
export interface NodeSuggestions {
  suggestions: TagSuggestion[]
  truncated: boolean
  analyzedChars: number
}

export interface TagSuggestionsApi {
  get: (nodeId: string) => NodeSuggestions | undefined
  set: (nodeId: string, result: AutoTagResult) => void
  /** 후보 하나를 목록에서 뺀다 (승인했거나 거절했을 때) */
  resolve: (nodeId: string, name: string) => void
  clear: (nodeId: string) => void
}

/**
 * AI 태그 제안의 세션 내 보관소 (PRD 5장 v0.2): DB 에 저장하지 않고 메모리에만 둔다.
 * WorkspaceBody 에서 한 번 만들어 context 로 공유 → 다른 노드나 그래프뷰에 다녀와도 유지되고, 새로고침하면 사라진다.
 */
export function useTagSuggestions(): TagSuggestionsApi {
  const [byNode, setByNode] = useState<ReadonlyMap<string, NodeSuggestions>>(new Map())

  const get = useCallback((nodeId: string) => byNode.get(nodeId), [byNode])

  const set = useCallback((nodeId: string, result: AutoTagResult) => {
    setByNode((prev) => new Map(prev).set(nodeId, { suggestions: result.suggestions, truncated: result.truncated, analyzedChars: result.analyzed_chars }))
  }, [])

  const resolve = useCallback((nodeId: string, name: string) => {
    setByNode((prev) => {
      const current = prev.get(nodeId)
      if (!current) return prev
      return new Map(prev).set(nodeId, { ...current, suggestions: current.suggestions.filter((s) => s.name !== name) })
    })
  }, [])

  const clear = useCallback((nodeId: string) => {
    setByNode((prev) => {
      if (!prev.has(nodeId)) return prev
      const next = new Map(prev)
      next.delete(nodeId)
      return next
    })
  }, [])

  return { get, set, resolve, clear }
}
