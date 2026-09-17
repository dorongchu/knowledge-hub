# PROGRESS — 지식정리 웹앱

## 현재 상태
인프라·프론트엔드 골격·로그인·워크스페이스 CRUD·노드 CRUD·그래프뷰·문서뷰(TipTap + sanitize) 완료. 남은 Phase 1: 태그, 엣지, 검색, AI auto-tag. (2026-09-13 기준)

- Supabase CLI: `npx supabase` (devDependency, v2.117.0). 서울 리전 프로젝트 `tqcvtmrozdtqqawwvlbm` 에 링크됨 (2026-09-17 뭄바이에서 이전. ref: `supabase/.temp/project-ref`).
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
- [x] 수동 태그 CRUD (카테고리 + 자유 태그) — 사용자 브라우저 테스트 통과(2026-09-17). `features/tag/{api,useTags,NodeTagBar,TagManagerDialog}.tsx`
- [x] 수동 노드 간 연결(엣지) 생성 — 사용자 브라우저 테스트 통과(2026-09-17, easy-connect + 플로팅 엣지 개선 포함). `features/edge/{api,useEdges}.ts`, `graph-view/{GraphView,EdgePanel}.tsx`
- [x] 텍스트 검색 (fuse.js) — 사용자 브라우저 테스트 통과(2026-09-17). `features/search/{searchIndex,Highlight,SearchInput,GlobalSearch}.tsx`, `lib/plainText.ts`
- [ ] 태그 검색·필터 (PRD 4.5, 2026-09-17 추가) — 텍스트 검색 색인에서 태그 제거(`searchIndex.ts` keys, `DocView` 의 tagNames 전달, 태그 칩 강조 제거) + 문서뷰 사이드바 태그 필터(이름 검색, 카테고리별 묶음, 노드 수, 복수 선택 AND 기본/OR 전환, 칩 클릭으로 필터, 텍스트 검색과 병용). 두 변경은 함께 배포(태그 제외만 먼저 하면 태그로 찾을 방법이 없어짐)
- [x] 노션 Markdown 가져오기 (PRD 11장) — 사용자가 실제 노션 내보내기로 테스트 통과(2026-09-17). 파싱 로직은 브라우저에서 모의 노션 zip 으로 검증(한글 파일명, 32자리 ID 제거, BOM/CRLF, 중첩 zip, 이미지·CSV·1 MB 초과 건너뛰기, __MACOSX 무시). `features/import/{parseNotion.ts,ImportDialog.tsx}`, `node/api.ts createNodes`, `useNodes.createMany`

### AI 기능 (Edge Function)
- [ ] `auto-tag` 함수: 세션 검증 + 소유권 검증 + 레이트리밋 → 태그 후보를 응답으로만 반환(DB 미기록) → 편집기 "태그 제안 받기" 버튼 + 임시 표시 승인 UI → 승인분만 `tags`/`node_tags(source: ai)` 저장. 세션 내 노드별 마지막 제안은 메모리 보관
- [ ] Edge Function 공통 미들웨어(인증/소유권/레이트리밋) 먼저 구현 후 개별 함수에 적용

