import { useState } from 'react'
import { Check, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isDuplicateError } from '@/features/tag/api'
import type { TagsApi } from '@/features/tag/useTags'
import { toMessage } from '@/features/workspace/useWorkspaces'
import { AutoTagError, requestTagSuggestions, type TagSuggestion } from './autoTag'
import type { TagSuggestionsApi } from './useTagSuggestions'

interface Props {
  nodeId: string
  tags: TagsApi
  store: TagSuggestionsApi
  /** 서버는 DB 의 본문을 읽으므로, 요청 전에 편집기의 미저장 변경분을 먼저 저장한다 */
  flushPendingSave: () => Promise<void>
}

/**
 * AI 태그 제안 (PRD 5장). "태그 제안 받기" 버튼을 누를 때만 호출한다 — 자동저장마다 호출하지 않는다.
 * 후보는 화면에만 임시로 보이고, ✓ 로 승인한 것만 tags / node_tags(source: 'ai') 에 저장된다 (CLAUDE.md 절대 규칙 5).
 */
export function TagSuggestions({ nodeId, tags, store, flushPendingSave }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busyName, setBusyName] = useState<string | null>(null)

  const current = store.get(nodeId)

  const request = async () => {
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      await flushPendingSave()
      const result = await requestTagSuggestions(nodeId)
      store.set(nodeId, result)
      if (result.suggestions.length === 0) setInfo('제안할 태그를 찾지 못했습니다. 본문을 더 작성한 뒤 다시 시도해 보세요.')
    } catch (e) {
      if (e instanceof AutoTagError) {
        setError(e.code === 'rate_limited' && e.retryAfterSeconds ? `${e.message} ${formatWait(e.retryAfterSeconds)} 뒤에 다시 시도해 주세요.` : e.message)
      } else {
        setError(toMessage(e))
      }
    } finally {
      setLoading(false)
    }
  }

  /** 승인: 기존 태그면 붙이기만, 새 태그면 만든 뒤 붙인다. 둘 다 source='ai' */
  const approve = async (s: TagSuggestion) => {
    setBusyName(s.name)
    setError(null)
    try {
      // 제안을 받은 뒤 태그가 삭제/생성됐을 수 있으므로 지금 상태 기준으로 다시 찾는다
      const existing = tags.tags.find((t) => t.id === s.tag_id) ?? tags.tags.find((t) => t.name.toLowerCase() === s.name.toLowerCase())
      const tag = existing ?? (await tags.createTag(s.name))
      await tags.attach(nodeId, tag.id, 'ai')
      store.resolve(nodeId, s.name)
    } catch (e) {
      setError(isDuplicateError(e) ? '같은 이름의 태그가 이미 있습니다. 새로고침 후 다시 시도해 주세요.' : toMessage(e))
    } finally {
      setBusyName(null)
    }
  }

  const suggestions = current?.suggestions ?? []

  return (
    <div className="space-y-1.5" aria-label="AI 태그 제안">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="xs" onClick={() => void request()} disabled={loading}>
          <Sparkles data-icon="inline-start" />
          {loading ? '분석 중…' : suggestions.length > 0 ? '다시 제안 받기' : '태그 제안 받기'}
        </Button>
        {suggestions.length > 0 && (
          <button type="button" onClick={() => store.clear(nodeId)} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
            제안 모두 닫기
          </button>
        )}
        {error && (
          <span role="alert" className="text-xs text-destructive">
            {error}
          </span>
        )}
        {info && !error && <span className="text-xs text-muted-foreground">{info}</span>}
      </div>

      {suggestions.length > 0 && (
        <ul className="space-y-1 rounded-md border border-dashed p-2">
          {suggestions.map((s) => (
            <li key={s.name} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-xs">
                <Sparkles className="size-3 text-muted-foreground" aria-hidden />
                {s.category_name && <span className="text-muted-foreground">{s.category_name}:</span>}
                {s.name}
                {s.is_new && <span className="ml-0.5 rounded bg-background px-1 text-[10px] text-muted-foreground">새 태그</span>}
              </span>
              <span className="min-w-0 flex-1 pt-0.5 text-xs text-muted-foreground">{s.reason}</span>
              <Button variant="ghost" size="icon-xs" aria-label={`${s.name} 승인`} title="승인 — 이 노드에 태그를 붙입니다" disabled={busyName !== null} onClick={() => void approve(s)}>
                <Check />
              </Button>
              <Button variant="ghost" size="icon-xs" aria-label={`${s.name} 거절`} title="거절" disabled={busyName !== null} onClick={() => store.resolve(nodeId, s.name)}>
                <X />
              </Button>
            </li>
          ))}
          {current?.truncated && (
            <li className="text-[11px] text-muted-foreground">본문이 길어 앞부분 {current.analyzedChars.toLocaleString()}자만 분석했습니다.</li>
          )}
        </ul>
      )}
    </div>
  )
}

function formatWait(seconds: number): string {
  if (seconds < 90) return `${seconds}초`
  if (seconds < 5400) return `${Math.round(seconds / 60)}분`
  return `${Math.round(seconds / 3600)}시간`
}
