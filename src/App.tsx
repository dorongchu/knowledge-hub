import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { LoginPage } from '@/features/auth/LoginPage'
import { WorkspaceListPage } from '@/features/workspace/WorkspaceListPage'
import { WorkspacePage } from '@/features/workspace/WorkspacePage'

// 무거운 뷰(React Flow, TipTap)는 라우트 단위로 분리 로드
const GraphView = lazy(() => import('@/features/graph-view/GraphView').then((m) => ({ default: m.GraphView })))
const DocView = lazy(() => import('@/features/doc-view/DocView').then((m) => ({ default: m.DocView })))

const viewFallback = <div className="flex h-full items-center justify-center text-sm text-muted-foreground">불러오는 중…</div>

/**
 * 라우트 구조 (PRD 4장)
 *   /login                      로그인
 *   /                           워크스페이스 목록 (홈)
 *   /w/:workspaceId             워크스페이스 상세 → /graph 로 리다이렉트
 *   /w/:workspaceId/graph       그래프뷰 탭
 *   /w/:workspaceId/doc         문서뷰 탭 (노드 미선택)
 *   /w/:workspaceId/doc/:nodeId 문서뷰 탭에서 특정 노드 편집
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/" element={<WorkspaceListPage />} />
        <Route path="/w/:workspaceId" element={<WorkspacePage />}>
          <Route index element={<Navigate to="graph" replace />} />
          <Route
            path="graph"
            element={
              <Suspense fallback={viewFallback}>
                <GraphView />
              </Suspense>
            }
          />
          <Route
            path="doc/:nodeId?"
            element={
              <Suspense fallback={viewFallback}>
                <DocView />
              </Suspense>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
