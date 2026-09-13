import { supabase } from '@/lib/supabase'
import type { Database, Tables } from '@/lib/database.types'

export type NodeType = Database['public']['Enums']['node_type']

/** 목록/편집에 쓰는 노드. embedding 은 무겁고 클라이언트에서 쓸 일이 없어 항상 제외한다. */
export type KnowledgeNode = Omit<Tables<'nodes'>, 'embedding'>

const NODE_COLUMNS = 'id, workspace_id, type, title, content, position_x, position_y, created_at, updated_at' as const

export const NODE_TITLE_MAX = 300 // DB check 제약과 동일
export const DEFAULT_NODE_TITLE = '제목 없음'

export const NODE_TYPE_LABEL: Record<NodeType, string> = {
  card: '카드',
  doc: '문서',
}

export async function listNodes(workspaceId: string): Promise<KnowledgeNode[]> {
  const { data, error } = await supabase
    .from('nodes')
    .select(NODE_COLUMNS)
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data
}

/** 제목은 빈 문자열로 만든다(DB default). 화면에서는 `DEFAULT_NODE_TITLE` 로 대체 표시. */
export async function createNode(input: { workspace_id: string; type: NodeType; title?: string; content?: string }): Promise<KnowledgeNode> {
  const { data, error } = await supabase.from('nodes').insert(input).select(NODE_COLUMNS).single()
  if (error) throw error
  return data
}

export type NodePatch = Partial<Pick<KnowledgeNode, 'type' | 'title' | 'content' | 'position_x' | 'position_y'>>

export async function updateNode(id: string, patch: NodePatch): Promise<KnowledgeNode> {
  const { data, error } = await supabase.from('nodes').update(patch).eq('id', id).select(NODE_COLUMNS).single()
  if (error) throw error
  return data
}

/** node_tags, edges, attachments 는 FK on delete cascade 로 함께 삭제된다. */
export async function deleteNode(id: string): Promise<void> {
  const { error } = await supabase.from('nodes').delete().eq('id', id)
  if (error) throw error
}
