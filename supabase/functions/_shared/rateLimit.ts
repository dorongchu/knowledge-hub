import type { AuthContext } from './auth.ts'
import { HttpError } from './http.ts'

/**
 * AI 호출 레이트리밋 (CLAUDE.md 절대 규칙 7). 초기값 — 비용을 보면서 조정.
 * 한도 확인과 기록은 DB 함수 `consume_ai_quota` 가 한 트랜잭션으로 처리한다 (마이그레이션 0004).
 */
export const AI_LIMITS = {
  userPerMinute: 5,
  userPerDay: 50,
  workspacePerDay: 100,
} as const

const REASON_MESSAGE: Record<string, string> = {
  user_per_minute: `요청이 너무 잦습니다. (분당 ${AI_LIMITS.userPerMinute}회)`,
  user_per_day: `오늘의 AI 사용 한도를 모두 썼습니다. (하루 ${AI_LIMITS.userPerDay}회)`,
  workspace_per_day: `이 워크스페이스의 오늘 AI 사용 한도를 모두 썼습니다. (하루 ${AI_LIMITS.workspacePerDay}회)`,
}

export interface Quota {
  usageId: number
  remainingUserMinute: number
  remainingUserDay: number
}

/** 한도 안이면 사용 1회를 기록하고 통과. 넘었으면 429 + Retry-After */
export async function consumeQuota(ctx: AuthContext, workspaceId: string, functionName: string): Promise<Quota> {
  const { data, error } = await ctx.adminClient.rpc('consume_ai_quota', {
    p_user_id: ctx.user.id,
    p_workspace_id: workspaceId,
    p_function_name: functionName,
    p_user_per_minute: AI_LIMITS.userPerMinute,
    p_user_per_day: AI_LIMITS.userPerDay,
    p_workspace_per_day: AI_LIMITS.workspacePerDay,
  })

  if (error || !data) {
    // 한도 확인에 실패하면 호출을 막는다 (열어 두면 비용 폭주를 못 막음)
    console.error('consume_ai_quota failed', error)
    throw new HttpError(500, 'internal', '사용 한도를 확인하지 못했습니다.')
  }

  if (!data.allowed) {
    const retryAfter = Number(data.retry_after_seconds) || 60
    throw new HttpError(
      429,
      'rate_limited',
      REASON_MESSAGE[data.reason as string] ?? '요청 한도를 넘었습니다.',
      { reason: data.reason, retry_after_seconds: retryAfter },
      { 'Retry-After': String(retryAfter) },
    )
  }

  return { usageId: data.usage_id, remainingUserMinute: data.remaining_user_minute, remainingUserDay: data.remaining_user_day }
}

/** Claude 호출이 우리 쪽/상대 쪽 장애로 실패해 결과를 못 받았을 때 방금 기록한 1회를 되돌린다 */
export async function refundQuota(ctx: AuthContext, quota: Quota): Promise<void> {
  const { error } = await ctx.adminClient.from('ai_usage').delete().eq('id', quota.usageId)
  if (error) console.error('refundQuota failed', error)
}
