import { supabase } from '@/lib/supabase'
import type { Database, Tables } from '@/lib/database.types'

export type Category = Tables<'categories'>
export type Tag = Tables<'tags'>
export type Provenance = Database['public']['Enums']['provenance']

/** 노드-태그 연결. source 는 'manual'(직접) 또는 'ai'(AI 제안을 승인) */
export interface NodeTagLink {
  node_id: string
  tag_id: string
  source: Provenance
}

export const TAG_NAME_MAX = 50 // DB check 제약과 동일 (tags, categories 공통)

export function normalizeName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (name.length === 0 || name.length > TAG_NAME_MAX) return null
  return name
}

/** unique(workspace_id, name) 위반을 사람이 읽을 메시지로 */
export function isDuplicateError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && e.code === '23505'
}

// ---- 조회 ----

export async function listCategories(workspaceId: string): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').eq('workspace_id', workspaceId).order('name')
  if (error) throw error
  return data
}

export async function listTags(workspaceId: string): Promise<Tag[]> {
  const { data, error } = await supabase.from('tags').select('*').eq('workspace_id', workspaceId).order('name')
  if (error) throw error
  return data
}

/** 워크스페이스의 모든 노드-태그 연결. node_tags 에는 workspace_id 가 없어 nodes 를 inner join 해 거른다. */
export async function listNodeTagLinks(workspaceId: string): Promise<NodeTagLink[]> {
  const { data, error } = await supabase
    .from('node_tags')
    .select('node_id, tag_id, source, nodes!inner(workspace_id)')
    .eq('nodes.workspace_id', workspaceId)
  if (error) throw error
  return data.map(({ node_id, tag_id, source }) => ({ node_id, tag_id, source }))
}

// ---- 카테고리 ----

export async function createCategory(workspaceId: string, name: string): Promise<Category> {
  const { data, error } = await supabase.from('categories').insert({ workspace_id: workspaceId, name }).select().single()
  if (error) throw error
  return data
}

export async function renameCategory(id: string, name: string): Promise<Category> {
  const { data, error } = await supabase.from('categories').update({ name }).eq('id', id).select().single()
  if (error) throw error
  return data
}

/** 소속 태그는 FK on delete set null 로 자유 태그가 된다 (태그 자체는 남음). */
export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}

// ---- 태그 ----

export async function createTag(workspaceId: string, name: string, categoryId: string | null = null): Promise<Tag> {
  const { data, error } = await supabase
    .from('tags')
    .insert({ workspace_id: workspaceId, name, category_id: categoryId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTag(id: string, patch: { name?: string; category_id?: string | null }): Promise<Tag> {
  const { data, error } = await supabase.from('tags').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

/** node_tags 는 FK on delete cascade 로 함께 삭제된다. */
export async function deleteTag(id: string): Promise<void> {
  const { error } = await supabase.from('tags').delete().eq('id', id)
  if (error) throw error
}

// ---- 노드에 붙이기/떼기 ----

export async function attachTag(nodeId: string, tagId: string, source: Provenance = 'manual'): Promise<NodeTagLink> {
  const { data, error } = await supabase
    .from('node_tags')
    .upsert({ node_id: nodeId, tag_id: tagId, source }, { onConflict: 'node_id,tag_id', ignoreDuplicates: true })
    .select('node_id, tag_id, source')
    .maybeSingle()
  if (error) throw error
  // 이미 붙어 있던 경우(ignoreDuplicates)엔 행이 반환되지 않는다
  return data ?? { node_id: nodeId, tag_id: tagId, source }
}

export async function detachTag(nodeId: string, tagId: string): Promise<void> {
  const { error } = await supabase.from('node_tags').delete().eq('node_id', nodeId).eq('tag_id', tagId)
  if (error) throw error
}
