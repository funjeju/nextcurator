'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/common/Header'
import { useAuth } from '@/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { formatRelativeDate } from '@/lib/formatDate'
import Link from 'next/link'

interface AdminStats {
  totalSummaries: number
  totalSaved: number
  totalUsers: number
  todaySummaries: number
  recentItems: any[]
}

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

  // 환경 변수는 클라이언트에서 접근 가능하도록 NEXT_PUBLIC_ 사용
  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'naggu1999@gmail.com'

  useEffect(() => {
    if (authLoading) return
    
    if (!user || user.email !== ADMIN_EMAIL) {
      setIsAdmin(false)
      setLoading(false) // 비관리자인 경우에도 로딩 종료
    } else {
      setIsAdmin(true)
      loadData()
    }
  }, [user, authLoading, ADMIN_EMAIL])

  const loadData = async (targetPage = page) => {
    setLoading(true)
    try {
      const auth = { uid: user?.uid, email: user?.email }

      const [statsRes, listRes] = await Promise.all([
        fetch('/api/admin/stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(auth)
        }),
        fetch('/api/admin/summaries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...auth, search, page: targetPage })
        })
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

  const goToPage = (newPage: number) => {
    setPage(newPage)
    loadData(newPage)
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`[영구 삭제] 정말로 이 요약을 삭제하시겠습니까?\n제목: ${title}\n데이터베이스에서 완전히 사라집니다.`)) return

    setDeletingId(id)
    try {
      const res = await fetch('/api/admin/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user?.uid, email: user?.email, id })
      })

      if (res.ok) {
        setSummaries(prev => prev.filter(s => s.id !== id))
        // 통계 갱신
        loadData()
      } else {
        alert('삭제에 실패했습니다.')
      }
    } catch {
      alert('오류가 발생했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#1a1918] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#1a1918] flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-4xl mb-4">🚫</h1>
        <h2 className="text-xl text-white font-bold mb-2">접근 권한이 없습니다</h2>
        <p className="text-gray-400 mb-6">관리자 계정으로 로그인해 주세요.</p>
        <Link href="/" className="px-6 py-2 bg-orange-500 text-white rounded-xl">홈으로 이동</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1a1918] text-white font-sans">
      <Header title="🔧 관리자 대시보드" />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 통계 섹션 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-gradient-to-br from-[#2a2826] to-[#1e1d1b] p-5 rounded-[24px] border border-white/5 shadow-xl">
            <p className="text-gray-400 text-[11px] mb-1">오늘 분석된 영상</p>
            <h3 className="text-2xl font-black text-orange-500">{stats?.todaySummaries ?? 0} <span className="text-[10px] font-normal text-gray-500">건</span></h3>
          </div>
          <div className="bg-gradient-to-br from-[#2a2826] to-[#1e1d1b] p-5 rounded-[24px] border border-white/5 shadow-xl">
            <p className="text-gray-400 text-[11px] mb-1">전체 분석(캐시)</p>
            <h3 className="text-2xl font-black text-white">{stats?.totalSummaries ?? 0} <span className="text-[10px] font-normal text-gray-500">건</span></h3>
          </div>
          <div className="bg-gradient-to-br from-[#2a2826] to-[#1e1d1b] p-5 rounded-[24px] border border-white/5 shadow-xl">
            <p className="text-gray-400 text-[11px] mb-1">유저 저장됨</p>
            <h3 className="text-2xl font-black text-blue-400">{stats?.totalSaved ?? 0} <span className="text-[10px] font-normal text-gray-500">건</span></h3>
          </div>
          <div className="bg-gradient-to-br from-[#2a2826] to-[#1e1d1b] p-5 rounded-[24px] border border-white/5 shadow-xl">
            <p className="text-gray-400 text-[11px] mb-1">누적 가입 유저</p>
            <h3 className="text-2xl font-black text-emerald-400">{stats?.totalUsers ?? 0} <span className="text-[10px] font-normal text-gray-500">명</span></h3>
          </div>
        </div>

        {/* 리스트 관리 섹션 */}
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
                {summaries.map((s) => (
                  <tr key={s.id} className="group hover:bg-white/[0.01] transition-colors">
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-3">
                        <img src={s.thumbnail} className="w-20 aspect-video rounded-lg object-cover bg-gray-800 border border-white/5 ring-1 ring-black/50" alt="" />
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
                      {s.isSaved ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20">
                          저장됨
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] bg-zinc-500/10 text-zinc-500 border border-zinc-500/20">
                          캐시만 존재
                        </span>
                      )}
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link 
                          href={`/result/${s.originalId || s.id}`} 
                          className="p-2.5 hover:bg-white/10 rounded-xl transition-colors text-gray-400"
                          title="상세 보기"
                        >
                          👁️
                        </Link>
                        <button
                          onClick={() => handleDelete(s.id, s.title)}
                          disabled={deletingId === s.id}
                          className="p-2.5 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-colors text-gray-400 disabled:opacity-50"
                          title="캐시 초기화 (데이터 삭제)"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {summaries.length === 0 && (
            <div className="py-20 text-center text-gray-500">
              데이터가 없습니다.
            </div>
          )}

          {/* 페이지네이션 */}
          {(page > 1 || hasMore) && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page === 1 || loading}
                className="px-4 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← 이전
              </button>
              <span className="text-xs text-gray-500">{page} 페이지</span>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={!hasMore || loading}
                className="px-4 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                다음 →
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
