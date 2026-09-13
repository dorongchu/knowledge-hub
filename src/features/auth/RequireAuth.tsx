import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './AuthProvider'

/** 로그인이 필요한 라우트를 감싼다. 미로그인 시 /login 으로 보내고, 로그인 후 원래 위치로 복귀. */
export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="flex h-dvh items-center justify-center text-muted-foreground">세션 확인 중…</div>
  }
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <Outlet />
}