## 프론트엔드 결정 사항 (2026-09-13)
- DB 타입: `src/lib/database.types.ts` (`npx supabase gen types typescript --linked --schema public`). 스키마 변경 시 재생성
- shadcn/ui는 base-nova 스타일 = **Base UI 기반** (Radix 아님). `asChild` 대신 `render` prop, 메뉴 아이템은 `onSelect` 대신 `onClick`, `AlertDialogAction`은 일반 Button이라 자동으로 닫히지 않음
- 데이터 fetch는 라이브러리 없이 훅(useState/useEffect)으로. 변경 후 목록 재조회로 서버 상태와 동기화
- 하위 라우트(그래프뷰/문서뷰)는 `useWorkspaceContext()`(WorkspacePage의 Outlet context)로 현재 워크스페이스 접근
- 다이얼로그 폼 상태는 DialogContent 안의 내부 컴포넌트에 두어 열릴 때마다 초기화 (effect로 리셋하지 않음)
- 노드: WorkspacePage의 `WorkspaceBody`에서 `useNodes(workspaceId)` 한 번 호출 → Outlet context 로 그래프뷰/문서뷰 공유(현재 형태는 아래 성능 조사 B 참고). 목록 조회 시 `embedding` 컬럼 제외
- 노드 편집: 선택 노드는 URL `/w/:id/doc/:nodeId`. 제목/본문은 0.8초 디바운스 자동저장 + Ctrl/Cmd+S 즉시 저장, 타입 변경은 즉시 저장, 언마운트 시 잔여 변경분 flush. 목록은 로컬 갱신(재정렬 없음)
- 새 노드는 빈 제목으로 생성(DB default), 화면에서 "제목 없음" 대체 표시, 제목 입력창 자동 포커스
- 태그: `useTags(workspace.id)` 를 WorkspaceBody 에서 한 번 호출 → Outlet context `{ workspace, nodes, tags }`. 노드-태그 연결은 `node_tags` + `nodes!inner(workspace_id)` 조인으로 워크스페이스 단위 일괄 조회, 로컬 상태 갱신(재조회 없음)
- 태그 UI: 편집기 제목 아래 `NodeTagBar`(칩 + 검색/생성 팝오버, 한글 조합 중 Enter 무시), 문서뷰 사이드바의 "태그 관리" 다이얼로그(카테고리 CRUD, 태그 이름 변경/카테고리 이동/삭제, 2단계 삭제 확인). 카테고리 삭제 시 소속 태그는 자유 태그로 남음(FK set null). AI 승인 태그는 칩에 ✨ 표시(source='ai') — auto-tag 단계에서 사용
- 엣지: `useEdges(workspace.id)` 를 WorkspaceBody 에서 호출 → Outlet context `{ workspace, nodes, tags, edges }`. 수동 연결은 `source='manual', status='confirmed'` 로 바로 확정. rejected 는 조회에서 제외, suggested 는 점선 스타일(Phase 2 대비 렌더만, 승인 UI 없음)
- 그래프 연결 UX 개선(2026-09-17, 사용자 제보: 나란한 노드/중간에 노드가 있을 때 연결이 잘 안 됨): 원인은 받는 점이 위쪽 중앙 10px 점 하나(반경 20px)뿐이었던 것. → (1) 연결 드래그 중에는 노드 전체를 덮는 투명 target 핸들이 활성화되어 노드 어디에 놓아도 연결(`useConnection().inProgress` 로 pointer-events 토글, 평소엔 꺼서 노드 드래그 방해 없음), (2) source 점을 상하좌우 4곳에, (3) `FloatingEdge`: 끝점을 핸들이 아니라 두 노드의 상대 위치로 계산(DB에 핸들 정보를 저장하지 않으므로 새로고침 후에도 동일). 공용 설정은 `graph-view/flowConfig.ts`
- 개발 전용 `/__dev/graph` (`GraphPlayground.tsx`, `import.meta.env.DEV` 일 때만 라우트 등록, 프로덕션 번들 제외): 로그인/DB 없이 같은 노드·엣지 컴포넌트로 연결 상호작용을 시험. 재현·회귀 확인은 여기서 JS 마우스 이벤트로 수행
- (이전 방식, 대체됨) 그래프 연결 UX: 아래 Handle(source) → 위 Handle(target) 드래그. `isValidConnection` 으로 자기 연결·같은 방향 중복을 DB 제약과 같은 기준으로 사전 차단(A→B 와 B→A 는 둘 다 허용). 엣지 클릭 → `EdgePanel`(라벨 편집: Enter/blur 저장, 2단계 삭제). 키보드 Delete 삭제는 비활성(`deleteKeyCode={null}`)
- 문서뷰 편집기 하단에 연결된 노드 목록(방향 화살표 + 라벨, 클릭 시 해당 노드로 이동) — 읽기 전용, 생성/편집은 그래프뷰에서만
- 검색: fuse.js 클라이언트 검색. (태그는 PRD v0.3 에서 텍스트 검색 대상 제외로 결정 — 태그 검색·필터 구현 때 함께 제거 예정) 현재 색인 대상은 제목(0.5)·태그 이름(0.3)·본문 평문(0.2, `markdownToPlainText`), threshold 0.34, ignoreLocation, 연속 2글자 이상 일치 필요, 검색어 2글자 이상. 워크스페이스 내 검색은 문서뷰 사이드바(이미 불러온 노드/태그로 색인, `useDeferredValue`), 전체 검색은 홈 화면(첫 포커스 때 내 모든 노드의 제목·본문을 한 번 조회, 태그 제외). 강조는 `<mark>` React 노드로만 렌더(HTML 주입 없음)
- 가져오기: 파싱은 전부 브라우저(`fflate`), 원본 미전송. 제한 상수는 `parseNotion.ts`(파일당 1 MB, 200개, zip 100 MB, card 기준 평문 500자). 제목만 있고 본문이 빈 페이지도 후보로 포함(노션의 빈 페이지). 일괄 insert 는 25개 또는 약 1.5 MB 단위로 나눠 요청, 중간 실패 시 성공분은 목록에 반영하고 결과 화면에 표시. 진입점은 문서뷰 사이드바의 가져오기 아이콘
- 렌더 링크 정책(`lib/markdown.ts`): http/https/mailto 만 href 허용(`ALLOWED_URI_REGEXP`). 노션 내보내기의 상대 경로 링크·이미지는 주소가 제거되고 글자/대체 텍스트만 남음 (PRD 11.3 의 내부 링크→엣지 변환 확장 때 재검토)
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

