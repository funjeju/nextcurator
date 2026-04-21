import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '쏙튜브 요금제 — 무료 · 유료 플랜 비교',
  description: '쏙튜브 무료 플랜과 유료 플랜을 비교합니다. 가입 없이 체험, 무제한 저장, 클래스룸 등 플랜별 기능 안내.',
  keywords: ['쏙튜브 요금제', '쏙튜브 가격', '유튜브 AI 요약 무료', '쏙튜브 유료 플랜'],
}

export default function PricingGuidePage() {
  return (
    <article className="flex flex-col gap-8 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-[#75716e] text-xs mb-4">
          <Link href="/guide" className="hover:text-white transition-colors">사용설명서</Link>
          <span>›</span>
          <span className="text-white">요금제 안내</span>
        </div>
        <h1 className="text-2xl font-black text-white mb-3">💳 요금제 안내</h1>
        <p className="text-[#a4a09c] text-sm leading-relaxed">
          쏙튜브는 회원가입 없이도 체험할 수 있습니다. 더 많이 활용할수록 로그인 플랜이 유리합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            name: '비회원',
            price: '무료',
            color: 'border-white/10',
            features: ['10분 미만 영상 1회', '요약 결과 확인', '저장 불가'],
            cta: null,
          },
          {
            name: '무료 회원',
            price: '0원',
            color: 'border-orange-500/30',
            highlight: true,
            features: ['영상 길이 제한 없음', '라이브러리 무제한 저장', '스퀘어 공유', 'AI 대화 검색', '재생목록 가져오기'],
            cta: '구글로 무료 가입',
            ctaHref: '/',
          },
          {
            name: '선생님 (Pro)',
            price: '문의',
            color: 'border-lime-500/30',
            features: ['무료 회원 모든 기능', '클래스룸 개설', '학생 학습 관리', '워크시트 자동 배포', '우선 지원'],
            cta: '문의하기',
            ctaHref: 'mailto:naggu1999@gmail.com',
          },
        ].map(plan => (
          <div key={plan.name} className={`bg-[#32302e] rounded-2xl p-5 border ${plan.color} flex flex-col gap-3`}>
            <div>
              <p className="text-[#75716e] text-xs">{plan.name}</p>
              <p className="text-white font-black text-xl mt-0.5">{plan.price}</p>
            </div>
            <ul className="flex flex-col gap-1.5 flex-1">
              {plan.features.map(f => (
                <li key={f} className="text-[#a4a09c] text-xs flex items-start gap-1.5">
                  <span className="text-orange-400 shrink-0">✓</span>{f}
                </li>
              ))}
            </ul>
            {plan.cta && (
              <Link
                href={plan.ctaHref!}
                className="w-full py-2 bg-orange-500 hover:bg-orange-400 text-white font-bold text-xs rounded-xl text-center transition-colors"
              >
                {plan.cta}
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-white/5">
        <Link href="/guide" className="text-[#75716e] text-sm hover:text-white transition-colors">
          ← 사용설명서 홈으로
        </Link>
      </div>
    </article>
  )
}
