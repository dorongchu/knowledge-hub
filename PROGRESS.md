# PROGRESS — 지식정리 웹앱

## 현재 상태
인프라·프론트엔드 골격·로그인 완료. 워크스페이스 CRUD 구현 및 브라우저 동작 확인 완료. git 저장소 GitHub 연동됨. (2026-09-13 기준)

- Supabase CLI: `npx supabase` (devDependency, v2.117.0). 프로젝트 링크됨 (ref: `supabase/.temp/project-ref`).
- 마이그레이션 (2026-09-13 `db push` 성공):
  - `supabase/migrations/20260913000001_init_schema.sql` — pgvector, enum, 헬퍼 함수, 8개 테이블 + 각 테이블 RLS
  - `supabase/migrations/20260913000002_storage_attachments.sql` — `attachments` private 버킷 + storage.objects 정책
- 프론트엔드: Vite 8 + React 19 + TS 6, Tailwind v4(`@tailwindcss/vite`), shadcn/ui(base-nova, neutral), react-router v7, `@` → `src/` 별칭
  - Node 22.23.2에서 `npm run build` 성공 (단일 청크 524 kB 경고 — 그래프/에디터 추가 시 code-split 검토)
  - `.env` 생성됨 (URL + publishable key, gitignore 대상). `.claude/launch.json`에 dev 서버 설정(포트 5173)
  - oxlint 경고 2건(react-refresh only-export-components: AuthProvider.tsx의 useAuth, shadcn button.tsx) — 동작 무관, 보류

## Phase 1 (MVP) 체크리스트

### 인프라
- [x] Supabase 프로젝트 생성, pgvector extension 활성화 (2026-09-13 db push 성공)
- [x] 스키마 마이그레이션 작성 (workspaces, nodes, categories, tags, node_tags, edges, workspace_members, attachments)
- [x] 전체 테이블 RLS 정책 작성 (owner_id 기준)
- [x] Storage 버킷 생성 (private) + RLS 정책 — 마이그레이션 0002
- [x] 마이그레이션 적용 (`npx supabase db push` 성공, 2026-09-13)

### 프론트엔드 기본 골격
- [x] Vite + React + TS 프로젝트 셋업 (Tailwind v4 + shadcn/ui 포함) — 빌드 성공, 로그인 페이지 렌더링 확인
- [x] Supabase Auth 연동 (로그인/세션) — 이메일+비밀번호. `features/auth/{AuthProvider,RequireAuth,LoginPage}.tsx`. 실기기 테스트 미완
- [x] 라우팅: 워크스페이스 목록 → 워크스페이스 상세(그래프뷰/문서뷰 탭) — `/`, `/login`, `/w/:id/graph|doc`. 상세/뷰는 자리표시자
- [x] 실제 가입/로그인 동작 확인 (2026-09-13)

### 핵심 기능
- [x] 워크스페이스 CRUD — `features/workspace/{api,useWorkspaces,WorkspaceDialogs,WorkspaceListPage,WorkspacePage}.tsx`. 목록(최근 수정순, 노드 수), 생성→상세 이동, 이름 변경, 삭제(확인 다이얼로그) 브라우저 검증 완료
- [ ] 노드 CRUD (카드/문서 타입)
- [ ] 그래프뷰 (`@xyflow/react`) — 노드 표시, 클릭 시 미리보기, 더블클릭 시 문서뷰 전환
- [ ] 문서뷰 (TipTap 에디터) — 노드 트리, Markdown 저장, sanitize 렌더링
- [ ] 수동 태그 CRUD (카테고리 + 자유 태그)
- [ ] 수동 노드 간 연결(엣지) 생성
- [ ] 텍스트 검색 (fuse.js)

### AI 기능 (Edge Function)
- [ ] `auto-tag` 함수: 세션 검증 + 소유권 검증 + 레이트리밋 → 태그 제안 → 승인 UI
- [ ] Edge Function 공통 미들웨어(인증/소유권/레이트리밋) 먼저 구현 후 개별 함수에 적용

## 프론트엔드 결정 사항 (2026-09-13)
- DB 타입: `src/lib/database.types.ts` (`npx supabase gen types typescript --linked --schema public`). 스키마 변경 시 재생성
- shadcn/ui는 base-nova 스타일 = **Base UI 기반** (Radix 아님). `asChild` 대신 `render` prop, 메뉴 아이템은 `onSelect` 대신 `onClick`, `AlertDialogAction`은 일반 Button이라 자동으로 닫히지 않음
- 데이터 fetch는 라이브러리 없이 훅(useState/useEffect)으로. 변경 후 목록 재조회로 서버 상태와 동기화
- 하위 라우트(그래프뷰/문서뷰)는 `useWorkspaceContext()`(WorkspacePage의 Outlet context)로 현재 워크스페이스 접근
- 다이얼로그 폼 상태는 DialogContent 안의 내부 컴포넌트에 두어 열릴 때마다 초기화 (effect로 리셋하지 않음)

## 스키마 결정 사항 (2026-09-13)
- 임베딩 차원: `vector(1024)` (Voyage voyage-3 계열 기준). HNSW cosine 인덱스 생성됨
- `workspaces.updated_at` 추가 (PRD 원안에 없음). 노드 insert/update/delete 시 트리거로 갱신
- `edges.workspace_id`는 MVP에서 NOT NULL. 워크스페이스 간 연결(Phase 3)은 그때 마이그레이션으로 완화
- `edges` 양 끝 노드, `tags.category_id`는 복합 FK로 같은 workspace 소속 강제. `node_tags`는 트리거로 검증
- `workspace_members`: workspace 생성 시 트리거로 owner 행 자동 삽입. RLS는 PRD 10.1대로 owner_id 기준
- 소유권 검증 헬퍼: `is_workspace_owner(uuid)`, `is_node_owner(uuid)`, `is_attachment_path_owner(text)` (security definer)
- Storage 경로 규칙: `{workspace_id}/{node_id}/{file_name}`, 버킷 파일 크기 제한 10 MiB

## 미결 사항 (확인 필요)
- AI 태그 제안 저장 방식: PRD의 `node_tags`에는 `status` 컬럼이 없음. 현재 스키마는 "AI 제안은 클라이언트에 임시 표시 → 승인 시 `source='ai'`로 insert" 흐름을 전제. edges처럼 DB에 suggested 상태로 저장하려면 `node_tags.status` 추가 마이그레이션 필요

## Phase 2 (미착수)
- [ ] AI 연결 추천 (임베딩 기반, 문서는 요약본 임베딩)
- [ ] AI 요약 → 카드 자동 생성
- [ ] 워크스페이스 공유/협업 (workspace_members role 세분화)
- [ ] edges rejected 상태 반영 (재추천 방지)

## Phase 3 (미착수)
- [ ] 워크스페이스 간 노드 연결
- [ ] 의미 기반 검색 고도화

## 다음 세션에서 할 일
1. 노드 CRUD (`features/node` 또는 `features/workspace` 하위) — 카드/문서 타입, 제목/본문(Markdown), 목록은 그래프뷰·문서뷰 양쪽에서 공유
2. 그 다음 그래프뷰(@xyflow/react)
