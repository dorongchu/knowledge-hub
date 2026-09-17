/**
 * Edge Function 공통: CORS, JSON 응답, 오류 형식.
 * 모든 오류 응답은 `{ error: { code, message, ... } }` 형태 — 클라이언트는 code 로 분기한다.
 */

// 브라우저(다른 출처의 웹앱)에서 호출하므로 CORS 가 필요하다. 인증은 쿠키가 아니라 Authorization 헤더라 * 로 열어도 된다.
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  })
}

export type ErrorCode =
  | 'method_not_allowed'
  | 'bad_request'
  | 'unauthenticated'
  | 'not_found' // 없는 리소스와 "남의 것"을 구분하지 않는다 (존재 여부를 흘리지 않기 위해)
  | 'rate_limited'
  | 'ai_unavailable'
  | 'ai_refused'
  | 'server_misconfigured'
  | 'internal'

/** 핸들러 안에서 throw 하면 withErrorHandling 이 응답으로 바꾼다 */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public details: Record<string, unknown> = {},
    public headers: Record<string, string> = {},
  ) {
    super(message)
  }
}

export function errorResponse(e: HttpError): Response {
  return json({ error: { code: e.code, message: e.message, ...e.details } }, e.status, e.headers)
}

/** OPTIONS 프리플라이트, POST 전용, 예외 → 오류 응답 변환을 한곳에서 처리 */
export function withErrorHandling(handler: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'POST 만 지원합니다.')
      return await handler(req)
    } catch (e) {
      if (e instanceof HttpError) return errorResponse(e)
      // 내부 오류의 상세는 로그에만 남기고 클라이언트에는 일반 메시지만 준다
      console.error('unhandled error', e)
      return errorResponse(new HttpError(500, 'internal', '서버 오류가 발생했습니다.'))
    }
  }
}

export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json()
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>
  } catch {
    // fallthrough
  }
  throw new HttpError(400, 'bad_request', '요청 본문이 올바른 JSON 객체가 아닙니다.')
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function requireUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw new HttpError(400, 'bad_request', `${field} 가 올바른 id 가 아닙니다.`)
  return value
}
