'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/providers/AuthProvider'
import { useRouter, useParams } from 'next/navigation'
import Header from '@/components/common/Header'
import Link from 'next/link'
import { formatRelativeDate } from '@/lib/formatDate'
import {
  getClass, getClassStudents, getClassLogs, summarizeStudentLogs,
  setMasterFolder, pushVideoToClass, ClassRoom, ActivityLog
} from '@/lib/classroom'
import { getUserFolders, getSavedSummariesByFolder } from '@/lib/db'

interface StudentRow {
  uid: string
  studentName: string
  displayName: string
  loginCount: number
  metaComplete: number
  metaConfused: number
  metaUnknown: number
  quizAttempts: number
  quizCorrect: number
  lastActive: any
}

export default function ClassDashboard() {
  const { user, userProfile, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const classCode = (params.classCode as string)?.toUpperCase()

  const [classroom, setClassroom] = useState<ClassRoom | null>(null)
  const [students, setStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'students' | 'folders' | 'setup'>('students')
  const [folders, setFolders] = useState<any[]>([])
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(null)
  const [studentLogs, setStudentLogs] = useState<ActivityLog[]>([])
  const [pushingFolder, setPushingFolder] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadData = useCallback(async () => {
    if (!user || !classCode) return
    setLoading(true)
    try {
      // logs는 실패해도 대시보드는 표시
      const [cls, studentList, userFolders] = await Promise.all([
        getClass(classCode),
        getClassStudents(classCode).catch(() => []),
        getUserFolders(user.uid).catch(() => []),
      ])

      if (!cls) {
        // 방금 생성된 클래스라면 짧게 재시도
        await new Promise(r => setTimeout(r, 1000))
        const retry = await getClass(classCode).catch(() => null)
        if (!retry || retry.teacherId !== user.uid) {
          router.push('/')
          return
        }
        setClassroom(retry)
        setFolders(userFolders)
        setStudents([])
        return
      }

      if (cls.teacherId !== user.uid) {
        router.push('/')
        return
      }

      setClassroom(cls)
      setFolders(userFolders)

      // 로그 조회 (실패해도 학생 목록은 표시)
      const logs = await getClassLogs(classCode, 1000).catch(() => [])

      // 학생별 활동 집계
      const rows: StudentRow[] = studentList.map((s: any) => {
        const sLogs = logs.filter((l: ActivityLog) => l.studentId === s.uid)
        const summary = summarizeStudentLogs(sLogs)
        return {
          uid: s.uid,
          studentName: s.studentName || s.displayName || '미상',
          displayName: s.displayName || s.studentName || '미상',
          ...summary,
        }
      })

      rows.sort((a, b) => {
        const aT = a.lastActive?.toMillis?.() ?? 0
        const bT = b.lastActive?.toMillis?.() ?? 0
        return bT - aT
      })

      setStudents(rows)
    } catch (e) {
      console.error('[ClassDashboard] loadData error:', e)
    } finally {
      setLoading(false)
    }
  }, [user, classCode, router])

  useEffect(() => {
    if (!authLoading) loadData()
  }, [authLoading, loadData])

  const handleSetMasterFolder = async (folderId: string) => {
    if (!classCode) return
    await setMasterFolder(classCode, folderId)
    setClassroom(prev => prev ? { ...prev, masterFolderId: folderId } : prev)
    alert('기준 폴더가 설정됐습니다. 이제 신규 학생이 참여하면 이 폴더의 영상이 자동 배포됩니다.')
  }

  const handlePushToAll = async (folderId: string) => {
    if (!classroom || !user) return
    if (!confirm('현재 이 폴더의 모든 영상을 기존 학생 전체에게 배포하시겠습니까?')) return
    setPushingFolder(true)
    try {
      const items = await getSavedSummariesByFolder(user.uid, folderId)
      for (const item of items) {
        await pushVideoToClass(classCode, folderId, user.uid, userProfile?.displayName || '선생님', item)
      }
      alert(`${items.length}개 영상이 ${students.length}명에게 배포됐습니다.`)
    } catch (e: any) {
      alert('배포 중 오류: ' + e.message)
    } finally {
      setPushingFolder(false)
    }
  }

  const openStudentDetail = async (student: StudentRow) => {
    setSelectedStudent(student)
    const logs = await getClassLogs(classCode, 1000)
    setStudentLogs(logs.filter(l => l.studentId === student.uid))
  }

  const copyCode = () => {
    navigator.clipboard.writeText(classCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#1a1918] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500" />
      </div>
    )
  }

  if (!classroom) return (
    <div className="min-h-screen bg-[#1a1918] flex flex-col items-center justify-center gap-3 text-center px-4">
      <p className="text-4xl">🏫</p>
      <p className="text-white font-bold">클래스를 불러올 수 없습니다.</p>
      <p className="text-gray-500 text-sm">클래스 코드 <span className="font-mono text-orange-400">{classCode}</span>가 존재하지 않거나 접근 권한이 없습니다.</p>
      <Link href="/mypage" className="mt-4 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm transition-colors">마이페이지로 이동</Link>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#1a1918] text-white">
      <Header title="🏫 클래스 대시보드" />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* 클래스 헤더 */}
        <div className="bg-gradient-to-br from-[#2a2826] to-[#1e1d1b] rounded-[28px] border border-white/5 p-6 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black">{classroom.schoolName} {classroom.grade}학년 {classroom.classNum}반</h1>
            <p className="text-gray-400 text-sm mt-1">{students.length}명 등록</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-[#1a1918] rounded-2xl px-5 py-3 border border-white/10">
              <p className="text-[10px] text-gray-500 mb-0.5">클래스 코드</p>
              <p className="text-xl font-black font-mono tracking-widest text-orange-400">{classCode}</p>
            </div>
            <button
              onClick={copyCode}
              className="px-4 py-3 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 rounded-2xl text-orange-400 text-sm font-bold transition-colors"
            >
              {copied ? '복사됨 ✓' : '코드 복사'}
            </button>
          </div>
        </div>

        {/* 요약 통계 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="등록 학생" value={students.length} unit="명" color="text-white" />
          <StatCard label="오늘 접속" value={students.filter(s => {
            const t = s.lastActive?.toMillis?.()
            return t && (Date.now() - t) < 86400000
          }).length} unit="명" color="text-emerald-400" />
          <StatCard label="완전이해 응답" value={students.reduce((a, s) => a + s.metaComplete, 0)} unit="건" color="text-blue-400" />
          <StatCard label="도움 필요" value={students.reduce((a, s) => a + s.metaUnknown, 0)} unit="건" color="text-red-400" />
        </div>

        {/* 탭 */}
        <div className="flex gap-2 mb-6">
          {(['students', 'folders', 'setup'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-xl text-sm font-bold transition-colors ${activeTab === tab ? 'bg-orange-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
            >
              {tab === 'students' ? '👥 학생 현황' : tab === 'folders' ? '📁 수업자료 관리' : '⚙️ 클래스 설정'}
            </button>
          ))}
        </div>

        {/* 학생 현황 탭 */}
        {activeTab === 'students' && (
          <div className="bg-[#23211f] rounded-[28px] border border-white/10 p-6">
            {students.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-4xl mb-3">👥</p>
                <p className="text-gray-400">아직 참여한 학생이 없습니다.</p>
                <p className="text-gray-600 text-sm mt-1">클래스 코드 <span className="font-mono text-orange-400">{classCode}</span>를 학생들에게 공유하세요.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-gray-500 border-b border-white/5">
                    <tr>
                      <th className="pb-3 font-medium">이름</th>
                      <th className="pb-3 font-medium text-center">접속</th>
                      <th className="pb-3 font-medium text-center">✅완전이해</th>
                      <th className="pb-3 font-medium text-center">🤔알쏭달쏭</th>
                      <th className="pb-3 font-medium text-center">❓전혀모름</th>
                      <th className="pb-3 font-medium text-center">퀴즈정답률</th>
                      <th className="pb-3 font-medium">마지막 활동</th>
                      <th className="pb-3 font-medium text-right">상세</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {students.map(s => (
                      <tr key={s.uid} className="hover:bg-white/[0.02]">
                        <td className="py-3 font-bold text-white">{s.studentName}</td>
                        <td className="py-3 text-center text-gray-300">{s.loginCount}</td>
                        <td className="py-3 text-center text-emerald-400 font-bold">{s.metaComplete}</td>
                        <td className="py-3 text-center text-yellow-400 font-bold">{s.metaConfused}</td>
                        <td className="py-3 text-center text-red-400 font-bold">{s.metaUnknown}</td>
                        <td className="py-3 text-center">
                          {s.quizAttempts > 0
                            ? <span className="text-blue-400">{Math.round(s.quizCorrect / s.quizAttempts * 100)}%</span>
                            : <span className="text-gray-600">-</span>}
                        </td>
                        <td className="py-3 text-gray-500">
                          {s.lastActive ? formatRelativeDate(s.lastActive?.toDate?.() || s.lastActive) : '없음'}
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => openStudentDetail(s)}
                            className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-gray-400"
                          >
                            보기
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 수업자료 관리 탭 */}
        {activeTab === 'folders' && (
          <div className="bg-[#23211f] rounded-[28px] border border-white/10 p-6">
            <p className="text-sm text-gray-400 mb-6">
              폴더를 <span className="text-orange-400 font-bold">기준 폴더</span>로 설정하면 이후 참여하는 학생에게 자동으로 복제됩니다.
              기존 학생에게도 즉시 배포하려면 <span className="text-blue-400">전체 배포</span> 버튼을 사용하세요.
            </p>
            {folders.length === 0 ? (
              <p className="text-gray-500 text-sm">폴더가 없습니다. 내 페이지에서 폴더를 먼저 만들어주세요.</p>
            ) : (
              <div className="space-y-3">
                {folders.map(folder => (
                  <div key={folder.id} className="flex items-center justify-between bg-[#1a1918] rounded-2xl px-5 py-4 border border-white/5">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📁</span>
                      <div>
                        <p className="font-bold text-sm">{folder.name}</p>
                        {classroom.masterFolderId === folder.id && (
                          <span className="text-[9px] text-orange-400 font-bold bg-orange-500/10 px-2 py-0.5 rounded-full">기준 폴더</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSetMasterFolder(folder.id)}
                        disabled={classroom.masterFolderId === folder.id}
                        className="px-3 py-1.5 rounded-lg text-xs bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 disabled:opacity-30 transition-colors font-bold"
                      >
                        {classroom.masterFolderId === folder.id ? '✓ 기준폴더' : '기준폴더 지정'}
                      </button>
                      <button
                        onClick={() => handlePushToAll(folder.id)}
                        disabled={pushingFolder}
                        className="px-3 py-1.5 rounded-lg text-xs bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50 transition-colors font-bold"
                      >
                        전체 배포
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 설정 탭 */}
        {activeTab === 'setup' && (
          <div className="bg-[#23211f] rounded-[28px] border border-white/10 p-6 space-y-4">
            <InfoRow label="학교명" value={classroom.schoolName} />
            <InfoRow label="학년/반" value={`${classroom.grade}학년 ${classroom.classNum}반`} />
            <InfoRow label="클래스 코드" value={classCode} highlight />
            <InfoRow label="학생 참여 링크" value={`ssoktube.com/classroom/join`} />
            <div className="pt-4">
              <p className="text-xs text-gray-500">학생들에게 클래스 코드 <span className="font-mono text-orange-400">{classCode}</span>를 알려주고 <strong>ssoktube.com/classroom/join</strong>에서 가입하도록 안내하세요.</p>
            </div>
          </div>
        )}
      </main>

      {/* 학생 상세 모달 */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setSelectedStudent(null)}>
          <div className="bg-[#23211f] rounded-[28px] border border-white/10 w-full max-w-lg max-h-[80vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black">{selectedStudent.studentName} 학생 활동 기록</h2>
              <button onClick={() => setSelectedStudent(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <MiniStat label="✅ 완전이해" value={selectedStudent.metaComplete} color="text-emerald-400" />
              <MiniStat label="🤔 알쏭달쏭" value={selectedStudent.metaConfused} color="text-yellow-400" />
              <MiniStat label="❓ 전혀모름" value={selectedStudent.metaUnknown} color="text-red-400" />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-gray-500 mb-3">최근 활동 로그</p>
              {studentLogs.length === 0
                ? <p className="text-gray-600 text-sm text-center py-8">활동 기록이 없습니다.</p>
                : studentLogs.slice(0, 30).map((log, i) => (
                  <div key={i} className="flex items-start gap-3 bg-[#1a1918] rounded-xl px-4 py-3 text-xs">
                    <span className="text-lg">{logTypeEmoji(log.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300 font-medium">{logTypeLabel(log.type, log.value)}</p>
                      {log.videoTitle && <p className="text-gray-600 truncate">{log.videoTitle}</p>}
                    </div>
                    <span className="text-gray-600 whitespace-nowrap">
                      {log.timestamp ? formatRelativeDate(log.timestamp?.toDate?.() || log.timestamp) : ''}
                    </span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className="bg-[#23211f] rounded-[20px] border border-white/5 p-4">
      <p className="text-gray-500 text-[10px] mb-1">{label}</p>
      <p className={`text-2xl font-black ${color}`}>{value} <span className="text-[10px] font-normal text-gray-600">{unit}</span></p>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-[#1a1918] rounded-2xl p-3 text-center">
      <p className="text-gray-500 text-[9px] mb-1">{label}</p>
      <p className={`text-xl font-black ${color}`}>{value}</p>
    </div>
  )
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className={`text-sm font-bold ${highlight ? 'font-mono text-orange-400 text-lg tracking-widest' : 'text-white'}`}>{value}</span>
    </div>
  )
}

function logTypeEmoji(type: string) {
  if (type === 'login') return '🔐'
  if (type === 'meta') return '🧠'
  if (type === 'quiz') return '📝'
  if (type === 'play') return '▶️'
  return '📌'
}

function logTypeLabel(type: string, value: Record<string, any>) {
  if (type === 'login') return '접속'
  if (type === 'meta') {
    const labels: Record<string, string> = { complete: '완전이해 ✅', confused: '알쏭달쏭 🤔', unknown: '전혀모름 ❓' }
    return labels[value.level] || '자기점검'
  }
  if (type === 'quiz') return value.correct ? '퀴즈 정답 ✓' : '퀴즈 오답'
  if (type === 'play') return `영상 시청 ${value.percentWatched ?? '?'}%`
  return type
}
