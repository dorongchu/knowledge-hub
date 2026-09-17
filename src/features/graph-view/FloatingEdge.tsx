import { BaseEdge, Position, getBezierPath, useInternalNode, type EdgeProps, type InternalNode } from '@xyflow/react'

/**
 * 플로팅 엣지: 끝점을 핸들 위치가 아니라 두 노드의 상대 위치로 계산한다.
 * - 나란히 있으면 옆면끼리, 위아래로 있으면 위/아래 면끼리 이어지고 노드를 옮기면 따라 바뀐다
 * - DB(edges)에는 핸들 정보를 저장하지 않으므로, 새로고침 후에도 드래그 당시와 같은 모양이 보장된다
 * (React Flow 공식 "Floating Edges" 예제의 계산 방식)
 */

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function rectOf(node: InternalNode): Rect {
  const { x, y } = node.internals.positionAbsolute
  return { x, y, w: node.measured.width ?? 0, h: node.measured.height ?? 0 }
}

/** `from` 의 중심에서 `to` 의 중심을 향하는 선이 `from` 의 테두리와 만나는 점 */
function intersection(from: Rect, to: Rect): { x: number; y: number } {
  const w = from.w / 2
  const h = from.h / 2
  const cx = from.x + w
  const cy = from.y + h
  const tx = to.x + to.w / 2
  const ty = to.y + to.h / 2
  if (w === 0 || h === 0) return { x: cx, y: cy }

  const xx1 = (tx - cx) / (2 * w) - (ty - cy) / (2 * h)
  const yy1 = (tx - cx) / (2 * w) + (ty - cy) / (2 * h)
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1)
  const xx3 = a * xx1
  const yy3 = a * yy1
  return { x: w * (xx3 + yy3) + cx, y: h * (-xx3 + yy3) + cy }
}

/** 테두리 위의 점이 어느 면에 있는지 → 베지어 곡선이 그 면에서 수직으로 나가게 한다 */
function sideOf(rect: Rect, p: { x: number; y: number }): Position {
  const px = Math.round(p.x)
  const py = Math.round(p.y)
  if (px <= Math.round(rect.x) + 1) return Position.Left
  if (px >= Math.round(rect.x + rect.w) - 1) return Position.Right
  if (py <= Math.round(rect.y) + 1) return Position.Top
  return Position.Bottom
}

export function FloatingEdge({ id, source, target, markerEnd, style, label, labelStyle, labelShowBg, labelBgStyle, labelBgPadding, labelBgBorderRadius, interactionWidth }: EdgeProps) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)
  if (!sourceNode || !targetNode) return null

  const s = rectOf(sourceNode)
  const t = rectOf(targetNode)
  const sp = intersection(s, t)
  const tp = intersection(t, s)

  const [path, labelX, labelY] = getBezierPath({
    sourceX: sp.x,
    sourceY: sp.y,
    sourcePosition: sideOf(s, sp),
    targetX: tp.x,
    targetY: tp.y,
    targetPosition: sideOf(t, tp),
  })

  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      style={style}
      label={label}
      labelX={labelX}
      labelY={labelY}
      labelStyle={labelStyle}
      labelShowBg={labelShowBg}
      labelBgStyle={labelBgStyle}
      labelBgPadding={labelBgPadding}
      labelBgBorderRadius={labelBgBorderRadius}
      interactionWidth={interactionWidth}
    />
  )
}
