import { useEffect } from 'react'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { Placeholder } from '@tiptap/extensions'
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Undo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  /** 초기 Markdown. 이후 변경은 onChange 로만 전달되며 외부 값 변경은 반영하지 않는다 (부모가 key 로 재마운트) */
  initialMarkdown: string
  onChange: (markdown: string) => void
  placeholder?: string
  className?: string
}

/**
 * TipTap 기반 Markdown 에디터 (PRD 7장). 저장 형식은 Markdown 문자열.
 * - 입력: `contentType: 'markdown'` 으로 파싱 → ProseMirror 스키마에 있는 노드/마크만 남는다
 * - 출력: `editor.getMarkdown()`
 * - `**굵게**`, `# 제목`, `- 목록` 같은 Markdown 단축 입력은 StarterKit 의 input rule 로 바로 동작
 * AI 제안(태그/연결)의 인라인 표시는 이후 단계에서 커스텀 확장으로 추가한다.
 */
export function MarkdownEditor({ initialMarkdown, onChange, placeholder, className }: Props) {
  const editor = useEditor({
    extensions: [StarterKit, Markdown, Placeholder.configure({ placeholder: placeholder ?? 'Markdown 으로 작성' })],
    content: initialMarkdown,
    contentType: 'markdown',
    onUpdate: ({ editor }) => onChange(editor.getMarkdown()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none dark:prose-invert min-h-full px-1 py-2 focus:outline-none',
        'aria-label': '본문',
      },
    },
  })

  // 부모(NodeEditor)가 언마운트되기 전에 에디터를 정리
  useEffect(() => () => editor?.destroy(), [editor])

  if (!editor) return null

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <Toolbar editor={editor} />
      <div className="min-h-0 flex-1 overflow-y-auto" onClick={() => editor.chain().focus().run()}>
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  // 선택 영역/마크 변경 시에만 리렌더되도록 필요한 상태만 뽑는다
  const s = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      strike: editor.isActive('strike'),
      code: editor.isActive('code'),
      h1: editor.isActive('heading', { level: 1 }),
      h2: editor.isActive('heading', { level: 2 }),
      h3: editor.isActive('heading', { level: 3 }),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      blockquote: editor.isActive('blockquote'),
      codeBlock: editor.isActive('codeBlock'),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  })
  const c = () => editor.chain().focus()

  const items: Array<{ label: string; icon: typeof Bold; active?: boolean; disabled?: boolean; run: () => void } | 'sep'> = [
    { label: '굵게', icon: Bold, active: s.bold, run: () => c().toggleBold().run() },
    { label: '기울임', icon: Italic, active: s.italic, run: () => c().toggleItalic().run() },
    { label: '취소선', icon: Strikethrough, active: s.strike, run: () => c().toggleStrike().run() },
    { label: '인라인 코드', icon: Code, active: s.code, run: () => c().toggleCode().run() },
    'sep',
    { label: '제목 1', icon: Heading1, active: s.h1, run: () => c().toggleHeading({ level: 1 }).run() },
    { label: '제목 2', icon: Heading2, active: s.h2, run: () => c().toggleHeading({ level: 2 }).run() },
    { label: '제목 3', icon: Heading3, active: s.h3, run: () => c().toggleHeading({ level: 3 }).run() },
    'sep',
    { label: '글머리 목록', icon: List, active: s.bulletList, run: () => c().toggleBulletList().run() },
    { label: '번호 목록', icon: ListOrdered, active: s.orderedList, run: () => c().toggleOrderedList().run() },
    { label: '인용', icon: Quote, active: s.blockquote, run: () => c().toggleBlockquote().run() },
    { label: '코드 블록', icon: SquareCode, active: s.codeBlock, run: () => c().toggleCodeBlock().run() },
    'sep',
    { label: '실행 취소', icon: Undo2, disabled: !s.canUndo, run: () => c().undo().run() },
    { label: '다시 실행', icon: Redo2, disabled: !s.canRedo, run: () => c().redo().run() },
  ]

  return (
    <div role="toolbar" aria-label="서식" className="flex flex-wrap items-center gap-0.5 border-b pb-2">
      {items.map((it, i) =>
        it === 'sep' ? (
          <span key={`sep-${i}`} className="mx-1 h-4 w-px bg-border" aria-hidden />
        ) : (
          <Button
            key={it.label}
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={it.label}
            aria-pressed={it.active}
            title={it.label}
            disabled={it.disabled}
            onMouseDown={(e) => e.preventDefault()} // 에디터 포커스/선택 유지
            onClick={it.run}
            className={cn(it.active && 'bg-muted text-foreground')}
          >
            <it.icon />
          </Button>
        ),
      )}
    </div>
  )
}
