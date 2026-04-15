import UrlInput from '@/components/home/UrlInput'
import Header from '@/components/common/Header'

export default function Home() {
  return (
    <div className="min-h-screen bg-[#252423] font-sans">
      <Header />
      <main className="flex flex-col items-center justify-center px-4 py-3 relative overflow-hidden">
      {/* Soft warm background glows mimicking the reference */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-orange-500/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-10 w-[600px] h-[600px] bg-amber-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="flex flex-col items-center gap-6 w-full max-w-3xl relative z-10">
        {/* Title: 모바일에서는 헤더 로고가 있으므로 숨김 */}
        <div className="text-center flex flex-col gap-3">
          {/* 데스크탑: 풀 로고 */}
          <div className="hidden md:flex flex-col items-center gap-2">
            <h1 className="text-[3.2rem] font-black tracking-tighter text-white leading-none">
              <span className="text-orange-400">SSOK</span>TUBE
            </h1>
            <p className="text-xl font-bold text-white/90 tracking-wide">
              유튜브를 <span className="text-orange-400">쏙</span>, 내 지식은 <span className="text-emerald-400">쑥</span>
            </p>
          </div>
          {/* 모바일: 슬로건만 */}
          <p className="md:hidden text-base font-bold text-white/90 tracking-wide">
            유튜브를 <span className="text-orange-400">쏙</span>, 내 지식은 <span className="text-emerald-400">쑥</span>
          </p>
        </div>

        <UrlInput />

        {/* Footer hint */}
        <p className="text-[#75716e] text-sm font-medium mt-2">
          자막이 있는 YouTube 영상이라면 무엇이든 분석할 수 있습니다.
        </p>
      </div>
      </main>
    </div>
  )
}
