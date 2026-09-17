/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** 'true' 일 때만 AI 태그 제안 버튼을 보여준다 (기본 꺼짐) */
  readonly VITE_ENABLE_AI_TAGGING?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
