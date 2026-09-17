/**
 * Markdown → 검색/발췌용 평문. 렌더링용이 아니므로 정확한 파싱 대신 기호만 걷어낸다.
 * (에디터가 저장할 때 붙이는 백슬래시 이스케이프도 제거)
 */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*\n?|```/g, '')) // 코드 블록: 펜스만 제거
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // 이미지 → alt
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // 링크 → 텍스트
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // 제목 기호
    .replace(/^\s{0,3}>\s?/gm, '') // 인용
    .replace(/^\s*([-*+]|\d+\.)\s+/gm, '') // 목록 기호
    .replace(/\\([\\`*_{}[\]()#+\-.!<>~|])/g, '$1') // 이스케이프 해제
    .replace(/(\*\*|__|\*|_|~~|`)/g, '') // 강조/코드 기호
    .replace(/\s+/g, ' ')
    .trim()
}

/** 길이 제한 발췌 */
export function excerptOf(markdown: string, max = 90): string {
  const text = markdownToPlainText(markdown)
  return text.length > max ? `${text.slice(0, max)}…` : text
}
