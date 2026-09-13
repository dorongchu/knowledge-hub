import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 설정되지 않았습니다. .env.example 을 참고해 .env 를 만들어 주세요.',
  )
}

// anon key는 공개 키. RLS가 실제 접근 제어를 담당한다.
// Anthropic API 키 등 비밀 값은 절대 여기(클라이언트 번들)에 두지 않는다 — CLAUDE.md 절대 규칙 1.
export const supabase = createClient(url, anonKey)