## 성능 조사 (2026-09-17, "검색 후 이동 시 로딩이 느림")
- Supabase 프로젝트 리전이 `ap-south-1`(뭄바이). 한국에서 REST 요청 1회 0.2~0.9초(측정: 0.28/0.52/0.65/0.86초, 1회 7.2초 스파이크. keep-alive 재사용 시에도 0.17~0.73초)
- 워크스페이스 진입 시 요청 구조: `getWorkspace`(1회) 완료 후에야 `useNodes`(1) + `useTags`(3) + `useEdges`(1) 5개가 병렬 시작 → 왕복 2단계 직렬. 2단계는 5개 중 가장 느린 요청이 좌우(지연 편차가 커서 태그·엣지 추가 후 체감 악화). 진입할 때마다 전부 재조회(캐시 없음)
- 문서뷰 lazy 청크 첫 로드: dev 모드 약 0.3초(요청 16개). 프로덕션은 단일 파일 485 kB(gzip 152 kB). 페이지 로드당 1회
- **적용됨 (B, 2026-09-17)**: `WorkspaceBody` 를 워크스페이스 행 조회 완료 전에 URL 의 id 만으로 즉시 마운트(`key={workspaceId}`) → getWorkspace + nodes + tags(3) + edges 6개 요청이 동시에 시작, 하위 뷰 lazy 청크도 같은 시점에 로드 시작(D 의 일부 효과). Outlet context 는 `{ workspaceId, workspace: Workspace | null, nodes, tags, edges }` 로 변경 — 하위 뷰는 `workspaceId` 를 쓰고, `workspace` 가 null 인 동안은 빈 상태 문구를 띄우지 않음. 권한은 RLS 가 요청마다 검사. 실제 로그인 화면에서의 동시 시작 여부는 사용자 확인 대기(자동화 브라우저 미로그인)
- **적용됨 (A, 2026-09-17)**: 서울 리전 `ap-northeast-2` 새 프로젝트(ref `tqcvtmrozdtqqawwvlbm`)로 이전. 사용자가 프로젝트 생성 + `link` + `db push`(마이그레이션 3개 적용 확인), `.env` 를 새 URL/publishable key 로 교체, 타입 재생성 결과 diff 없음(스키마 동일). 데이터는 새로 시작(이전 안 함). 측정: 새 연결 0.09~0.13초(첫 요청 0.84초), keep-alive 0.03~0.08초 ← 뭄바이 0.17~0.9초. 사용자 재가입 후 정상 동작 확인(2026-09-17). 남은 일: 며칠 사용 후 뭄바이 프로젝트(`zdtsuqtakmohdzingiou`) 일시정지/삭제
- 개선안(나머지 미적용, 우선순위순): (A) 프로젝트를 서울 리전 `ap-northeast-2` 로 이전 — 리전은 변경 불가라 새 프로젝트 생성 + `db push` + 계정 재가입 + 데이터 이전 + `.env` 교체 필요, 데이터가 적은 지금이 가장 쌈 (B) 직렬 제거: URL 의 workspaceId 로 nodes/tags/edges 를 workspace 조회와 동시에 시작 (C) 5개 요청을 PostgREST 임베드 select 또는 RPC 로 1~2개로 합치기 (D) 홈 화면 idle 때 GraphView/DocView 청크 prefetch (E) 워크스페이스 데이터 세션 캐시(stale-while-revalidate)

## 최적화 후보 (필요해질 때)
- 노드 목록 조회에서 본문 분리: 지금은 `listNodes` 가 모든 노드의 content 를 한 번에 가져옴(그래프 발췌·미리보기용). 노드 수/본문 총량이 커지면 목록은 발췌만, 본문은 선택 시 개별 조회로 변경
- 전체 검색은 모든 노드의 본문을 한 번에 조회해 브라우저에서 색인 — 노드가 아주 많아지면 Postgres full-text 또는 Phase 3 의미 검색(pgvector)으로 서버 검색 전환
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
1. 태그 검색·필터(PRD 4.5) → auto-tag Edge Function
2. 노션 Markdown 가져오기(PRD 11장) → auto-tag Edge Function
