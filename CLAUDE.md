# CLAUDE.md — 지식정리 웹앱

이 문서는 Claude Code가 이 프로젝트에서 작업할 때 항상 참고해야 하는 규칙과 맥락이다.
전체 설계 근거는 `지식정리앱_설계문서.md`(PRD)를 참고. 여기는 구현 시 지켜야 할 것만 압축.

## 프로젝트 개요

개인 지식/학습 내용을 그래프(마인드맵)와 문서(노트) 두 형태로 통합 관리하는 웹앱.
워크스페이스(주제별 공간) 안에 노드(카드/문서)를 만들고, AI가 태깅·요약·연결을 제안하면 사용자가 승인한다.
초기엔 1인 사용, 데이터 모델은 멀티유저 협업 확장을 전제로 설계됨.

## 기술 스택 (고정)

- 프론트엔드: React + TypeScript, Vite
- 그래프: `@xyflow/react`
- 에디터: TipTap (ProseMirror 헤드리스) — AI 제안을 커스텀 노드/하이라이트로 인라인 표시
- 검색: `fuse.js`(텍스트) + Supabase `pgvector`(의미 검색)
- 백엔드/DB: Supabase (Auth, Postgres, pgvector, Realtime, Storage)
- AI: Anthropic Claude API — **반드시 Supabase Edge Function을 통해서만 호출** (클라이언트 직접 호출 금지)
- 스타일: Tailwind CSS + shadcn/ui

## 절대 규칙 (위반 시 재작업 대상)

1. **Anthropic API 키를 클라이언트 번들에 절대 넣지 않는다.** 모든 AI 호출은 Edge Function(`auto-tag`, `summarize`, `suggest-connections`)을 경유한다.
2. **모든 테이블에 RLS를 켠다.** 새 테이블을 만들면 그 자리에서 바로 RLS 정책까지 작성한다 — "나중에" 없음.
3. **Edge Function은 세션 검증 + 소유권 검증을 둘 다 한다.** 로그인 여부만 확인하고 넘어가지 않는다 (요청된 node/workspace가 요청자 소유인지 매번 확인).
4. **Storage 버킷은 private.** 첨부파일 접근은 signed URL로만.
5. **AI 출력은 항상 "제안" 상태로 저장하고 사용자 승인 후 확정한다.** 자동 반영 경로를 만들지 않는다 (프롬프트 인젝션 방어의 핵심 장치).
6. **노드 콘텐츠 렌더링 시 DOMPurify 등으로 sanitize한다.**
7. **AI 호출은 사용자/워크스페이스별 레이트리밋을 건다.**

## 데이터 모델 (요약 — 상세는 PRD 6장)

```
workspaces (id, owner_id, name, created_at, updated_at)  -- updated_at: 홈 화면 최근 수정순 정렬용, 노드 변경 시 트리거로 갱신
nodes (id, workspace_id, type: card|doc, title, content, embedding vector(1024), created_at, updated_at)  -- 1024 = Voyage voyage-3 계열
categories (id, workspace_id, name)
tags (id, workspace_id, name, category_id nullable)
node_tags (node_id, tag_id, source: ai|manual)
edges (id, workspace_id, source_node_id, target_node_id, label, source: ai|manual, status: suggested|confirmed|rejected)
workspace_members (workspace_id, user_id, role)  -- MVP엔 owner만
attachments (id, node_id, storage_path, file_name, mime_type, created_at)
```

임베딩 전략: 문서형(doc) 노드는 원문 대신 AI 요약본을 임베딩 (긴 텍스트 직접 임베딩 금지 — 의미 희석).

마이그레이션: `supabase/migrations/YYYYMMDDHHMMSS_이름.sql` (Supabase CLI 규약). 소유권 검증은 `public.is_workspace_owner(uuid)` / `public.is_node_owner(uuid)` 헬퍼 함수로 통일 — Phase 2 협업 확장 시 이 두 함수만 수정. Storage 경로 규칙은 `{workspace_id}/{node_id}/{file_name}`.

## 폴더 구조 (제안)

```
/src
  /features
    /workspace
    /graph-view
    /doc-view
    /search
  /components (shadcn 기반 공용 컴포넌트)
  /lib (supabase client, api wrapper)
/supabase
  /functions
    /auto-tag
    /summarize
    /suggest-connections
  /migrations
```

## 작업 방식

- 새 세션 시작 시 `PROGRESS.md`를 먼저 읽고 현재 상태 파악
- 기능 단위로 작업 후 `PROGRESS.md` 갱신
- 스키마 변경은 Supabase migration 파일로 관리, CLAUDE.md의 데이터 모델 요약도 동기화
- MVP 범위(PRD 8장 Phase 1) 밖의 기능은 구현하지 않음 — 임의로 Phase 2/3 기능 선반영 금지
