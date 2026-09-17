# PROGRESS — 지식정리 웹앱

## 현재 상태
인프라·프론트엔드 골격·로그인·워크스페이스 CRUD·노드 CRUD·그래프뷰·문서뷰(TipTap + sanitize) 완료. 남은 Phase 1: 태그, 엣지, 검색, AI auto-tag. (2026-09-13 기준)

- Supabase CLI: `npx supabase` (devDependency, v2.117.0). 프로젝트 링크됨 (ref: `supabase/.temp/project-ref`).
- 마이그레이션 (2026-09-13 `db push` 성공):
  - `supabase/migrations/20260913000001_init_schema.sql` — pgvector, enum, 헬퍼 함수, 8개 테이블 + 각 테이블 RLS
  - `supabase/migrations/20260913000002_storage_attachments.sql` — `attachments` private 버킷 + storage.objects 정책
  - `supabase/migrations/20260913000003_node_positions.sql` — `nodes.position_x/position_y` 추가, updated_at 트리거를 title/content/type 변경 시로 제한 (2026-09-13 push 완료)
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
- [x] 노드 CRUD (카드/문서 타입) — `features/node/{api,useNodes,NodeEditor}.tsx`, 문서뷰(`features/doc-view/DocView.tsx`)에 목록+편집기. 생성/자동저장/타입 변경/삭제/새로고침 유지 브라우저 검증 완료
- [x] 그래프뷰 (`@xyflow/react` v12) — `features/graph-view/{GraphView,KnowledgeFlowNode,NodePreviewPanel,layout,types}.tsx`. 노드 표시(카드/문서 크기·아이콘 구분), 클릭 시 우측 미리보기 패널, 더블클릭·"문서뷰에서 편집" 버튼으로 `/w/:id/doc/:nodeId` 전환. 브라우저 검증 완료(더블클릭·드래그는 JS 이벤트로 검증)
- [x] 문서뷰 (TipTap 에디터) — 노드 목록, Markdown 저장, sanitize 렌더링. `features/node/MarkdownEditor.tsx`(TipTap v3 + `@tiptap/markdown`, 툴바), `lib/markdown.ts`(marked + DOMPurify), `components/MarkdownView.tsx`(그래프 미리보기에 사용). 브라우저 검증: 자동저장, H1 서식 Markdown 왕복, script/onerror/javascript: 제거 확인
- [ ] 수동 태그 CRUD (카테고리 + 자유 태그)
- [ ] 수동 노드 간 연결(엣지) 생성
- [ ] 텍스트 검색 (fuse.js)
- [ ] 노션 Markdown 가져오기 (`features/import`) — .zip/.md 업로드 → 미리보기 → 노드 생성. PRD 11장 (2026-09-17 추가)

### AI 기능 (Edge Function)
- [ ] `auto-tag` 함수: 세션 검증 + 소유권 검증 + 레이트리밋 → 태그 후보를 응답으로만 반환(DB 미기록) → 편집기 "태그 제안 받기" 버튼 + 임시 표시 승인 UI → 승인분만 `tags`/`node_tags(source: ai)` 저장. 세션 내 노드별 마지막 제안은 메모리 보관
- [ ] Edge Function 공통 미들웨어(인증/소유권/레이트리밋) 먼저 구현 후 개별 함수에 적용

