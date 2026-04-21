import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '선생님을 위한 유튜브 클래스룸 — 영상 워크시트 자동 생성·학생 관리 | 쏙튜브',
  description: '유튜브 영상을 수업 자료로 만드세요. AI 워크시트 자동 생성, 클래스 코드 배포, 학생 학습 현황 관리까지. 교사·강사를 위한 유튜브 에듀테크 도구.',
  keywords: ['유튜브 교육 활용', '유튜브 수업 자료', '클래스룸 유튜브', '교사 유튜브 워크시트', '유튜브 교육 도구', '수업용 유튜브 정리', '교육용 영상 요약', '유튜브 에듀테크', '학생 학습 관리', '유튜브 수업 활용법', '영어 수업 유튜브 자료', '유튜브 플립러닝', 'CEFR 영어 수업 자료', '유튜브 워크시트 자동화'],
}

export default function ClassroomGuidePage() {
  return (
    <article className="flex flex-col gap-10 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-[#75716e] text-xs mb-4">
          <Link href="/guide" className="hover:text-white transition-colors">사용설명서</Link>
          <span>›</span>
          <span className="text-white">클래스룸</span>
        </div>
        <h1 className="text-2xl font-black text-white mb-3">🎓 선생님, 유튜브 영상이 10초 만에 수업 워크시트가 됩니다</h1>
        <p className="text-[#a4a09c] text-sm leading-relaxed">
          유튜브에는 훌륭한 교육 영상이 넘쳐나지만 수업에 활용하려면 자료 만들기가 번거립니다. 쏙튜브 <strong className="text-white">클래스룸</strong>은 유튜브 영상을 AI 워크시트로 자동 변환하고, 클래스 코드 하나로 학생들에게 배포하며, 누가 어떤 자료를 언제 학습했는지 대시보드로 관리할 수 있는 교육용 도구입니다. 교사·강사·튜터 모두 활용할 수 있습니다.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white border-l-2 border-lime-500 pl-3">이런 선생님·강사님께 필요합니다</h2>
        <ul className="flex flex-col gap-2">
          {[
            '영어 수업에 TED·BBC 영상을 활용하고 싶은 영어 교사',
            '유튜브 강의 영상을 온라인 수업 자료로 정리하는 학원 강사',
            '플립러닝(Flipped Learning)을 도입하려는 중·고등학교 선생님',
            '학생들에게 영상 시청 후 과제를 제출받고 싶은 교수·강사',
            '학생 학습 이력을 체계적으로 관리하고 싶은 교육 기관 담당자',
          ].map(t => (
            <li key={t} className="flex items-start gap-2 text-[#a4a09c] text-sm">
              <span className="text-lime-400 mt-0.5 shrink-0">✓</span>{t}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-white border-l-2 border-lime-500 pl-3">클래스룸 기능 상세</h2>
        <div className="flex flex-col gap-3">
          {[
            { icon: '🏫', title: '클래스 개설 & 코드 배포', desc: '클래스 코드를 생성해 카카오톡·이메일로 학생에게 공유하면 즉시 수업 환경이 만들어집니다. 별도 앱 설치 없이 스마트폰 브라우저에서 접속 가능합니다.' },
            { icon: '📄', title: 'AI 워크시트 자동 생성', desc: '유튜브 영상을 요약하면 학습 목표에 맞는 빈칸 채우기·핵심 질문·토론 포인트가 포함된 워크시트가 자동 생성됩니다. 영어 영상은 CEFR A1~C2 레벨에 맞게 조정됩니다.' },
            { icon: '📊', title: '학습 현황 대시보드', desc: '어떤 학생이 어떤 자료를 언제 열람했는지, 워크시트 완료율이 얼마인지 한눈에 확인할 수 있습니다. 참여하지 않은 학생에게 알림을 보낼 수도 있습니다.' },
            { icon: '📱', title: '학생 모바일 접속', desc: '학생은 별도 회원 가입·설치 없이 클래스 코드만으로 스마트폰에서 학습 자료에 접근합니다. iOS·Android 모두 지원합니다.' },
          ].map(item => (
            <div key={item.title} className="flex gap-4 bg-[#32302e] rounded-2xl p-4">
              <span className="text-2xl shrink-0">{item.icon}</span>
              <div>
                <p className="text-white font-semibold text-sm">{item.title}</p>
                <p className="text-[#75716e] text-xs mt-1 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-white border-l-2 border-lime-500 pl-3">수업 활용 시나리오</h2>
        <div className="flex flex-col gap-3">
          {[
            { icon: '🔤', title: '영어 수업 — TED 영상 워크시트', desc: 'TED 강연을 CEFR 레벨에 맞게 요약해 핵심 어휘·표현·토론 질문이 담긴 워크시트로 배포. 예습 과제로 제공하면 수업 시간을 토론에 집중할 수 있습니다.' },
            { icon: '📰', title: '사회·역사 — 뉴스 5W1H 분석', desc: 'KBS·JTBC 뉴스 유튜브를 AI가 5W1H 형식으로 정리한 자료를 배포. 학생들이 사건의 맥락을 구조적으로 파악하는 데 도움이 됩니다.' },
            { icon: '🍳', title: '가정·직업 — 실습 영상 정리', desc: '요리·목공·코딩 실습 유튜브에서 단계별 과정을 추출해 체크리스트·실습 가이드로 변환합니다. 학생들이 영상을 멈추지 않고 실습할 수 있습니다.' },
          ].map(item => (
            <div key={item.title} className="flex gap-3 bg-[#32302e] rounded-2xl p-4">
              <span className="text-xl shrink-0">{item.icon}</span>
              <div>
                <p className="text-white font-semibold text-sm">{item.title}</p>
                <p className="text-[#75716e] text-xs mt-1 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-lime-500/10 border border-lime-500/20 rounded-2xl p-5">
        <h2 className="text-lime-400 font-bold text-sm mb-3">클래스룸 추천 과목</h2>
        <div className="grid grid-cols-3 gap-2">
          {['영어', '사회', '역사', '과학', '경제', '도덕', '가정', '직업', '정보·코딩'].map(t => (
            <div key={t} className="bg-[#32302e] rounded-lg px-2 py-1.5 text-[#a4a09c] text-xs text-center">{t}</div>
          ))}
        </div>
        <p className="text-[#4a4745] text-xs mt-3">유튜브 자막이 있는 모든 교육 영상에서 워크시트 생성 가능합니다.</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white border-l-2 border-lime-500 pl-3">자주 묻는 질문</h2>
        <div className="flex flex-col gap-2">
          {[
            { q: '학생 수 제한이 있나요?', a: '기본 플랜에서 클래스당 학생 수 제한이 있습니다. 학원·학교 단위의 대규모 이용은 교육 기관 플랜을 별도 문의해주세요.' },
            { q: 'CEFR 레벨 조정은 어떻게 하나요?', a: '워크시트 생성 시 대상 학생의 영어 레벨을 A1~C2 중 선택하면 어휘 난이도·질문 수준이 자동으로 조정됩니다.' },
          ].map(item => (
            <div key={item.q} className="bg-[#32302e] rounded-xl p-4">
              <p className="text-white text-sm font-semibold mb-1">Q. {item.q}</p>
              <p className="text-[#75716e] text-xs leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3 pt-2 border-t border-white/5">
        <Link href="/mypage" className="px-5 py-2.5 bg-lime-700 hover:bg-lime-600 text-white font-bold text-sm rounded-xl transition-colors">
          클래스룸 시작하기
        </Link>
        <Link href="/guide/square" className="text-[#75716e] text-sm hover:text-white transition-colors">
          ← 스퀘어 활용법
        </Link>
      </div>
    </article>
  )
}
