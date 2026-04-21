import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '선생님을 위한 유튜브 클래스룸 — 쏙튜브',
  description: '유튜브 영상을 학습 자료로 활용하세요. 워크시트 자동 생성, 학생 학습 현황 관리, 클래스 코드로 손쉬운 배포.',
  keywords: ['유튜브 교육 활용', '유튜브 수업 자료', '클래스룸 유튜브', '교사 유튜브 워크시트'],
}

export default function ClassroomGuidePage() {
  return (
    <article className="flex flex-col gap-8 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-[#75716e] text-xs mb-4">
          <Link href="/guide" className="hover:text-white transition-colors">사용설명서</Link>
          <span>›</span>
          <span className="text-white">클래스룸</span>
        </div>
        <h1 className="text-2xl font-black text-white mb-3">🎓 선생님, 유튜브 영상이 워크시트가 됩니다</h1>
        <p className="text-[#a4a09c] text-sm leading-relaxed">
          유튜브 영상을 수업에 활용하고 싶지만 자료 만들기가 번거로웠나요? 쏙튜브 클래스룸으로 <strong className="text-white">영상 요약 · 워크시트 배포 · 학생 학습 관리</strong>를 한번에 처리하세요.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-3">
        {[
          { icon: '🏫', title: '클래스 개설', desc: '클래스 코드를 생성해 학생들에게 공유하면 즉시 수업 환경이 만들어집니다.' },
          { icon: '📄', title: '워크시트 자동 생성', desc: '유튜브 영상을 요약하면 학습 목표에 맞는 워크시트가 자동 생성됩니다. 영어 영상은 CEFR 레벨에 맞춰 조정됩니다.' },
          { icon: '📊', title: '학습 현황 대시보드', desc: '어떤 학생이 어떤 자료를 언제 학습했는지 한눈에 확인할 수 있습니다.' },
          { icon: '📱', title: '학생 모바일 접속', desc: '학생은 별도 설치 없이 클래스 코드만으로 스마트폰에서 학습 자료에 접근합니다.' },
        ].map(item => (
          <div key={item.title} className="flex gap-4 bg-[#32302e] rounded-2xl p-4">
            <span className="text-2xl shrink-0">{item.icon}</span>
            <div>
              <p className="text-white font-semibold text-sm">{item.title}</p>
              <p className="text-[#75716e] text-xs mt-1">{item.desc}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="bg-lime-500/10 border border-lime-500/20 rounded-2xl p-5">
        <h2 className="text-lime-400 font-bold text-sm mb-2">추천 과목</h2>
        <div className="grid grid-cols-3 gap-2">
          {['영어', '사회', '역사', '과학', '경제', '도덕'].map(t => (
            <div key={t} className="bg-[#32302e] rounded-lg px-2 py-1.5 text-[#a4a09c] text-xs text-center">{t}</div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3 pt-2 border-t border-white/5">
        <Link href="/mypage" className="px-5 py-2.5 bg-lime-700 hover:bg-lime-600 text-white font-bold text-sm rounded-xl transition-colors">
          클래스룸 시작하기
        </Link>
        <Link href="/guide/pricing" className="text-[#75716e] text-sm hover:text-white transition-colors">
          요금제 안내 →
        </Link>
      </div>
    </article>
  )
}
