import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { WORKSPACE_NAME_MAX, normalizeWorkspaceName } from './api'
import { toMessage } from './useWorkspaces'

interface NameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  initialName?: string
  submitLabel: string
  onSubmit: (name: string) => Promise<void>
}

/**
 * 생성/이름 변경 공용 다이얼로그.
 * 폼 상태는 DialogContent 안의 NameForm 에 두어, 닫히면 언마운트되고 열릴 때마다 초기값으로 새로 시작한다.
 */
export function WorkspaceNameDialog({ open, onOpenChange, title, description, initialName = '', submitLabel, onSubmit }: NameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <NameForm
          title={title}
          description={description}
          initialName={initialName}
          submitLabel={submitLabel}
          onSubmit={onSubmit}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function NameForm({
  title,
  description,
  initialName,
  submitLabel,
  onSubmit,
  onClose,
}: Omit<NameDialogProps, 'open' | 'onOpenChange' | 'initialName'> & { initialName: string; onClose: () => void }) {
  const [name, setName] = useState(initialName)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const normalized = normalizeWorkspaceName(name)
    if (!normalized) {
      setError(`이름은 1~${WORKSPACE_NAME_MAX}자여야 합니다.`)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(normalized)
      onClose()
    } catch (err) {
      setError(toMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="workspace-name">이름</Label>
        <Input
          id="workspace-name"
          autoFocus
          maxLength={WORKSPACE_NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 프론트엔드, 통계학"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
          취소
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? '처리 중…' : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceName: string
  nodeCount: number
  onConfirm: () => Promise<void>
}

export function WorkspaceDeleteDialog({ open, onOpenChange, workspaceName, nodeCount, onConfirm }: DeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <DeleteBody
          workspaceName={workspaceName}
          nodeCount={nodeCount}
          onConfirm={onConfirm}
          onClose={() => onOpenChange(false)}
        />
      </AlertDialogContent>
    </AlertDialog>
  )
}

function DeleteBody({
  workspaceName,
  nodeCount,
  onConfirm,
  onClose,
}: Omit<DeleteDialogProps, 'open' | 'onOpenChange'> & { onClose: () => void }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      setError(toMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>"{workspaceName}" 워크스페이스를 삭제할까요?</AlertDialogTitle>
        <AlertDialogDescription>
          안에 있는 노드 {nodeCount}개와 태그, 연결, 첨부파일이 모두 함께 삭제됩니다. 되돌릴 수 없습니다.
        </AlertDialogDescription>
      </AlertDialogHeader>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={submitting}>취소</AlertDialogCancel>
        {/* AlertDialogAction 은 일반 Button 이라 자동으로 닫히지 않는다. 완료 후 onClose 로 직접 닫는다 */}
        <AlertDialogAction variant="destructive" disabled={submitting} onClick={() => void handleConfirm()}>
          {submitting ? '삭제 중…' : '삭제'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  )
}
