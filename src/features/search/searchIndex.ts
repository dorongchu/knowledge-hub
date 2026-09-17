import Fuse, { type FuseResultMatch, type IFuseOptions } from 'fuse.js'
import type { NodeType } from '@/features/node/api'
import { markdownToPlainText } from '@/lib/plainText'

/** 검색 색인용 문서. text 는 Markdown 기호를 걷어낸 평문. */
export interface SearchDoc {
  id: string
  workspaceId: string
  type: NodeType
  title: string
  text: string
  tags: string[]
}

export function toSearchDoc(
  node: { id: string; workspace_id: string; type: NodeType; title: string; content: string },
  tagNames: string[] = [],
): SearchDoc {
  return { id: node.id, workspaceId: node.workspace_id, type: node.type, title: node.title, text: markdownToPlainText(node.content), tags: tagNames }
}

const FUSE_OPTIONS: IFuseOptions<SearchDoc> = {
  keys: [
    { name: 'title', weight: 0.5 },
    { name: 'tags', weight: 0.3 },
    { name: 'text', weight: 0.2 },
  ],
  // 0 = 완전 일치만, 1 = 아무거나. ignoreLocation 이면 점수 ≈ 틀린 글자 수 / 검색어 길이.
  // 0.34: 3글자에서 1글자, 4~5글자에서 1글자, 6글자에서 2글자까지 오타 허용.
  threshold: 0.34,
  ignoreLocation: true, // 본문 어디에 있든 같은 점수 (기본값은 앞부분만 유리)
  // 연속 2글자 이상 일치한 구간이 있어야 결과로 인정. 그래서 "임배딩"→"임베딩" 처럼 3글자 단어의 가운데 글자 오타는
  // 잡히지 않는다(일치 구간이 1글자씩). 1로 낮추면 잡히지만 짧은 검색어에서 무관한 결과가 크게 늘어 정확도를 택했다.
  minMatchCharLength: 2,
  includeMatches: true,
}

export function createNodeFuse(docs: SearchDoc[]): Fuse<SearchDoc> {
  return new Fuse(docs, FUSE_OPTIONS)
}

/** 강조 표시용 조각. hit=true 인 부분이 검색어와 일치한 곳. */
export interface SnippetPart {
  text: string
  hit: boolean
}

export interface SearchHit {
  doc: SearchDoc
  titleParts: SnippetPart[]
  /** 본문에서 일치한 곳 주변 발췌. 본문 일치가 없으면 null */
  snippet: SnippetPart[] | null
  matchedTags: string[]
}

const MIN_QUERY = 2
const SNIPPET_BEFORE = 24
const SNIPPET_AFTER = 60
const MAX_RESULTS = 50

export function isSearchable(query: string): boolean {
  return query.trim().length >= MIN_QUERY
}

export function searchNodes(fuse: Fuse<SearchDoc>, query: string): SearchHit[] {
  const q = query.trim()
  if (q.length < MIN_QUERY) return []
  return fuse.search(q, { limit: MAX_RESULTS }).map(({ item, matches }) => {
    const titleMatch = matches?.find((m) => m.key === 'title')
    const textMatch = matches?.find((m) => m.key === 'text')
    return {
      doc: item,
      titleParts: splitByIndices(item.title, meaningful(titleMatch, q)),
      snippet: textMatch ? buildSnippet(item.text, meaningful(textMatch, q)) : null,
      matchedTags: (matches ?? []).filter((m) => m.key === 'tags' && typeof m.value === 'string').map((m) => m.value as string),
    }
  })
}

/**
 * fuse 는 흩어진 1~2글자 일치도 indices 로 돌려준다. 강조가 지저분해지지 않게
 * 검색어 길이의 절반 이상인 구간만 남긴다 (없으면 가장 긴 구간 하나).
 */
function meaningful(match: FuseResultMatch | undefined, query: string): Array<[number, number]> {
  const indices = (match?.indices ?? []) as Array<[number, number]>
  if (indices.length === 0) return []
  const minLen = Math.max(2, Math.ceil(query.length / 2))
  const kept = indices.filter(([s, e]) => e - s + 1 >= minLen)
  if (kept.length > 0) return kept
  return [indices.reduce((best, cur) => (cur[1] - cur[0] > best[1] - best[0] ? cur : best))]
}

function splitByIndices(text: string, indices: Array<[number, number]>): SnippetPart[] {
  if (indices.length === 0) return text ? [{ text, hit: false }] : []
  const parts: SnippetPart[] = []
  let cursor = 0
  for (const [start, end] of [...indices].sort((a, b) => a[0] - b[0])) {
    if (start < cursor) continue // 겹치는 구간은 건너뜀
    if (start > cursor) parts.push({ text: text.slice(cursor, start), hit: false })
    parts.push({ text: text.slice(start, end + 1), hit: true })
    cursor = end + 1
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false })
  return parts
}

/** 첫 일치 지점 주변만 잘라 발췌를 만든다 */
function buildSnippet(text: string, indices: Array<[number, number]>): SnippetPart[] | null {
  if (indices.length === 0) return null
  const first = [...indices].sort((a, b) => a[0] - b[0])[0]
  const from = Math.max(0, first[0] - SNIPPET_BEFORE)
  const to = Math.min(text.length, first[1] + 1 + SNIPPET_AFTER)
  const shifted = indices
    .filter(([s, e]) => s >= from && e < to)
    .map(([s, e]) => [s - from, e - from] as [number, number])
  const parts = splitByIndices(text.slice(from, to), shifted)
  if (from > 0) parts.unshift({ text: '…', hit: false })
  if (to < text.length) parts.push({ text: '…', hit: false })
  return parts
}
