'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSavedBlogDrafts, deleteBlogDraft, SavedBlogDraft } from '@/lib/blogDraft'
import { formatRelativeDate } from '@/lib/formatDate'

function buildHtml(draft: SavedBlogDraft): string {
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

  return `<!-- SEO: ${draft.meta_description} -->

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
  <p style="margin:0;font-size:0.9em;color:#92400e;">이 글은 <a href="${appUrl}" target="_blank" rel="noopener" style="color:#f97316;font-weight:600;">SSOKTUBE AI</a>로 분석된 콘텐츠입니다.</p>
</div>

<div style="margin:16px 0;">${tagsHtml}</div>
</article>`
}

function buildPlainText(draft: SavedBlogDraft): string {
  const ytBase = `https://youtu.be/${draft.videoId}`
  const lines: string[] = [
    draft.seo_title, '',
    `📹 원본: ${draft.channel} — ${draft.title}`,
    `🔗 ${ytBase}`, '',
    `■ 메타 설명`, draft.meta_description, '',
    `■ 태그`, draft.tags.join(', '), '',
    '─'.repeat(40), '',
  ]
  for (const s of draft.sections) {
    if (s.heading) lines.push(`▌ ${s.heading}`, '')
    lines.push(s.text)
    if (s.timestamp && s.seconds !== null) lines.push(`▶ ${ytBase}?t=${s.seconds} (${s.timestamp})`)
    lines.push('')
  }
  return lines.join('\n')
}

interface DetailModalProps {
  draft: SavedBlogDraft
  onClose: () => void
}

function DetailModal({ draft, onClose }: DetailModalProps) {
  const [tab, setTab] = useState<'preview' | 'html' | 'text'>('preview')
  const [copied, setCopied] = useState<'html' | 'text' | null>(null)

  const copy = async (type: 'html' | 'text') => {
    const content = type === 'html' ? buildHtml(draft) : buildPlainText(draft)
    await navigator.clipboard.writeText(content)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1c1a18] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="shrink-0 flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/5">
          <div>
            <h2 className="text-white font-bold text-base line-clamp-1">{draft.seo_title}</h2>
            <p className="text-zinc-500 text-xs mt-0.5">{draft.channel} · 읽는 시간 약 {draft.reading_time}분</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl ml-4">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
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

          {/* SEO 메타 */}
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
          </div>

          {tab === 'preview' && (
            <div className="bg-white rounded-2xl p-5 text-zinc-800 space-y-3">
              <img src={draft.thumbnail} alt="" className="w-full rounded-xl object-cover max-h-48" />
              <h1 className="text-lg font-bold leading-snug">{draft.seo_title}</h1>
              <p className="text-xs text-zinc-400">📹 {draft.channel} | 약 {draft.reading_time}분</p>
              {draft.sections.map(s => (
                <div key={s.id}>
                  {s.heading && <h2 className="text-base font-bold mt-4 mb-1 text-zinc-700">{s.heading}</h2>}
                  <p className="text-sm leading-relaxed text-zinc-600">{s.text}</p>
                  {s.timestamp && <p className="text-xs text-orange-500 mt-1">▶ {s.timestamp} 구간</p>}
                </div>
              ))}
              <div className="flex flex-wrap gap-1 pt-2">
                {draft.tags.map(t => (
                  <span key={t} className="px-2 py-0.5 bg-zinc-100 rounded-full text-[10px] text-zinc-500">#{t}</span>
                ))}
              </div>
            </div>
          )}
          {tab === 'html' && (
            <pre className="bg-zinc-900 border border-white/10 rounded-2xl p-4 text-[10px] text-zinc-400 overflow-x-auto leading-relaxed max-h-64 whitespace-pre-wrap">
              {buildHtml(draft)}
            </pre>
          )}
          {tab === 'text' && (
            <pre className="bg-zinc-900 border border-white/10 rounded-2xl p-4 text-[10px] text-zinc-400 overflow-x-auto leading-relaxed max-h-64 whitespace-pre-wrap">
              {buildPlainText(draft)}
            </pre>
          )}
        </div>

        <div className="shrink-0 flex gap-2 px-6 py-4 border-t border-white/5">
          <Link
            href={`/result/${draft.sessionId}`}
            className="px-4 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 text-xs flex items-center transition-colors"
          >
            원본 영상 →
          </Link>
          <div className="flex-1" />
          <button
            onClick={() => copy('text')}
            className={`px-4 h-10 rounded-xl text-xs font-bold transition-colors ${
              copied === 'text' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 hover:bg-white/10 text-zinc-300'
            }`}
          >
            {copied === 'text' ? '✓ 복사됨' : '📋 텍스트 복사'}
          </button>
          <button
            onClick={() => copy('html')}
            className={`px-4 h-10 rounded-xl text-xs font-bold transition-colors ${
              copied === 'html' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-orange-500 hover:bg-orange-600 text-white'
            }`}
          >
            {copied === 'html' ? '✓ 복사됨' : '🌐 HTML 복사'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SavedBlogDrafts({ userId }: { userId: string }) {
  const [drafts, setDrafts] = useState<SavedBlogDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [viewDraft, setViewDraft] = useState<SavedBlogDraft | null>(null)

  useEffect(() => {
    if (!userId) return
    getSavedBlogDrafts(userId)
      .then(setDrafts)
      .finally(() => setLoading(false))
  }, [userId])

  const handleDelete = async (id: string) => {
    if (!confirm('이 블로그 초안을 삭제할까요?')) return
    setDeletingId(id)
    try {
      await deleteBlogDraft(id)
      setDrafts(prev => prev.filter(d => d.id !== id))
    } catch {
      alert('삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-10 h-10 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
      </div>
    )
  }

  if (drafts.length === 0) {
    return (
      <div className="text-center py-16 text-[#75716e]">
        <p className="text-4xl mb-3">✍️</p>
        <p className="font-medium text-white mb-1">저장된 블로그 초안이 없습니다</p>
        <p className="text-sm">요약 결과 페이지에서 블로그 초안을 생성하고 저장해보세요.</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {drafts.map(draft => (
          <div
            key={draft.id}
            className="group bg-[#32302e] border border-white/5 hover:border-white/15 rounded-2xl overflow-hidden transition-all cursor-pointer"
            onClick={() => setViewDraft(draft)}
          >
            <div className="relative overflow-hidden bg-[#23211f]">
              <img
                src={draft.thumbnail}
                alt={draft.seo_title}
                className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-[9px] font-bold text-orange-400 border border-orange-500/30">
                블로그
              </div>
            </div>
            <div className="p-4">
              <p className="text-white font-semibold text-sm leading-snug line-clamp-2 mb-2">
                {draft.seo_title}
              </p>
              <p className="text-zinc-500 text-xs mb-3 line-clamp-2">{draft.meta_description}</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-zinc-500 text-xs">{draft.channel}</p>
                  {draft.createdAt && (
                    <p className="text-zinc-600 text-xs">{formatRelativeDate(draft.createdAt)}</p>
                  )}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(draft.id) }}
                  disabled={deletingId === draft.id}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-30"
                  title="삭제"
                >
                  {deletingId === draft.id ? (
                    <div className="w-3.5 h-3.5 rounded-full border border-zinc-500 border-t-transparent animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {draft.tags.slice(0, 3).map(t => (
                  <span key={t} className="px-1.5 py-0.5 bg-[#23211f] border border-white/5 rounded text-[10px] text-zinc-500">
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {viewDraft && (
        <DetailModal draft={viewDraft} onClose={() => setViewDraft(null)} />
      )}
    </>
  )
}
