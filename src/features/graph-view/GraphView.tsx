import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  Background,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type IsValidConnection,
  type NodeMouseHandler,
  type OnNodeDrag,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useWorkspaceContext } from '@/features/workspace/WorkspacePage'
import { toMessage } from '@/features/workspace/useWorkspaces'
import { DEFAULT_NODE_TITLE } from '@/features/node/api'
import { isDuplicateEdgeError, type KnowledgeEdge } from '@/features/edge/api'
import { EdgePanel } from './EdgePanel'
import { NodePreviewPanel } from './NodePreviewPanel'
import { defaultEdgeOptions, edgeTypes, flowInteractionProps, nodeTypes } from './flowConfig'
import { resolvePosition } from './layout'
import { KNOWLEDGE_NODE_TYPE, type KnowledgeFlowNode } from './types'

function toFlowEdge(e: KnowledgeEdge, selected: boolean): Edge {
  return {
    id: e.id,
    source: e.source_node_id,
    target: e.target_node_id,
    ...defaultEdgeOptions, // 플로팅 엣지 + 화살표
    label: e.label ?? undefined,
    selected,
    // PRD 5장: 제안(suggested)은 점선, 확정(confirmed)은 실선. Phase 1 에서는 수동 연결(confirmed)만 생성된다.
    style: e.status === 'suggested' ? { strokeDasharray: '6 4' } : undefined,
  }
}

/**
 * 그래프뷰 (PRD 4.2): 노드 표시, 클릭 시 사이드 패널 미리보기, 더블클릭 시 문서뷰로 전환.
 * 수동 연결: 노드 네 면의 점에서 끌어 다른 노드 아무 곳에나 놓는다. 엣지 클릭 시 라벨 편집/삭제 패널.
 */
export function GraphView() {
  const { workspace, nodes, edges } = useWorkspaceContext()
  const navigate = useNavigate()
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<KnowledgeFlowNode>([])
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [notice, setNotice] = useState<string | null>(null)

  // DB 노드 목록 → React Flow 노드. 화면에 이미 있는 노드는 현재(드래그 중일 수 있는) 위치와 선택 상태를 유지하고,
  // 새로 나타난 노드만 DB 저장 위치 또는 격자 위치로 배치한다.
  useEffect(() => {
    setFlowNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]))
      const total = nodes.items.length
      return nodes.items.map((n, i) => {
        const existing = prevById.get(n.id)
        return {
          id: n.id,
          type: KNOWLEDGE_NODE_TYPE,
          position: existing?.position ?? resolvePosition(n, i, total),
          selected: existing?.selected ?? false,
          data: { node: n },
        }
      })
    })
  }, [nodes.items, setFlowNodes])

  // DB 엣지 목록 → React Flow 엣지 (선택 상태 유지)
  useEffect(() => {
    setFlowEdges((prev) => {
      const selectedIds = new Set(prev.filter((e) => e.selected).map((e) => e.id))
      return edges.items.map((e) => toFlowEdge(e, selectedIds.has(e.id)))
    })
  }, [edges.items, setFlowEdges])

  const selectedNodeId = useMemo(() => flowNodes.find((n) => n.selected)?.id, [flowNodes])
  const selectedEdgeId = useMemo(() => flowEdges.find((e) => e.selected)?.id, [flowEdges])
  const selectedNode = selectedNodeId ? nodes.items.find((n) => n.id === selectedNodeId) : undefined
  const selectedEdge = selectedEdgeId ? edges.items.find((e) => e.id === selectedEdgeId) : undefined

  const titleOf = useCallback((nodeId: string) => nodes.items.find((n) => n.id === nodeId)?.title || DEFAULT_NODE_TITLE, [nodes.items])

  const openInDoc = useCallback((nodeId: string) => navigate(`/w/${workspace.id}/doc/${nodeId}`), [navigate, workspace.id])

  const onNodeDoubleClick: NodeMouseHandler<KnowledgeFlowNode> = useCallback((_e, node) => openInDoc(node.id), [openInDoc])

  // 드래그 종료 시 DB 저장. 실패해도 화면 위치는 유지되고 다음 새로고침 때 마지막 저장 위치로 돌아간다.
  const updateNode = nodes.update
  const onNodeDragStop: OnNodeDrag<KnowledgeFlowNode> = useCallback(
    (_e, _node, dragged) => {
      for (const n of dragged) {
        void updateNode(n.id, { position_x: n.position.x, position_y: n.position.y }).catch(() => {})
      }
    },
    [updateNode],
  )

  // DB 제약과 같은 기준으로 드래그 단계에서 미리 막는다: 자기 자신 연결 금지, 같은 방향 중복 금지
  const edgeExists = edges.exists
  const isValidConnection: IsValidConnection = useCallback(
    (c) => !!c.source && !!c.target && c.source !== c.target && !edgeExists(c.source, c.target),
    [edgeExists],
  )

  const connectNodes = edges.connect
  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target) return
      setNotice(null)
      connectNodes(c.source, c.target).catch((e) => setNotice(isDuplicateEdgeError(e) ? '이미 연결되어 있습니다.' : `연결 실패: ${toMessage(e)}`))
    },
    [connectNodes],
  )

  const clearSelection = useCallback(() => {
    setFlowNodes((prev) => prev.map((n) => (n.selected ? { ...n, selected: false } : n)))
    setFlowEdges((prev) => prev.map((e) => (e.selected ? { ...e, selected: false } : e)))
  }, [setFlowNodes, setFlowEdges])

  const message = notice ?? nodes.error ?? edges.error

  return (
    <div className="flex h-full">
      <div className="relative min-w-0 flex-1">
        <ReactFlow<KnowledgeFlowNode, Edge>
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          fitView
          fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
          {...flowInteractionProps}
        >
          <Background gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>

        {!nodes.loading && nodes.items.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="pointer-events-auto rounded-lg border bg-background/95 p-6 text-center text-sm text-muted-foreground shadow-sm">
              <p className="mb-2">아직 노드가 없습니다.</p>
              <Link to={`/w/${workspace.id}/doc`} className="underline">
                문서뷰에서 첫 노드 만들기
              </Link>
            </div>
          </div>
        )}
        {nodes.items.length >= 2 && edges.items.length === 0 && !edges.loading && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md border bg-background/95 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
            노드 가장자리의 점을 끌어 다른 노드 위에 놓으면 연결됩니다.
          </p>
        )}
        {message && (
          <p role="alert" className="absolute top-3 left-3 rounded-md border border-destructive/40 bg-background p-2 text-sm text-destructive">
            {message}
          </p>
        )}
      </div>

      {selectedEdge ? (
        <EdgePanel
          key={selectedEdge.id}
          edge={selectedEdge}
          sourceTitle={titleOf(selectedEdge.source_node_id)}
          targetTitle={titleOf(selectedEdge.target_node_id)}
          onSaveLabel={(label) => edges.setLabel(selectedEdge.id, label)}
          onDelete={() => edges.remove(selectedEdge.id)}
          onClose={clearSelection}
        />
      ) : (
        selectedNode && <NodePreviewPanel node={selectedNode} onOpenInDoc={() => openInDoc(selectedNode.id)} onClose={clearSelection} />
      )}
    </div>
  )
}
