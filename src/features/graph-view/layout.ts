import type { XYPosition } from '@xyflow/react'
import type { KnowledgeNode } from '@/features/node/api'

const CELL_W = 260
const CELL_H = 150

/** 위치가 저장되지 않은 노드용 격자 배치 (생성 순서). 엣지가 생기면 레이아웃 알고리즘으로 교체 가능. */
export function gridPosition(index: number, total: number): XYPosition {
  const cols = Math.max(1, Math.ceil(Math.sqrt(total)))
  return { x: (index % cols) * CELL_W, y: Math.floor(index / cols) * CELL_H }
}

/** DB에 저장된 position_x/y 가 있으면 그것을, 없으면(null) 격자 위치를 준다. */
export function resolvePosition(node: KnowledgeNode, index: number, total: number): XYPosition {
  if (node.position_x !== null && node.position_y !== null) {
    return { x: node.position_x, y: node.position_y }
  }
  return gridPosition(index, total)
}
