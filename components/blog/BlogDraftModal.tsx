'use client'

import { useState } from 'react'
import type { SummarizeResponse } from '@/types/summary'
import { saveBlogDraft } from '@/lib/blogDraft'
import { useAuth } from '@/providers/AuthProvider'

interface BlogSection {
  id: string
  heading: string | null
  level: number
  text: string
  timestamp: string | null
  seconds: number | null
}

interface BlogDraft {
  seo_title: string
  meta_description: string
  slug: string
  tags: string[]
  reading_time: number
  sections: BlogSection[]
  videoId: string
  sessionId: string
  thumbnail: string
  title: string
  channel: string
}

interface Props {
  data: SummarizeResponse
  onClose: () => void
}

function buildHtml(draft: BlogDraft): string {
  const ytBase = `https://youtu.be/${draft.videoId}`
  const appUrl = `https://ssoktube.com/result/${draft.sessionId}`

  const sectionsHtml = draft.sections.map(s => {
    const tsLink = s.seconds
      ? `\n<p style="margin:6px 0 16px;"><a href="${ytBase}?t=${s.seconds}" target="_blank" rel="noopener" style="font-size:0.85em;color:#f97316;">▶ 영상 ${s.timestamp} 구간 바로보기</a></p>`
      : ''
    if (!s.heading) {
      return `<p style="margin:0 0 20px;line-height:1.8;font-size:1.05em;">${s.text}</p>`
    }
    const tag = `h${s.level}`
    return `<${tag} style="margin:32px 0 12px;font-weight:700;">${s.heading}</${tag}>\n<p style="margin:0 0 12px;line-height:1.8;">${s.text}</p>${tsLink}`
  }).join('\n')

  const tagsHtml = draft.tags.map(t =>
    `<span style="display:inline-block;margin:3px;padding:3px 10px;background:#f3f4f6;border-radius:999px;font-size:0.8em;color:#374151;">${t}</span>`
  ).join('')

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: draft.seo_title,
    description: draft.meta_description,
    image: draft.thumbnail,
    author: { '@type': 'Organization', name: 'SSOKTUBE' },
    publisher: { '@type': 'Organization', name: 'SSOKTUBE', url: 'https://ssoktube.com' },
    mainEntityOfPage: appUrl,
    keywords: draft.tags.join(', '),
  })

  return `<!-- SEO: ${draft.meta_description} -->
<script type="application/ld+json">${jsonLd}</script>

<article>

<h1 style="font-size:1.6em;font-weight:800;margin:0 0 12px;line-height:1.4;">${draft.seo_title}</h1>
<p style="font-size:0.85em;color:#6b7280;margin:0 0 20px;">📹 원본 영상: <a href="${ytBase}" target="_blank" rel="noopener">${draft.channel} — ${draft.title}</a> &nbsp;|&nbsp; 읽는 시간: 약 ${draft.reading_time}분</p>

<figure style="margin:0 0 28px;">
  <a href="${ytBase}" target="_blank" rel="noopener">
    <img src="${draft.thumbnail}" alt="${draft.seo_title}" style="width:100%;max-width:640px;border-radius:10px;display:block;" />
  </a>
</figure>

${sectionsHtml}

<div style="margin:32px 0 16px;padding:16px;background:#fff7ed;border-left:4px solid #f97316;border-radius:4px;">
  <p style="margin:0;font-size:0.9em;color:#92400e;">이 글은 <a href="${appUrl}" target="_blank" rel="noopener" style="color:#f97316;font-weight:600;">SSOKTUBE AI</a>로 분석된 콘텐츠입니다. 원본 영상 전체 요약·타임스탬프 이동은 링크에서 확인하세요.</p>
</div>

<div style="margin:16px 0;">${tagsHtml}</div>

</article>`
}

