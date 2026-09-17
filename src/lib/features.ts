/**
 * 기능 스위치. `.env` 의 값은 Vite 가 빌드/dev 서버 시작 시점에 읽으므로 바꾼 뒤에는 dev 서버를 재시작해야 한다.
 *
 * AI 태그 제안(auto-tag)은 Anthropic API 종량제 과금이 발생하므로 기본은 꺼 둔다.
 * 켜는 방법: (1) `npx supabase secrets set ANTHROPIC_API_KEY=...` 로 서버에 키 등록 (2) `.env` 에 VITE_ENABLE_AI_TAGGING=true
 * 꺼져 있으면 버튼 자체가 보이지 않는다. 서버 함수는 배포돼 있어도 키가 없으면 Claude 를 호출하지 않는다.
 */
export const AI_TAGGING_ENABLED = import.meta.env.VITE_ENABLE_AI_TAGGING === 'true'
