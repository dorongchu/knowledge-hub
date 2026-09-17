import { useMemo, useRef, useState, type DragEvent } from 'react'
import { AlertTriangle, FileUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DEFAULT_NODE_TITLE, NODE_TYPE_LABEL, type NodeType } from '@/features/node/api'
import type { NodesApi } from '@/features/node/useNodes'
import { toMessage } from '@/features/workspace/useWorkspaces'
import { cn } from '@/lib/utils'
import { MAX_FILES, MAX_FILE_BYTES, SKIP_REASON_LABEL, parseImportFiles, type ImportCandidate, type SkippedFile } from './parseNotion'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  nodes: NodesApi
}

/** 노션 Markdown 가져오기 (PRD 11장): 파일 선택 → 미리보기 → 노드 생성 → 결과 */
export function ImportDialog({ open, onOpenChange, nodes }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-2xl">
        {/* 닫히면 언마운트되어 다음에 열 때 처음 단계부터 시작한다 */}
        <ImportFlow nodes={nodes} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

type Step =
  | { kind: 'pick'; error?: string }
  | { kind: 'parsing' }
  | { kind: 'preview'; candidates: ImportCandidate[]; skipped: SkippedFile[] }
  | { kind: 'importing'; done: number; total: number }
  | { kind: 'done'; created: number; failedMessage?: string; skipped: SkippedFile[] }

function ImportFlow({ nodes, onClose }: { nodes: NodesApi; onClose: () => void }) {
  const [step, setStep] = useState<Step>({ kind: 'pick' })
  // 미리보기에서 사용자가 바꾼 값: 제외한 항목, 타입 변경
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [types, setTypes] = useState<Map<string, NodeType>>(new Map())

  const existingTitles = useMemo(() => new Set(nodes.items.map((n) => n.title.trim().toLowerCase()).filter(Boolean)), [nodes.items])

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return
    setStep({ kind: 'parsing' })
    try {
      const { candidates, skipped } = await parseImportFiles(files)
      if (candidates.length === 0) {
        setStep({ kind: 'pick', error: skipped.length > 0 ? `가져올 수 있는 Markdown 파일이 없습니다. (건너뜀 ${skipped.length}개)` : '가져올 수 있는 Markdown 파일이 없습니다.' })
        return
      }
      setExcluded(new Set())
      setTypes(new Map())
      setStep({ kind: 'preview', candidates, skipped })
    } catch (e) {
      setStep({ kind: 'pick', error: `파일을 읽지 못했습니다: ${toMessage(e)}` })
    }
  }

  const runImport = async (candidates: ImportCandidate[], skipped: SkippedFile[]) => {
    const selected = candidates.filter((c) => !excluded.has(c.key))
    if (selected.length === 0) return
    setStep({ kind: 'importing', done: 0, total: selected.length })
    try {
      const created = await nodes.createMany(
        selected.map((c) => ({ type: types.get(c.key) ?? c.suggestedType, title: c.title, content: c.content })),
        (done, total) => setStep({ kind: 'importing', done, total }),
      )
      setStep({ kind: 'done', created: created.length, skipped })
    } catch (e) {
      const partial = (e as { createdSoFar?: unknown[] }).createdSoFar?.length ?? 0
      setStep({ kind: 'done', created: partial, failedMessage: toMessage(e), skipped })
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>노션에서 가져오기</DialogTitle>
        <DialogDescription>
          노션의 "내보내기 → Markdown &amp; CSV"로 받은 zip 파일을 그대로 올리거나, 압축을 푼 .md 파일들을 고르세요. 파일은 이 브라우저 안에서만 읽습니다.
        </DialogDescription>
      </DialogHeader>

      {step.kind === 'pick' && <PickStep error={step.error} onFiles={(f) => void handleFiles(f)} />}

      {step.kind === 'parsing' && <p className="py-10 text-center text-sm text-muted-foreground">파일을 읽는 중…</p>}

      {step.kind === 'preview' && (
        <PreviewStep
          candidates={step.candidates}
          skipped={step.skipped}
          excluded={excluded}
          types={types}
          existingTitles={existingTitles}
          onToggle={(key) =>
            setExcluded((prev) => {
              const next = new Set(prev)
              if (next.has(key)) next.delete(key)
              else next.add(key)
              return next
            })
          }
          onToggleAll={(include) => setExcluded(include ? new Set() : new Set(step.candidates.map((c) => c.key)))}
          onType={(key, t) => setTypes((prev) => new Map(prev).set(key, t))}
        />
      )}

      {step.kind === 'importing' && (
        <div className="py-10 text-center text-sm text-muted-foreground" aria-live="polite">
          노드를 만드는 중… {step.done} / {step.total}
        </div>
      )}

      {step.kind === 'done' && (
        <div className="space-y-3 py-4 text-sm">
          <p className="font-medium">노드 {step.created}개를 가져왔습니다.</p>
          {step.failedMessage && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-destructive">
              도중에 실패해 나머지는 가져오지 못했습니다: {step.failedMessage}
            </p>
          )}
          <p className="text-muted-foreground">각 노드의 편집기에서 태그를 붙일 수 있습니다. 그래프에서는 자동 배치된 위치에 나타납니다.</p>
          <SkippedList skipped={step.skipped} />
        </div>
      )}

      <DialogFooter>
        {step.kind === 'preview' ? (
          <>
            <Button variant="outline" onClick={() => setStep({ kind: 'pick' })}>
              다시 고르기
            </Button>
            <Button disabled={step.candidates.length === excluded.size} onClick={() => void runImport(step.candidates, step.skipped)}>
              {step.candidates.length - excluded.size}개 가져오기
            </Button>
          </>
        ) : (
          <Button variant={step.kind === 'done' ? 'default' : 'outline'} disabled={step.kind === 'importing'} onClick={onClose}>
            {step.kind === 'done' ? '완료' : '닫기'}
          </Button>
        )}
      </DialogFooter>
    </>
  )
}

