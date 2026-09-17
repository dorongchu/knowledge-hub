import { memo } from 'react'
import { Handle, Position, useConnection, type NodeProps } from '@xyflow/react'
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

const SOURCE_SIDES = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
] as const

const sourceHandleClass = '!size-2.5 !border-background !bg-muted-foreground hover:!bg-primary'

/**
 * 그래프 위 노드. 카드형은 작게, 문서형은 크게 + 아이콘으로 구분 (PRD 3장: 같은 엔티티, 렌더링만 다름).
 *
 * 연결 UX ("easy connect"):
 * - 보내는 점(source)은 상하좌우 네 곳. 나란한 노드는 옆 점에서 바로 끌 수 있다
 * - 받는 영역(target)은 노드 전체를 덮는 투명 핸들. 평소엔 pointer-events 를 꺼서 노드 드래그/클릭을 방해하지 않고,
 *   다른 노드에서 연결을 끌고 오는 동안에만 켜져서 노드 어디에 놓아도 연결된다
 * - 엣지 모양은 핸들이 아니라 노드 위치로 계산한다 (FloatingEdge)
 */
function KnowledgeFlowNodeComponent({ id, data, selected }: NodeProps<KnowledgeFlowNode>) {
  const { node } = data
  const isDoc = node.type === 'doc'
  const Icon = isDoc ? FileText : StickyNote
  const summary = excerpt(node.content)

  const connection = useConnection()
  const acceptingConnection = connection.inProgress && connection.fromNode.id !== id
  const isDropTarget = acceptingConnection && connection.toNode?.id === id

  return (
    <div
      className={cn(
        'relative rounded-lg border bg-card text-card-foreground shadow-sm transition-shadow',
        isDoc ? 'w-56 p-3' : 'w-44 p-2.5',
        selected ? 'border-primary ring-2 ring-primary/30' : 'hover:shadow-md',
        isDropTarget && (connection.isValid === false ? 'ring-2 ring-destructive/40' : 'border-primary ring-2 ring-primary/50'),
      )}
    >
      {/* 받는 영역: 노드 전체. 소스 점들보다 먼저 렌더해 평소엔 소스 점이 위에 오게 한다 */}
      <Handle
        type="target"
        position={Position.Top}
        isConnectableStart={false}
        className={cn(
          '!top-0 !left-0 !h-full !w-full !transform-none !rounded-lg !border-0 !bg-transparent',
          acceptingConnection ? '!pointer-events-auto z-10' : '!pointer-events-none',
        )}
      />

      <div className="flex items-start gap-1.5">
        <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className={cn('min-w-0 flex-1 truncate font-medium', isDoc ? 'text-sm' : 'text-xs')}>
          {node.title || DEFAULT_NODE_TITLE}
        </span>
      </div>
      {summary && (
        <p className={cn('mt-1 text-muted-foreground', isDoc ? 'line-clamp-3 text-xs' : 'line-clamp-2 text-[11px]')}>{summary}</p>
      )}

      {SOURCE_SIDES.map((s) => (
        <Handle key={s.id} id={s.id} type="source" position={s.position} isConnectableEnd={false} className={sourceHandleClass} />
      ))}
    </div>
  )
}

export const KnowledgeFlowNodeView = memo(KnowledgeFlowNodeComponent)
