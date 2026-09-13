import type { XYPosition } from '@xyflow/react'
import type { KnowledgeNode } from '@/features/node/api'

/**
 * 노드 위치.
 * PRD 6장 스키마에는 위치 컬럼이 없어 DB에 저장하지 않는다. 대신 워크스페이스별로 모듈 캐시에 두어
 * 탭 전환(그래프뷰 언마운트) 뒤에도 세션 내에서는 드래그한 위치가 유지된다. 새로고침하면 자동 배치로 돌아간다.
 * 영구 저장이 필요하면 nodes 에 position_x/position_y 를 추가하는 마이그레이션으로 확장.
 */
const positionCache = new Map<string, Map<string, XYPosition>>()

export function getCachedPosition(workspaceId: string, nodeId: string): XYPosition | undefined {
  return positionCache.get(workspaceId)?.get(nodeId)
}

export function setCachedPosition(workspaceId: string, nodeId: string, pos: XYPosition): void {
  let ws = positionCache.get(workspaceId)
  if (!ws) {
    ws = new Map()
    positionCache.set(workspaceId, ws)
  }
  ws.set(nodeId, pos)
}

export function forgetCachedPosition(workspaceId: string, nodeId: string): void {
  positionCache.get(workspaceId)?.delete(nodeId)
}

const CELL_W = 260
const CELL_H = 150

/** 생성 순서대로 격자 배치. 엣지가 생기면 이후 단계에서 레이아웃 알고리즘으로 교체 가능. */
export function gridPosition(index: number, total: number): XYPosition {
  const cols = Math.max(1, Math.ceil(Math.sqrt(total)))
  return { x: (index % cols) * CELL_W, y: Math.floor(index / cols) * CELL_H }
}

/** 캐시된 위치가 있으면 그것을, 없으면 격자 위치를 준다. */
export function resolvePosition(workspaceId: string, node: KnowledgeNode, index: number, total: number): XYPosition {
  return getCachedPosition(workspaceId, node.id) ?? gridPosition(index, total)
}
