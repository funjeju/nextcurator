'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const GOOGLE_CLIENT_ID = '711357873847-gk3fc4not23gmtm2ajblm2mcls6okngu.apps.googleusercontent.com'

interface YTPlaylist {
  id: string
  title: string
  itemCount: number
  thumbnail: string
}

interface YTVideo {
  videoId: string
  title: string
  thumbnail: string
  channelTitle: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (resp: { access_token?: string; error?: string }) => void
          }) => { requestAccessToken: () => void }
        }
      }
    }
  }
}

export default function YouTubeImportTab() {
  const router = useRouter()
  const [gisReady, setGisReady] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [playlists, setPlaylists] = useState<YTPlaylist[]>([])
  const [selectedPlaylist, setSelectedPlaylist] = useState<YTPlaylist | null>(null)
  const [videos, setVideos] = useState<YTVideo[]>([])
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)
  const [loadingConnect, setLoadingConnect] = useState(false)
  const [loadingVideos, setLoadingVideos] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // GIS 스크립트 로드
  useEffect(() => {
    if (document.getElementById('gis-script')) { setGisReady(true); return }
    const script = document.createElement('script')
    script.id = 'gis-script'
    script.src = 'https://accounts.google.com/gsi/client'
    script.onload = () => setGisReady(true)
    document.head.appendChild(script)
  }, [])

  const handleConnect = () => {
    if (!window.google) return
    setError(null)
    setLoadingConnect(true)

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/youtube.readonly',
      callback: async (resp) => {
        if (resp.error || !resp.access_token) {
          setError('YouTube 연동에 실패했습니다.')
          setLoadingConnect(false)
          return
        }
        try {
          await loadPlaylists(resp.access_token)
          setAccessToken(resp.access_token)
        } catch (e: any) {
          setError(e.message)
        } finally {
          setLoadingConnect(false)
        }
      },
    })
    client.requestAccessToken()
  }

  const loadPlaylists = async (token: string) => {
    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50',
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message ?? '재생목록을 불러오지 못했습니다.')
    if (!data.items?.length) throw new Error('재생목록이 없거나 가져올 수 없습니다.')
    setPlaylists(data.items.map((item: any) => ({
      id: item.id,
      title: item.snippet.title,
      itemCount: item.contentDetails.itemCount ?? 0,
      thumbnail: item.snippet.thumbnails?.medium?.url ?? '',
    })))
  }

  const loadVideos = async (playlist: YTPlaylist, pageToken?: string) => {
    if (!accessToken) return
    setLoadingVideos(true)
    setError(null)
    try {
      const params = new URLSearchParams({ part: 'snippet', playlistId: playlist.id, maxResults: '50' })
      if (pageToken) params.set('pageToken', pageToken)
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? '영상 목록을 불러오지 못했습니다.')
      const items: YTVideo[] = (data.items ?? [])
        .filter((item: any) => item.snippet.resourceId?.videoId)
        .map((item: any) => ({
          videoId: item.snippet.resourceId.videoId,
          title: item.snippet.title,
          thumbnail: item.snippet.thumbnails?.medium?.url ?? '',
          channelTitle: item.snippet.videoOwnerChannelTitle ?? '',
        }))
      setVideos(prev => pageToken ? [...prev, ...items] : items)
      setNextPageToken(data.nextPageToken ?? null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoadingVideos(false)
    }
  }

  const handleSelectPlaylist = async (playlist: YTPlaylist) => {
    setSelectedPlaylist(playlist)
    setVideos([])
    setNextPageToken(null)
    await loadVideos(playlist)
  }

  const handleDisconnect = () => {
    setAccessToken(null); setPlaylists([]); setSelectedPlaylist(null); setVideos([]); setError(null)
  }

  if (!accessToken) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        </div>
        <div className="text-center">
          <h3 className="text-white font-bold text-lg mb-2">YouTube 재생목록 가져오기</h3>
          <p className="text-[#75716e] text-sm max-w-xs leading-relaxed">저장해둔 재생목록 영상을 가져와서 AI로 빠르게 요약하세요.</p>
        </div>
        {error && <p className="text-red-400 text-sm text-center max-w-xs">{error}</p>}
        <button
          onClick={handleConnect}
          disabled={!gisReady || loadingConnect}
          className="flex items-center gap-3 px-6 py-3 bg-[#32302e] hover:bg-[#3d3a38] border border-white/10 hover:border-red-500/30 rounded-2xl transition-all group disabled:opacity-60"
        >
          {loadingConnect ? (
            <svg className="w-5 h-5 animate-spin text-[#75716e]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : (
            <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          )}
          <span className="text-white font-semibold text-sm group-hover:text-red-400 transition-colors">
            {!gisReady ? '로딩 중...' : loadingConnect ? '연결 중...' : 'YouTube 연동하기'}
          </span>
        </button>
        <p className="text-[#4a4745] text-xs">재생목록 읽기 권한만 요청합니다</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <aside className="w-full md:w-60 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold text-sm">내 재생목록</h3>
          <button onClick={handleDisconnect} className="text-[10px] text-[#75716e] hover:text-white transition-colors">연결 해제</button>
        </div>
        <div className="flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 scrollbar-none">
          {playlists.map(pl => (
            <button
              key={pl.id}
              onClick={() => handleSelectPlaylist(pl)}
              className={`text-left px-3 py-2.5 rounded-xl whitespace-nowrap md:whitespace-normal transition-all border ${
                selectedPlaylist?.id === pl.id
                  ? 'bg-red-500/15 border-red-500/30 text-white'
                  : 'bg-[#32302e] border-transparent text-[#a4a09c] hover:bg-[#3d3a38] hover:text-white'
              }`}
            >
              <p className="text-sm font-medium truncate max-w-[180px]">{pl.title}</p>
              <p className="text-[10px] text-[#75716e] mt-0.5">{pl.itemCount}개</p>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {!selectedPlaylist ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-4xl mb-3 opacity-30">📋</span>
            <p className="text-[#75716e] text-sm">재생목록을 선택하면 영상 목록이 표시됩니다</p>
          </div>
        ) : loadingVideos && videos.length === 0 ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-red-500" />
          </div>
        ) : error ? (
          <div className="text-center py-12 bg-[#32302e]/30 rounded-2xl px-6">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-white font-semibold text-sm truncate">{selectedPlaylist.title}</h3>
              <span className="text-[#75716e] text-xs shrink-0">{videos.length}개</span>
            </div>
            {videos.length === 0 ? (
              <div className="text-center py-12 text-[#75716e] text-sm">영상이 없습니다.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {videos.map(video => (
                  <div key={video.videoId} className="bg-[#32302e] rounded-2xl border border-white/5 overflow-hidden hover:border-white/15 transition-all group">
                    <div className="relative overflow-hidden aspect-video bg-[#23211f]">
                      {video.thumbnail
                        ? <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        : <div className="w-full h-full flex items-center justify-center text-3xl opacity-20">▶</div>
                      }
                    </div>
                    <div className="p-3">
                      <p className="text-[#e2e2e2] text-xs font-semibold leading-snug mb-1 line-clamp-2 group-hover:text-white transition-colors">{video.title}</p>
                      {video.channelTitle && <p className="text-[#75716e] text-[10px] mb-3 truncate">{video.channelTitle}</p>}
                      <button
                        onClick={() => router.push(`/?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${video.videoId}`)}`)}
                        className="w-full py-2 bg-orange-500/10 hover:bg-orange-500 text-orange-400 hover:text-white text-xs font-bold rounded-xl transition-all border border-orange-500/20 hover:border-transparent"
                      >
                        AI 요약하기
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {nextPageToken && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => loadVideos(selectedPlaylist, nextPageToken)}
                  disabled={loadingVideos}
                  className="px-6 py-2.5 bg-[#32302e] hover:bg-[#3d3a38] text-[#a4a09c] hover:text-white text-sm rounded-xl transition-colors border border-white/10 disabled:opacity-50"
                >
                  {loadingVideos ? '불러오는 중...' : '더 보기'}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
