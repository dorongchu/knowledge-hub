import type { SnippetPart } from './searchIndex'

/** 검색 일치 구간을 <mark> 로 강조. 문자열을 React 노드로만 넣으므로 HTML 주입 경로가 없다. */
export function Highlight({ parts, fallback = '' }: { parts: SnippetPart[]; fallback?: string }) {
  if (parts.length === 0) return <>{fallback}</>
  return (
    <>
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded-sm bg-yellow-200 px-0.5 text-foreground dark:bg-yellow-500/40">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  )
}
