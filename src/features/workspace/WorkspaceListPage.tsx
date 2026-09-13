import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/AuthProvider'

/** 홈: 워크스페이스 카드 그리드 (PRD 4.1). 목록 조회/생성은 "워크스페이스 CRUD" 단계에서 구현. */
export function WorkspaceListPage() {
  const { session, signOut } = useAuth()

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">워크스페이스</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{session?.user.email}</span>
          <Button variant="outline" size="sm" onClick={signOut}>
            로그아웃
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          워크스페이스 목록은 다음 단계(워크스페이스 CRUD)에서 채워집니다.{' '}
          <Link to="/w/demo/graph" className="underline">
            상세 페이지 골격 보기
          </Link>
        </div>
      </section>
    </main>
  )
}
