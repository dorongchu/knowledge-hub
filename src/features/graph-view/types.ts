import type { Node } from '@xyflow/react'
import type { KnowledgeNode } from '@/features/node/api'

export const KNOWLEDGE_NODE_TYPE = 'knowledge' as const

/** React Flow 노드. data 에 DB 노드를 그대로 싣는다. */
export type KnowledgeFlowNode = Node<{ node: KnowledgeNode }, typeof KNOWLEDGE_NODE_TYPE>
