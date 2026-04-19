'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CurationSettings, CurationSchedule, CuratedPost } from '@/lib/magazine'

const SCHEDULE_OPTIONS: { value: CurationSchedule; label: string; desc: string }[] = [
  { value: '3x_daily',  label: '하루 3회',   desc: '8시간마다 자동 생성' },
  { value: '1x_daily',  label: '하루 1회',   desc: '24시간마다 자동 생성' },
  { value: '3x_weekly', label: '주 3회',     desc: '약 56시간마다 자동 생성' },
  { value: '1x_weekly', label: '주 1회',     desc: '7일마다 자동 생성' },
  { value: 'manual',    label: '수동',       desc: '자동 생성 없음, 직접 트리거' },
]

const STATUS_BADGE: Record<string, string> = {
  draft:     'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  published: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
}

function formatDate(iso: string) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

// 간단한 마크다운 → HTML 변환 (react-markdown 없이)
function mdToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 style="font-size:1em;font-weight:700;margin:20px 0 6px;color:#e4e4e7;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:1.15em;font-weight:800;margin:24px 0 8px;color:#fff;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:6px;">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '</p><p style="margin:0 0 12px;line-height:1.75;color:#a1a1aa;">')
    .replace(/^(?!<h[23])(.+)$/gm, (m) => m.startsWith('<') ? m : `<p style="margin:0 0 12px;line-height:1.75;color:#a1a1aa;">${m}</p>`)
}

