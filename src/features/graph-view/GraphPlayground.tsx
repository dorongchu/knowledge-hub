import { useCallback } from 'react'
import { ReactFlow, addEdge, useEdgesState, useNodesState, type Connection, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { KnowledgeNode } from '@/features/node/api'
import { flowInteractionProps, nodeTypes, edgeTypes, defaultEdgeOptions } from './flowConfig'
import { KNOWLEDGE_NODE_TYPE, type KnowledgeFlowNode } from './types'

/**
 * 개발 전용 (`import.meta.env.DEV` 일 때만 라우트에 등록): 로그인/DB 없이 그래프 상호작용을 시험하는 화면.
 * GraphView 와 같은 노드/엣지 컴포넌트와 같은 상호작용 설정(flowConfig)을 쓴다.
 * 배치: A — C — B 가 가로로 나란히(평행 + 중간에 노드), D 는 아래.
 */
const mock = (id: string, title: string, type: 'card' | 'doc', x: number, y: number): KnowledgeFlowNode => {
  const node: KnowledgeNode = {
    id,
    workspace_id: 'dev',
    type,
    title,
    content: type === 'doc' ? '긴 문서 노드의 본문 발췌가 여기에 표시됩니다.' : '',
    position_x: x,
    position_y: y,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
  return { id, type: KNOWLEDGE_NODE_TYPE, position: { x, y }, data: { node } }
}

const initialNodes: KnowledgeFlowNode[] = [
  mock('a', 'A (왼쪽)', 'card', 0, 0),
  mock('c', 'C (가운데)', 'doc', 260, 0),
  mock('b', 'B (오른쪽)', 'card', 560, 0),
  mock('d', 'D (아래)', 'card', 280, 220),
]

export function GraphPlayground() {
  const [nodes, , onNodesChange] = useNodesState<KnowledgeFlowNode>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const onConnect = useCallback((c: Connection) => setEdges((eds) => addEdge({ ...c, ...defaultEdgeOptions }, eds)), [setEdges])

  return (
    <div className="flex h-dvh flex-col">
      <p className="border-b px-3 py-1 text-xs text-muted-foreground">
        DEV 그래프 플레이그라운드 · 엣지 <span data-testid="edge-count">{edges.length}</span>개 ·{' '}
        <span data-testid="edge-list">{edges.map((e) => `${e.source}>${e.target}`).join(',')}</span>
      </p>
      <div className="min-h-0 flex-1">
        <ReactFlow<KnowledgeFlowNode, Edge>
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onConnect={onConnect}
          isValidConnection={(c) => c.source !== c.target && !edges.some((e) => e.source === c.source && e.target === c.target)}
          fitView
          fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
          {...flowInteractionProps}
        />
      </div>
    </div>
  )
}
