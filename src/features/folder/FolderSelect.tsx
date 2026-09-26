import { useState } from 'react'
import { Folder as FolderIcon } from 'lucide-react'
import { toMessage } from '@/features/workspace/useWorkspaces'
import { FOLDER_NAME_MAX, NO_FOLDER_LABEL, isDuplicateFolderError, normalizeFolderName } from './api'
import type { FoldersApi } from './useFolders'

const NONE = '' // select 값: 폴더 없음
const NEW = '__new__' // select 값: 새 폴더 만들기

interface Props {
  folders: FoldersApi
  value: string | null
  onChange: (folderId: string | null) => Promise<void> | void
  /** "새 폴더…" 항목 표시 여부 (기본 표시) */
  allowCreate?: boolean
  label?: string
  className?: string
}

/**
 * 폴더 선택 (편집기 상단, 일괄 이동 액션 바 공용).
 * 네이티브 <select> 를 쓴다 — 항목이 많아도 가볍고 키보드 접근성이 그대로다.
 * "새 폴더…" 를 고르면 이름을 물어 만든 뒤 바로 그 폴더를 선택한다.
 */
export function FolderSelect({ folders, value, onChange, allowCreate = true, label = '폴더', className }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handle = async (selected: string) => {
    setError(null)
    let next: string | null = selected === NONE ? null : selected
    if (selected === NEW) {
      const raw = window.prompt(`새 폴더 이름 (1~${FOLDER_NAME_MAX}자)`)
      if (raw === null) return
      const name = normalizeFolderName(raw)
      if (!name) {
        setError('폴더 이름이 비어 있거나 너무 깁니다.')
        return
      }
      setBusy(true)
      try {
        next = (await folders.create(name)).id
      } catch (e) {
        setError(isDuplicateFolderError(e) ? '같은 이름의 폴더가 이미 있습니다.' : toMessage(e))
        setBusy(false)
        return
      }
    }
    setBusy(true)
    try {
      await onChange(next)
    } catch (e) {
      setError(toMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className={className}>
      <span className="inline-flex items-center gap-1">
        <FolderIcon className="size-3.5 text-muted-foreground" aria-hidden />
        <select
          aria-label={label}
          value={value ?? NONE}
          disabled={busy}
          onChange={(e) => void handle(e.target.value)}
          className="h-7 max-w-44 rounded-md border bg-background px-1.5 text-xs"
        >
          <option value={NONE}>{NO_FOLDER_LABEL}</option>
          {folders.items.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
          {allowCreate && <option value={NEW}>＋ 새 폴더…</option>}
        </select>
      </span>
      {error && (
        <span role="alert" className="ml-2 text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  )
}
