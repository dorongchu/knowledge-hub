import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { FileText, StickyNote } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toMessage } from '@/features/workspace/useWorkspaces'
import { DEFAULT_NODE_TITLE } from '@/features/node/api'
import { Highlight } from './Highlight'
import { SearchInput } from './SearchInput'
import { createNodeFuse, isSearchable, searchNodes, toSearchDoc, type SearchDoc } from './searchIndex'

interface Props {
  /** workspaceId → 이름 (결과에 어느 워크스페이스인지 표시) */
  workspaceNames: Map<string, string>
}

type Load = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; docs: SearchDoc[] } | { status: 'error'; message: string }

/**
 * 전체 워크스페이스 텍스트 검색 (PRD 4.3). 홈 화면용.
 * 검색창에 처음 포커스할 때 내 모든 노드를 한 번 불러와(RLS 로 본인 소유만) 브라우저에서 fuse.js 로 검색한다.
 * 태그는 검색 대상이 아니다(태그는 워크스페이스별 태그 필터로 조회 — PRD 4.5). 노드가 아주 많아지면 서버 검색으로 전환 — PROGRESS.md 최적화 후보.
 */
export function GlobalSearch({ workspaceNames }: Props) {
  const [query, setQuery] = useState('')
  const [load, setLoad] = useState<Load>({ status: 'idle' })
  const deferredQuery = useDeferredValue(query)

  const ensureLoaded = () => {
    if (load.status !== 'idle' && load.status !== 'error') return
    setLoad({ status: 'loading' })
    supabase
      .from('nodes')
      .select('id, workspace_id, type, title, content')
      .then(({ data, error }) => {
        if (error) setLoad({ status: 'error', message: toMessage(error) })
        else setLoad({ status: 'ready', docs: data.map((n) => toSearchDoc(n)) })
      })
  }

  const fuse = useMemo(() => (load.status === 'ready' ? createNodeFuse(load.docs) : null), [load])
  const hits = useMemo(() => (fuse ? searchNodes(fuse, deferredQuery) : []), [fuse, deferredQuery])
  const active = isSearchable(query)

  return (
    <div className="mb-6">
      <SearchInput
        value={query}
        onChange={setQuery}
        onFocus={ensureLoaded}
        label="전체 워크스페이스 검색"
        placeholder="모든 워크스페이스에서 노드 검색 (2글자 이상)"
        className="max-w-md"
      />

      {active && (
        <div className="mt-3 rounded-lg border" role="region" aria-label="검색 결과">
          {load.status === 'loading' && <p className="p-3 text-sm text-muted-foreground">노드를 불러오는 중…</p>}
          {load.status === 'error' && <p className="p-3 text-sm text-destructive">검색 준비 실패: {load.message}</p>}
          {load.status === 'ready' && hits.length === 0 && <p className="p-3 text-sm text-muted-foreground">"{query.trim()}" 에 대한 결과가 없습니다.</p>}
          {hits.length > 0 && (
            <>
              <p className="border-b px-3 py-1.5 text-xs text-muted-foreground">결과 {hits.length}개</p>
              <ul className="max-h-96 divide-y overflow-y-auto">
                {hits.map(({ doc, titleParts, snippet }) => {
                  const Icon = doc.type === 'card' ? StickyNote : FileText
                  return (
                    <li key={doc.id}>
                      <Link to={`/w/${doc.workspaceId}/doc/${doc.id}`} className="flex items-start gap-2 px-3 py-2 text-sm hover:bg-muted/60">
                        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            <Highlight parts={titleParts} fallback={DEFAULT_NODE_TITLE} />
                          </span>
                          {snippet && (
                            <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                              <Highlight parts={snippet} />
                            </span>
                          )}
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">{workspaceNames.get(doc.workspaceId) ?? '워크스페이스'}</span>
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
