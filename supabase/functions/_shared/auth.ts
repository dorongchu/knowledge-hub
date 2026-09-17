// 버전은 이 모듈을 쓰는 각 함수의 deno.json(import map)에서 정한다
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { HttpError } from './http.ts'

/**
 * 세션 검증 + 소유권 검증 (CLAUDE.md 절대 규칙 3). 로그인 여부만 보고 넘어가지 않는다.
 *
 * 클라이언트 두 종류:
 * - userClient: 요청자의 JWT 로 동작 → 모든 조회에 RLS 가 적용된다. 소유권 검증과 데이터 읽기는 이것으로만 한다
 * - adminClient: service_role (RLS 우회). 레이트리밋 기록처럼 사용자가 직접 쓰면 안 되는 작업에만 쓴다.
 *   절대 사용자 입력으로 임의의 테이블을 읽고 쓰는 데 쓰지 않는다.
 */

function requireEnv(name: string): string {
  const v = Deno.env.get(name)
  if (!v) {
    console.error(`missing env: ${name}`)
    throw new HttpError(500, 'server_misconfigured', '서버 설정이 완료되지 않았습니다.')
  }
  return v
}

export interface AuthContext {
  user: User
  userClient: SupabaseClient
  adminClient: SupabaseClient
}

/** 1) 세션 검증: Authorization 헤더의 JWT 를 Supabase Auth 에 확인받는다 (서명·만료·로그아웃 여부 포함) */
export async function authenticate(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) throw new HttpError(401, 'unauthenticated', '로그인이 필요합니다.')

  const url = requireEnv('SUPABASE_URL')
  const userClient = createClient(url, requireEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await userClient.auth.getUser(authHeader.slice('Bearer '.length))
  if (error || !data.user) throw new HttpError(401, 'unauthenticated', '세션이 유효하지 않습니다. 다시 로그인해 주세요.')

  const adminClient = createClient(url, requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return { user: data.user, userClient, adminClient }
}

export interface OwnedNode {
  id: string
  workspace_id: string
  type: 'card' | 'doc'
  title: string
  content: string
}

/**
 * 2) 소유권 검증: 요청된 노드가 요청자 소유인지 확인하고 그 내용을 돌려준다.
 * - userClient 로 조회하므로 RLS(`is_workspace_owner`)가 1차로 거른다
 * - 그 위에 workspaces.owner_id 를 명시적으로 한 번 더 비교한다 (Phase 2 에서 멤버 읽기 권한이 생겨도 AI 호출은 별도 판단이 필요하므로)
 * - 본문은 클라이언트가 보낸 값이 아니라 여기서 DB 로부터 읽은 값을 쓴다
 */
export async function requireOwnedNode(ctx: AuthContext, nodeId: string): Promise<OwnedNode> {
  const { data, error } = await ctx.userClient
    .from('nodes')
    .select('id, workspace_id, type, title, content, workspaces!inner(owner_id)')
    .eq('id', nodeId)
    .maybeSingle()

  if (error) {
    console.error('requireOwnedNode query failed', error)
    throw new HttpError(500, 'internal', '노드를 확인하지 못했습니다.')
  }
  const ownerId = (data?.workspaces as { owner_id?: string } | null | undefined)?.owner_id
  if (!data || ownerId !== ctx.user.id) throw new HttpError(404, 'not_found', '노드를 찾을 수 없습니다.')

  return { id: data.id, workspace_id: data.workspace_id, type: data.type, title: data.title, content: data.content }
}
