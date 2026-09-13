import { Navigate, Route, Routes } from 'react-router'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { LoginPage } from '@/features/auth/LoginPage'
import { WorkspaceListPage } from '@/features/workspace/WorkspaceListPage'
import { WorkspacePage } from '@/features/workspace/WorkspacePage'
import { GraphView } from '@/features/graph-view/GraphView'
import { DocView } from '@/features/doc-view/DocView'

/**
 * 라우트 구조 (PRD 4장)
 *   /login                      로그인
 *   /                           워크스페이스 목록 (홈)
 *   /w/:workspaceId             워크스페이스 상세 → /graph 로 리다이렉트
 *   /w/:workspaceId/graph       그래프뷰 탭
 *   /w/:workspaceId/doc         문서뷰 탭
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/" element={<WorkspaceListPage />} />
        <Route path="/w/:workspaceId" element={<WorkspacePage />}>
          <Route index element={<Navigate to="graph" replace />} />
          <Route path="graph" element={<GraphView />} />
          <Route path="doc" element={<DocView />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
