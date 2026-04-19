'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CurationSettings, CurationSchedule, CuratedPost, MagazineLog } from '@/lib/magazine'

const SCHEDULE_OPTIONS: { value: CurationSchedule; label: string; desc: string }[] = [
  { value: '3x_daily',  label: '하루 3회', desc: '8시간마다 자동 생성' },
  { value: '2x_daily',  label: '하루 2회', desc: '12시간마다 자동 생성' },
  { value: '1x_daily',  label: '하루 1회', desc: '24시간마다 자동 생성' },
  { value: '3x_weekly', label: '주 3회',   desc: '월·수·금 자동 생성' },
  { value: '1x_weekly', label: '주 1회',   desc: '매주 월요일 자동 생성' },
  { value: 'manual',    label: '수동',     desc: '자동 생성 없음, 직접 트리거' },
]

const CATEGORIES = ['전체', '요리/레시피', '경제/재테크', '건강/의학', '기술/IT', '교육/학습', '엔터테인먼트', '라이프스타일', '뉴스/시사', '스포츠']

const STATUS_BADGE: Record<string, string> = {
  draft:     'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  published: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
}

const LOG_STATUS: Record<string, { color: string; icon: string }> = {
  success: { color: 'text-emerald-400', icon: '✅' },
  error:   { color: 'text-red-400',     icon: '❌' },
  skipped: { color: 'text-yellow-400',  icon: '⏭️' },
}

