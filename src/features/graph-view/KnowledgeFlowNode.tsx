import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { FileText, StickyNote } from 'lucide-react'
import { DEFAULT_NODE_TITLE } from '@/features/node/api'
import { cn } from '@/lib/utils'
import type { KnowledgeFlowNode } from './types'

/** 본문 미리보기용 발췌 (Markdown 기호는 대충 걷어낸다). */
export function excerpt(content: string, max = 90): string {
  const text = content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/**
 * 그래프 위 노드. 카드형은 작게, 문서형은 크게 + 아이콘으로 구분 (PRD 3장: 같은 엔티티, 렌더링만 다름).
 * Handle 은 "수동 연결" 단계에서 엣지 드래그에 쓰인다.
 */
function KnowledgeFlowNodeComponent({ data, selected }: NodeProps<KnowledgeFlowNode>) {
  const { node } = data
  const isDoc = node.type === 'doc'
  const Icon = isDoc ? FileText : StickyNote
  const summary = excerpt(node.content)

  return (
    <div
      className={cn(
        'rounded-lg border bg-card text-card-foreground shadow-sm transition-shadow',
        isDoc ? 'w-56 p-3' : 'w-44 p-2.5',
        selected ? 'border-primary ring-2 ring-primary/30' : 'hover:shadow-md',
      )}
    >
      <Handle type="target" position={Position.Top} className="!size-2 !bg-muted-foreground" />
      <div className="flex items-start gap-1.5">
        <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className={cn('min-w-0 flex-1 truncate font-medium', isDoc ? 'text-sm' : 'text-xs')}>
          {node.title || DEFAULT_NODE_TITLE}
        </span>
      </div>
      {summary && (
        <p className={cn('mt-1 text-muted-foreground', isDoc ? 'line-clamp-3 text-xs' : 'line-clamp-2 text-[11px]')}>{summary}</p>
      )}
      <Handle type="source" position={Position.Bottom} className="!size-2 !bg-muted-foreground" />
    </div>
  )
}

export const KnowledgeFlowNodeView = memo(KnowledgeFlowNodeComponent)
