import { useState, type KeyboardEvent } from 'react'
import { ArrowRight, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EDGE_LABEL_MAX, normalizeLabel, type KnowledgeEdge } from '@/features/edge/api'
import { toMessage } from '@/features/workspace/useWorkspaces'

interface Props {
  edge: KnowledgeEdge
  sourceTitle: string
  targetTitle: string
  onSaveLabel: (label: string | null) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
}

/** 그래프에서 엣지 클릭 시 오른쪽에 뜨는 패널: 관계 라벨 편집 + 연결 삭제. 부모가 `key={edge.id}` 로 마운트한다. */
export function EdgePanel({ edge, sourceTitle, targetTitle, onSaveLabel, onDelete, onClose }: Props) {
  const [label, setLabel] = useState(edge.label ?? '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    const next = normalizeLabel(label)
    if (next === (edge.label ?? null)) return
    setStatus('saving')
    setError(null)
    try {
      await onSaveLabel(next)
      setStatus('saved')
    } catch (e) {
      setStatus('idle')
      setError(toMessage(e))
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void save()
    }
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l bg-background" aria-label="연결 편집">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="text-sm font-medium">연결</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {status === 'saving' && '저장 중…'}
          {status === 'saved' && '저장됨'}
        </span>
        <Button variant="ghost" size="icon-sm" aria-label="연결 패널 닫기" onClick={onClose}>
          <X />
        </Button>
      </div>

      <div className="flex-1 space-y-4 p-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate rounded-md border px-2 py-1">{sourceTitle}</span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate rounded-md border px-2 py-1">{targetTitle}</span>
        </div>

        <div className="space-y-2">
          <Label htmlFor="edge-label">관계 라벨</Label>
          <Input
            id="edge-label"
            placeholder="예: 예시, 원인, 반대 개념"
            maxLength={EDGE_LABEL_MAX}
            value={label}
            onChange={(e) => {
              setLabel(e.target.value)
              setStatus('idle')
            }}
            onBlur={() => void save()}
            onKeyDown={onKeyDown}
          />
          <p className="text-xs text-muted-foreground">Enter 또는 입력창을 벗어나면 저장됩니다. 비워 두면 라벨 없이 표시됩니다.</p>
        </div>

        {error && <p className="text-destructive">{error}</p>}
      </div>

      <div className="border-t p-3">
        {confirmingDelete ? (
          <Button
            variant="destructive"
            className="w-full"
            autoFocus
            onBlur={() => setConfirmingDelete(false)}
            onClick={() => void onDelete().catch((e) => setError(toMessage(e)))}
          >
            정말 삭제
          </Button>
        ) : (
          <Button variant="outline" className="w-full" onClick={() => setConfirmingDelete(true)}>
            <Trash2 data-icon="inline-start" />
            연결 삭제
          </Button>
        )}
      </div>
    </aside>
  )
}