## 프론트엔드 결정 사항 (2026-09-13)
- DB 타입: `src/lib/database.types.ts` (`npx supabase gen types typescript --linked --schema public`). 스키마 변경 시 재생성
- shadcn/ui는 base-nova 스타일 = **Base UI 기반** (Radix 아님). `asChild` 대신 `render` prop, 메뉴 아이템은 `onSelect` 대신 `onClick`, `AlertDialogAction`은 일반 Button이라 자동으로 닫히지 않음
- 데이터 fetch는 라이브러리 없이 훅(useState/useEffect)으로. 변경 후 목록 재조회로 서버 상태와 동기화
- 하위 라우트(그래프뷰/문서뷰)는 `useWorkspaceContext()`(WorkspacePage의 Outlet context)로 현재 워크스페이스 접근
- 다이얼로그 폼 상태는 DialogContent 안의 내부 컴포넌트에 두어 열릴 때마다 초기화 (effect로 리셋하지 않음)
- 노드: WorkspacePage의 `WorkspaceBody`에서 `useNodes(workspace.id)` 한 번 호출 → Outlet context `{ workspace, nodes }` 로 그래프뷰/문서뷰 공유. 목록 조회 시 `embedding` 컬럼 제외
- 노드 편집: 선택 노드는 URL `/w/:id/doc/:nodeId`. 제목/본문은 0.8초 디바운스 자동저장 + Ctrl/Cmd+S 즉시 저장, 타입 변경은 즉시 저장, 언마운트 시 잔여 변경분 flush. 목록은 로컬 갱신(재정렬 없음)
- 새 노드는 빈 제목으로 생성(DB default), 화면에서 "제목 없음" 대체 표시, 제목 입력창 자동 포커스
- 본문 편집: TipTap v3 `useEditor({ content, contentType: 'markdown' })` 로 Markdown 파싱, `editor.getMarkdown()` 으로 직렬화(마크다운 특수문자는 백슬래시 이스케이프됨). 노드 전환 시 `key` 로 에디터 재마운트. 툴바 상태는 `useEditorState` 셀렉터로 구독
- 본문 렌더(읽기): 반드시 `renderMarkdown()`(marked → DOMPurify, style/form/iframe 등 금지, 링크는 target=_blank + noopener) → `MarkdownView`. 다른 곳에서 `dangerouslySetInnerHTML` 직접 사용 금지
- Tailwind `@tailwindcss/typography` 플러그인(`prose` 클래스)으로 에디터/뷰 스타일 통일
- 라우트 lazy import 적용: index 355 kB / GraphView 253 kB / DocView 461 kB (gzip 114/83/145 kB)
- 그래프 노드 위치: `nodes.position_x/position_y` 에 영구 저장 (null 이면 격자 자동 배치). 드래그 종료 시 `nodes.update` 로 저장, 실패는 무시(다음 새로고침 때 마지막 저장 위치). 위치 변경은 `updated_at` 을 바꾸지 않음 (트리거 조건) → 목록 정렬/홈 최근 수정순에 영향 없음
- 그래프 미리보기 패널은 본문을 원문 텍스트(`<pre>`)로 표시 → HTML 렌더 아님. Markdown 렌더(+DOMPurify) 컴포넌트는 문서뷰 단계에서 만들어 재사용

## 스키마 결정 사항 (2026-09-13)
- 임베딩 차원: `vector(1024)` (Voyage voyage-3 계열 기준). HNSW cosine 인덱스 생성됨
- `workspaces.updated_at` 추가 (PRD 원안에 없음). 노드 insert/update/delete 시 트리거로 갱신
- `edges.workspace_id`는 MVP에서 NOT NULL. 워크스페이스 간 연결(Phase 3)은 그때 마이그레이션으로 완화
- `edges` 양 끝 노드, `tags.category_id`는 복합 FK로 같은 workspace 소속 강제. `node_tags`는 트리거로 검증
- `workspace_members`: workspace 생성 시 트리거로 owner 행 자동 삽입. RLS는 PRD 10.1대로 owner_id 기준
- 소유권 검증 헬퍼: `is_workspace_owner(uuid)`, `is_node_owner(uuid)`, `is_attachment_path_owner(text)` (security definer)
- Storage 경로 규칙: `{workspace_id}/{node_id}/{file_name}`, 버킷 파일 크기 제한 10 MiB

## 최적화 후보 (필요해질 때)
- 노드 목록 조회에서 본문 분리: 지금은 `listNodes` 가 모든 노드의 content 를 한 번에 가져옴(그래프 발췌·미리보기용). 노드 수/본문 총량이 커지면 목록은 발췌만, 본문은 선택 시 개별 조회로 변경
- 자동저장이 본문 전체를 전송 — 큰 문서에서 무거움. 가져오기 한도(파일당 1 MB)를 올리기 전에 함께 점검 (PRD 11.1)

## 결정 완료 (2026-09-17)
- AI 태그 제안: DB에 저장하지 않고 화면에만 임시 표시, 승인 시 저장. `node_tags.status` 컬럼 추가 없음 (PRD 5장, CLAUDE.md 규칙 5 문구 갱신)
- 자동 태깅 트리거: 자동저장(0.8초)마다가 아니라 "태그 제안 받기" 버튼으로만 호출
- 노션 Markdown 가져오기: Phase 1 마지막 핵심 기능으로 추가 (auto-tag 앞). 클라이언트 파싱, 이미지/CSV/내부 링크 엣지는 1차 제외

## Phase 2 (미착수)
- [ ] AI 연결 추천 (임베딩 기반, 문서는 요약본 임베딩)
- [ ] AI 요약 → 카드 자동 생성
- [ ] 워크스페이스 공유/협업 (workspace_members role 세분화)
- [ ] edges rejected 상태 반영 (재추천 방지)

## Phase 3 (미착수)
- [ ] 워크스페이스 간 노드 연결
- [ ] 의미 기반 검색 고도화

## 다음 세션에서 할 일
1. 수동 태그 CRUD — 카테고리 + 자유 태그. 워크스페이스 태그 관리 UI + 노드 편집기에서 태그 붙이기/떼기
2. 수동 엣지 생성(그래프에서 Handle 드래그, 라벨) → 텍스트 검색(fuse.js) → auto-tag Edge Function
