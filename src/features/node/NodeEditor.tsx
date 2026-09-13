import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toMessage } from '@/features/workspace/useWorkspaces'
import { cn } from '@/lib/utils'
import { DEFAULT_NODE_TITLE, NODE_TITLE_MAX, NODE_TYPE_LABEL, type KnowledgeNode, type NodePatch, type NodeType } from './api'

const AUTOSAVE_DELAY_MS = 800

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

interface Props {
  node: KnowledgeNode
  onSave: (patch: NodePatch) => Promise<unknown>
  onDelete: () => Promise<void>
}

/**
 * 노드 편집기 (MVP: 제목 + 타입 + Markdown textarea). 다음 단계에서 본문을 TipTap 으로 교체한다.
 * 부모는 `key={node.id}` 로 마운트해 노드가 바뀌면 로컬 상태가 초기화되도록 한다.
 * 저장: 제목/본문은 입력 후 AUTOSAVE_DELAY_MS 디바운스, 타입은 즉시. Ctrl/Cmd+S 로 즉시 저장.
 */
export function NodeEditor({ node, onSave, onDelete }: Props) {
  const [title, setTitle] = useState(node.title)
  const [content, setContent] = useState(node.content)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // 아직 저장되지 않은 변경분. 디바운스 타이머와 함께 ref 로 관리해 최신 값을 항상 flush 할 수 있게 한다.
  const pending = useRef<NodePatch>({})
  const timer = useRef<number | null>(null)

  const flush = useCallback(async () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    const patch = pending.current
    if (Object.keys(patch).length === 0) return
    pending.current = {}
    setStatus('saving')
    try {
      await onSave(patch)
      setStatus((s) => (s === 'saving' ? 'saved' : s))
      setError(null)
    } catch (e) {
      // 실패한 변경분은 되살려 다음 저장 때 다시 시도
      pending.current = { ...patch, ...pending.current }
      setStatus('error')
      setError(toMessage(e))
    }
  }, [onSave])

  const schedule = useCallback(
    (patch: NodePatch) => {
      pending.current = { ...pending.current, ...patch }
      setStatus('dirty')
      if (timer.current !== null) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void flush(), AUTOSAVE_DELAY_MS)
    },
    [flush],
  )

  // 언마운트(다른 노드 선택, 탭 전환) 시 남은 변경분 저장
  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
      const patch = pending.current
      if (Object.keys(patch).length > 0) {
        pending.current = {}
        void onSave(patch)
      }
    }
  }, [onSave])

  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault()
      void flush()
    }
  }

  const changeType = async (type: NodeType) => {
    if (type === node.type) return
    setStatus('saving')
    try {
      await onSave({ type })
      setStatus('saved')
      setError(null)
    } catch (e) {
      setStatus('error')
      setError(toMessage(e))
    }
  }

  return (
    <div className="flex h-full flex-col" onKeyDown={onKeyDown}>
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <TypeToggle value={node.type} onChange={(t) => void changeType(t)} />
        <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
          {status === 'dirty' && '편집 중…'}
          {status === 'saving' && '저장 중…'}
          {status === 'saved' && '저장됨'}
          {status === 'error' && <span className="text-destructive">저장 실패: {error}</span>}
        </span>
        <Button variant="ghost" size="icon-sm" aria-label="노드 삭제" onClick={() => setConfirmDelete(true)}>
          <Trash2 />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
        <Input
          aria-label="제목"
          placeholder={DEFAULT_NODE_TITLE}
          autoFocus={node.title === ''} // 방금 만든 노드는 바로 제목부터 입력
          maxLength={NODE_TITLE_MAX}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            schedule({ title: e.target.value })
          }}
          className="text-lg font-medium"
        />
        <Textarea
          aria-label="본문 (Markdown)"
          placeholder={node.type === 'card' ? '짧은 개념 설명을 적어 보세요' : 'Markdown 으로 작성'}
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            schedule({ content: e.target.value })
          }}
          className="min-h-0 flex-1 resize-none font-mono text-sm"
        />
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>"{node.title || DEFAULT_NODE_TITLE}" 노드를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>태그, 다른 노드와의 연결, 첨부파일도 함께 삭제됩니다. 되돌릴 수 없습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                pending.current = {} // 삭제될 노드에 남은 변경분은 버린다
                void onDelete()
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function TypeToggle({ value, onChange }: { value: NodeType; onChange: (t: NodeType) => void }) {
  const types: NodeType[] = ['card', 'doc']
  return (
    <div role="radiogroup" aria-label="노드 타입" className="inline-flex rounded-md border p-0.5">
      {types.map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t}
          onClick={() => onChange(t)}
          className={cn(
            'rounded px-2.5 py-1 text-xs transition-colors',
            value === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
          )}
        >
          {NODE_TYPE_LABEL[t]}
        </button>
      ))}
    </div>
  )
}
