import { useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router'
import { FileText, Plus, StickyNote, Tags } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useWorkspaceContext } from '@/features/workspace/WorkspacePage'
import { NodeEditor } from '@/features/node/NodeEditor'
import { DEFAULT_NODE_TITLE, NODE_TYPE_LABEL, type KnowledgeNode, type NodeType } from '@/features/node/api'
import { TagManagerDialog } from '@/features/tag/TagManagerDialog'
import type { TagsApi } from '@/features/tag/useTags'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * 문서뷰 (PRD 4.2): 좌측 노드 목록, 우측 편집기.
 * 선택 노드는 URL(/w/:workspaceId/doc/:nodeId)로 표현 — 그래프뷰 더블클릭 전환도 같은 경로를 쓴다.
 * 검색(fuse.js)은 "텍스트 검색" 단계에서 좌측 상단에 추가.
 */
export function DocView() {
  const { workspace, nodes, tags } = useWorkspaceContext()
  const { nodeId } = useParams<{ nodeId?: string }>()
  const navigate = useNavigate()
  const [tagManagerOpen, setTagManagerOpen] = useState(false)

  const selected = nodeId ? nodes.items.find((n) => n.id === nodeId) : undefined
  const base = `/w/${workspace.id}/doc`

  const handleCreate = async (type: NodeType) => {
    const node = await nodes.create(type)
    navigate(`${base}/${node.id}`)
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-72 shrink-0 flex-col border-r">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <span className="text-sm text-muted-foreground">노드 {nodes.items.length}개</span>
          <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="태그 관리" title="태그 관리" onClick={() => setTagManagerOpen(true)}>
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

        <nav className="min-h-0 flex-1 overflow-y-auto">
          {nodes.error && <p className="p-3 text-sm text-destructive">{nodes.error}</p>}
          {nodes.loading ? (
            <p className="p-3 text-sm text-muted-foreground">불러오는 중…</p>
          ) : nodes.items.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">아직 노드가 없습니다. "새 노드"로 시작하세요.</p>
          ) : (
            <ul>
              {nodes.items.map((n) => (
                <li key={n.id}>
                  <NodeListItem node={n} to={`${base}/${n.id}`} tags={tags} />
                </li>
              ))}
            </ul>
          )}
        </nav>
      </aside>

      <section className="min-w-0 flex-1">
        {selected ? (
          <NodeEditor
            key={selected.id}
            node={selected}
            tags={tags}
            onSave={(patch) => nodes.update(selected.id, patch)}
            onDelete={async () => {
              await nodes.remove(selected.id)
              tags.forgetNode(selected.id)
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
    </div>
  )
}

function NodeListItem({ node, to, tags }: { node: KnowledgeNode; to: string; tags: TagsApi }) {
  const Icon = node.type === 'card' ? StickyNote : FileText
  const nodeTags = tags.tagsOfNode(node.id)
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn('flex items-start gap-2 border-b px-3 py-2 text-sm transition-colors hover:bg-muted/60', isActive && 'bg-muted')
      }
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{node.title || DEFAULT_NODE_TITLE}</span>
        <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="px-1 py-0 text-[10px]">
            {NODE_TYPE_LABEL[node.type]}
          </Badge>
          <time dateTime={node.updated_at}>{formatRelativeTime(node.updated_at)}</time>
        </span>
        {nodeTags.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1">
            {nodeTags.slice(0, 4).map(({ tag }) => (
              <span key={tag.id} className="rounded bg-muted px-1 text-[10px] text-muted-foreground">
                {tag.name}
              </span>
            ))}
            {nodeTags.length > 4 && <span className="text-[10px] text-muted-foreground">+{nodeTags.length - 4}</span>}
          </span>
        )}
      </span>
    </NavLink>
  )
}
