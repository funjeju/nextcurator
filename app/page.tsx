import UrlInput from '@/components/home/UrlInput'

export default function Home() {
  return (
    <main className="min-h-screen bg-[#252423] flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden font-sans">
      {/* Soft warm background glows mimicking the reference */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-orange-500/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-10 w-[600px] h-[600px] bg-amber-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="flex flex-col items-center gap-10 w-full max-w-3xl relative z-10">
        {/* Logo & Title */}
        <div className="text-center flex flex-col gap-3">
          <h1 className="text-5xl md:text-[3.5rem] font-bold tracking-tight text-white mb-2">
            🎬 Next Curator
          </h1>
          <p className="text-[#a4a09c] text-lg font-medium tracking-wide">
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
  )
}
