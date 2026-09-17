import { unzip, type Unzipped } from 'fflate'
import { NODE_TITLE_MAX, type NodeType } from '@/features/node/api'
import { markdownToPlainText } from '@/lib/plainText'

/**
 * 노션 "Markdown & CSV" 내보내기 → 노드 후보 (PRD 11장).
 * 전부 브라우저에서 처리하며 원본 파일은 서버로 보내지 않는다. 화면(ImportDialog)과 분리된 순수 로직.
 */

// PRD 11.1 의 초기값. 가져오기 화면에서만 검사하는 클라이언트 상수 (바꿔도 마이그레이션 불필요)
export const MAX_FILE_BYTES = 1024 * 1024 // 파일당 1 MB
export const MAX_FILES = 200 // 한 번에 200개
export const MAX_ZIP_BYTES = 100 * 1024 * 1024 // zip 자체 상한 (메모리 보호)
export const CARD_MAX_CHARS = 500 // 평문 기준 이 길이 이하면 card 로 제안 (PRD 11.2)

export interface ImportCandidate {
  /** 미리보기 목록의 key. 같은 이름의 파일이 있어도 겹치지 않게 순번을 붙인다 */
  key: string
  sourceName: string
  title: string
  content: string
  /** Markdown 기호를 걷어낸 평문 글자 수 */
  chars: number
  suggestedType: NodeType
}

export type SkipReason = 'too-large' | 'over-limit' | 'not-markdown' | 'empty' | 'unreadable'

export interface SkippedFile {
  name: string
  reason: SkipReason
}

export const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  'too-large': `파일당 ${MAX_FILE_BYTES / 1024 / 1024} MB 초과`,
  'over-limit': `한 번에 ${MAX_FILES}개 초과`,
  'not-markdown': 'Markdown 파일이 아님 (이미지·CSV 등은 1차 범위 제외)',
  empty: '제목과 본문이 모두 비어 있음',
  unreadable: '읽을 수 없음 (손상되었거나 지원하지 않는 형식)',
}

export interface ParseResult {
  candidates: ImportCandidate[]
  skipped: SkippedFile[]
}

const isMarkdown = (name: string) => /\.(md|markdown)$/i.test(name)
const isZip = (name: string) => /\.zip$/i.test(name)
/** macOS 가 zip 에 끼워 넣는 메타 파일 등 */
const isJunk = (name: string) => name.startsWith('__MACOSX/') || /(^|\/)\.[^/]+$/.test(name)
const baseName = (path: string) => path.split('/').pop() ?? path

/** 파일명 → 제목 대체값: 확장자와, 노션이 끝에 붙이는 32자리 16진수 ID 를 뗀다 */
export function titleFromFileName(path: string): string {
  return baseName(path)
    .replace(/\.(md|markdown)$/i, '')
    .replace(/\s+[0-9a-f]{32}$/i, '')
    .trim()
}

/** Markdown 한 개 → 제목/본문/타입 (PRD 11.2). 제목과 본문이 모두 비면 null */
export function parseNotionMarkdown(sourceName: string, raw: string): Omit<ImportCandidate, 'key'> | null {
  const text = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const lines = text.split('\n')

  // 첫 번째로 나오는 비어 있지 않은 줄이 `# 제목` 이면 그것을 제목으로 쓰고 본문에서 뺀다
  let title = ''
  let bodyStart = 0
  const firstIdx = lines.findIndex((l) => l.trim() !== '')
  const heading = firstIdx >= 0 ? /^#\s+(.+?)\s*#*\s*$/.exec(lines[firstIdx]) : null
  if (heading) {
    title = heading[1].trim()
    bodyStart = firstIdx + 1
  } else {
    title = titleFromFileName(sourceName)
  }

  const content = lines.slice(bodyStart).join('\n').trim()
  title = title.slice(0, NODE_TITLE_MAX)
  if (title === '' && content === '') return null

  const chars = markdownToPlainText(content).length
  return { sourceName, title, content, chars, suggestedType: chars <= CARD_MAX_CHARS ? 'card' : 'doc' }
}

function unzipAsync(data: Uint8Array, skipped: SkippedFile[]): Promise<Unzipped> {
  return new Promise((resolve, reject) => {
    unzip(
      data,
      {
        // 압축을 풀기 전에 거른다: Markdown(과 중첩 zip)만, 크기 제한 이내만
        filter: (f) => {
          if (f.name.endsWith('/') || isJunk(f.name)) return false
          if (isZip(f.name)) return f.originalSize <= MAX_ZIP_BYTES
          if (!isMarkdown(f.name)) {
            skipped.push({ name: f.name, reason: 'not-markdown' })
            return false
          }
          if (f.originalSize > MAX_FILE_BYTES) {
            skipped.push({ name: f.name, reason: 'too-large' })
            return false
          }
          return true
        },
      },
      (err, files) => (err ? reject(err) : resolve(files)),
    )
  })
}

/** zip 하나에서 Markdown 원문들을 꺼낸다. 노션은 큰 내보내기를 zip 안의 zip(Part-1.zip …)으로 주므로 한 단계 중첩까지 푼다 */
async function extractZip(data: Uint8Array, skipped: SkippedFile[], depth = 0): Promise<Array<{ name: string; text: string }>> {
  const out: Array<{ name: string; text: string }> = []
  const files = await unzipAsync(data, skipped)
  const decoder = new TextDecoder('utf-8')
  for (const [name, bytes] of Object.entries(files)) {
    if (isZip(name)) {
      if (depth === 0) out.push(...(await extractZip(bytes, skipped, 1)))
      continue
    }
    out.push({ name, text: decoder.decode(bytes) })
  }
  return out
}

/** 사용자가 고른 파일들(.zip / .md 혼합 가능) → 노드 후보 + 건너뛴 파일 목록 */
export async function parseImportFiles(files: File[]): Promise<ParseResult> {
  const skipped: SkippedFile[] = []
  const raws: Array<{ name: string; text: string }> = []

  for (const file of files) {
    try {
      if (isZip(file.name)) {
        if (file.size > MAX_ZIP_BYTES) {
          skipped.push({ name: file.name, reason: 'too-large' })
          continue
        }
        raws.push(...(await extractZip(new Uint8Array(await file.arrayBuffer()), skipped)))
      } else if (isMarkdown(file.name)) {
        if (file.size > MAX_FILE_BYTES) skipped.push({ name: file.name, reason: 'too-large' })
        else raws.push({ name: file.name, text: await file.text() })
      } else {
        skipped.push({ name: file.name, reason: 'not-markdown' })
      }
    } catch {
      skipped.push({ name: file.name, reason: 'unreadable' })
    }
  }

  // 경로 순으로 정렬해 매번 같은 순서가 되게 한다
  raws.sort((a, b) => a.name.localeCompare(b.name, 'ko'))

  const candidates: ImportCandidate[] = []
  for (const { name, text } of raws) {
    if (candidates.length >= MAX_FILES) {
      skipped.push({ name, reason: 'over-limit' })
      continue
    }
    const parsed = parseNotionMarkdown(name, text)
    if (!parsed) skipped.push({ name, reason: 'empty' })
    else candidates.push({ ...parsed, key: `${candidates.length}:${name}` })
  }

  return { candidates, skipped }
}
