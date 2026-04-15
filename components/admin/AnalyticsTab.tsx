'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts'

interface AnalyticsData {
  dailySignups: { date: string; count: number; cumulative: number }[]
  dailyVideos: { date: string; count: number }[]
  dailySaved: { date: string; count: number }[]
  kpi: {
    totalUsers: number
    totalVideos: number
    totalSaved: number
    saveRate: number
    avgVideosPerUser: number
    newUsersLast30: number
    newVideosLast30: number
    last7Signups: number
    last7Videos: number
  }
  roleBreakdown: { teacher: number; student: number; general: number }
}

const COLORS = {
  orange: '#f97316',
  emerald: '#10b981',
  blue: '#3b82f6',
  purple: '#a855f7',
  zinc: '#71717a',
}

function shortDate(d: string) {
  const [, m, day] = d.split('-')
  return `${parseInt(m)}/${parseInt(day)}`
}

function KpiCard({
  label, value, unit, sub, color, icon,
}: {
  label: string; value: number | string; unit?: string; sub?: string; color: string; icon: string
}) {
  return (
    <div className="bg-gradient-to-br from-[#2a2826] to-[#1e1d1b] rounded-2xl border border-white/5 p-5 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-[11px]">{label}</p>
        <span className="text-lg">{icon}</span>
      </div>
      <p className={`text-2xl font-black ${color}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
        {unit && <span className="text-xs font-normal text-gray-500 ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-[10px] text-gray-500">{sub}</p>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1c1a18] border border-white/10 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <span className="font-bold text-white">{p.value}</span></p>
      ))}
    </div>
  )
}

export default function AnalyticsTab({ getAuthHeader }: { getAuthHeader: () => Promise<Record<string, string>> }) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const headers = await getAuthHeader()
        const res = await fetch('/api/admin/analytics', { method: 'POST', headers, body: JSON.stringify({}) })
        if (!res.ok) throw new Error(`${res.status}`)
        setData(await res.json())
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-500" />
    </div>
  )
  if (error) return <div className="py-16 text-center text-red-400">데이터 로드 실패: {error}</div>
  if (!data) return null

  const { kpi, dailySignups, dailyVideos, dailySaved, roleBreakdown } = data

  // 날짜 레이블 간격 (30일 중 7개만 표시)
  const tickInterval = 4
  const combinedDaily = dailySignups.map((s, i) => ({
    date: shortDate(s.date),
    신규가입: s.count,
    누적가입: s.cumulative,
    영상분석: dailyVideos[i]?.count ?? 0,
    저장: dailySaved[i]?.count ?? 0,
  }))

  const pieData = [
    { name: '일반', value: roleBreakdown.general || 0, color: COLORS.zinc },
    { name: '선생님', value: roleBreakdown.teacher || 0, color: COLORS.emerald },
    { name: '학생', value: roleBreakdown.student || 0, color: COLORS.blue },
  ].filter(d => d.value > 0)

  return (
    <div className="space-y-6">

      {/* ── KPI 카드 ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="누적 가입 유저" value={kpi.totalUsers} unit="명" icon="👥" color="text-white"
          sub={`최근 30일 +${kpi.newUsersLast30}명`} />
        <KpiCard label="전체 영상 분석" value={kpi.totalVideos} unit="건" icon="🎬" color="text-orange-400"
          sub={`최근 30일 +${kpi.newVideosLast30}건`} />
        <KpiCard label="유저 저장률" value={`${kpi.saveRate}%`} icon="📌" color="text-emerald-400"
          sub={`저장 ${kpi.totalSaved.toLocaleString()}건`} />
        <KpiCard label="유저당 평균 분석" value={kpi.avgVideosPerUser} unit="건" icon="📊" color="text-blue-400"
          sub="전체 기간 기준" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="이번 주 신규 가입" value={kpi.last7Signups} unit="명" icon="🌱" color="text-emerald-400" />
        <KpiCard label="이번 주 영상 분석" value={kpi.last7Videos} unit="건" icon="⚡" color="text-orange-400" />
        <KpiCard label="선생님 계정" value={roleBreakdown.teacher} unit="명" icon="🏫" color="text-emerald-400"
          sub={`학생 ${roleBreakdown.student}명`} />
        <KpiCard label="EdTech 전환율" value={kpi.totalUsers > 0 ? Math.round((roleBreakdown.teacher + roleBreakdown.student) / kpi.totalUsers * 100) : 0}
          unit="%" icon="🎓" color="text-purple-400" sub="교육 기능 사용 비율" />
      </div>

      {/* ── 일별 영상 분석 + 저장 Bar ── */}
      <div className="bg-[#23211f] rounded-[28px] border border-white/5 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-white font-bold">일별 영상 분석 현황</h3>
            <p className="text-gray-500 text-xs mt-0.5">최근 30일 · 영상 분석 수 및 저장 수</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-500 inline-block" />분석</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />저장</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={combinedDaily} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} tickLine={false} axisLine={false}
              interval={tickInterval} />
            <YAxis tick={{ fill: '#71717a', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="영상분석" fill={COLORS.orange} radius={[3, 3, 0, 0]} maxBarSize={20} />
            <Bar dataKey="저장" fill={COLORS.emerald} radius={[3, 3, 0, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── 신규 가입자 Area + 누적 Line ── */}
      <div className="bg-[#23211f] rounded-[28px] border border-white/5 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-white font-bold">유저 성장 추이</h3>
            <p className="text-gray-500 text-xs mt-0.5">최근 30일 · 일별 신규 가입 및 누적 가입자</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-blue-400 inline-block" />신규</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-orange-400 inline-block" />누적</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={combinedDaily} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.25} />
                <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gOrange" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.orange} stopOpacity={0.2} />
                <stop offset="95%" stopColor={COLORS.orange} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 10 }} tickLine={false} axisLine={false}
              interval={tickInterval} />
            <YAxis tick={{ fill: '#71717a', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="신규가입" stroke={COLORS.blue} strokeWidth={2}
              fill="url(#gBlue)" dot={false} />
            <Area type="monotone" dataKey="누적가입" stroke={COLORS.orange} strokeWidth={2}
              fill="url(#gOrange)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── 회원 구성 파이 + 핵심 지표 ── */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* 파이차트 */}
        <div className="bg-[#23211f] rounded-[28px] border border-white/5 p-6">
          <h3 className="text-white font-bold mb-1">회원 역할 분포</h3>
          <p className="text-gray-500 text-xs mb-4">최근 30일 신규 가입 기준</p>
          {pieData.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                    paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-3">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-gray-400 text-sm">{d.name}</span>
                    <span className="text-white font-bold text-sm ml-auto">{d.value}명</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-500 text-sm">데이터 없음</div>
          )}
        </div>

        {/* 투자자용 핵심 지표 */}
        <div className="bg-[#23211f] rounded-[28px] border border-white/5 p-6 flex flex-col gap-3">
          <h3 className="text-white font-bold mb-1">📈 투자 핵심 지표</h3>
          {[
            {
              label: 'Total Analyzed Videos',
              value: kpi.totalVideos.toLocaleString(),
              desc: '누적 AI 영상 분석 건수',
              color: 'text-orange-400',
            },
            {
              label: 'Content Save Rate',
              value: `${kpi.saveRate}%`,
              desc: '분석 후 라이브러리 저장 비율',
              color: kpi.saveRate >= 30 ? 'text-emerald-400' : 'text-yellow-400',
            },
            {
              label: 'Avg. Videos / User',
              value: `${kpi.avgVideosPerUser}건`,
              desc: '유저당 평균 분석 수 (활성도)',
              color: 'text-blue-400',
            },
            {
              label: 'EdTech Adoption',
              value: `${kpi.totalUsers > 0 ? Math.round((roleBreakdown.teacher + roleBreakdown.student) / kpi.totalUsers * 100) : 0}%`,
              desc: '교사·학생 계정 비율',
              color: 'text-purple-400',
            },
            {
              label: 'W/W Growth (Users)',
              value: `+${kpi.last7Signups}명`,
              desc: '최근 7일 신규 가입',
              color: 'text-emerald-400',
            },
          ].map(m => (
            <div key={m.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div>
                <p className="text-gray-400 text-[10px] font-mono uppercase tracking-wider">{m.label}</p>
                <p className="text-gray-500 text-[9px]">{m.desc}</p>
              </div>
              <span className={`text-lg font-black ${m.color}`}>{m.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 푸터 노트 ── */}
      <p className="text-center text-gray-600 text-[10px] pb-4">
        * 최근 30일 기준 · updatedAt 필드 기준 집계 · 실시간 반영
      </p>
    </div>
  )
}
