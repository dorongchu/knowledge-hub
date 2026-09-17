import { MarkerType, type DefaultEdgeOptions, type EdgeTypes, type NodeTypes, type ReactFlowProps } from '@xyflow/react'
import { FloatingEdge } from './FloatingEdge'
import { KnowledgeFlowNodeView } from './KnowledgeFlowNode'
import { KNOWLEDGE_NODE_TYPE } from './types'

/**
 * GraphView 와 개발용 GraphPlayground 가 공유하는 React Flow 설정.
 * 컴포넌트 밖 모듈 상수로 두어 매 렌더마다 새 객체가 되지 않게 한다 (React Flow 권장).
 */
export const nodeTypes: NodeTypes = { [KNOWLEDGE_NODE_TYPE]: KnowledgeFlowNodeView }

export const FLOATING_EDGE_TYPE = 'floating' as const

export const edgeTypes: EdgeTypes = { [FLOATING_EDGE_TYPE]: FloatingEdge }

export const defaultEdgeOptions: DefaultEdgeOptions = {
  type: FLOATING_EDGE_TYPE,
  markerEnd: { type: MarkerType.ArrowClosed },
}

/** 연결/줌/삭제 등 상호작용 관련 공통 props */
export const flowInteractionProps = {
  minZoom: 0.2,
  maxZoom: 2,
  deleteKeyCode: null, // 키보드 삭제는 막고, 삭제는 패널의 확인 버튼으로만
} satisfies Partial<ReactFlowProps>
