import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toMessage } from '@/features/workspace/useWorkspaces'
import { FOLDER_NAME_MAX, isDuplicateFolderError, normalizeFolderName } from './api'
import type { FoldersApi } from './useFolders'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  folders: FoldersApi
  /** folderId → 소속 노드 수 (삭제 확인 문구용) */
  countOf: (folderId: string) => number
  /** 폴더 삭제 뒤 노드 목록의 folder_id 를 로컬에서 비우기 위해 호출 */
  onDeleted: (folderId: string) => void
}

/** 폴더 관리 (PRD 12.3): 생성 / 이름 변경 / 순서 / 삭제 */
export function FolderManagerDialog({ open, onOpenChange, folders, countOf, onDeleted }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>폴더 관리</DialogTitle>
          <DialogDescription>폴더는 이 워크스페이스 안에서 노드를 묶는 선택 사항입니다. 노드는 폴더 하나에만 속합니다.</DialogDescription>
        </DialogHeader>
        <Body folders={folders} countOf={countOf} onDeleted={onDeleted} />
      </DialogContent>
    </Dialog>
  )
}

function Body({ folders, countOf, onDeleted }: Omit<Props, 'open' | 'onOpenChange'>) {
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<unknown>): Promise<boolean> => {
    setError(null)
    try {
      await fn()
      return true
    } catch (e) {
      setError(isDuplicateFolderError(e) ? '같은 이름의 폴더가 이미 있습니다.' : toMessage(e))
      return false
    }
  }

  return (
    <div className="space-y-4 text-sm">
      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-destructive">
          {error}
        </p>
      )}

      <AddForm onAdd={(name) => run(() => folders.create(name))} />

      {folders.items.length === 0 ? (
        <p className="text-muted-foreground">아직 폴더가 없습니다.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {folders.items.map((f, i) => (
            <li key={f.id} className="flex items-center gap-1 px-2 py-1.5">
              <EditableName value={f.name} onSave={(name) => run(() => folders.rename(f.id, name))} />
              <span className="shrink-0 text-xs text-muted-foreground">노드 {countOf(f.id)}개</span>
              <Button variant="ghost" size="icon-xs" aria-label={`${f.name} 위로`} disabled={i === 0} onClick={() => void run(() => folders.move(f.id, 'up'))}>
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`${f.name} 아래로`}
                disabled={i === folders.items.length - 1}
                onClick={() => void run(() => folders.move(f.id, 'down'))}
              >
                <ArrowDown />
              </Button>
              <ConfirmDeleteButton
                label={`폴더 ${f.name} 삭제`}
                confirmText={countOf(f.id) > 0 ? `삭제 (노드 ${countOf(f.id)}개는 폴더 없음으로)` : '삭제'}
                onConfirm={async () => {
                  if (await run(() => folders.remove(f.id))) onDeleted(f.id)
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AddForm({ onAdd }: { onAdd: (name: string) => Promise<boolean> }) {
  const [name, setName] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const n = normalizeFolderName(name)
    if (n && (await onAdd(n))) setName('')
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-1">
      <Input aria-label="새 폴더" placeholder="새 폴더 이름" maxLength={FOLDER_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
      <Button type="submit" size="icon-sm" variant="outline" aria-label="새 폴더 추가" disabled={!normalizeFolderName(name)}>
        <Plus />
      </Button>
    </form>
  )
}

function EditableName({ value, onSave }: { value: string; onSave: (name: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const save = async () => {
    const name = normalizeFolderName(draft)
    if (!name || name === value) {
      setEditing(false)
      return
    }
    if (await onSave(name)) setEditing(false)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter') {
      e.preventDefault()
      void save()
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      setEditing(false)
    }
  }

  if (!editing) {
    return (
      <span className="flex min-w-0 flex-1 items-center gap-1">
        <span className="truncate">{value}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`${value} 이름 변경`}
          onClick={() => {
            setDraft(value)
            setEditing(true)
          }}
        >
          <Pencil />
        </Button>
      </span>
    )
  }
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1">
      <Input autoFocus aria-label="새 이름" maxLength={FOLDER_NAME_MAX} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} className="h-7" />
      <Button variant="ghost" size="icon-xs" aria-label="저장" onClick={() => void save()}>
        <Check />
      </Button>
      <Button variant="ghost" size="icon-xs" aria-label="취소" onClick={() => setEditing(false)}>
        <X />
      </Button>
    </span>
  )
}

function ConfirmDeleteButton({ label, confirmText, onConfirm }: { label: string; confirmText: string; onConfirm: () => Promise<unknown> }) {
  const [confirming, setConfirming] = useState(false)
  if (!confirming) {
    return (
      <Button variant="ghost" size="icon-xs" aria-label={label} className="shrink-0" onClick={() => setConfirming(true)}>
        <Trash2 />
      </Button>
    )
  }
  return (
    <Button variant="destructive" size="xs" autoFocus className="shrink-0" onBlur={() => setConfirming(false)} onClick={() => void onConfirm().finally(() => setConfirming(false))}>
      {confirmText}
    </Button>
  )
}
