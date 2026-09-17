import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'

export type KnowledgeEdge = Tables<'edges'>

export const EDGE_LABEL_MAX = 100 // DB check 제약과 동일

/** 빈 문자열은 null 로 (라벨 없음) */
export function normalizeLabel(raw: string): string | null {
  const label = raw.trim().replace(/\s+/g, ' ')
  return label === '' ? null : label.slice(0, EDGE_LABEL_MAX)
}

/** unique(source_node_id, target_node_id) 위반 */
export function isDuplicateEdgeError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && e.code === '23505'
}

/** rejected(거부된 AI 제안)는 화면에 그리지 않으므로 제외. */
export async function listEdges(workspaceId: string): Promise<KnowledgeEdge[]> {
  const { data, error } = await supabase.from('edges').select('*').eq('workspace_id', workspaceId).neq('status', 'rejected')
  if (error) throw error
  return data
}

/** 수동 연결: source='manual', status='confirmed' 로 바로 확정 (AI 제안 경로와 무관). */
export async function createManualEdge(input: {
  workspace_id: string
  source_node_id: string
  target_node_id: string
  label?: string | null
}): Promise<KnowledgeEdge> {
  const { data, error } = await supabase
    .from('edges')
    .insert({ ...input, source: 'manual', status: 'confirmed' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateEdgeLabel(id: string, label: string | null): Promise<KnowledgeEdge> {
  const { data, error } = await supabase.from('edges').update({ label }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteEdge(id: string): Promise<void> {
  const { error } = await supabase.from('edges').delete().eq('id', id)
  if (error) throw error
}
