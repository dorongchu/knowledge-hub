import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toMessage } from '@/features/workspace/useWorkspaces'
import { TAG_NAME_MAX, isDuplicateError, normalizeName, type Tag } from './api'
import type { TagsApi } from './useTags'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tags: TagsApi
}

const FREE = '' // select 값: 자유 태그(카테고리 없음)

/** 워크스페이스 태그 체계 관리: 카테고리(사전 정의 분류) + 자유 태그 (PRD 6장, 9장) */
export function TagManagerDialog({ open, onOpenChange, tags }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>태그 관리</DialogTitle>
          <DialogDescription>카테고리는 "언어", "난이도" 같은 분류입니다. 카테고리가 없는 태그는 자유 태그입니다.</DialogDescription>
        </DialogHeader>
        <ManagerBody tags={tags} />
      </DialogContent>
    </Dialog>
  )
}

function ManagerBody({ tags }: { tags: TagsApi }) {
  const [error, setError] = useState<string | null>(null)

  /** 실패 시 메시지를 띄우고 false 반환 (인라인 편집이 닫히지 않게) */
  const run = async (fn: () => Promise<unknown>, duplicateMessage: string): Promise<boolean> => {
    setError(null)
    try {
      await fn()
      return true
    } catch (e) {
      setError(isDuplicateError(e) ? duplicateMessage : toMessage(e))
      return false
    }
  }

  const freeTags = tags.tags.filter((t) => t.category_id === null)

  return (
    <div className="space-y-5 text-sm">
      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-destructive">
          {error}
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <AddForm
          label="새 카테고리"
          placeholder="예: 난이도"
          onAdd={(name) => run(() => tags.createCategory(name), '같은 이름의 카테고리가 이미 있습니다.')}
        />
        <AddTagForm tags={tags} onAdd={(name, categoryId) => run(() => tags.createTag(name, categoryId), '같은 이름의 태그가 이미 있습니다.')} />
      </div>

      {tags.categories.map((c) => (
        <section key={c.id} aria-label={`카테고리 ${c.name}`}>
          <div className="flex items-center gap-1 border-b pb-1">
            <EditableName
              value={c.name}
              className="font-medium"
              onSave={(name) => run(() => tags.renameCategory(c.id, name), '같은 이름의 카테고리가 이미 있습니다.')}
            />
            <ConfirmDeleteButton
              label={`카테고리 ${c.name} 삭제`}
              confirmText="삭제 (태그는 자유 태그로 남음)"
              onConfirm={() => run(() => tags.deleteCategory(c.id), '')}
            />
          </div>
          <TagRows tags={tags} items={tags.tags.filter((t) => t.category_id === c.id)} run={run} emptyText="이 카테고리에 태그가 없습니다." />
        </section>
      ))}

      <section aria-label="자유 태그">
        <div className="border-b pb-1 font-medium">자유 태그</div>
        <TagRows tags={tags} items={freeTags} run={run} emptyText="자유 태그가 없습니다." />
      </section>
    </div>
  )
}

function TagRows({
  tags,
  items,
  run,
  emptyText,
}: {
  tags: TagsApi
  items: Tag[]
  run: (fn: () => Promise<unknown>, dup: string) => Promise<boolean>
  emptyText: string
}) {
  if (items.length === 0) return <p className="py-2 text-muted-foreground">{emptyText}</p>
  return (
    <ul className="divide-y">
      {items.map((t) => {
        const count = tags.usageCount(t.id)
        return (
          <li key={t.id} className="flex items-center gap-2 py-1.5">
            <EditableName value={t.name} onSave={(name) => run(() => tags.updateTag(t.id, { name }), '같은 이름의 태그가 이미 있습니다.')} />
            <span className="shrink-0 text-xs text-muted-foreground">노드 {count}개</span>
            <select
              aria-label={`태그 ${t.name} 의 카테고리`}
              value={t.category_id ?? FREE}
              onChange={(e) => void run(() => tags.updateTag(t.id, { category_id: e.target.value === FREE ? null : e.target.value }), '')}
              className="h-7 max-w-32 shrink-0 rounded-md border bg-background px-1 text-xs"
            >
              <option value={FREE}>자유 태그</option>
              {tags.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ConfirmDeleteButton
              label={`태그 ${t.name} 삭제`}
              confirmText={count > 0 ? `삭제 (노드 ${count}개에서 제거)` : '삭제'}
              onConfirm={() => run(() => tags.deleteTag(t.id), '')}
            />
          </li>
        )
      })}
    </ul>
  )
}

/** 이름 표시 + 연필 버튼 → 인라인 입력. Enter 저장, Esc 취소. */
function EditableName({ value, onSave, className }: { value: string; onSave: (name: string) => Promise<boolean>; className?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const save = async () => {
    const name = normalizeName(draft)
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
      e.stopPropagation() // 다이얼로그가 닫히지 않게
      setEditing(false)
    }
  }

  if (!editing) {
    return (
      <span className="flex min-w-0 flex-1 items-center gap-1">
        <span className={`truncate ${className ?? ''}`}>{value}</span>
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
      <Input autoFocus aria-label="새 이름" maxLength={TAG_NAME_MAX} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} className="h-7" />
      <Button variant="ghost" size="icon-xs" aria-label="저장" onClick={() => void save()}>
        <Check />
      </Button>
      <Button variant="ghost" size="icon-xs" aria-label="취소" onClick={() => setEditing(false)}>
        <X />
      </Button>
    </span>
  )
}

/** 첫 클릭에 확인 문구로 바뀌고, 두 번째 클릭에 실행. 포커스를 잃으면 원래대로. */
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
    <Button
      variant="destructive"
      size="xs"
      autoFocus
      className="shrink-0"
      onBlur={() => setConfirming(false)}
      onClick={() => void onConfirm().finally(() => setConfirming(false))}
    >
      {confirmText}
    </Button>
  )
}

function AddForm({ label, placeholder, onAdd }: { label: string; placeholder: string; onAdd: (name: string) => Promise<boolean> }) {
  const [name, setName] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const n = normalizeName(name)
    if (n && (await onAdd(n))) setName('')
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-1">
      <Input aria-label={label} placeholder={`${label} (${placeholder})`} maxLength={TAG_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
      <Button type="submit" size="icon-sm" variant="outline" aria-label={`${label} 추가`} disabled={!normalizeName(name)}>
        <Plus />
      </Button>
    </form>
  )
}

function AddTagForm({ tags, onAdd }: { tags: TagsApi; onAdd: (name: string, categoryId: string | null) => Promise<boolean> }) {
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<string>(FREE)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const n = normalizeName(name)
    if (n && (await onAdd(n, categoryId === FREE ? null : categoryId))) setName('')
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-1">
      <Input aria-label="새 태그" placeholder="새 태그" maxLength={TAG_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} className="h-8 min-w-0" />
      <select
        aria-label="새 태그의 카테고리"
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        className="h-8 max-w-24 shrink-0 rounded-md border bg-background px-1 text-xs"
      >
        <option value={FREE}>자유</option>
        {tags.categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <Button type="submit" size="icon-sm" variant="outline" aria-label="새 태그 추가" disabled={!normalizeName(name)}>
        <Plus />
      </Button>
    </form>
  )
}
