import { supabase } from '@/lib/supabase'
import type { Tables } from '@/lib/database.types'

export type Folder = Tables<'folders'>

export const FOLDER_NAME_MAX = 100 // DB check 제약과 동일
export const NO_FOLDER_LABEL = '폴더 없음'

export function normalizeFolderName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (name.length === 0 || name.length > FOLDER_NAME_MAX) return null
  return name
}

/** unique(workspace_id, name) 위반 */
export function isDuplicateFolderError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && e.code === '23505'
}

export async function listFolders(workspaceId: string): Promise<Folder[]> {
  const { data, error } = await supabase.from('folders').select('*').eq('workspace_id', workspaceId).order('sort_order').order('name')
  if (error) throw error
  return data
}

export async function createFolder(workspaceId: string, name: string, sortOrder: number): Promise<Folder> {
  const { data, error } = await supabase.from('folders').insert({ workspace_id: workspaceId, name, sort_order: sortOrder }).select().single()
  if (error) throw error
  return data
}

export async function updateFolder(id: string, patch: { name?: string; sort_order?: number }): Promise<Folder> {
  const { data, error } = await supabase.from('folders').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

/** 소속 노드는 삭제되지 않고 folder_id 가 null 이 된다 (FK on delete set null). */
export async function deleteFolder(id: string): Promise<void> {
  const { error } = await supabase.from('folders').delete().eq('id', id)
  if (error) throw error
}

/** 순서 일괄 저장 (위/아래 이동 후). 실패한 것이 있으면 첫 오류를 던진다. */
export async function reorderFolders(orders: Array<{ id: string; sort_order: number }>): Promise<void> {
  const results = await Promise.all(orders.map((o) => supabase.from('folders').update({ sort_order: o.sort_order }).eq('id', o.id)))
  const failed = results.find((r) => r.error)
  if (failed?.error) throw failed.error
}