export default function CurationTab({ getAuthHeader }: {
  getAuthHeader: () => Promise<Record<string, string>>
}) {
  const [settings, setSettings] = useState<CurationSettings | null>(null)
  const [posts, setPosts] = useState<CuratedPost[]>([])
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [loadingPosts, setLoadingPosts]       = useState(true)
  const [saving, setSaving]                   = useState(false)
  const [triggering, setTriggering]           = useState(false)
  const [triggerResult, setTriggerResult]     = useState<string>('')
  const [actionId, setActionId]               = useState<string | null>(null)
  const [previewPost, setPreviewPost]         = useState<CuratedPost | null>(null)

  const callAdmin = async (action: string, extra?: object) => {
    const headers = await getAuthHeader()
    const res = await fetch('/api/admin/curation', {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...extra }),
    })
    return res.json()
  }

  useEffect(() => {
    callAdmin('getSettings').then(data => {
      setSettings(data)
      setLoadingSettings(false)
    })
    callAdmin('listPosts').then(data => {
      if (Array.isArray(data)) setPosts(data)
      setLoadingPosts(false)
    })
  }, [])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    await callAdmin('saveSettings', { settings })
    setSaving(false)
  }

  const handleTrigger = async (autoPublish: boolean) => {
    setTriggering(true)
    setTriggerResult('')
    try {
      const res = await fetch('/api/cron/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true, autoPublish }),
      })
      const data = await res.json()
      if (data.success) {
        setTriggerResult(`✅ 생성 완료: "${data.title}" (${data.status}, 영상 ${data.videoCount}개)`)
        const updated = await callAdmin('listPosts')
        if (Array.isArray(updated)) setPosts(updated)
      } else {
        setTriggerResult(`⚠️ ${data.error ?? (data.skipped ? '스킵됨: ' + data.reason : '알 수 없는 오류')}`)
      }
    } catch (e) {
      setTriggerResult(`❌ 오류: ${String(e)}`)
    }
    setTriggering(false)
  }

  const handlePublish = async (id: string) => {
    setActionId(id)
    await callAdmin('publish', { id })
    setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'published', publishedAt: new Date().toISOString() } : p))
    setPreviewPost(prev => prev?.id === id ? { ...prev, status: 'published', publishedAt: new Date().toISOString() } : prev)
    setActionId(null)
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`포스트를 삭제하시겠습니까?\n"${title}"`)) return
    setActionId(id)
    await callAdmin('delete', { id })
    setPosts(prev => prev.filter(p => p.id !== id))
    setPreviewPost(prev => prev?.id === id ? null : prev)
    setActionId(null)
  }

  if (loadingSettings) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
    </div>
  )

  return (
    <div className="space-y-8">

      {/* 설정 패널 */}
      <div className="bg-[#2a2826] rounded-2xl border border-white/8 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-black text-base flex items-center gap-2">
            ✍️ 매거진 자동 발행 설정
          </h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-[#a4a09c]">자동 생성</span>
            <button
              onClick={() => settings && setSettings({ ...settings, enabled: !settings.enabled })}
              className={`relative w-10 h-5 rounded-full transition-colors ${settings?.enabled ? 'bg-orange-500' : 'bg-[#3d3a38]'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings?.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </label>
        </div>

        {settings && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 발행 주기 */}
            <div>
              <label className="block text-xs text-[#75716e] mb-2">발행 주기</label>
              <div className="space-y-1.5">
                {SCHEDULE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSettings({ ...settings, schedule: opt.value })}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm transition-all ${
                      settings.schedule === opt.value
                        ? 'bg-orange-500/15 border-orange-500/40 text-white'
                        : 'bg-[#1c1a18] border-white/8 text-[#a4a09c] hover:border-white/20'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${settings.schedule === opt.value ? 'bg-orange-500' : 'bg-[#3d3a38]'}`} />
                    <span className="font-bold">{opt.label}</span>
                    <span className="text-xs opacity-60 ml-auto">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 수치 설정 */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#75716e] mb-1">
                  최소 영상 수 <span className="text-white font-bold">{settings.minVideoCount}개</span>
                </label>
                <input
                  type="range" min={3} max={10} value={settings.minVideoCount}
                  onChange={e => setSettings({ ...settings, minVideoCount: Number(e.target.value) })}
                  className="w-full accent-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-[#75716e] mb-1">
                  포스트당 최대 영상 수 <span className="text-white font-bold">{settings.maxVideoCount}개</span>
                </label>
                <input
                  type="range" min={3} max={15} value={settings.maxVideoCount}
                  onChange={e => setSettings({ ...settings, maxVideoCount: Number(e.target.value) })}
                  className="w-full accent-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-[#75716e] mb-1">
                  최근 <span className="text-white font-bold">{settings.lookbackDays}일</span> 영상 기준
                </label>
                <input
                  type="range" min={1} max={14} value={settings.lookbackDays}
                  onChange={e => setSettings({ ...settings, lookbackDays: Number(e.target.value) })}
                  className="w-full accent-orange-500"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={settings.autoPublish}
                  onChange={e => setSettings({ ...settings, autoPublish: e.target.checked })}
                  className="accent-orange-500"
                />
                <span className="text-sm text-[#a4a09c]">생성 즉시 자동 발행 (미체크 시 초안으로 저장)</span>
              </label>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-white/8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors disabled:opacity-50"
          >
            {saving ? '저장 중...' : '설정 저장'}
          </button>
          {settings?.lastGeneratedAt && (
            <span className="text-xs text-[#75716e]">
              마지막 생성: {formatDate(settings.lastGeneratedAt)}
            </span>
          )}
        </div>
      </div>

      {/* 수동 트리거 */}
      <div className="bg-[#2a2826] rounded-2xl border border-white/8 p-6">
        <h2 className="text-white font-black text-base mb-4">지금 바로 생성</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleTrigger(false)}
            disabled={triggering}
            className="px-4 py-2.5 rounded-xl bg-[#32302e] hover:bg-[#3a3836] text-white text-sm font-bold border border-white/10 transition-colors disabled:opacity-50"
          >
            {triggering ? '생성 중...' : '📝 초안으로 생성'}
          </button>
          <button
            onClick={() => handleTrigger(true)}
            disabled={triggering}
            className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-sm font-bold border border-emerald-500/30 transition-colors disabled:opacity-50"
          >
            {triggering ? '생성 중...' : '🚀 생성 + 즉시 발행'}
          </button>
        </div>
        {triggerResult && (
          <p className="mt-3 text-sm text-[#a4a09c] bg-[#1c1a18] rounded-xl px-3 py-2 border border-white/8">
            {triggerResult}
          </p>
        )}
      </div>

      {/* 미리보기 모달 */}
      {previewPost && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4"
          onClick={() => setPreviewPost(null)}
        >
          <div
            className="w-full max-w-2xl bg-[#1c1a18] rounded-2xl border border-white/10 overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${STATUS_BADGE[previewPost.status] ?? STATUS_BADGE.draft}`}>
                  {previewPost.status === 'published' ? '발행됨' : '초안'}
                </span>
                <span className="text-xs text-[#75716e]">{formatDate(previewPost.createdAt)}</span>
              </div>
              <button onClick={() => setPreviewPost(null)} className="text-[#75716e] hover:text-white transition-colors text-lg leading-none">✕</button>
            </div>

            {/* 썸네일 */}
            {previewPost.heroThumbnail && !previewPost.heroThumbnail.startsWith('data:') && (
              <img src={previewPost.heroThumbnail} alt="" className="w-full h-48 object-cover" />
            )}

            {/* 본문 */}
            <div className="px-6 py-5">
              <h2 className="text-white font-black text-xl mb-1">{previewPost.title}</h2>
              {previewPost.subtitle && (
                <p className="text-[#a4a09c] text-sm mb-4">{previewPost.subtitle}</p>
              )}
              <div className="flex items-center gap-3 text-[10px] text-[#75716e] mb-5">
                <span>영상 {previewPost.videoTitles?.length ?? 0}개</span>
                <span>{previewPost.readTime}분 읽기</span>
                {previewPost.tags?.slice(0, 3).map(t => (
                  <span key={t} className="px-1.5 py-0.5 bg-[#2a2826] rounded border border-white/8">{t}</span>
                ))}
              </div>

              <div
                className="text-sm"
                dangerouslySetInnerHTML={{ __html: mdToHtml(previewPost.body ?? '') }}
              />

              {/* FAQ */}
              {previewPost.faq && previewPost.faq.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-white font-bold text-sm mb-3">자주 묻는 질문</h3>
                  <div className="space-y-2">
                    {previewPost.faq.map((f, i) => (
                      <details key={i} className="bg-[#2a2826] rounded-xl border border-white/8 px-4 py-3 group">
                        <summary className="text-[#a4a09c] text-sm cursor-pointer list-none flex items-center justify-between gap-2">
                          <span>{f.question}</span>
                          <span className="text-xs opacity-50 group-open:rotate-180 transition-transform">▼</span>
                        </summary>
                        <p className="text-[#75716e] text-sm mt-2 leading-relaxed">{f.answer}</p>
                      </details>
                    ))}
                  </div>
                </div>
              )}

              {/* 체크리스트 */}
              {previewPost.checklist && previewPost.checklist.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-white font-bold text-sm mb-3">핵심 체크리스트</h3>
                  <ul className="space-y-1.5">
                    {previewPost.checklist.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#a4a09c]">
                        <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* 액션 버튼 */}
            <div className="flex items-center gap-2 px-6 py-4 border-t border-white/8 bg-[#161412]">
              {previewPost.status === 'published' && (
                <Link
                  href={`/magazine/${previewPost.slug}`}
                  target="_blank"
                  className="px-4 py-2 rounded-xl bg-[#32302e] text-[#a4a09c] hover:text-white text-sm font-bold border border-white/8 transition-colors"
                >
                  발행 글 보기 →
                </Link>
              )}
              {previewPost.status === 'draft' && (
                <button
                  onClick={() => handlePublish(previewPost.id)}
                  disabled={actionId === previewPost.id}
                  className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-sm font-bold border border-emerald-500/30 transition-colors disabled:opacity-50"
                >
                  {actionId === previewPost.id ? '발행 중...' : '발행하기'}
                </button>
              )}
              <button
                onClick={() => handleDelete(previewPost.id, previewPost.title)}
                disabled={actionId === previewPost.id}
                className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm font-bold border border-red-500/20 transition-colors disabled:opacity-50"
              >
                삭제
              </button>
              <button
                onClick={() => setPreviewPost(null)}
                className="ml-auto px-4 py-2 rounded-xl bg-[#2a2826] text-[#a4a09c] hover:text-white text-sm font-bold border border-white/8 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 포스트 목록 */}
      <div className="bg-[#2a2826] rounded-2xl border border-white/8 p-6">
        <h2 className="text-white font-black text-base mb-4">
          포스트 목록 <span className="text-[#75716e] font-normal text-sm">({posts.length}개)</span>
        </h2>

        {loadingPosts ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <p className="text-[#75716e] text-sm text-center py-8">아직 생성된 포스트가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {posts.map(post => (
              <div
                key={post.id}
                onClick={() => setPreviewPost(post)}
                className="flex items-start gap-3 p-3 rounded-xl bg-[#1c1a18] border border-white/6 hover:border-orange-500/30 hover:bg-[#221f1d] transition-all cursor-pointer group"
              >
                {post.heroThumbnail && !post.heroThumbnail.startsWith('data:') && (
                  <img src={post.heroThumbnail} alt="" className="w-16 h-10 object-cover rounded-lg shrink-0 bg-[#252423]" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-bold line-clamp-1 group-hover:text-orange-400 transition-colors">{post.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${STATUS_BADGE[post.status] ?? STATUS_BADGE.draft}`}>
                      {post.status === 'published' ? '발행됨' : '초안'}
                    </span>
                    <span className="text-[10px] text-[#75716e]">영상 {post.videoTitles?.length ?? 0}개</span>
                    <span className="text-[10px] text-[#75716e]">{post.readTime}분 읽기</span>
                    <span className="text-[10px] text-[#75716e]">{formatDate(post.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                  {post.status === 'published' && (
                    <Link
                      href={`/magazine/${post.slug}`}
                      target="_blank"
                      className="px-2 py-1 rounded-lg bg-[#32302e] text-[#a4a09c] hover:text-white text-[10px] font-bold border border-white/8 transition-colors"
                    >
                      보기
                    </Link>
                  )}
                  {post.status === 'draft' && (
                    <button
                      onClick={() => handlePublish(post.id)}
                      disabled={actionId === post.id}
                      className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-[10px] font-bold border border-emerald-500/30 transition-colors disabled:opacity-50"
                    >
                      발행
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(post.id, post.title)}
                    disabled={actionId === post.id}
                    className="px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-[10px] font-bold border border-red-500/20 transition-colors disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
