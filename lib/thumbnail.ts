/**
 * 공유 썸네일 SVG 생성기 (PDF · 음성 · 웹사이트 등 비유튜브 콘텐츠용)
 */

export type SourceType = 'pdf' | 'voice' | 'website'

const PALETTE: Record<string, { c1: string; c2: string; accent: string }> = {
  recipe:   { c1: '#450a0a', c2: '#9a3412', accent: '#f97316' },
  english:  { c1: '#0c1445', c2: '#1e3a8a', accent: '#60a5fa' },
  learning: { c1: '#2e1065', c2: '#5b21b6', accent: '#a78bfa' },
  news:     { c1: '#18181b', c2: '#3f3f46', accent: '#a1a1aa' },
  selfdev:  { c1: '#052e16', c2: '#14532d', accent: '#34d399' },
  travel:   { c1: '#082f49', c2: '#164e63', accent: '#22d3ee' },
  story:    { c1: '#4a044e', c2: '#831843', accent: '#f472b6' },
  tips:     { c1: '#431407', c2: '#78350f', accent: '#fbbf24' },
  report:   { c1: '#0f0a2e', c2: '#1e1b4b', accent: '#818cf8' },
}

const CAT_EMOJI: Record<string, string> = {
  recipe: '🍳', english: '🔤', learning: '📐', news: '🗞️',
  selfdev: '💪', travel: '🧳', story: '🍿', tips: '💡', report: '📋',
}

const SOURCE_META: Record<SourceType, { icon: string; label: string }> = {
  pdf:     { icon: '📄', label: 'PDF 문서' },
  voice:   { icon: '🎙', label: '음성 녹음' },
  website: { icon: '🌐', label: '웹 아티클' },
}

function esc(s: string) {
  return s.replace(/[<>&"']/g, c =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;'
    : c === '"' ? '&quot;' : '&apos;'
  )
}

function splitTitle(title: string, maxLen = 16): [string, string] {
  if (title.length <= maxLen) return [title, '']
  const mid = title.slice(0, maxLen + 2).lastIndexOf(' ')
  const cut = mid > 6 ? mid : maxLen
  return [title.slice(0, cut), title.slice(cut).trim().slice(0, maxLen + 2)]
}

export function buildContentThumbnail(
  category: string,
  title: string,
  source: SourceType,
): string {
  const { c1, c2, accent } = PALETTE[category] ?? PALETTE.report
  const catEmoji = CAT_EMOJI[category] ?? '✨'
  const { icon: srcIcon, label: srcLabel } = SOURCE_META[source]

  const [line1, line2] = splitTitle(esc(title.slice(0, 36)))
  const titleY1 = line2 ? 178 : 192
  const titleY2 = 204

  const dots = [
    [420, 30], [440, 55], [460, 25], [455, 75], [430, 80],
    [30, 200], [18, 225], [45, 240], [60, 215],
  ]

  const svg = `<svg width="480" height="270" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="glow1" cx="85%" cy="15%" r="45%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="10%" cy="85%" r="40%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="textbg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.55)"/>
    </linearGradient>
  </defs>

  <rect width="480" height="270" fill="url(#bg)" rx="14"/>
  <rect width="480" height="270" fill="url(#glow1)" rx="14"/>
  <rect width="480" height="270" fill="url(#glow2)" rx="14"/>
  <rect x="0" y="130" width="480" height="140" fill="url(#textbg)"/>

  <!-- 장식: 원형 라인 우상단 -->
  <circle cx="400" cy="-10" r="110" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.18"/>
  <circle cx="400" cy="-10" r="75" fill="none" stroke="${accent}" stroke-width="1" opacity="0.12"/>
  <!-- 장식: 원형 라인 좌하단 -->
  <circle cx="30" cy="270" r="60" fill="none" stroke="${accent}" stroke-width="1.2" opacity="0.15"/>

  <!-- 장식: 도트 패턴 -->
  ${dots.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="${accent}" opacity="0.3"/>`).join('\n  ')}

  <!-- 장식: 사선 라인 -->
  <line x1="0" y1="270" x2="140" y2="0" stroke="${accent}" stroke-width="0.8" opacity="0.08"/>
  <line x1="60" y1="270" x2="200" y2="0" stroke="${accent}" stroke-width="0.5" opacity="0.06"/>

  <!-- 좌측 액센트 바 -->
  <rect x="0" y="0" width="4" height="270" fill="${accent}" opacity="0.8" rx="2"/>

  <!-- 카테고리 배지 -->
  <rect x="18" y="18" width="76" height="26" rx="13" fill="${accent}" fill-opacity="0.18"/>
  <rect x="18" y="18" width="76" height="26" rx="13" fill="none" stroke="${accent}" stroke-width="1" stroke-opacity="0.4"/>
  <text x="56" y="35" font-size="11" font-weight="700" fill="${accent}" text-anchor="middle" font-family="system-ui,sans-serif" opacity="0.9">${catEmoji} ${esc((category).toUpperCase().slice(0, 7))}</text>

  <!-- 메인 카테고리 이모지 -->
  <text x="56" y="128" font-size="68" text-anchor="middle" dominant-baseline="middle">${catEmoji}</text>
  <!-- 소스 아이콘 (보조) -->
  <text x="148" y="120" font-size="34" text-anchor="middle" dominant-baseline="middle" opacity="0.65">${srcIcon}</text>

  <!-- 타이틀 -->
  <text x="26" y="${titleY1}" font-size="19" font-weight="700" fill="white" font-family="system-ui,sans-serif" opacity="0.95">${line1}</text>
  ${line2 ? `<text x="26" y="${titleY2}" font-size="19" font-weight="700" fill="white" font-family="system-ui,sans-serif" opacity="0.95">${line2}</text>` : ''}

  <!-- 소스 레이블 배지 (우하단) -->
  <rect x="352" y="237" width="116" height="22" rx="11" fill="rgba(0,0,0,0.4)"/>
  <text x="410" y="252" font-size="11" fill="rgba(255,255,255,0.7)" text-anchor="middle" font-family="system-ui,sans-serif">${srcIcon} ${srcLabel}</text>

  <!-- 워터마크 -->
  <text x="26" y="255" font-size="11" fill="${accent}" font-family="system-ui,sans-serif" font-weight="600" opacity="0.45">SSOKTUBE</text>
</svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
