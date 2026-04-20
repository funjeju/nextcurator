'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/common/Header'
import { useAuth } from '@/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { formatRelativeDate } from '@/lib/formatDate'
import Link from 'next/link'
import AnalyticsTab from '@/components/admin/AnalyticsTab'
import CurationTab from '@/components/admin/CurationTab'

interface AdminStats {
  totalSummaries: number
  totalSaved: number
  totalUsers: number
  todaySummaries: number
}

interface UserStats {
  total: number
  teachers: number
  students: number
  general: number
  paid: number
}

type AdminTab = 'analytics' | 'videos' | 'users' | 'curation' | 'square'

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [summaries, setSummaries] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [activeTab, setActiveTab] = useState<AdminTab>('analytics')

  // 스퀘어 관리
  const [squareItems, setSquareItems] = useState<any[]>([])
  const [squareSearch, setSquareSearch] = useState('')
  const [squarePage, setSquarePage] = useState(1)
  const [squareTotal, setSquareTotal] = useState(0)
  const [squareLoading, setSquareLoading] = useState(false)
  const [squareManagingId, setSquareManagingId] = useState<string | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const SQUARE_PAGE_SIZE = 12

  // 회원 관리
  const [users, setUsers] = useState<any[]>([])
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [userSearch, setUserSearch] = useState('')
  const [userRole, setUserRole] = useState('all')
  const [userPlan, setUserPlan] = useState('all')
  const [userPage, setUserPage] = useState(1)
  const [userTotal, setUserTotal] = useState(0)
  const [userLoading, setUserLoading] = useState(false)

  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL

  useEffect(() => {
    if (authLoading) return
    if (!user || user.email !== ADMIN_EMAIL) {
      setIsAdmin(false)
      setLoading(false)
    } else {
      setIsAdmin(true)
      loadData()
    }
  }, [user, authLoading])

  const getAuthHeader = async () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${user ? await user.getIdToken() : ''}`,
  })

  const loadData = async (targetPage = page) => {
    setLoading(true)
    try {
      const headers = await getAuthHeader()
      const [statsRes, listRes] = await Promise.all([
        fetch('/api/admin/stats', { method: 'POST', headers, body: JSON.stringify({}) }),
        fetch('/api/admin/summaries', { method: 'POST', headers, body: JSON.stringify({ search, page: targetPage }) }),
      ])
      if (statsRes.ok) setStats(await statsRes.json())
      if (listRes.ok) {
        const data = await listRes.json()
        setSummaries(data.summaries)
        setHasMore(data.summaries.length === 10)
      }
    } catch (e) {
      console.error('Failed to load admin data:', e)
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async (p = 1, role = userRole, plan = userPlan, q = userSearch) => {
    setUserLoading(true)
    try {
      const headers = await getAuthHeader()
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers,
        body: JSON.stringify({ search: q, role, plan, page: p }),
      })
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users)
        setUserTotal(data.total)
        setUserStats(data.stats)
        setUserPage(p)
      }
    } catch (e) {
      console.error('Failed to load users:', e)
    } finally {
      setUserLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin && activeTab === 'users') loadUsers(1)
    if (isAdmin && activeTab === 'square') loadSquare(1)
  }, [isAdmin, activeTab])

  const goToPage = (newPage: number) => { setPage(newPage); loadData(newPage) }

  const loadSquare = async (p = 1, q = squareSearch, hidden = showHidden) => {
    setSquareLoading(true)
    try {
      const headers = await getAuthHeader()
      const res = await fetch('/api/admin/square', {
        method: 'POST',
        headers,
        body: JSON.stringify({ search: q, page: p, showHidden: hidden }),
      })
      if (res.ok) {
        const data = await res.json()
        setSquareItems(data.items)
        setSquareTotal(data.total)
        setSquarePage(p)
      }
    } catch (e) { console.error(e) }
    finally { setSquareLoading(false) }
  }

  const handleSquareManage = async (id: string, action: 'hide' | 'show' | 'delete', title: string) => {
    const labels = { hide: '숨김', show: '숨김 해제', delete: '영구 삭제' }
    if (action === 'delete' && !confirm(`[영구 삭제] 복구 불가합니다.\n"${title}"`)) return
    if (action === 'hide' && !confirm(`스퀘어에서 숨깁니다 (데이터는 유지).\n"${title}"`)) return
    setSquareManagingId(id)
    try {
      const headers = await getAuthHeader()
      const res = await fetch('/api/admin/square', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id, action }),
      })
      if (res.ok) {
        if (action === 'delete') {
          setSquareItems(prev => prev.filter(i => i.id !== id))
          setSquareTotal(prev => prev - 1)
        } else if (action === 'hide') {
          setSquareItems(prev => showHidden
            ? prev.map(i => i.id === id ? { ...i, adminHidden: true } : i)
            : prev.filter(i => i.id !== id)
          )
        } else if (action === 'show') {
          setSquareItems(prev => prev.map(i => i.id === id ? { ...i, adminHidden: false } : i))
        }
      } else {
        alert('처리 실패')
      }
    } catch { alert('오류가 발생했습니다.') }
    finally { setSquareManagingId(null) }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`[영구 삭제] 정말로 이 요약을 삭제하시겠습니까?\n제목: ${title}`)) return
    setDeletingId(id)
    try {
      const headers = await getAuthHeader()
      const res = await fetch('/api/admin/delete', { method: 'POST', headers, body: JSON.stringify({ id }) })
      if (res.ok) {
        setSummaries(prev => prev.filter(s => s.id !== id))
      } else {
        const err = await res.json().catch(() => ({}))
        alert(`삭제 실패: ${err.error || res.status}`)
      }
    } catch { alert('오류가 발생했습니다.') }
    finally { setDeletingId(null) }
  }

  if (authLoading || loading) return (
    <div className="min-h-screen bg-[#1a1918] flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500" />
    </div>
  )

  if (!isAdmin) return (
    <div className="min-h-screen bg-[#1a1918] flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-4xl mb-4">🚫</h1>
      <h2 className="text-xl text-white font-bold mb-2">접근 권한이 없습니다</h2>
      <p className="text-gray-400 mb-6">관리자 계정으로 로그인해 주세요.</p>
      <Link href="/" className="px-6 py-2 bg-orange-500 text-white rounded-xl">홈으로 이동</Link>
    </div>
  )

  const roleBadge = (role: string) => {
    if (role === 'teacher') return <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-bold">선생님</span>
    if (role === 'student') return <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-blue-500/15 text-blue-400 border border-blue-500/20 font-bold">학생</span>
    return <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">일반</span>
  }

  const planBadge = (plan: string) => {
    if (plan === 'paid' || plan === 'pro') return <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-orange-500/15 text-orange-400 border border-orange-500/20 font-bold">유료</span>
    return <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-zinc-500/10 text-zinc-500 border border-zinc-500/20">무료</span>
  }

  return (
    <div className="min-h-screen bg-[#1a1918] text-white font-sans">
      <Header title="🔧 관리자 대시보드" />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: '오늘 분석된 영상', value: stats?.todaySummaries ?? 0, unit: '건', color: 'text-orange-500' },
            { label: '전체 분석(캐시)', value: stats?.totalSummaries ?? 0, unit: '건', color: 'text-white' },
            { label: '유저 저장됨', value: stats?.totalSaved ?? 0, unit: '건', color: 'text-blue-400' },
            { label: '누적 가입 유저', value: stats?.totalUsers ?? 0, unit: '명', color: 'text-emerald-400' },
          ].map(c => (
            <div key={c.label} className="bg-gradient-to-br from-[#2a2826] to-[#1e1d1b] p-5 rounded-[24px] border border-white/5 shadow-xl">
              <p className="text-gray-400 text-[11px] mb-1">{c.label}</p>
              <h3 className={`text-2xl font-black ${c.color}`}>{c.value} <span className="text-[10px] font-normal text-gray-500">{c.unit}</span></h3>
            </div>
          ))}
        </div>

        {/* 탭 */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-colors ${activeTab === 'analytics' ? 'bg-orange-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            📈 통계 분석
          </button>
          <button
            onClick={() => setActiveTab('videos')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-colors ${activeTab === 'videos' ? 'bg-orange-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            🎬 영상 관리
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-colors ${activeTab === 'users' ? 'bg-orange-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            👥 회원 관리
          </button>
          <button
            onClick={() => setActiveTab('curation')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-colors ${activeTab === 'curation' ? 'bg-orange-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            ✍️ 매거진
          </button>
          <button
            onClick={() => setActiveTab('square')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-colors ${activeTab === 'square' ? 'bg-orange-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            🔲 스퀘어
          </button>
        </div>

        {/* ── 통계 분석 탭 ── */}
        {activeTab === 'analytics' && (
          <AnalyticsTab getAuthHeader={getAuthHeader} />
        )}

        {/* ── 매거진 큐레이션 탭 ── */}
        {activeTab === 'curation' && (
          <CurationTab getAuthHeader={getAuthHeader} />
        )}

        {/* ── 영상 관리 탭 ── */}
        {activeTab === 'videos' && (
          <div className="bg-[#23211f] rounded-[32px] border border-white/10 p-6 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold italic tracking-tighter">ALL VIDEO MANAGEMENT</h2>
              <div className="relative">
                <input
                  type="text"
                  placeholder="제목, 유저, ID 검색..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { setPage(1); loadData(1) } }}
                  className="bg-[#1a1918] border border-white/10 rounded-xl px-4 py-2.5 pl-10 text-xs focus:outline-none focus:border-orange-500 w-64 transition-all"
                />
                <span className="absolute left-3 top-3 opacity-30">🔍</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-gray-500 border-b border-white/5">
                  <tr>
                    <th className="pb-3 font-medium">콘텐츠 (캐시 포함)</th>
                    <th className="pb-3 font-medium">유저/시각</th>
                    <th className="pb-3 font-medium">관리 상태</th>
                    <th className="pb-3 font-medium text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {summaries.map(s => (
                    <tr key={s.id} className="group hover:bg-white/[0.01] transition-colors">
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3">
                          <img src={s.thumbnail} className="w-20 aspect-video rounded-lg object-cover bg-gray-800 border border-white/5" alt="" />
                          <div className="min-w-0">
                            <p className="font-bold text-white line-clamp-1 group-hover:text-orange-400 transition-colors">{s.title}</p>
                            <p className="text-[9px] text-gray-500 mt-0.5 truncate">{s.category} · {s.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <p className="text-gray-300">{s.userDisplayName || '익명 (캐시)'}</p>
                        <p className="text-[10px] text-gray-500">{s.createdAt ? formatRelativeDate(s.createdAt) : '-'}</p>
                      </td>
                      <td className="py-4">
                        {s.isSaved
                          ? <span className="px-2 py-0.5 rounded-full text-[9px] bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20">저장됨</span>
                          : <span className="px-2 py-0.5 rounded-full text-[9px] bg-zinc-500/10 text-zinc-500 border border-zinc-500/20">캐시만</span>}
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/result/${s.originalId || s.id}`} className="p-2.5 hover:bg-white/10 rounded-xl transition-colors text-gray-400" title="상세 보기">👁️</Link>
                          <button
                            onClick={() => handleDelete(s.id, s.title)}
                            disabled={deletingId === s.id}
                            className="p-2.5 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-colors text-gray-400 disabled:opacity-50"
                          >🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {summaries.length === 0 && <div className="py-20 text-center text-gray-500">데이터가 없습니다.</div>}
            {(page > 1 || hasMore) && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button onClick={() => goToPage(page - 1)} disabled={page === 1 || loading} className="px-4 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors">← 이전</button>
                <span className="text-xs text-gray-500">{page} 페이지</span>
                <button onClick={() => goToPage(page + 1)} disabled={!hasMore || loading} className="px-4 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors">다음 →</button>
              </div>
            )}
          </div>
        )}

        {/* ── 스퀘어 관리 탭 ── */}
        {activeTab === 'square' && (
          <div className="bg-[#23211f] rounded-[32px] border border-white/10 p-6 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold italic tracking-tighter">SQUARE MANAGEMENT</h2>
                <p className="text-xs text-gray-500 mt-1">전체 {squareTotal}개</p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showHidden}
                    onChange={e => { setShowHidden(e.target.checked); loadSquare(1, squareSearch, e.target.checked) }}
                    className="accent-orange-500"
                  />
                  숨김 항목 포함
                </label>
                <input
                  type="text"
                  placeholder="제목, 채널, 유저 검색..."
                  value={squareSearch}
                  onChange={e => setSquareSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') loadSquare(1, squareSearch) }}
                  className="bg-[#1a1918] border border-white/10 rounded-xl px-4 py-2 pl-8 text-xs focus:outline-none focus:border-orange-500 w-52"
                />
                <button onClick={() => loadSquare(1, squareSearch)} className="px-4 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 transition-colors">검색</button>
              </div>
            </div>

            {squareLoading ? (
              <div className="py-20 text-center"><div className="animate-spin inline-block rounded-full h-8 w-8 border-t-2 border-orange-500" /></div>
            ) : squareItems.length === 0 ? (
              <div className="py-20 text-center text-gray-500">항목이 없습니다.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {squareItems.map(item => (
                  <div key={item.id} className={`rounded-2xl border p-4 flex flex-col gap-3 ${item.adminHidden ? 'border-red-500/20 bg-red-500/5' : 'border-white/8 bg-[#2a2826]'}`}>
                    <div className="flex gap-3">
                      <img src={item.thumbnail} alt={item.title} className="w-24 h-14 object-cover rounded-lg shrink-0 bg-gray-800" />
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-xs font-bold line-clamp-2 leading-snug">{item.title}</p>
                        <p className="text-[10px] text-gray-500 mt-1">{item.channel} · {item.category}</p>
                        <p className="text-[10px] text-gray-600">{item.autoCollected ? '🤖 자동수집' : `👤 ${item.userDisplayName || '익명'}`}</p>
                      </div>
                    </div>
                    {item.adminHidden && (
                      <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full self-start">숨김 중</span>
                    )}
                    <div className="flex gap-2 mt-auto">
                      <Link href={`/result/${item.sessionId}`} target="_blank" className="flex-1 py-1.5 rounded-xl text-center text-[11px] bg-white/5 hover:bg-white/10 text-gray-400 transition-colors">
                        👁️ 보기
                      </Link>
                      {item.adminHidden ? (
                        <button
                          onClick={() => handleSquareManage(item.id, 'show', item.title)}
                          disabled={squareManagingId === item.id}
                          className="flex-1 py-1.5 rounded-xl text-[11px] bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 transition-colors disabled:opacity-50"
                        >
                          ✅ 숨김 해제
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSquareManage(item.id, 'hide', item.title)}
                          disabled={squareManagingId === item.id}
                          className="flex-1 py-1.5 rounded-xl text-[11px] bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-400 border border-yellow-500/20 transition-colors disabled:opacity-50"
                        >
                          🙈 숨기기
                        </button>
                      )}
                      <button
                        onClick={() => handleSquareManage(item.id, 'delete', item.title)}
                        disabled={squareManagingId === item.id}
                        className="flex-1 py-1.5 rounded-xl text-[11px] bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20 transition-colors disabled:opacity-50"
                      >
                        🗑️ 영구삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {squareTotal > SQUARE_PAGE_SIZE && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button onClick={() => loadSquare(squarePage - 1)} disabled={squarePage === 1 || squareLoading} className="px-4 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors">← 이전</button>
                <span className="text-xs text-gray-500">{squarePage} / {Math.ceil(squareTotal / SQUARE_PAGE_SIZE)} 페이지</span>
                <button onClick={() => loadSquare(squarePage + 1)} disabled={squarePage >= Math.ceil(squareTotal / SQUARE_PAGE_SIZE) || squareLoading} className="px-4 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors">다음 →</button>
              </div>
            )}
          </div>
        )}

        {/* ── 회원 관리 탭 ── */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* 회원 통계 */}
            {userStats && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: '전체 회원', value: userStats.total, color: 'text-white' },
                  { label: '일반 사용자', value: userStats.general, color: 'text-gray-300' },
                  { label: '선생님', value: userStats.teachers, color: 'text-emerald-400' },
                  { label: '학생', value: userStats.students, color: 'text-blue-400' },
                  { label: '유료 회원', value: userStats.paid, color: 'text-orange-400' },
                ].map(c => (
                  <div key={c.label} className="bg-[#23211f] rounded-2xl border border-white/5 p-4 text-center">
                    <p className="text-gray-500 text-[10px] mb-1">{c.label}</p>
                    <p className={`text-xl font-black ${c.color}`}>{c.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* 필터 + 검색 */}
            <div className="bg-[#23211f] rounded-[32px] border border-white/10 p-6 shadow-2xl">
              <div className="flex flex-wrap gap-3 mb-5">
                <input
                  type="text"
                  placeholder="이름, 이메일, 학교, 클래스코드 검색..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') loadUsers(1, userRole, userPlan, userSearch) }}
                  className="flex-1 min-w-48 bg-[#1a1918] border border-white/10 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-orange-500 transition-colors"
                />
                <select
                  value={userRole}
                  onChange={e => { setUserRole(e.target.value); loadUsers(1, e.target.value, userPlan, userSearch) }}
                  className="bg-[#1a1918] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="all">전체 역할</option>
                  <option value="none">일반 사용자</option>
                  <option value="teacher">선생님</option>
                  <option value="student">학생</option>
                </select>
                <select
                  value={userPlan}
                  onChange={e => { setUserPlan(e.target.value); loadUsers(1, userRole, e.target.value, userSearch) }}
                  className="bg-[#1a1918] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="all">전체 플랜</option>
                  <option value="free">무료</option>
                  <option value="paid">유료</option>
                </select>
                <button
                  onClick={() => loadUsers(1, userRole, userPlan, userSearch)}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  검색
                </button>
              </div>

              {/* 회원 테이블 */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-gray-500 border-b border-white/5">
                    <tr>
                      <th className="pb-3 font-medium">회원</th>
                      <th className="pb-3 font-medium">역할</th>
                      <th className="pb-3 font-medium">플랜</th>
                      <th className="pb-3 font-medium">클래스 정보</th>
                      <th className="pb-3 font-medium text-center">토큰</th>
                      <th className="pb-3 font-medium">가입일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {userLoading ? (
                      <tr><td colSpan={6} className="py-16 text-center text-gray-500">불러오는 중...</td></tr>
                    ) : users.length === 0 ? (
                      <tr><td colSpan={6} className="py-16 text-center text-gray-500">회원이 없습니다.</td></tr>
                    ) : users.map(u => {
                      const isIncomplete = !u.profileCompleted && !u.role
                      const isStudentEmail = (u.email || '').includes('@cls.ssoktube.com')
                      return (
                      <tr key={u.id} className={`hover:bg-white/[0.02] transition-colors ${isIncomplete ? 'opacity-60' : ''}`}>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            {u.photoURL
                              ? <img src={u.photoURL} className="w-7 h-7 rounded-full border border-white/10 shrink-0 object-cover" alt="" />
                              : <div className="w-7 h-7 rounded-full bg-[#3d3a38] flex items-center justify-center text-sm shrink-0">{u.avatarEmoji || '👤'}</div>
                            }
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <p className={`font-semibold truncate max-w-[120px] ${!u.displayName && !u.studentName ? 'text-gray-500 italic' : 'text-white'}`}>
                                  {u.displayName || u.studentName || '(이름 없음)'}
                                </p>
                                {isIncomplete && <span className="text-[8px] px-1 py-0.5 bg-yellow-500/15 text-yellow-500 rounded border border-yellow-500/20 shrink-0">미완성</span>}
                                {isStudentEmail && !u.role && <span className="text-[8px] px-1 py-0.5 bg-blue-500/15 text-blue-400 rounded border border-blue-500/20 shrink-0">학생?</span>}
                              </div>
                              <p className="text-gray-500 text-[9px] truncate max-w-[140px]">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3">{roleBadge(u.role)}</td>
                        <td className="py-3">{planBadge(u.plan)}</td>
                        <td className="py-3">
                          {u.role === 'teacher' && u.classCode && (
                            <div>
                              <p className="text-emerald-400 font-mono font-bold text-[10px]">{u.classCode}</p>
                              <p className="text-gray-500 text-[9px]">{u.schoolName} {u.grade}학년 {u.classNum}반</p>
                            </div>
                          )}
                          {u.role === 'student' && u.classCode && (
                            <div>
                              <p className="text-blue-400 font-mono text-[10px]">{u.classCode}</p>
                              <p className="text-gray-500 text-[9px]">{u.schoolName} {u.grade}학년 {u.classNum}반</p>
                            </div>
                          )}
                          {!u.classCode && <span className="text-gray-600 text-[9px]">-</span>}
                        </td>
                        <td className="py-3 text-center">
                          <span className="text-orange-400 font-bold">{u.tokens ?? 0}</span>
                        </td>
                        <td className="py-3 text-gray-500">
                          {u.createdAt || u.updatedAt ? formatRelativeDate(u.createdAt || u.updatedAt) : '-'}
                        </td>
                      </tr>
                    )})}

                  </tbody>
                </table>
              </div>

              {/* 페이지네이션 */}
              {userTotal > 20 && (
                <div className="flex items-center justify-center gap-3 mt-5">
                  <button
                    onClick={() => loadUsers(userPage - 1)}
                    disabled={userPage === 1 || userLoading}
                    className="px-4 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
                  >← 이전</button>
                  <span className="text-xs text-gray-500">{userPage} 페이지 / 총 {userTotal}명</span>
                  <button
                    onClick={() => loadUsers(userPage + 1)}
                    disabled={userPage * 20 >= userTotal || userLoading}
                    className="px-4 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-colors"
                  >다음 →</button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
