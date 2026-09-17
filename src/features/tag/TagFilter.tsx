import { useMemo, useState } from 'react'
import { Check, Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { Tag } from './api'
import type { TagsApi } from './useTags'
import type { TagFilterApi } from './useTagFilter'

interface Props {
  tags: TagsApi
  filter: TagFilterApi
}

/**
 * 태그 검색·필터 (PRD 4.5). 문서뷰 사이드바의 텍스트 검색창 아래.
 * 팝오버에서 태그 이름으로 찾아 고르면(복수 가능) 그 태그가 붙은 노드만 목록에 남는다.
 */
export function TagFilter({ tags, filter }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  // 카테고리별 묶음 (카테고리 이름순, 자유 태그는 마지막). 검색어는 태그 이름과 카테고리 이름 둘 다에 적용
  const groups = useMemo(() => {
    const match = (t: Tag) => q === '' || t.name.toLowerCase().includes(q) || (tags.categoryName(t.category_id) ?? '').toLowerCase().includes(q)
    const out: Array<{ key: string; label: string; items: Tag[] }> = []
    for (const c of tags.categories) {
      const items = tags.tags.filter((t) => t.category_id === c.id && match(t))
      if (items.length > 0) out.push({ key: c.id, label: c.name, items })
    }
    const free = tags.tags.filter((t) => t.category_id === null && match(t))
    if (free.length > 0) out.push({ key: 'free', label: '자유 태그', items: free })
    return out
  }, [tags, q])

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <Popover
          open={open}
          onOpenChange={(o) => {
            setOpen(o)
            if (!o) setQuery('')
          }}
        >
          <PopoverTrigger render={<Button variant={filter.active ? 'secondary' : 'ghost'} size="xs" className={cn(!filter.active && 'text-muted-foreground')} />}>
            <Filter data-icon="inline-start" />
            태그 필터{filter.active && ` ${filter.selected.length}`}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2">
            <Input
              autoFocus
              aria-label="태그 이름으로 찾기"
              placeholder="태그 이름으로 찾기"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8"
            />
            <div className="mt-2 max-h-64 overflow-y-auto text-sm" role="listbox" aria-label="태그" aria-multiselectable>
              {tags.tags.length === 0 ? (
                <p className="px-2 py-1 text-muted-foreground">아직 태그가 없습니다. 노드 편집기에서 태그를 붙여 보세요.</p>
              ) : groups.length === 0 ? (
                <p className="px-2 py-1 text-muted-foreground">"{query.trim()}" 에 해당하는 태그가 없습니다.</p>
              ) : (
                groups.map((g) => (
                  <div key={g.key} role="group" aria-label={g.label} className="mb-1">
                    <p className="px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{g.label}</p>
                    {g.items.map((t) => {
                      const checked = filter.selectedIds.has(t.id)
                      return (
                        <button
                          key={t.id}
                          type="button"
                          role="option"
                          aria-selected={checked}
                          onClick={() => filter.toggle(t.id)}
                          className={cn('flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-muted', checked && 'bg-muted/60')}
                        >
                          <Check className={cn('size-3.5 shrink-0', checked ? 'opacity-100' : 'opacity-0')} aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{t.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{tags.usageCount(t.id)}</span>
                        </button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        {filter.selected.length >= 2 && (
          <div role="radiogroup" aria-label="여러 태그 조건" className="ml-auto inline-flex rounded-md border p-0.5 text-[11px]">
            {(
              [
                ['and', '모두'],
                ['or', '하나라도'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={filter.mode === mode}
                onClick={() => filter.setMode(mode)}
                className={cn('rounded px-1.5 py-0.5', filter.mode === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {filter.active && (
        <div className="flex flex-wrap items-center gap-1" aria-label="선택된 태그">
          {filter.selected.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-0.5 rounded bg-secondary px-1.5 py-0.5 text-xs">
              {tags.categoryName(t.category_id) && <span className="text-muted-foreground">{tags.categoryName(t.category_id)}:</span>}
              {t.name}
              <button
                type="button"
                aria-label={`필터에서 ${t.name} 빼기`}
                onClick={() => filter.toggle(t.id)}
                className="rounded-sm p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <button type="button" onClick={filter.clear} className="px-1 text-xs text-muted-foreground underline-offset-2 hover:underline">
            전체 해제
          </button>
        </div>
      )}
    </div>
  )
}
