import DOMPurify from 'dompurify'
import { marked } from 'marked'

marked.setOptions({ gfm: true, breaks: false })

// 링크는 새 탭 + noopener 로 열리게 한다 (DOMPurify 가 target 을 허용하도록 아래 ADD_ATTR 필요)
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

/**
 * Markdown → sanitize 된 HTML 문자열.
 * CLAUDE.md 절대 규칙 6: 노드 콘텐츠를 HTML 로 렌더할 때는 반드시 이 함수를 거친다.
 * (본문에 섞인 raw HTML/script, javascript: URL, 이벤트 핸들러 등을 제거)
 */
export function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown, { async: false })
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'object', 'embed'],
  })
}
