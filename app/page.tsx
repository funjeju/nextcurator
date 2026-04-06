import UrlInput from '@/components/home/UrlInput'

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background gradient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-900/5 rounded-full blur-3xl" />
      </div>

      <div className="flex flex-col items-center gap-10 w-full max-w-2xl relative z-10">
        {/* Logo & Title */}
        <div className="text-center flex flex-col gap-4">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="text-5xl">🎬</span>
            <h1 className="text-5xl font-black text-white tracking-tight">
              Next Curator
            </h1>
          </div>
          <p className="text-zinc-400 text-xl leading-relaxed">
            흘러가던 유튜브,<br />
            <span className="text-zinc-200 font-medium">이제 AI가 내 창고에 쌓아준다</span>
          </p>
        </div>

        <UrlInput />

        {/* Footer hint */}
        <p className="text-zinc-600 text-xs">
          자막이 있는 YouTube 영상이라면 무엇이든 OK
        </p>
      </div>
    </main>
  )
}
