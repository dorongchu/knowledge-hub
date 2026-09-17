import { useMemo } from 'react'
import { renderMarkdown } from '@/lib/markdown'
import { cn } from '@/lib/utils'

interface Props {
  markdown: string
  className?: string
}

/** 노드 본문(Markdown)의 읽기 전용 렌더링. 항상 renderMarkdown(sanitize) 을 거친 HTML 만 주입한다. */
export function MarkdownView({ markdown, className }: Props) {
  const html = useMemo(() => renderMarkdown(markdown), [markdown])
  return (
    <div
      className={cn('prose prose-sm max-w-none dark:prose-invert', className)}
      // renderMarkdown 이 DOMPurify 로 정제한 결과만 들어온다
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
