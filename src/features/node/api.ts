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

/**
 * 가져오기용 일괄 생성. 한 요청이 과도해지지 않게 개수(25개)와 용량(약 1.5 MB) 둘 다로 묶음을 나눈다.
 * 중간에 실패하면 그때까지 생성된 노드를 에러 객체의 `createdSoFar` 로 돌려준다.
 */
const INSERT_CHUNK_ROWS = 25
const INSERT_CHUNK_CHARS = 1_500_000

export async function createNodes(
  workspaceId: string,
  inputs: Array<{ type: NodeType; title: string; content: string }>,
  onProgress?: (done: number, total: number) => void,
): Promise<KnowledgeNode[]> {
  const chunks: Array<typeof inputs> = []
  let current: typeof inputs = []
  let chars = 0
  for (const input of inputs) {
    const size = input.title.length + input.content.length
    if (current.length > 0 && (current.length >= INSERT_CHUNK_ROWS || chars + size > INSERT_CHUNK_CHARS)) {
      chunks.push(current)
      current = []
      chars = 0
    }
    current.push(input)
    chars += size
  }
  if (current.length > 0) chunks.push(current)

  const created: KnowledgeNode[] = []
  for (const chunk of chunks) {
    const rows = chunk.map((n) => ({ ...n, workspace_id: workspaceId }))
    const { data, error } = await supabase.from('nodes').insert(rows).select(NODE_COLUMNS)
    if (error) throw Object.assign(error, { createdSoFar: created })
    created.push(...data)
    onProgress?.(created.length, inputs.length)
  }
  return created
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