function buildPlainText(draft: BlogDraft): string {
  const ytBase = `https://youtu.be/${draft.videoId}`
  const lines: string[] = [
    draft.seo_title,
    '',
    `📹 원본: ${draft.channel} — ${draft.title}`,
    `🔗 ${ytBase}`,
    '',
    `■ 메타 설명`,
    draft.meta_description,
    '',
    `■ 태그`,
    draft.tags.join(', '),
    '',
    '─'.repeat(40),
    '',
  ]
  for (const s of draft.sections) {
    if (s.heading) lines.push(`▌ ${s.heading}`, '')
    lines.push(s.text)
    if (s.timestamp && s.seconds !== null) {
      lines.push(`▶ ${ytBase}?t=${s.seconds} (${s.timestamp})`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

export default function BlogDraftModal({ data, onClose }: Props) {
  const { user, openAuthModal } = useAuth()
  const [draft, setDraft] = useState<BlogDraft | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'preview' | 'html' | 'text'>('preview')
  const [copied, setCopied] = useState<'html' | 'text' | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const generate = async () => {
    setLoading(true)
    setSaved(false)
    try {
      const res = await fetch('/api/blog-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          channel: data.channel,
          category: data.category,
          summary: data.summary,
          videoId: data.videoId,
          sessionId: data.sessionId,
          thumbnail: data.thumbnail,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setDraft(await res.json())
      setTab('preview')
    } catch (e: any) {
      alert('블로그 초안 생성 실패: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!draft) return
    if (!user) { openAuthModal(); return }
    setSaving(true)
    try {
      await saveBlogDraft(user.uid, {
        videoId: draft.videoId,
        sessionId: draft.sessionId,
        title: draft.title,
        channel: draft.channel,
        thumbnail: draft.thumbnail,
        seo_title: draft.seo_title,
        meta_description: draft.meta_description,
        slug: draft.slug,
        tags: draft.tags,
        reading_time: draft.reading_time,
        sections: draft.sections,
      })
      setSaved(true)
    } catch (e: any) {
      alert('저장 실패: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const copy = async (type: 'html' | 'text') => {
    if (!draft) return
    const content = type === 'html' ? buildHtml(draft) : buildPlainText(draft)
    await navigator.clipboard.writeText(content)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="bg-[#1c1a18] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="shrink-0 flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/5">
          <div>
            <h2 className="text-white font-bold text-lg">📝 블로그 초안 생성</h2>
            <p className="text-xs text-zinc-500 mt-0.5">SEO 최적화 · HTML 퍼가기 · 텍스트 복사</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!draft && !loading && (
            <div className="flex flex-col items-center gap-5 py-10 text-center">
              <span className="text-5xl">✍️</span>
              <div>
                <p className="text-white font-semibold mb-1">AI가 블로그 초안을 작성합니다</p>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  SEO 제목 · 메타 설명 · 본문 섹션 · 태그를 자동 생성합니다.<br />
                  티스토리·워드프레스용 HTML 복사도 지원합니다.
                </p>
              </div>
              <button
                onClick={generate}
                className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl transition-colors text-sm"
              >
                블로그 초안 생성하기
              </button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center gap-4 py-16">
              <div className="w-10 h-10 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
              <p className="text-zinc-400 text-sm">SEO 최적화 초안 작성 중...</p>
            </div>
          )}

          {draft && (
            <div className="space-y-4">
              {/* 탭 */}
              <div className="flex gap-1.5 p-1 bg-white/5 rounded-xl">
                {([
                  { id: 'preview', label: '👁 미리보기' },
                  { id: 'html',    label: '🌐 HTML 복사' },
                  { id: 'text',    label: '📋 텍스트 복사' },
                ] as const).map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                      tab === t.id ? 'bg-orange-500 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* SEO 메타 요약 (항상 표시) */}
              <div className="bg-white/3 border border-white/8 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 text-orange-400 font-bold w-20">SEO 제목</span>
                  <span className="text-zinc-200">{draft.seo_title}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 text-orange-400 font-bold w-20">메타 설명</span>
                  <span className="text-zinc-400">{draft.meta_description}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 text-orange-400 font-bold w-20">태그</span>
                  <span className="text-zinc-400">{draft.tags.join(', ')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-orange-400 font-bold w-20">읽는 시간</span>
                  <span className="text-zinc-400">약 {draft.reading_time}분</span>
                </div>
              </div>

              {/* 미리보기 탭 */}
              {tab === 'preview' && (
                <div className="bg-white rounded-2xl p-5 text-zinc-800 space-y-4">
                  <img
                    src={draft.thumbnail}
                    alt={draft.seo_title}
                    className="w-full rounded-xl object-cover max-h-48"
                  />
                  <h1 className="text-lg font-bold leading-snug">{draft.seo_title}</h1>
                  <p className="text-xs text-zinc-400">
                    📹 {draft.channel} | 읽는 시간 약 {draft.reading_time}분
                  </p>
                  {draft.sections.map(s => (
                    <div key={s.id}>
                      {s.heading && (
                        <h2 className="text-base font-bold mt-4 mb-1 text-zinc-700">{s.heading}</h2>
                      )}
                      <p className="text-sm leading-relaxed text-zinc-600">{s.text}</p>
                      {s.timestamp && (
                        <p className="text-xs text-orange-500 mt-1">▶ {s.timestamp} 구간</p>
                      )}
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-1 pt-2">
                    {draft.tags.map(t => (
                      <span key={t} className="px-2 py-0.5 bg-zinc-100 rounded-full text-[10px] text-zinc-500">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* HTML 탭 */}
              {tab === 'html' && (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500">티스토리·워드프레스 HTML 편집기에 그대로 붙여넣기 하세요.</p>
                  <pre className="bg-zinc-900 border border-white/10 rounded-2xl p-4 text-[10px] text-zinc-400 overflow-x-auto leading-relaxed max-h-64 whitespace-pre-wrap">
                    {buildHtml(draft)}
                  </pre>
                </div>
              )}

              {/* 텍스트 탭 */}
              {tab === 'text' && (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500">네이버 블로그·브런치·노션 등 일반 에디터에 붙여넣기 하세요.</p>
                  <pre className="bg-zinc-900 border border-white/10 rounded-2xl p-4 text-[10px] text-zinc-400 overflow-x-auto leading-relaxed max-h-64 whitespace-pre-wrap">
                    {buildPlainText(draft)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 버튼 */}
        {draft && (
          <div className="shrink-0 flex gap-2 px-6 py-4 border-t border-white/5">
            <button
              onClick={generate}
              className="px-4 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white text-xs transition-colors"
            >
              🔄 다시 생성
            </button>
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className={`px-4 h-10 rounded-xl text-xs font-bold transition-colors ${
                saved
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white'
              } disabled:opacity-60`}
            >
              {saved ? '✓ 저장됨' : saving ? '저장 중...' : '💾 저장'}
            </button>
            <div className="flex-1" />
            <button
              onClick={() => copy('text')}
              className={`px-4 h-10 rounded-xl text-xs font-bold transition-colors ${
                copied === 'text'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-white/5 hover:bg-white/10 text-zinc-300'
              }`}
            >
              {copied === 'text' ? '✓ 복사됨' : '📋 텍스트 복사'}
            </button>
            <button
              onClick={() => copy('html')}
              className={`px-4 h-10 rounded-xl text-xs font-bold transition-colors ${
                copied === 'html'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-orange-500 hover:bg-orange-600 text-white'
              }`}
            >
              {copied === 'html' ? '✓ 복사됨' : '🌐 HTML 복사'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