function formatDate(iso: string) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

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
  const [posts, setPosts]       = useState<CuratedPost[]>([])
  const [logs, setLogs]         = useState<MagazineLog[]>([])
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [loadingPosts, setLoadingPosts]       = useState(true)
  const [loadingLogs, setLoadingLogs]         = useState(true)
  const [saving, setSaving]       = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [triggerResult, setTriggerResult] = useState<string>('')
  const [urlInput, setUrlInput]   = useState('')
  const [urlTriggering, setUrlTriggering] = useState(false)
  const [urlResult, setUrlResult] = useState<string>('')
  const [actionId, setActionId]   = useState<string | null>(null)
  const [previewPost, setPreviewPost] = useState<CuratedPost | null>(null)

  const callAdmin = async (action: string, extra?: object) => {
    const headers = await getAuthHeader()
    const res = await fetch('/api/admin/curation', {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...extra }),
    })
    return res.json()
  }

  const loadAll = async () => {
    const [settingsData, postsData, logsData] = await Promise.all([
      callAdmin('getSettings'),
      callAdmin('listPosts'),
      callAdmin('getLogs'),
    ])
    setSettings(settingsData)
    setLoadingSettings(false)
    if (Array.isArray(postsData)) setPosts(postsData)
    setLoadingPosts(false)
    if (Array.isArray(logsData)) setLogs(logsData)
    setLoadingLogs(false)
  }

  useEffect(() => { loadAll() }, [])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    await callAdmin('saveSettings', { settings })
    setSaving(false)
  }

  const extractSessionId = (input: string): string => {
    const trimmed = input.trim()
    try {
      const url = new URL(trimmed)
      const parts = url.pathname.split('/').filter(Boolean)
      const idx = parts.indexOf('result')
      if (idx !== -1 && parts[idx + 1]) return parts[idx + 1]
    } catch { /* not a URL */ }
    return trimmed
  }

  const handleUrlTrigger = async (autoPublish: boolean) => {
    const sessionId = extractSessionId(urlInput)
    if (!sessionId) return
    setUrlTriggering(true)
    setUrlResult('')
    try {
      const res = await fetch('/api/cron/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true, autoPublish, sessionId }),
      })
      const data = await res.json()
      if (data.success) {
        setUrlResult(`✅ 생성 완료: "${data.title}" (${data.status})`)
        setUrlInput('')
        const [updatedPosts, updatedLogs] = await Promise.all([
          callAdmin('listPosts'),
          callAdmin('getLogs'),
        ])
        if (Array.isArray(updatedPosts)) setPosts(updatedPosts)
        if (Array.isArray(updatedLogs)) setLogs(updatedLogs)
      } else {
        setUrlResult(`⚠️ ${data.error ?? '알 수 없는 오류'}`)
      }
    } catch (e) {
      setUrlResult(`❌ 오류: ${String(e)}`)
    }
    setUrlTriggering(false)
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
        setTriggerResult(`✅ 생성 완료: "${data.title}" (${data.status})`)
        const [updatedPosts, updatedLogs] = await Promise.all([
          callAdmin('listPosts'),
          callAdmin('getLogs'),
        ])
        if (Array.isArray(updatedPosts)) setPosts(updatedPosts)
        if (Array.isArray(updatedLogs)) setLogs(updatedLogs)
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
    <div className="space-y-6">

      {/* ── 자동 발행 설정 ── */}
      <div className="bg-[#2a2826] rounded-2xl border border-white/8 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-black text-base">📰 매거진 자동 발행 설정</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-[#a4a09c]">{settings?.enabled ? '자동 생성 ON' : '자동 생성 OFF'}</span>
            <button
              onClick={() => settings && setSettings({ ...settings, enabled: !settings.enabled })}
              className={`relative w-11 h-6 rounded-full transition-colors ${settings?.enabled ? 'bg-orange-500' : 'bg-[#3d3a38]'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings?.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </label>
        </div>

        {settings && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 발행 주기 */}
            <div>
              <p className="text-xs text-[#75716e] mb-2 font-bold uppercase tracking-wide">발행 주기</p>
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

            {/* 세부 설정 */}
            <div className="space-y-5">
              {/* 하루 최대 발행 수 */}
              <div>
                <p className="text-xs text-[#75716e] mb-2 font-bold uppercase tracking-wide">
                  하루 최대 발행 수 <span className="text-orange-400 normal-case">{settings.dailyLimit}개</span>
                </p>
                <div className="flex gap-2">
                  {([1, 2, 3] as const).map(n => (
                    <button
                      key={n}
                      onClick={() => setSettings({ ...settings, dailyLimit: n })}
                      className={`flex-1 py-2 rounded-xl border text-sm font-bold transition-all ${
                        settings.dailyLimit === n
                          ? 'bg-orange-500/20 border-orange-500/40 text-orange-400'
                          : 'bg-[#1c1a18] border-white/8 text-[#a4a09c] hover:border-white/20'
                      }`}
                    >
                      {n}개
                    </button>
                  ))}
                </div>
              </div>

              {/* 영상 기준 기간 */}
              <div>
                <p className="text-xs text-[#75716e] mb-2 font-bold uppercase tracking-wide">
                  영상 선별 기간 <span className="text-orange-400 normal-case">최근 {settings.lookbackDays}일</span>
                </p>
                <input
                  type="range" min={1} max={14} value={settings.lookbackDays}
                  onChange={e => setSettings({ ...settings, lookbackDays: Number(e.target.value) })}
                  className="w-full accent-orange-500"
                />
                <div className="flex justify-between text-[10px] text-[#75716e] mt-1">
                  <span>1일</span><span>7일</span><span>14일</span>
                </div>
              </div>

              {/* 카테고리 필터 */}
              <div>
                <p className="text-xs text-[#75716e] mb-2 font-bold uppercase tracking-wide">
                  카테고리 필터 <span className="text-orange-400 normal-case font-normal">
                    {settings.categoryFilter.length === 0 ? '전체' : settings.categoryFilter.join(', ')}
                  </span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map(cat => {
                    const isAll = cat === '전체'
                    const active = isAll
                      ? settings.categoryFilter.length === 0
                      : settings.categoryFilter.includes(cat)
                    return (
                      <button
                        key={cat}
                        onClick={() => {
                          if (isAll) {
                            setSettings({ ...settings, categoryFilter: [] })
                          } else {
                            const next = active
                              ? settings.categoryFilter.filter(c => c !== cat)
                              : [...settings.categoryFilter, cat]
                            setSettings({ ...settings, categoryFilter: next })
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                          active
                            ? 'bg-orange-500/20 border-orange-500/40 text-orange-400'
                            : 'bg-[#1c1a18] border-white/8 text-[#75716e] hover:border-white/20'
                        }`}
                      >
                        {cat}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 자동 발행 */}
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-[#1c1a18] border border-white/8">
                <input
                  type="checkbox"
                  checked={settings.autoPublish}
                  onChange={e => setSettings({ ...settings, autoPublish: e.target.checked })}
                  className="accent-orange-500 w-4 h-4"
                />
                <div>
                  <p className="text-sm text-white font-bold">생성 즉시 자동 발행</p>
                  <p className="text-[11px] text-[#75716e]">미체크 시 초안으로 저장 후 수동 발행</p>
                </div>
              </label>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mt-5 pt-4 border-t border-white/8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors disabled:opacity-50"
          >
            {saving ? '저장 중...' : '설정 저장'}
          </button>
          {settings?.lastGeneratedAt && (
            <span className="text-xs text-[#75716e]">마지막 생성: {formatDate(settings.lastGeneratedAt)}</span>
          )}
        </div>
      </div>

      {/* ── 지금 바로 생성 ── */}
      <div className="bg-[#2a2826] rounded-2xl border border-white/8 p-6">
        <h2 className="text-white font-black text-base mb-4">⚡ 지금 바로 생성</h2>
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

        {/* ── URL 지정 생성 ── */}
        <div className="mt-5 pt-5 border-t border-white/8">
          <p className="text-xs text-[#75716e] font-bold uppercase tracking-wide mb-2">
            특정 요약 페이지로 생성
          </p>
          <p className="text-[11px] text-[#4a4846] mb-3">
            마이페이지·스퀘어의 요약 페이지 URL 또는 sessionId를 입력하세요
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={urlInput}
              onChange={e => { setUrlInput(e.target.value); setUrlResult('') }}
              placeholder="https://ssoktube.com/result/abc123 또는 sessionId"
              className="flex-1 bg-[#1c1a18] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-[#4a4846] focus:outline-none focus:border-orange-500/50 min-w-0"
            />
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => handleUrlTrigger(false)}
              disabled={urlTriggering || !urlInput.trim()}
              className="px-4 py-2 rounded-xl bg-[#32302e] hover:bg-[#3a3836] text-white text-sm font-bold border border-white/10 transition-colors disabled:opacity-40"
            >
              {urlTriggering ? '생성 중...' : '📝 초안으로 생성'}
            </button>
            <button
              onClick={() => handleUrlTrigger(true)}
              disabled={urlTriggering || !urlInput.trim()}
              className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-sm font-bold border border-emerald-500/30 transition-colors disabled:opacity-40"
            >
              {urlTriggering ? '생성 중...' : '🚀 생성 + 즉시 발행'}
            </button>
          </div>
          {urlResult && (
            <p className="mt-2 text-sm text-[#a4a09c] bg-[#1c1a18] rounded-xl px-3 py-2 border border-white/8">
              {urlResult}
            </p>
          )}
        </div>
      </div>

      {/* ── 발행 로그 ── */}
      <div className="bg-[#2a2826] rounded-2xl border border-white/8 p-6">
        <h2 className="text-white font-black text-base mb-4">
          📋 발행 로그
          <span className="text-[#75716e] font-normal text-sm ml-2">({logs.length}건)</span>
        </h2>
        {loadingLogs ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-[#75716e] text-sm text-center py-6">아직 발행 기록이 없습니다.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {logs.map(log => {
              const s = LOG_STATUS[log.status] ?? LOG_STATUS.error
              return (
                <div key={log.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-[#1c1a18] border border-white/6">
                  <span className="text-sm mt-0.5 shrink-0">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold ${s.color}`}>
                      {log.status === 'success' ? log.postTitle : log.status === 'skipped' ? `스킵: ${log.reason}` : `오류: ${log.error}`}
                    </p>
                    {log.videoTitle && (
                      <p className="text-[10px] text-[#75716e] mt-0.5 truncate">📹 {log.videoTitle}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-[#75716e]">{formatDate(log.createdAt)}</p>
                    <p className="text-[9px] text-[#4a4846] mt-0.5">{log.triggerType === 'cron' ? '자동' : '수동'}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── 포스트 목록 ── */}
      <div className="bg-[#2a2826] rounded-2xl border border-white/8 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-black text-base">
            📄 포스트 목록 <span className="text-[#75716e] font-normal text-sm">({posts.length}개)</span>
          </h2>
          <Link
            href="/magazine"
            target="_blank"
            className="text-xs text-orange-400 hover:text-orange-300 border border-orange-500/30 px-3 py-1.5 rounded-lg transition-colors"
          >
            매거진 게시판 →
          </Link>
        </div>

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
                    <span className="text-[10px] text-[#75716e]">👁 {post.viewCount ?? 0}</span>
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

      {/* ── 미리보기 모달 ── */}
      {previewPost && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-8 px-4"
          onClick={() => setPreviewPost(null)}
        >
          <div
            className="w-full max-w-2xl bg-[#1c1a18] rounded-2xl border border-white/10 overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${STATUS_BADGE[previewPost.status] ?? STATUS_BADGE.draft}`}>
                  {previewPost.status === 'published' ? '발행됨' : '초안'}
                </span>
                <span className="text-xs text-[#75716e]">{formatDate(previewPost.createdAt)}</span>
              </div>
              <button onClick={() => setPreviewPost(null)} className="text-[#75716e] hover:text-white transition-colors text-lg">✕</button>
            </div>

            {previewPost.heroThumbnail && !previewPost.heroThumbnail.startsWith('data:') && (
              <img src={previewPost.heroThumbnail} alt={previewPost.title} className="w-full h-48 object-cover" />
            )}

            <div className="px-6 py-5">
              <h2 className="text-white font-black text-xl mb-1">{previewPost.title}</h2>
              {previewPost.subtitle && <p className="text-[#a4a09c] text-sm mb-4">{previewPost.subtitle}</p>}
              <div className="flex items-center gap-3 text-[10px] text-[#75716e] mb-5 flex-wrap">
                <span>👁 {previewPost.viewCount ?? 0}</span>
                <span>{previewPost.readTime}분 읽기</span>
                {previewPost.tags?.slice(0, 3).map(t => (
                  <span key={t} className="px-1.5 py-0.5 bg-[#2a2826] rounded border border-white/8">{t}</span>
                ))}
              </div>

              <div className="text-sm" dangerouslySetInnerHTML={{ __html: mdToHtml(previewPost.body ?? '') }} />

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

              {(previewPost as any).comments && (
                <div className="mt-5 space-y-3">
                  <h3 className="text-white font-bold text-sm">💬 시청자 반응</h3>
                  <div className="bg-orange-500/8 rounded-xl p-3 border border-orange-500/20">
                    <p className="text-[10px] font-bold text-orange-400 mb-1.5">🔥 인기 댓글 경향</p>
                    <p className="text-xs text-[#a4a09c] leading-relaxed mb-2">{(previewPost as any).comments.popular_summary}</p>
                    {(previewPost as any).comments.popular_highlights?.map((h: any, i: number) => (
                      <div key={i} className="bg-[#1c1a18] rounded-lg px-3 py-2 mb-1.5 border-l-2 border-orange-500">
                        <p className="text-xs text-[#e4e4e7] leading-relaxed">"{h.text}"</p>
                        <p className="text-[9px] text-[#75716e] mt-0.5">👍 {h.likes?.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-indigo-500/8 rounded-xl p-3 border border-indigo-500/20">
                    <p className="text-[10px] font-bold text-indigo-400 mb-1.5">🕐 최신 댓글 경향</p>
                    <p className="text-xs text-[#a4a09c] leading-relaxed mb-2">{(previewPost as any).comments.recent_summary}</p>
                    {(previewPost as any).comments.recent_highlights?.map((h: any, i: number) => (
                      <div key={i} className="bg-[#1c1a18] rounded-lg px-3 py-2 mb-1.5 border-l-2 border-indigo-500">
                        <p className="text-xs text-[#e4e4e7] leading-relaxed">"{h.text}"</p>
                        <p className="text-[9px] text-[#75716e] mt-0.5">👍 {h.likes?.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 px-6 py-4 border-t border-white/8 bg-[#161412]">
              {previewPost.status === 'published' && (
                <Link href={`/magazine/${previewPost.slug}`} target="_blank"
                  className="px-4 py-2 rounded-xl bg-[#32302e] text-[#a4a09c] hover:text-white text-sm font-bold border border-white/8 transition-colors">
                  발행 글 보기 →
                </Link>
              )}
              {previewPost.status === 'draft' && (
                <button onClick={() => handlePublish(previewPost.id)} disabled={actionId === previewPost.id}
                  className="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-sm font-bold border border-emerald-500/30 transition-colors disabled:opacity-50">
                  {actionId === previewPost.id ? '발행 중...' : '발행하기'}
                </button>
              )}
              <button onClick={() => handleDelete(previewPost.id, previewPost.title)} disabled={actionId === previewPost.id}
                className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm font-bold border border-red-500/20 transition-colors disabled:opacity-50">
                삭제
              </button>
              <button onClick={() => setPreviewPost(null)}
                className="ml-auto px-4 py-2 rounded-xl bg-[#2a2826] text-[#a4a09c] hover:text-white text-sm font-bold border border-white/8 transition-colors">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
