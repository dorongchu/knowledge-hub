# Knowledge Hub — 지식정리 웹앱

개인 지식과 학습 내용을 **그래프(마인드맵)** 와 **문서(노트)** 두 가지 모습으로 함께 관리하는 웹앱입니다.
주제별 워크스페이스 안에 카드(짧은 개념)와 문서(긴 노트)를 만들고, 태그와 연결로 엮어 둡니다.

- 설계 문서: [지식정리앱_설계문서.md](지식정리앱_설계문서.md) (PRD)
- 구현 규칙: [CLAUDE.md](CLAUDE.md)
- 진행 상황과 결정 기록: [PROGRESS.md](PROGRESS.md)

> 현재 Phase 1(MVP) 단계입니다. 1인 사용을 기준으로 만들었고, 데이터 모델은 이후 협업 확장을 염두에 두고 있습니다.

## 기능

| 영역 | 내용 |
|---|---|
| 워크스페이스 | 생성, 이름 변경, 삭제. 홈에서 최근 수정순 카드 목록과 노드 수 표시 |
| 노드 | 카드/문서 두 타입. 제목과 Markdown 본문, 입력 후 자동저장(Ctrl+S 로 즉시 저장) |
| 문서뷰 | 좌측 노드 목록, 우측 TipTap 에디터(서식 툴바, `# `·`**` 같은 Markdown 단축 입력), 연결된 노드 목록 |
| 그래프뷰 | 노드를 끌어 배치(위치 저장), 클릭 시 미리보기, 더블클릭 시 문서뷰로 이동. 노드 가장자리 점을 끌어 다른 노드 위에 놓으면 연결, 선을 눌러 관계 라벨 편집·삭제 |
| 태그 | 카테고리 + 자유 태그. 편집기에서 붙이기/떼기, 태그 관리 화면에서 이름 변경·카테고리 이동·삭제 |
| 검색 | 제목·본문 텍스트 검색(워크스페이스 내 / 전체 워크스페이스), 일치 부분 강조 |
| 태그 필터 | 태그를 골라 노드 목록을 거름. 여러 개 선택 시 "모두 / 하나라도" 전환, 텍스트 검색과 함께 사용 가능 |
| 노션 가져오기 | 노션의 "Markdown & CSV" 내보내기 zip 또는 .md 파일을 올려 노드로 변환. 파일은 브라우저 안에서만 읽음 |
| AI 태그 제안 (선택) | 버튼을 누르면 Claude 가 본문을 분석해 태그 후보를 제안, 승인한 것만 저장. **기본 꺼짐** — 아래 "AI 태그 제안 켜기" 참고 |

## 기술 스택

- React 19 + TypeScript + Vite
- Tailwind CSS v4 + shadcn/ui (Base UI 기반)
- 그래프 `@xyflow/react`, 에디터 TipTap v3 (`@tiptap/markdown`), 검색 `fuse.js`
- Markdown 렌더링 `marked` + `DOMPurify`, zip 해제 `fflate`
- Supabase: Auth, Postgres(+pgvector), Storage, Edge Functions
- AI: Anthropic Claude API — Supabase Edge Function 을 통해서만 호출

## 시작하기

### 준비물

- Node.js **22 LTS** (20.19 이상이면 동작). Vite 8 이 그보다 낮은 버전을 지원하지 않습니다
- Supabase 계정

### 1. 저장소와 의존성

```bash
git clone https://github.com/dorongchu/knowledge-hub.git
cd knowledge-hub
npm install
```

### 2. Supabase 프로젝트