function PickStep({ error, onFiles }: { error?: string; onFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    onFiles(Array.from(e.dataTransfer.files))
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn('flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center text-sm', dragging && 'border-primary bg-primary/5')}
      >
        <FileUp className="size-8 text-muted-foreground" aria-hidden />
        <p className="text-muted-foreground">zip 또는 .md 파일을 여기에 끌어다 놓거나</p>
        <Button onClick={() => inputRef.current?.click()}>파일 선택</Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".zip,.md,.markdown,application/zip,text/markdown"
          className="sr-only"
          aria-label="가져올 파일"
          onChange={(e) => {
            onFiles(Array.from(e.target.files ?? []))
            e.target.value = '' // 같은 파일을 다시 고를 수 있게
          }}
        />
      </div>
      <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
        <li>.md 파일 하나가 노드 하나가 됩니다. 제목은 첫 번째 "# 제목" 줄, 없으면 파일 이름에서 가져옵니다.</li>
        <li>
          파일당 {MAX_FILE_BYTES / 1024 / 1024} MB, 한 번에 {MAX_FILES}개까지. 이미지·첨부·데이터베이스(CSV)와 페이지 간 링크의 연결 변환은 아직 지원하지 않습니다.
        </li>
      </ul>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

function PreviewStep({
  candidates,
  skipped,
  excluded,
  types,
  existingTitles,
  onToggle,
  onToggleAll,
  onType,
}: {
  candidates: ImportCandidate[]
  skipped: SkippedFile[]
  excluded: Set<string>
  types: Map<string, NodeType>
  existingTitles: Set<string>
  onToggle: (key: string) => void
  onToggleAll: (include: boolean) => void
  onType: (key: string, type: NodeType) => void
}) {
  const allIncluded = excluded.size === 0
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">
          {candidates.length}개 중 {candidates.length - excluded.size}개 선택됨
        </span>
        <Button variant="ghost" size="xs" onClick={() => onToggleAll(!allIncluded)}>
          {allIncluded ? '전체 해제' : '전체 선택'}
        </Button>
      </div>

      <ul className="min-h-0 flex-1 divide-y overflow-y-auto rounded-md border" aria-label="가져올 항목">
        {candidates.map((c) => {
          const included = !excluded.has(c.key)
          const type = types.get(c.key) ?? c.suggestedType
          const duplicate = c.title !== '' && existingTitles.has(c.title.trim().toLowerCase())
          return (
            <li key={c.key} className={cn('flex items-center gap-3 px-3 py-2', !included && 'opacity-50')}>
              <input type="checkbox" checked={included} onChange={() => onToggle(c.key)} aria-label={`${c.title || DEFAULT_NODE_TITLE} 가져오기`} className="size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.title || DEFAULT_NODE_TITLE}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.chars.toLocaleString()}자 · {c.sourceName}
                </p>
                {duplicate && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="size-3" aria-hidden />이 워크스페이스에 같은 제목의 노드가 이미 있습니다 (가져오면 새 노드가 하나 더 생깁니다)
                  </p>
                )}
              </div>
              <select
                aria-label={`${c.title || DEFAULT_NODE_TITLE} 의 타입`}
                value={type}
                disabled={!included}
                onChange={(e) => onType(c.key, e.target.value as NodeType)}
                className="h-7 shrink-0 rounded-md border bg-background px-1 text-xs"
              >
                <option value="card">{NODE_TYPE_LABEL.card}</option>
                <option value="doc">{NODE_TYPE_LABEL.doc}</option>
              </select>
            </li>
          )
        })}
      </ul>

      <SkippedList skipped={skipped} />
    </div>
  )
}

function SkippedList({ skipped }: { skipped: SkippedFile[] }) {
  if (skipped.length === 0) return null
  // 사유별로 묶어 개수와 예시 몇 개만 보여준다 (zip 안의 이미지가 수백 개일 수 있음)
  const byReason = new Map<SkippedFile['reason'], string[]>()
  for (const s of skipped) byReason.set(s.reason, [...(byReason.get(s.reason) ?? []), s.name])
  return (
    <details className="rounded-md border p-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer">건너뛴 파일 {skipped.length}개</summary>
      <ul className="mt-2 space-y-1">
        {[...byReason.entries()].map(([reason, names]) => (
          <li key={reason}>
            <span className="font-medium text-foreground">{SKIP_REASON_LABEL[reason]}</span> — {names.length}개
            <span className="block truncate">
              {names.slice(0, 3).join(', ')}
              {names.length > 3 && ' …'}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}
