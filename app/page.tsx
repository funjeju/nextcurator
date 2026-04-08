import UrlInput from '@/components/home/UrlInput'
import Header from '@/components/common/Header'

export default function Home() {
  return (
    <div className="min-h-screen bg-[#252423] font-sans">
      <Header />
      <main className="flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Soft warm background glows mimicking the reference */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-orange-500/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-10 w-[600px] h-[600px] bg-amber-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="flex flex-col items-center gap-6 w-full max-w-3xl relative z-10">
        {/* Title: 모바일에서는 헤더 로고가 있으므로 숨김 */}
        <div className="text-center flex flex-col gap-2">
          <h1 className="hidden md:block text-[3.5rem] font-bold tracking-tight text-white">
            🎬 Next Curator
          </h1>
          <p className="text-[#a4a09c] text-base md:text-lg font-medium tracking-wide">
            가장 스마트한 유튜브 저장소
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
