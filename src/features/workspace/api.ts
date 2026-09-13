import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'

export type Workspace = Tables<'workspaces'>

export interface WorkspaceSummary extends Workspace {
  node_count: number
}

export const WORKSPACE_NAME_MAX = 100 // DB check 제약과 동일

export function normalizeWorkspaceName(raw: string): string | null {
  const name = raw.trim()
  if (name.length === 0 || name.length > WORKSPACE_NAME_MAX) return null
  return name
}

/** 홈 목록: 최근 수정순 + 노드 수 (PRD 4.1). RLS로 본인 소유만 반환된다. */
export async function listWorkspaces(): Promise<WorkspaceSummary[]> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*, nodes(count)')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data.map(({ nodes, ...ws }) => ({ ...ws, node_count: nodes[0]?.count ?? 0 }))
}

export async function getWorkspace(id: string): Promise<Workspace | null> {
  const { data, error } = await supabase.from('workspaces').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

/** owner_id 는 DB default(auth.uid())로 채워진다. */
export async function createWorkspace(name: string): Promise<Workspace> {
  const { data, error } = await supabase.from('workspaces').insert({ name }).select().single()
  if (error) throw error
  return data
}

export async function renameWorkspace(id: string, name: string): Promise<Workspace> {
  const { data, error } = await supabase.from('workspaces').update({ name }).eq('id', id).select().single()
  if (error) throw error
  return data
}

/** 하위 nodes/tags/edges 등은 FK on delete cascade 로 함께 삭제된다. */
export async function deleteWorkspace(id: string): Promise<void> {
  const { error } = await supabase.from('workspaces').delete().eq('id', id)
  if (error) throw error
}
