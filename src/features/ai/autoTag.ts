import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/**
 * auto-tag Edge Function 호출 (CLAUDE.md 절대 규칙 1: AI 는 Edge Function 을 통해서만).
 * 서버는 후보를 돌려주기만 하고 DB 에 쓰지 않는다. 저장은 사용자가 승인할 때 클라이언트가 한다.
 */

export interface TagSuggestion {
  name: string
  /** 기존 태그와 이름이 일치하면 그 id, 새 태그면 null */
  tag_id: string | null
  category_name: string | null
  is_new: boolean
  reason: string
}

export interface AutoTagResult {
  suggestions: TagSuggestion[]
  /** 본문이 길어 앞부분만 분석했는지 */
  truncated: boolean
  analyzed_chars: number
  remaining: { per_minute: number; per_day: number }
}

export type AutoTagErrorCode =
  | 'bad_request'
  | 'unauthenticated'
  | 'not_found'
  | 'rate_limited'
  | 'ai_unavailable'
  | 'ai_refused'
  | 'server_misconfigured'
  | 'internal'
  | 'network'

export class AutoTagError extends Error {
  code: AutoTagErrorCode
  retryAfterSeconds?: number

  constructor(code: AutoTagErrorCode, message: string, retryAfterSeconds?: number) {
    super(message)
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export async function requestTagSuggestions(nodeId: string): Promise<AutoTagResult> {
  const { data, error } = await supabase.functions.invoke<AutoTagResult>('auto-tag', { body: { node_id: nodeId } })

  if (error) {
    // 함수가 4xx/5xx 로 응답한 경우: 본문의 { error: { code, message } } 를 읽는다
    if (error instanceof FunctionsHttpError) {
      const body = (await error.context.json().catch(() => null)) as { error?: { code?: AutoTagErrorCode; message?: string; retry_after_seconds?: number } } | null
      if (body?.error?.code) throw new AutoTagError(body.error.code, body.error.message ?? '요청을 처리하지 못했습니다.', body.error.retry_after_seconds)
      throw new AutoTagError('internal', '요청을 처리하지 못했습니다.')
    }
    throw new AutoTagError('network', 'AI 기능에 연결하지 못했습니다. 네트워크를 확인해 주세요.')
  }
  if (!data) throw new AutoTagError('internal', '응답이 비어 있습니다.')
  return data
}
