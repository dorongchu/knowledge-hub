import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from './AuthProvider'

type Mode = 'signin' | 'signup'

/**
 * 이메일 + 비밀번호 로그인/가입.
 * - 로그인 성공 시 onAuthStateChange → AuthProvider 세션 갱신 → 아래 Navigate 로 원래 위치 복귀
 * - 가입 시 Supabase 프로젝트의 "Confirm email" 설정이 켜져 있으면 메일 확인 후 로그인 가능
 */
export function LoginPage() {
  const { session, loading } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (!loading && session) {
    return <Navigate to={from} replace />
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setSubmitting(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setError(error.message)
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) {
          setError(error.message)
        } else if (!data.session) {
          // 이메일 확인이 켜진 프로젝트: 세션 없이 user만 반환됨
          setNotice('확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해 주세요.')
          setMode('signin')
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Knowledge Hub</CardTitle>
          <CardDescription>{mode === 'signin' ? '이메일로 로그인' : '새 계정 만들기'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {notice && <p className="text-sm text-muted-foreground">{notice}</p>}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? '처리 중…' : mode === 'signin' ? '로그인' : '가입'}
            </Button>

            <button
              type="button"
              className="w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin')
                setError(null)
                setNotice(null)
              }}
            >
              {mode === 'signin' ? '계정이 없나요? 가입하기' : '이미 계정이 있나요? 로그인'}
            </button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
