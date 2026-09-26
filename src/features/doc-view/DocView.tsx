import { useDeferredValue, useMemo, useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router'
import { ChevronDown, ChevronRight, FileText, FileUp, Folder as FolderIcon, FolderOpen, ListChecks, Plus, StickyNote, Tags, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useWorkspaceContext } from '@/features/workspace/WorkspacePage'
import { toMessage } from '@/features/workspace/useWorkspaces'
import { NodeEditor } from '@/features/node/NodeEditor'
import { DEFAULT_NODE_TITLE, NODE_TYPE_LABEL, type KnowledgeNode, type NodeType } from '@/features/node/api'
import { ImportDialog } from '@/features/import/ImportDialog'
import { NO_FOLDER_LABEL } from '@/features/folder/api'
import { FolderManagerDialog } from '@/features/folder/FolderManagerDialog'
import { FolderSelect } from '@/features/folder/FolderSelect'
import { TagFilter } from '@/features/tag/TagFilter'
import { TagManagerDialog } from '@/features/tag/TagManagerDialog'
import type { TagsApi } from '@/features/tag/useTags'
import type { TagFilterApi } from '@/features/tag/useTagFilter'
import { Highlight } from '@/features/search/Highlight'
import { SearchInput } from '@/features/search/SearchInput'
import { createNodeFuse, isSearchable, searchNodes, toSearchDoc, type SearchHit } from '@/features/search/searchIndex'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const NO_FOLDER_KEY = '__none__'

/**
 * 문서뷰 (PRD 4.2): 좌측 노드 목록, 우측 편집기.
 * 선택 노드는 URL(/w/:workspaceId/doc/:nodeId)로 표현 — 그래프뷰 더블클릭 전환도 같은 경로를 쓴다.
 * 좌측 상단: 텍스트 검색(제목·본문, PRD 4.3) + 태그 필터(PRD 4.5). 목록은 폴더별 섹션(PRD 12.3).
 * 적용 순서: 폴더 필터 → 태그 필터 → 그 범위 안에서 텍스트 검색. 이미 불러온 데이터만 쓰므로 추가 조회 없음.
 * 선택 모드(PRD 12.8): 체크박스로 여러 노드를 골라 폴더로 한 번에 이동. "현재 목록 모두 선택"은 필터·검색이 적용된 결과 전체.
 */
export function DocView() {
  const { workspaceId, workspace, nodes, tags, edges, tagFilter, tagSuggestions, folders, folderFilter, setFolderFilter } = useWorkspaceContext()
  const { nodeId } = useParams<{ nodeId?: string }>()
  const navigate = useNavigate()
  const [tagManagerOpen, setTagManagerOpen] = useState(false)
  const [folderManagerOpen, setFolderManagerOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkError, setBulkError] = useState<string | null>(null)

  // 1) 폴더 필터 → 2) 태그 필터
  const matchesTags = tagFilter.matches
  const visibleNodes = useMemo(
    () => nodes.items.filter((n) => (folderFilter === null || n.folder_id === folderFilter) && matchesTags(n.id)),
    [nodes.items, folderFilter, matchesTags],
  )

  // 3) 그 범위 안에서 텍스트 검색
  const fuse = useMemo(() => createNodeFuse(visibleNodes.map((n) => toSearchDoc(n))), [visibleNodes])
  const searching = isSearchable(query)
  const hits = useMemo(() => (isSearchable(deferredQuery) ? searchNodes(fuse, deferredQuery) : []), [fuse, deferredQuery])
  const hitById = useMemo(() => new Map(hits.map((h) => [h.doc.id, h])), [hits])
  const nodeById = useMemo(() => new Map(nodes.items.map((n) => [n.id, n])), [nodes.items])

  // 화면에 실제로 나오는 노드 (검색 중이면 검색 결과, 아니면 필터 결과). "현재 목록 모두 선택"의 대상
  const listedNodes = useMemo(() => (searching ? hits.flatMap((h) => nodeById.get(h.doc.id) ?? []) : visibleNodes), [searching, hits, nodeById, visibleNodes])

  // 폴더별 섹션. 폴더가 하나도 없으면 섹션 없이 평면 목록(폴더를 안 쓰는 사람에게는 화면이 그대로)
  const sections = useMemo(() => {
    const groups = new Map<string, KnowledgeNode[]>()
    for (const n of listedNodes) {
      const key = n.folder_id ?? NO_FOLDER_KEY
      const arr = groups.get(key)
      if (arr) arr.push(n)
      else groups.set(key, [n])
    }
    const out: Array<{ key: string; folderId: string | null; label: string; items: KnowledgeNode[] }> = []
    for (const f of folders.items) {
      const items = groups.get(f.id)
      if (items) out.push({ key: f.id, folderId: f.id, label: f.name, items })
    }
    const none = groups.get(NO_FOLDER_KEY)
    if (none) out.push({ key: NO_FOLDER_KEY, folderId: null, label: NO_FOLDER_LABEL, items: none })
    return out
  }, [listedNodes, folders.items])
  const flatList = folders.items.length === 0

  const folderCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const n of nodes.items) if (n.folder_id) m.set(n.folder_id, (m.get(n.folder_id) ?? 0) + 1)
    return m
  }, [nodes.items])

  const selected = nodeId ? nodes.items.find((n) => n.id === nodeId) : undefined
  const base = `/w/${workspaceId}/doc`

  const handleCreate = async (type: NodeType, folderId?: string | null) => {
    // 폴더 헤더의 ＋ 는 그 폴더에, 상단 "새 노드"는 현재 폴더 필터 또는 보고 있던 노드의 폴더를 물려받는다
    const target = folderId !== undefined ? folderId : (folderFilter ?? selected?.folder_id ?? null)
    const node = await nodes.create(type, target)
    navigate(`${base}/${node.id}`)
  }

  const toggleCollapsed = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
    setBulkError(null)
  }

  const bulkMove = async (folderId: string | null) => {
    setBulkError(null)
    try {
      await nodes.moveToFolder([...selectedIds], folderId)
      setSelectedIds(new Set())
    } catch (e) {
      setBulkError(toMessage(e))
      throw e
    }
  }

  const listItemProps = (n: KnowledgeNode) => ({
    node: n,
    to: `${base}/${n.id}`,
    active: n.id === nodeId,
    tags,
    tagFilter,
    hit: hitById.get(n.id),
    selectMode,
    checked: selectedIds.has(n.id),
    onToggle: () => toggleSelected(n.id),
  })

  const filteredCountLabel = folderFilter !== null || tagFilter.active ? `${visibleNodes.length} / ${nodes.items.length}` : String(nodes.items.length)

  return (
    <div className="flex h-full">
      <aside className="flex w-72 shrink-0 flex-col border-r">
        <div className="flex items-center gap-1 border-b px-3 py-2">
          <span className="mr-auto text-sm text-muted-foreground">노드 {filteredCountLabel}개</span>
          <Button
            variant={selectMode ? 'secondary' : 'ghost'}
            size="icon-sm"
            aria-label="선택 모드"
            aria-pressed={selectMode}
            title="선택 모드 — 여러 노드를 골라 폴더로 이동"
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
          >
            <ListChecks />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="폴더 관리" title="폴더 관리" onClick={() => setFolderManagerOpen(true)}>
            <FolderIcon />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="노션에서 가져오기" title="노션에서 가져오기" onClick={() => setImportOpen(true)}>
            <FileUp />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="태그 관리" title="태그 관리" onClick={() => setTagManagerOpen(true)}>
            <Tags />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="sm" />}>
              <Plus data-icon="inline-start" />새 노드
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void handleCreate('card')}>
                <StickyNote /> 카드 — 짧은 개념
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleCreate('doc')}>
                <FileText /> 문서 — 긴 노트
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-2 border-b px-3 py-2">
          <SearchInput value={query} onChange={setQuery} label="이 워크스페이스에서 검색" placeholder="제목·본문 검색" />
          <TagFilter tags={tags} filter={tagFilter} />
          {folderFilter !== null && (
            <div className="flex items-center gap-1 text-xs">
              <FolderOpen className="size-3.5 text-muted-foreground" aria-hidden />
              <span className="truncate">{folders.nameOf(folderFilter) ?? '(삭제된 폴더)'}</span>
              <button type="button" aria-label="폴더 필터 해제" onClick={() => setFolderFilter(null)} className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="size-3" />
              </button>
            </div>
          )}
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto" aria-label={searching ? '검색 결과' : '노드 목록'}>
          {nodes.error && <p className="p-3 text-sm text-destructive">{nodes.error}</p>}
          {nodes.loading || !workspace ? (
            <p className="p-3 text-sm text-muted-foreground">불러오는 중…</p>
          ) : nodes.items.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">아직 노드가 없습니다. "새 노드"로 시작하세요.</p>
          ) : listedNodes.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              {searching
                ? `"${query.trim()}" 에 대한 결과가 없습니다.${folderFilter !== null || tagFilter.active ? ' (필터가 적용된 범위에서 검색했습니다)' : ''}`
                : folderFilter !== null && !tagFilter.active
                  ? '이 폴더에 노드가 없습니다.'
                  : `선택한 태그${tagFilter.selected.length >= 2 ? (tagFilter.mode === 'and' ? '가 모두' : ' 중 하나라도') : '가'} 붙은 노드가 없습니다.`}
            </p>
          ) : (
            <>
              {searching && (
                <p className="border-b px-3 py-1 text-xs text-muted-foreground">
                  결과 {hits.length}개{(folderFilter !== null || tagFilter.active) && ' · 필터 적용 중'}
                </p>
              )}
              {flatList ? (
                <ul>
                  {listedNodes.map((n) => (
                    <li key={n.id}>
                      <NodeListItem {...listItemProps(n)} />
                    </li>
                  ))}
                </ul>
              ) : (
                sections.map((sec) => {
                  const isCollapsed = collapsed.has(sec.key)
                  const Chevron = isCollapsed ? ChevronRight : ChevronDown
                  return (
                    <section key={sec.key} aria-label={sec.label}>
                      <div className={cn('group flex items-center gap-1 border-b bg-muted/30 px-2 py-1 text-xs', sec.folderId !== null && sec.folderId === folderFilter && 'bg-primary/10')}>
                        <button type="button" aria-label={isCollapsed ? `${sec.label} 펼치기` : `${sec.label} 접기`} aria-expanded={!isCollapsed} onClick={() => toggleCollapsed(sec.key)} className="rounded p-0.5 hover:bg-muted">
                          <Chevron className="size-3.5" />
                        </button>
                        {sec.folderId === null ? (
                          <span className="min-w-0 flex-1 truncate font-medium text-muted-foreground">{sec.label}</span>
                        ) : (
                          <button
                            type="button"
                            title={folderFilter === sec.folderId ? '폴더 필터 해제' : '이 폴더만 보기'}
                            onClick={() => setFolderFilter(folderFilter === sec.folderId ? null : sec.folderId)}
                            className="min-w-0 flex-1 truncate text-left font-medium hover:underline"
                          >
                            {sec.label}
                          </button>
                        )}
                        <span className="text-muted-foreground">{sec.items.length}</span>
                        <button
                          type="button"
                          aria-label={`${sec.label}에 새 카드`}
                          title="이 폴더에 새 카드"
                          onClick={() => void handleCreate('card', sec.folderId)}
                          className="rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted focus-visible:opacity-100"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                      {!isCollapsed && (
                        <ul>
                          {sec.items.map((n) => (
                            <li key={n.id}>
                              <NodeListItem {...listItemProps(n)} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  )
                })
              )}
            </>
          )}
        </nav>

        {selectMode && (
          <div className="space-y-1.5 border-t bg-muted/30 px-3 py-2 text-xs" aria-label="선택 작업">
            <div className="flex items-center gap-2">
              <span className="font-medium">{selectedIds.size}개 선택</span>
              <button type="button" onClick={() => setSelectedIds(new Set(listedNodes.map((n) => n.id)))} className="text-muted-foreground underline-offset-2 hover:underline">
                현재 목록 모두 선택 ({listedNodes.length})
              </button>
              <button type="button" onClick={() => setSelectedIds(new Set())} disabled={selectedIds.size === 0} className="text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50">
                선택 해제
              </button>
              <button type="button" onClick={exitSelectMode} className="ml-auto text-muted-foreground underline-offset-2 hover:underline">
                완료
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">이동:</span>
              {selectedIds.size === 0 ? (
                <span className="text-muted-foreground">노드를 먼저 고르세요</span>
              ) : (
                // value 를 항상 null 로 두는 "명령형" 선택: 고른 순간 이동하고 다시 비운다
                <FolderSelect key={selectedIds.size} folders={folders} value={null} onChange={bulkMove} label={`선택한 노드 ${selectedIds.size}개를 폴더로 이동`} />
              )}
            </div>
            {bulkError && (
              <p role="alert" className="text-destructive">
                {bulkError}
              </p>
            )}
          </div>
        )}
      </aside>

      <section className="min-w-0 flex-1">
        {selected ? (
          <NodeEditor
            key={selected.id}
            node={selected}
            tags={tags}
            onTagClick={tagFilter.only}
            tagSuggestions={tagSuggestions}
            folders={folders}
            connections={edges.ofNode(selected.id).map((e) => {
              const outgoing = e.source_node_id === selected.id
              const otherId = outgoing ? e.target_node_id : e.source_node_id
              const other = nodes.items.find((n) => n.id === otherId)
              return { edgeId: e.id, outgoing, label: e.label, otherTitle: other?.title || DEFAULT_NODE_TITLE, to: `${base}/${otherId}` }
            })}
            onSave={(patch) => nodes.update(selected.id, patch)}
            onDelete={async () => {
              await nodes.remove(selected.id)
              tags.forgetNode(selected.id)
              tagSuggestions.clear(selected.id)
              edges.forgetNode(selected.id)
              navigate(base, { replace: true })
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
            {nodeId && !nodes.loading ? '노드를 찾을 수 없습니다. 삭제되었거나 다른 워크스페이스의 노드입니다.' : '왼쪽에서 노드를 선택하거나 새 노드를 만드세요.'}
          </div>
        )}
      </section>

      <TagManagerDialog open={tagManagerOpen} onOpenChange={setTagManagerOpen} tags={tags} />
      <FolderManagerDialog
        open={folderManagerOpen}
        onOpenChange={setFolderManagerOpen}
        folders={folders}
        countOf={(id) => folderCount.get(id) ?? 0}
        onDeleted={(id) => {
          nodes.forgetFolder(id)
          if (folderFilter === id) setFolderFilter(null)
        }}
      />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} nodes={nodes} folders={folders} />
    </div>
  )
}

interface ListItemProps {
  node: KnowledgeNode
  to: string
  active: boolean
  tags: TagsApi
  tagFilter: TagFilterApi
  hit?: SearchHit
  selectMode: boolean
  checked: boolean
  onToggle: () => void
}

/**
 * 목록 한 줄. 링크(제목 영역)와 태그 칩(버튼)을 형제로 둔다 — 링크 안에 버튼을 넣지 않기 위해.
 * 태그 칩을 누르면 그 태그 하나로 필터가 걸린다 (PRD 4.5). 선택 모드에서는 줄 전체가 체크 토글이 된다 (PRD 12.8).
 */
function NodeListItem({ node, to, active, tags, tagFilter, hit, selectMode, checked, onToggle }: ListItemProps) {
  const Icon = node.type === 'card' ? StickyNote : FileText
  const nodeTags = tags.tagsOfNode(node.id)

  const body = (
    <>
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{hit ? <Highlight parts={hit.titleParts} fallback={DEFAULT_NODE_TITLE} /> : node.title || DEFAULT_NODE_TITLE}</span>
        {hit?.snippet && (
          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
            <Highlight parts={hit.snippet} />
          </span>
        )}
        <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="px-1 py-0 text-[10px]">
            {NODE_TYPE_LABEL[node.type]}
          </Badge>
          <time dateTime={node.updated_at}>{formatRelativeTime(node.updated_at)}</time>
        </span>
      </span>
    </>
  )

  return (
    <div className={cn('border-b text-sm transition-colors hover:bg-muted/60', active && !selectMode && 'bg-muted', checked && 'bg-primary/10')}>
      {selectMode ? (
        <label className="flex cursor-pointer items-start gap-2 px-3 pt-2 pb-1.5">
          <input type="checkbox" checked={checked} onChange={onToggle} aria-label={`${node.title || DEFAULT_NODE_TITLE} 선택`} className="mt-1 size-4 shrink-0" />
          {body}
        </label>
      ) : (
        <NavLink to={to} className="flex items-start gap-2 px-3 pt-2 pb-1.5">
          {body}
        </NavLink>
      )}
      {nodeTags.length > 0 && (
        <div className="flex flex-wrap gap-1 pr-3 pb-2 pl-9">
          {nodeTags.slice(0, 4).map(({ tag }) => (
            <button
              key={tag.id}
              type="button"
              title={`"${tag.name}" 태그로 필터`}
              onClick={() => tagFilter.only(tag.id)}
              className={cn(
                'rounded px-1 text-[10px] transition-colors hover:bg-primary/15 hover:text-foreground',
                tagFilter.selectedIds.has(tag.id) ? 'bg-primary/15 text-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              {tag.name}
            </button>
          ))}
          {nodeTags.length > 4 && <span className="text-[10px] text-muted-foreground">+{nodeTags.length - 4}</span>}
        </div>
      )}
    </div>
  )
}
