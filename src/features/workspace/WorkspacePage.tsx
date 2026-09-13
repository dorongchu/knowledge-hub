import { Link, NavLink, Outlet, useParams } from 'react-router'
import { cn } from '@/lib/utils'

/**
 * 워크스페이스 상세 (PRD 4.2). 그래프뷰 ↔ 문서뷰를 탭으로 전환.
 * 탭 상태는 URL(/w/:workspaceId/graph | /doc)에 두어 새로고침·공유 시 유지된다.
 */
export function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'rounded-md px-3 py-1.5 text-sm transition-colors',
      isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
    )

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-4 border-b px-4 py-2">
        <Link to="/" className="text-sm text-muted-foreground hover:underline">
          ← 워크스페이스
        </Link>
        <h1 className="truncate font-medium">워크스페이스 {workspaceId}</h1>
        <nav className="ml-auto flex gap-1">
          <NavLink to="graph" className={tabClass}>
            그래프뷰
          </NavLink>
          <NavLink to="doc" className={tabClass}>
            문서뷰
          </NavLink>
        </nav>
      </header>
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
