import { useMemo, useState, type KeyboardEvent } from 'react'
import { Plus, Sparkles, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toMessage } from '@/features/workspace/useWorkspaces'
import { TAG_NAME_MAX, isDuplicateError, normalizeName, type Tag } from './api'
import type { TagsApi } from './useTags'

const MAX_SUGGESTIONS = 8

interface Props {
  nodeId: string
  tags: TagsApi
  /** 칩의 이름 부분을 누르면 호출 (그 태그로 목록 필터) */
  onTagClick?: (tagId: string) => void
}

/** 노드에 붙은 태그 칩 + 태그 추가(기존 태그 검색 / 새 자유 태그 생성). 수동으로 붙인 태그는 source='manual'. */
export function NodeTagBar({ nodeId, tags, onTagClick }: Props) {
  const attached = tags.tagsOfNode(nodeId)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(toMessage(e))
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="태그">
      {attached.map(({ tag, source }) => (
        <TagChip
          key={tag.id}
          tag={tag}
          categoryName={tags.categoryName(tag.category_id)}
          ai={source === 'ai'}
          onClick={onTagClick ? () => onTagClick(tag.id) : undefined}
          onRemove={() => void run(() => tags.detach(nodeId, tag.id))}
        />
      ))}
      <TagPicker
        tags={tags}
        attachedIds={new Set(attached.map((a) => a.tag.id))}
        onPick={(tagId) => tags.attach(nodeId, tagId)}
        onCreate={async (name) => {
          const t = await tags.createTag(name)
          await tags.attach(nodeId, t.id)
        }}
      />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}

export function TagChip({
  tag,
  categoryName,
  ai = false,
  onClick,
  onRemove,
}: {
  tag: Tag
  categoryName: string | null
  ai?: boolean
  onClick?: () => void
  onRemove?: () => void
}) {
  return (
    <Badge variant="secondary" className="gap-1 pr-1 font-normal">
      {ai && <Sparkles className="size-3 text-muted-foreground" aria-label="AI 제안으로 추가됨" />}
      {onClick ? (
        <button type="button" onClick={onClick} title={`"${tag.name}" 태그로 목록 필터`} className="inline-flex items-center gap-1 hover:underline">
          {categoryName && <span className="text-muted-foreground">{categoryName}:</span>}
          <span>{tag.name}</span>
        </button>
      ) : (
        <>
          {categoryName && <span className="text-muted-foreground">{categoryName}:</span>}
          <span>{tag.name}</span>
        </>
      )}
      {onRemove && (
        <button
          type="button"
          aria-label={`태그 ${tag.name} 제거`}
          onClick={onRemove}
          className="rounded-sm p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      )}
    </Badge>
  )
}

function TagPicker({
  tags,
  attachedIds,
  onPick,
  onCreate,
}: {
  tags: TagsApi
  attachedIds: Set<string>
  onPick: (tagId: string) => Promise<void>
  onCreate: (name: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hint, setHint] = useState<string | null>(null)

  const q = query.trim().toLowerCase()
  const candidates = useMemo(
    () => tags.tags.filter((t) => !attachedIds.has(t.id) && (q === '' || t.name.toLowerCase().includes(q))).slice(0, MAX_SUGGESTIONS),
    [tags.tags, attachedIds, q],
  )
  const exact = q === '' ? undefined : tags.tags.find((t) => t.name.toLowerCase() === q)
  const canCreate = q !== '' && !exact

  const pick = async (tagId: string) => {
    try {
      await onPick(tagId)
      setQuery('')
      setHint(null)
    } catch (e) {
      setHint(toMessage(e))
    }
  }

  const create = async () => {
    const name = normalizeName(query)
    if (!name) {
      setHint(`태그 이름은 1~${TAG_NAME_MAX}자여야 합니다.`)
      return
    }
    try {
      await onCreate(name)
      setQuery('')
      setHint(null)
    } catch (e) {
      setHint(isDuplicateError(e) ? '같은 이름의 태그가 이미 있습니다.' : toMessage(e))
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return // 한글 조합 중 Enter 는 무시
    e.preventDefault()
    if (exact) {
      if (attachedIds.has(exact.id)) setHint('이미 붙어 있는 태그입니다.')
      else void pick(exact.id)
    } else if (canCreate) {
      void create()
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) {
          setQuery('')
          setHint(null)
        }
      }}
    >
      <PopoverTrigger render={<Button variant="ghost" size="xs" className="text-muted-foreground" />}>
        <Plus data-icon="inline-start" />
        태그
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <Input
          autoFocus
          aria-label="태그 검색 또는 새 태그 이름"
          placeholder="태그 검색 또는 새로 만들기"
          maxLength={TAG_NAME_MAX}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setHint(null)
          }}
          onKeyDown={onKeyDown}
          className="h-8"
        />
        <ul className="mt-2 max-h-56 overflow-y-auto text-sm" role="listbox" aria-label="태그 후보">
          {candidates.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => void pick(t.id)}
                className="flex w-full items-center gap-1 rounded px-2 py-1 text-left hover:bg-muted"
              >
                {tags.categoryName(t.category_id) && <span className="text-muted-foreground">{tags.categoryName(t.category_id)}:</span>}
                <span className="truncate">{t.name}</span>
              </button>
            </li>
          ))}
          {canCreate && (
            <li>
              <button
                type="button"
                onClick={() => void create()}
                className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-primary hover:bg-muted"
              >
                <Plus className="size-3.5" />
                <span className="truncate">새 태그 "{query.trim()}" 만들기</span>
              </button>
            </li>
          )}
          {candidates.length === 0 && !canCreate && (
            <li className="px-2 py-1 text-muted-foreground">{tags.tags.length === 0 ? '아직 태그가 없습니다. 이름을 입력해 만드세요.' : '붙일 수 있는 태그가 없습니다.'}</li>
          )}
        </ul>
        {hint && <p className="mt-1 px-2 text-xs text-destructive">{hint}</p>}
      </PopoverContent>
    </Popover>
  )
}
