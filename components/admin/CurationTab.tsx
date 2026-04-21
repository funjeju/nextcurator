'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { CurationSettings, CuratedPost, MagazineLog } from '@/lib/magazine'

type AiSubcategory = 'news' | 'tools' | 'usecases'

interface PipelineSlot {
  sessionId?: string
  savedSummaryId?: string
  videoId?: string
  title?: string
  subcategory?: AiSubcategory
  savedAt?: string
  status?: 'ready' | 'processing' | 'published' | string
}

interface PipelineSlots {
  news: PipelineSlot | null
  tools: PipelineSlot | null
  usecases: PipelineSlot | null
}

const SUBCATEGORY_META: Record<AiSubcategory, { label: string; emoji: string; color: string; border: string; bg: string }> = {
  news:     { label: 'AI 소식',  emoji: '📰', color: 'text-blue-400',   border: 'border-blue-500/30',   bg: 'bg-blue-500/10'   },
  tools:    { label: 'AI 도구',  emoji: '🛠️', color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
  usecases: { label: 'AI 활용',  emoji: '🚀', color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
}

const SLOT_STATUS_BADGE: Record<string, string> = {
  ready:      'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  processing: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  published:  'bg-blue-500/20 text-blue-400 border-blue-500/30',
}

const STATUS_BADGE: Record<string, string> = {
  draft:     'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  published: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
}

const LOG_STATUS: Record<string, { color: string; icon: string }> = {
  success: { color: 'text-emerald-400', icon: '✅' },
  error:   { color: 'text-red-400',     icon: '❌' },
  skipped: { color: 'text-yellow-400',  icon: '⏭️' },
}

const PIPELINE_SCHEDULE = [
  { label: 'KST 06:00', slots: ['news'],     times: ['06:00', '06:10', '06:20', '06:30'] },
  { label: 'KST 14:00', slots: ['tools'],    times: ['14:00', '14:10', '14:20', '14:30'] },
  { label: 'KST 22:00', slots: ['usecases'], times: ['22:00', '22:10', '22:20', '22:30'] },
]

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

type PipelineStage = 'scout' | 'evaluate' | 'summarize' | 'publish'

const STAGE_META: Record<PipelineStage, { label: string; api: string; color: string }> = {
  scout:    { label: '① Scout',    api: '/api/cron/ai-scout',    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30' },
  evaluate: { label: '② Evaluate', api: '/api/cron/ai-evaluate', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30' },
  summarize:{ label: '③ Summarize',api: '/api/cron/ai-summarize',color: 'bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30' },
  publish:  { label: '④ Publish',  api: '/api/cron/generate-post',color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30' },
}

function PipelineTrigger({
  subcategory,
  onDone,
}: {
  subcategory: AiSubcategory
  onDone: () => void
}) {
  const [running, setRunning] = useState<PipelineStage | null>(null)
  const [result, setResult]   = useState<{ stage: PipelineStage; ok: boolean; msg: string } | null>(null)

  const trigger = async (stage: PipelineStage) => {
    setRunning(stage)
    setResult(null)
    try {
      const res = await fetch(STAGE_META[stage].api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true, subcategory }),
      })
      const data = await res.json()
      const ok = !!(data.success || data.ok)
      const msg = data.error ?? data.message ?? data.reason
        ?? (ok ? `${stage} 완료` : '알 수 없는 오류')
      setResult({ stage, ok, msg })
      if (ok) onDone()
    } catch (e) {
      setResult({ stage, ok: false, msg: String(e) })
    }
    setRunning(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(STAGE_META) as PipelineStage[]).map(stage => (
          <button
            key={stage}
            onClick={() => trigger(stage)}
            disabled={running !== null}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors disabled:opacity-40 ${STAGE_META[stage].color}`}
          >
            {running === stage ? '실행 중...' : STAGE_META[stage].label}
          </button>
        ))}
      </div>
      {result && (
        <p className={`text-[11px] px-3 py-1.5 rounded-lg border ${result.ok ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
          {result.ok ? '✅' : '❌'} [{result.stage}] {result.msg}
        </p>
      )}
    </div>
  )
}

export default function CurationTab({ getAuthHeader }: {
  getAuthHeader: () => Promise<Record<string, string>>
}) {
  const [settings, setSettings]         = useState<CurationSettings | null>(null)
  const [slots, setSlots]               = useState<PipelineSlots | null>(null)
  const [posts, setPosts]               = useState<CuratedPost[]>([])
  const [logs, setLogs]                 = useState<MagazineLog[]>([])
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [loadingPosts, setLoadingPosts] = useState(true)
  const [loadingLogs, setLoadingLogs]   = useState(true)
  const [saving, setSaving]             = useState(false)
  const [triggering, setTriggering]     = useState(false)
  const [triggerResult, setTriggerResult] = useState('')
  const [urlInput, setUrlInput]         = useState('')
  const [urlTriggering, setUrlTriggering] = useState(false)
  const [urlResult, setUrlResult]       = useState('')
  const [actionId, setActionId]         = useState<string | null>(null)
  const [previewPost, setPreviewPost]   = useState<CuratedPost | null>(null)

  const callAdmin = useCallback(async (action: string, extra?: object) => {
    const headers = await getAuthHeader()
    const res = await fetch('/api/admin/curation', {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...extra }),
    })
    return res.json()
  }, [getAuthHeader])

  const loadSlots = useCallback(async () => {
    setLoadingSlots(true)
    const data = await callAdmin('getPipelineSlots')
    setSlots(data)
    setLoadingSlots(false)
  }, [callAdmin])

  const loadAll = useCallback(async () => {
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
    loadSlots()
  }, [callAdmin, loadSlots])

  useEffect(() => { loadAll() }, [loadAll])

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
        const [updatedPosts, updatedLogs] = await Promise.all([callAdmin('listPosts'), callAdmin('getLogs')])
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
        const [updatedPosts, updatedLogs] = await Promise.all([callAdmin('listPosts'), callAdmin('getLogs')])
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

      {/* ── AI 파이프라인 설정 ── */}
      <div className="bg-[#2a2826] rounded-2xl border border-white/8 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-black text-base">🤖 AI 파이프라인 설정</h2>
            <p className="text-[11px] text-[#75716e] mt-1">
              KST 06:00 / 14:00 / 22:00 — Scout → Evaluate → Summarize → Publish (각 10분 간격)
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer shrink-0 ml-4">
            <span className="text-xs text-[#a4a09c]">{settings?.enabled ? '자동 ON' : '자동 OFF'}</span>
            <button
              onClick={() => settings && setSettings({ ...settings, enabled: !settings.enabled })}
              className={`relative w-11 h-6 rounded-full transition-colors ${settings?.enabled ? 'bg-orange-500' : 'bg-[#3d3a38]'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${settings?.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </label>
        </div>

        {/* 파이프라인 타이밍 시각화 */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {PIPELINE_SCHEDULE.map(({ label, slots: slotNames, times }) => (
            <div key={label} className="bg-[#1c1a18] rounded-xl border border-white/8 p-3">
              <p className="text-[11px] font-bold text-[#a4a09c] mb-2">{label}</p>
              <div className="space-y-1">
                {(['scout','evaluate','summarize','publish'] as PipelineStage[]).map((stage, i) => (
                  <div key={stage} className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[#4a4846] w-9 shrink-0">{times[i]}</span>
                    <span className={`text-[10px] font-bold ${STAGE_META[stage].color.split(' ')[1]}`}>
                      {['Scout','Evaluate','Summarize','Publish'][i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {settings && (
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-[#1c1a18] border border-white/8 mb-4">
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
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors disabled:opacity-50"
          >
            {saving ? '저장 중...' : '설정 저장'}
          </button>
          {settings?.lastGeneratedAt && (
            <span className="text-xs text-[#75716e]">마지막 자동 발행: {formatDate(settings.lastGeneratedAt)}</span>
          )}
        </div>
      </div>

      {/* ── AI 파이프라인 슬롯 현황 ── */}
      <div className="bg-[#2a2826] rounded-2xl border border-white/8 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-black text-base">📡 파이프라인 슬롯 현황</h2>
          <button
            onClick={loadSlots}
            disabled={loadingSlots}
            className="px-3 py-1.5 rounded-lg bg-[#1c1a18] hover:bg-[#252423] text-[#a4a09c] text-[11px] font-bold border border-white/8 transition-colors disabled:opacity-50"
          >
            {loadingSlots ? '로딩...' : '↻ 새로고침'}
          </button>
        </div>

        {loadingSlots ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(Object.keys(SUBCATEGORY_META) as AiSubcategory[]).map(sub => {
              const meta = SUBCATEGORY_META[sub]
              const slot = slots?.[sub]
              return (
                <div key={sub} className={`rounded-xl border p-4 ${meta.bg} ${meta.border}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-sm font-black ${meta.color}`}>{meta.emoji} {meta.label}</span>
                    {slot?.status && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${SLOT_STATUS_BADGE[slot.status] ?? 'bg-[#1c1a18] text-[#75716e] border-white/10'}`}>
                        {slot.status}
                      </span>
                    )}
                  </div>
                  {slot ? (
                    <div className="space-y-1.5">
                      <p className="text-xs text-white font-medium line-clamp-2 leading-snug">{slot.title ?? '제목 없음'}</p>
                      {slot.videoId && (
                        <a
                          href={`https://www.youtube.com/watch?v=${slot.videoId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-[#75716e] hover:text-red-400 transition-colors"
                        >
                          ▶ YouTube
                        </a>
                      )}
                      {slot.savedAt && (
                        <p className="text-[10px] text-[#4a4846]">{formatDate(slot.savedAt)}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#4a4846]">슬롯 비어있음</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── 파이프라인 수동 실행 ── */}
      <div className="bg-[#2a2826] rounded-2xl border border-white/8 p-6">
        <h2 className="text-white font-black text-base mb-1">⚙️ 파이프라인 수동 실행</h2>
        <p className="text-[11px] text-[#75716e] mb-4">각 단계를 순서대로 수동 실행합니다. Publish는 슬롯에 ready 상태 요약이 있어야 동작합니다.</p>
        <div className="space-y-4">
          {(Object.keys(SUBCATEGORY_META) as AiSubcategory[]).map(sub => {
            const meta = SUBCATEGORY_META[sub]
            return (
              <div key={sub} className="bg-[#1c1a18] rounded-xl border border-white/8 p-4">
                <p className={`text-xs font-black mb-3 ${meta.color}`}>{meta.emoji} {meta.label}</p>
                <PipelineTrigger subcategory={sub} onDone={loadSlots} />
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 특정 요약으로 매거진 생성 ── */}
      <div className="bg-[#2a2826] rounded-2xl border border-white/8 p-6">
        <h2 className="text-white font-black text-base mb-1">⚡ 특정 요약으로 매거진 생성</h2>
        <p className="text-[11px] text-[#75716e] mb-4">스퀘어 요약 페이지 URL 또는 sessionId를 지정해서 매거진을 즉시 생성합니다.</p>

        <div className="flex flex-wrap gap-3 mb-4">
          <button
            onClick={() => handleTrigger(false)}
            disabled={triggering}
            className="px-4 py-2.5 rounded-xl bg-[#32302e] hover:bg-[#3a3836] text-white text-sm font-bold border border-white/10 transition-colors disabled:opacity-50"
          >
            {triggering ? '생성 중...' : '📝 최적 요약으로 초안 생성'}
          </button>
          <button
            onClick={() => handleTrigger(true)}
            disabled={triggering}
            className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-sm font-bold border border-emerald-500/30 transition-colors disabled:opacity-50"
          >
            {triggering ? '생성 중...' : '🚀 최적 요약으로 즉시 발행'}
          </button>
        </div>
        {triggerResult && (
          <p className="mb-4 text-sm text-[#a4a09c] bg-[#1c1a18] rounded-xl px-3 py-2 border border-white/8">{triggerResult}</p>
        )}

        <div className="pt-4 border-t border-white/8">
          <p className="text-[11px] text-[#75716e] mb-2 font-bold uppercase tracking-wide">URL / SessionId 지정</p>
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
            <p className="mt-2 text-sm text-[#a4a09c] bg-[#1c1a18] rounded-xl px-3 py-2 border border-white/8">{urlResult}</p>
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
              {(previewPost as any).platformReactions && (
                <div className="mt-3">
                  <div className="bg-emerald-500/8 rounded-xl p-3 border border-emerald-500/20">
                    <p className="text-[10px] font-bold text-emerald-400 mb-1.5">💡 SSOKTUBE 학습자 반응</p>
                    <p className="text-xs text-[#a4a09c] leading-relaxed mb-2">{(previewPost as any).platformReactions.summary}</p>
                    {(previewPost as any).platformReactions.highlights?.map((h: any, i: number) => (
                      <div key={i} className="bg-[#1c1a18] rounded-lg px-3 py-2 mb-1.5 border-l-2 border-emerald-500">
                        <p className="text-[9px] text-emerald-400/70 font-bold mb-0.5">[{h.context}]</p>
                        <p className="text-xs text-[#e4e4e7] leading-relaxed">"{h.text}"</p>
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
