import { FileText, PencilLine, StickyNote, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DEFAULT_NODE_TITLE, NODE_TYPE_LABEL, type KnowledgeNode } from '@/features/node/api'
import { formatRelativeTime } from '@/lib/format'
import { MarkdownView } from '@/components/MarkdownView'

interface Props {
  node: KnowledgeNode
  onOpenInDoc: () => void
  onClose: () => void
}

/**
 * 그래프에서 노드 클릭 시 오른쪽에 뜨는 미리보기 (PRD 4.2).
 * 본문은 MarkdownView(marked + DOMPurify sanitize) 로 렌더한다 — CLAUDE.md 절대 규칙 6.
 */
export function NodePreviewPanel({ node, onOpenInDoc, onClose }: Props) {
  const Icon = node.type === 'doc' ? FileText : StickyNote
  return (
    <aside className="flex w-80 shrink-0 flex-col border-l bg-background" aria-label="노드 미리보기">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        <Badge variant="outline" className="px-1 py-0 text-[10px]">
          {NODE_TYPE_LABEL[node.type]}
        </Badge>
        <span className="ml-auto text-xs text-muted-foreground">
          <time dateTime={node.updated_at}>{formatRelativeTime(node.updated_at)}</time>
        </span>
        <Button variant="ghost" size="icon-sm" aria-label="미리보기 닫기" onClick={onClose}>
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <h2 className="mb-3 text-base font-semibold">{node.title || DEFAULT_NODE_TITLE}</h2>
        {node.content ? (
          <MarkdownView markdown={node.content} />
        ) : (
          <p className="text-sm text-muted-foreground">본문이 비어 있습니다.</p>
        )}
      </div>
      <div className="border-t p-3">
        <Button className="w-full" onClick={onOpenInDoc}>
          <PencilLine data-icon="inline-start" />
          문서뷰에서 편집
        </Button>
      </div>
    </aside>
  )
}