1. [Supabase 대시보드](https://supabase.com/dashboard)에서 새 프로젝트를 만듭니다. **리전은 사용하는 곳과 가까운 곳**을 고르세요(한국이면 Northeast Asia (Seoul)). 리전은 나중에 바꿀 수 없고, 먼 리전은 모든 동작을 눈에 띄게 느리게 만듭니다.
2. CLI 로 로그인하고 프로젝트에 연결한 뒤 스키마를 올립니다. Supabase CLI 는 devDependency 로 들어 있어 따로 설치하지 않아도 됩니다.

```bash
npx supabase login
npx supabase link --project-ref <프로젝트-ref>
npx supabase db push
```

`db push` 는 `supabase/migrations/` 의 마이그레이션을 순서대로 적용합니다. 테이블, RLS 정책, 첨부파일용 private 버킷이 만들어집니다.

3. 대시보드 Authentication 에서 Email 로그인이 켜져 있는지 확인합니다. "Confirm email" 이 켜져 있으면 가입 후 메일의 링크를 눌러야 로그인됩니다.

### 3. 환경 변수

`.env.example` 을 복사해 `.env` 를 만들고 값을 채웁니다. 값은 대시보드 Project Settings → API Keys 에 있습니다.

```bash
cp .env.example .env
```

| 변수 | 값 |
|---|---|
| `VITE_SUPABASE_URL` | `https://<프로젝트-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Publishable key (`sb_publishable_…`). 브라우저에 공개되는 값이며 실제 접근 제어는 RLS 가 합니다 |
| `VITE_ENABLE_AI_TAGGING` | `true` 일 때만 AI 태그 제안 버튼 표시. 기본 `false` |

`.env` 는 git 에 올라가지 않습니다. **service_role / secret 키와 `ANTHROPIC_API_KEY` 는 절대 `.env` 에 넣지 마세요.** `VITE_` 로 시작하는 값은 브라우저 번들에 그대로 들어갑니다.

### 4. 실행

```bash
npm run dev
```

http://localhost:5173 을 열고 "가입하기"로 계정을 만든 뒤 로그인합니다. `.env` 를 바꾼 뒤에는 dev 서버를 다시 시작해야 반영됩니다.

## AI 태그 제안 켜기 (선택)

Anthropic API 는 **종량제**입니다(Claude 앱 구독과 별개로, Anthropic Console 에서 크레딧을 충전해 씁니다). 그래서 기본은 꺼져 있고, 꺼진 상태에서는 버튼이 보이지 않으며 비용이 전혀 발생하지 않습니다.

1. 서버에 키를 등록합니다. 키는 Supabase 의 Edge Function 시크릿으로만 저장되고 앱 번들에는 들어가지 않습니다.

```bash
npx supabase secrets set ANTHROPIC_API_KEY=<키>
```

2. 함수를 배포합니다(이미 배포돼 있으면 생략). Docker 없이 동작합니다.

```bash
npx supabase functions deploy auto-tag --use-api
```

3. `.env` 에 `VITE_ENABLE_AI_TAGGING=true` 를 넣고 dev 서버를 재시작합니다.

동작 방식과 안전장치:

- 편집기의 "태그 제안 받기" 버튼을 누를 때만 호출합니다. 자동저장 때는 호출하지 않습니다.
- 함수는 요청마다 세션을 검증하고, 요청한 노드가 본인 소유인지 확인한 뒤, 본문을 DB 에서 직접 읽습니다.
- 후보는 응답으로만 돌려주고 DB 에 쓰지 않습니다. 화면에서 승인한 것만 저장됩니다.
- 호출 한도(초기값): 사용자당 분당 5회·하루 50회, 워크스페이스당 하루 100회. `supabase/functions/_shared/rateLimit.ts` 에서 조정합니다.
- 모델은 `claude-sonnet-5`, 본문은 앞 24,000자까지만 분석합니다.

## 명령어

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입체크 후 프로덕션 빌드 (`dist/`) |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run lint` | oxlint |
| `npx supabase db push` | 새 마이그레이션 적용 |
| `npx supabase gen types typescript --linked --schema public > src/lib/database.types.ts` | 스키마를 바꾼 뒤 DB 타입 재생성 |
| `cd supabase/functions/auto-tag && npx deno check index.ts && npx deno lint . ../_shared` | Edge Function 타입 검사와 lint (deno 는 devDependency) |

## 폴더 구조

```
src/
  features/
    auth/         로그인, 세션, 라우트 가드
    workspace/    워크스페이스 CRUD, 상세 페이지(노드·태그·엣지를 한 번 불러와 하위 뷰에 공유)
    node/         노드 API, 편집기(TipTap)
    doc-view/     문서뷰: 노드 목록 + 검색 + 태그 필터 + 편집기
    graph-view/   그래프뷰: 노드/엣지 컴포넌트, 연결 패널, 개발용 플레이그라운드
    tag/          태그·카테고리 API, 태그 바, 태그 관리, 태그 필터
    edge/         노드 간 연결 API
    search/       fuse.js 색인, 강조 표시, 전체 검색
    import/       노션 Markdown 가져오기
    ai/           auto-tag 호출, 제안 보관소, 승인 UI
  components/     shadcn/ui 컴포넌트, MarkdownView
  lib/            supabase 클라이언트, DB 타입, Markdown 렌더(sanitize), 유틸, 기능 스위치
supabase/
  migrations/     스키마 + RLS + Storage 정책
  functions/
    _shared/      CORS·오류 형식, 세션+소유권 검증, 레이트리밋
    auto-tag/     태그 제안 함수
```

## 보안 모델

- 모든 테이블에 RLS 가 켜져 있고, 워크스페이스 소유자만 자기 데이터를 읽고 씁니다. 소유권 판정은 DB 함수 `is_workspace_owner` / `is_node_owner` 로 통일했습니다.
- 첨부파일 버킷은 private 이며 경로 규칙은 `{workspace_id}/{node_id}/{파일명}` 입니다.
- 노드 본문을 HTML 로 보여줄 때는 항상 `src/lib/markdown.ts` 의 `renderMarkdown`(marked → DOMPurify)을 거칩니다. 링크는 http/https/mailto 만 허용합니다.
- Anthropic API 키는 Edge Function 시크릿에만 있습니다. AI 출력은 제안일 뿐이며 사용자가 승인하기 전에는 아무것도 반영되지 않습니다.

## 개발 참고

- **그래프 플레이그라운드**: dev 서버에서 `/__dev/graph` 를 열면 로그인과 DB 없이 그래프 상호작용(연결, 드래그)만 시험할 수 있습니다. 프로덕션 빌드에는 포함되지 않습니다.
- **shadcn/ui 는 Base UI 기반**입니다. Radix 의 `asChild` 대신 `render` prop 을, 메뉴 아이템에는 `onSelect` 대신 `onClick` 을 씁니다.
- 스키마를 바꿀 때는 새 마이그레이션 파일을 추가하고(`YYYYMMDDHHMMSS_이름.sql`), 테이블을 만들면 같은 파일에서 RLS 정책까지 작성합니다. 그 뒤 DB 타입을 재생성하고 CLAUDE.md 의 데이터 모델 요약을 맞춥니다.

## 배포

`npm run build` 로 만든 `dist/` 는 정적 파일이라 어떤 정적 호스팅에도 올릴 수 있습니다. 두 가지만 맞추면 됩니다.

- 클라이언트 라우팅을 쓰므로 모든 경로가 `index.html` 로 돌아가도록 설정합니다(SPA fallback).
- 빌드 시점의 환경 변수가 번들에 들어가므로, 호스팅 서비스의 빌드 환경에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 를 넣습니다.

호스팅 서비스는 아직 정하지 않았습니다.

## 로드맵

- **Phase 1 (현재)**: 위 기능. AI 태그 제안은 구현·배포돼 있고 키 등록만 보류 상태
- **Phase 2**: AI 연결 추천(임베딩 기반), AI 요약으로 카드 생성, 워크스페이스 공유·협업
- **Phase 3**: 워크스페이스 간 노드 연결, 의미 기반 검색 고도화

자세한 범위는 PRD 8장, 실제 진행과 결정 사항은 PROGRESS.md 에 있습니다.
