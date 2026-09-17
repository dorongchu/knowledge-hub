import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { MoreHorizontal, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/features/auth/AuthProvider'
import { GlobalSearch } from '@/features/search/GlobalSearch'
import { formatRelativeTime } from '@/lib/format'
import { useWorkspaces } from './useWorkspaces'
import { WorkspaceDeleteDialog, WorkspaceNameDialog } from './WorkspaceDialogs'
import type { WorkspaceSummary } from './api'

type DialogState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'rename'; target: WorkspaceSummary }
  | { kind: 'delete'; target: WorkspaceSummary }

/** 홈: 워크스페이스 카드 그리드, 최근 수정순, 노드 수 표시 (PRD 4.1) */
export function WorkspaceListPage() {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  const { items, loading, error, create, rename, remove } = useWorkspaces()
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' })

  const closeDialog = () => setDialog({ kind: 'none' })
  const workspaceNames = useMemo(() => new Map(items.map((w) => [w.id, w.name])), [items])

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">워크스페이스</h1>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">{session?.user.email}</span>
          <Button variant="outline" size="sm" onClick={signOut}>
            로그아웃
          </Button>
          <Button size="sm" onClick={() => setDialog({ kind: 'create' })}>
            <Plus data-icon="inline-start" />새 워크스페이스
          </Button>
        </div>
      </header>

      {items.length > 0 && <GlobalSearch workspaceNames={workspaceNames} />}

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          목록을 불러오지 못했습니다: {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="mb-3 text-sm text-muted-foreground">아직 워크스페이스가 없습니다. 주제별로 하나씩 만들어 보세요.</p>
          <Button onClick={() => setDialog({ kind: 'create' })}>
            <Plus data-icon="inline-start" />첫 워크스페이스 만들기
          </Button>
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((ws) => (
            <WorkspaceCard
              key={ws.id}
              workspace={ws}
              onOpen={() => navigate(`/w/${ws.id}`)}
              onRename={() => setDialog({ kind: 'rename', target: ws })}
              onDelete={() => setDialog({ kind: 'delete', target: ws })}
            />
          ))}
        </section>
      )}

      <WorkspaceNameDialog
        open={dialog.kind === 'create'}
        onOpenChange={(o) => !o && closeDialog()}
        title="새 워크스페이스"
        description="주제별로 지식을 모아두는 공간입니다."
        submitLabel="만들기"
        onSubmit={async (name) => {
          const ws = await create(name)
          navigate(`/w/${ws.id}`)
        }}
      />

      <WorkspaceNameDialog
        open={dialog.kind === 'rename'}
        onOpenChange={(o) => !o && closeDialog()}
        title="이름 변경"
        initialName={dialog.kind === 'rename' ? dialog.target.name : ''}
        submitLabel="저장"
        onSubmit={async (name) => {
          if (dialog.kind === 'rename') await rename(dialog.target.id, name)
        }}
      />

      <WorkspaceDeleteDialog
        open={dialog.kind === 'delete'}
        onOpenChange={(o) => !o && closeDialog()}
        workspaceName={dialog.kind === 'delete' ? dialog.target.name : ''}
        nodeCount={dialog.kind === 'delete' ? dialog.target.node_count : 0}
        onConfirm={async () => {
          if (dialog.kind === 'delete') await remove(dialog.target.id)
        }}
      />
    </main>
  )
}

interface CardProps {
  workspace: WorkspaceSummary
  onOpen: () => void
  onRename: () => void
  onDelete: () => void
}

function WorkspaceCard({ workspace, onOpen, onRename, onDelete }: CardProps) {
  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle className="truncate">{workspace.name}</CardTitle>
        <DropdownMenu>
          {/* Base UI: asChild 대신 render prop. 카드 클릭(onOpen)으로 전파되지 않게 막는다 */}
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" aria-label="워크스페이스 메뉴" />}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          {/* 포털로 렌더되지만 React 이벤트는 트리를 따라 카드까지 버블링되므로 여기서도 차단 */}
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={onRename}>이름 변경</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
        <span>노드 {workspace.node_count}개</span>
        <time dateTime={workspace.updated_at}>{formatRelativeTime(workspace.updated_at)}</time>
      </CardContent>
    </Card>
  )
}
