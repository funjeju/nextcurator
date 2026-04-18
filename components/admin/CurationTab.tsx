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
        setTriggerResult(`⚠️ ${data.error || data.skipped ? '스킵됨: ' + data.reason : '알 수 없는 오류'}`)
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
    setActionId(null)
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`포스트를 삭제하시겠습니까?\n"${title}"`)) return
    setActionId(id)
    await callAdmin('delete', { id })
    setPosts(prev => prev.filter(p => p.id !== id))
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
              <div key={post.id} className="flex items-start gap-3 p-3 rounded-xl bg-[#1c1a18] border border-white/6">
                {post.heroThumbnail && !post.heroThumbnail.startsWith('data:') && (
                  <img src={post.heroThumbnail} alt="" className="w-16 h-10 object-cover rounded-lg shrink-0 bg-[#252423]" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-bold line-clamp-1">{post.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${STATUS_BADGE[post.status] ?? STATUS_BADGE.draft}`}>
                      {post.status === 'published' ? '발행됨' : '초안'}
                    </span>
                    <span className="text-[10px] text-[#75716e]">영상 {post.videoTitles?.length ?? 0}개</span>
                    <span className="text-[10px] text-[#75716e]">{post.readTime}분 읽기</span>
                    <span className="text-[10px] text-[#75716e]">{formatDate(post.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
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
