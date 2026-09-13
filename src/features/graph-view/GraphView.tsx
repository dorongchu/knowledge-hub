import { useCallback, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  Background,
  Controls,
  ReactFlow,
  useNodesState,
  type NodeMouseHandler,
  type NodeTypes,
  type OnNodeDrag,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useWorkspaceContext } from '@/features/workspace/WorkspacePage'
import { KnowledgeFlowNodeView } from './KnowledgeFlowNode'
import { NodePreviewPanel } from './NodePreviewPanel'
import { forgetCachedPosition, resolvePosition, setCachedPosition } from './layout'
import { KNOWLEDGE_NODE_TYPE, type KnowledgeFlowNode } from './types'

// 컴포넌트 밖에 두어 매 렌더마다 새 객체가 되지 않게 한다 (React Flow 권장)
const nodeTypes: NodeTypes = { [KNOWLEDGE_NODE_TYPE]: KnowledgeFlowNodeView }

/**
 * 그래프뷰 (PRD 4.2): 노드 표시, 클릭 시 사이드 패널 미리보기, 더블클릭 시 문서뷰로 전환.
 * 엣지 표시/생성은 "수동 노드 간 연결" 단계에서 추가.
 */
export function GraphView() {
  const { workspace, nodes } = useWorkspaceContext()
  const navigate = useNavigate()
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<KnowledgeFlowNode>([])

  // DB 노드 목록 → React Flow 노드. 이미 있는 노드는 위치/선택 상태를 유지하고, 새 노드만 배치한다.
  useEffect(() => {
    setFlowNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]))
      const nextIds = new Set(nodes.items.map((n) => n.id))
      for (const id of prevById.keys()) if (!nextIds.has(id)) forgetCachedPosition(workspace.id, id)

      const total = nodes.items.length
      return nodes.items.map((n, i) => {
        const existing = prevById.get(n.id)
        return {
          id: n.id,
          type: KNOWLEDGE_NODE_TYPE,
          position: existing?.position ?? resolvePosition(workspace.id, n, i, total),
          selected: existing?.selected ?? false,
          data: { node: n },
        }
      })
    })
  }, [nodes.items, workspace.id, setFlowNodes])

  const selectedId = useMemo(() => flowNodes.find((n) => n.selected)?.id, [flowNodes])
  const selectedNode = selectedId ? nodes.items.find((n) => n.id === selectedId) : undefined

  const openInDoc = useCallback((nodeId: string) => navigate(`/w/${workspace.id}/doc/${nodeId}`), [navigate, workspace.id])

  const onNodeDoubleClick: NodeMouseHandler<KnowledgeFlowNode> = useCallback((_e, node) => openInDoc(node.id), [openInDoc])

  const onNodeDragStop: OnNodeDrag<KnowledgeFlowNode> = useCallback(
    (_e, node) => setCachedPosition(workspace.id, node.id, node.position),
    [workspace.id],
  )

  const clearSelection = useCallback(
    () => setFlowNodes((prev) => prev.map((n) => (n.selected ? { ...n, selected: false } : n))),
    [setFlowNodes],
  )

  return (
    <div className="flex h-full">
      <div className="relative min-w-0 flex-1">
        <ReactFlow<KnowledgeFlowNode>
          nodes={flowNodes}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeDragStop={onNodeDragStop}
          fitView
          fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
          minZoom={0.2}
          maxZoom={2}
          nodesConnectable={false}
          deleteKeyCode={null}
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
        {nodes.error && (
          <p role="alert" className="absolute top-3 left-3 rounded-md border border-destructive/40 bg-background p-2 text-sm text-destructive">
            {nodes.error}
          </p>
        )}
      </div>

      {selectedNode && <NodePreviewPanel node={selectedNode} onOpenInDoc={() => openInDoc(selectedNode.id)} onClose={clearSelection} />}
    </div>
  )
}
