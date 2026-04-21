'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import {
  getYTPlaylists, getYTVideos, saveYTPlaylistsAndVideos, getSummarizedVideoIds,
  YTCachedPlaylist, YTCachedVideo,
} from '@/lib/db'
import { serverTimestamp } from 'firebase/firestore'

const GOOGLE_CLIENT_ID = '711357873847-gk3fc4not23gmtm2ajblm2mcls6okngu.apps.googleusercontent.com'

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
  const { user } = useAuth()

  const [gisReady, setGisReady] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Firestore 캐시
  const [playlists, setPlaylists] = useState<YTCachedPlaylist[]>([])
  const [newPlaylistIds, setNewPlaylistIds] = useState<Set<string>>(new Set())
  const [selectedPlaylist, setSelectedPlaylist] = useState<YTCachedPlaylist | null>(null)
  const [videos, setVideos] = useState<YTCachedVideo[]>([])
  const [loadingVideos, setLoadingVideos] = useState(false)
  const [summarizedIds, setSummarizedIds] = useState<Set<string>>(new Set())

  // GIS 스크립트 로드
  useEffect(() => {
    if (document.getElementById('gis-script')) { setGisReady(true); return }
    const script = document.createElement('script')
    script.id = 'gis-script'
    script.src = 'https://accounts.google.com/gsi/client'
    script.onload = () => setGisReady(true)
    document.head.appendChild(script)
  }, [])

  // Firestore에서 캐시된 재생목록 로드
  useEffect(() => {
    if (!user) return
    getYTPlaylists(user.uid).then(setPlaylists)
    getSummarizedVideoIds(user.uid).then(setSummarizedIds)
  }, [user])

  const handleSelectPlaylist = async (pl: YTCachedPlaylist) => {
    setSelectedPlaylist(pl)
    setVideos([])
    setLoadingVideos(true)
    try {
      const vids = await getYTVideos(user!.uid, pl.id)
      setVideos(vids)
    } finally {
      setLoadingVideos(false)
    }
  }

  // YouTube API로 재생목록 + 영상 전체 가져오기
  const fetchAllFromYouTube = async (token: string): Promise<{
    playlists: YTCachedPlaylist[]
    videosByPlaylist: Record<string, YTCachedVideo[]>
  }> => {
    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50',
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message ?? '재생목록을 불러오지 못했습니다.')
    if (!data.items?.length) throw new Error('재생목록이 없거나 가져올 수 없습니다.')

    const fetchedPlaylists: YTCachedPlaylist[] = []
    const videosByPlaylist: Record<string, YTCachedVideo[]> = {}

    for (const item of data.items) {
      const plId = item.id
      // 영상 목록 가져오기
      const vids: YTCachedVideo[] = []
      let pageToken: string | undefined
      do {
        const params = new URLSearchParams({ part: 'snippet', playlistId: plId, maxResults: '50' })
        if (pageToken) params.set('pageToken', pageToken)
        const vRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const vData = await vRes.json()
        if (vRes.ok) {
          for (const v of vData.items ?? []) {
            if (v.snippet.resourceId?.videoId) {
              vids.push({
                videoId: v.snippet.resourceId.videoId,
                title: v.snippet.title,
                thumbnail: v.snippet.thumbnails?.medium?.url ?? '',
                channelTitle: v.snippet.videoOwnerChannelTitle ?? '',
                playlistId: plId,
              })
            }
          }
          pageToken = vData.nextPageToken
        } else {
          pageToken = undefined
        }
      } while (pageToken)

      fetchedPlaylists.push({
        id: plId,
        title: item.snippet.title,
        itemCount: vids.length,
        thumbnail: item.snippet.thumbnails?.medium?.url ?? '',
        videoIds: vids.map(v => v.videoId),
        lastSynced: serverTimestamp(),
      })
      videosByPlaylist[plId] = vids
    }

    return { playlists: fetchedPlaylists, videosByPlaylist }
  }

  const handleSync = useCallback(() => {
    if (!window.google || !user) return
    setError(null)
    setSyncing(true)

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/youtube.readonly',
      callback: async (resp) => {
        if (resp.error || !resp.access_token) {
          setError('YouTube 연동에 실패했습니다.')
          setSyncing(false)
          return
        }
        try {
          const { playlists: fresh, videosByPlaylist } = await fetchAllFromYouTube(resp.access_token)

          // 기존 캐시와 비교 → NEW 계산
          const prevMap = new Map(playlists.map(p => [p.id, new Set(p.videoIds)]))
          const newIds = new Set<string>()
          for (const pl of fresh) {
            const prev = prevMap.get(pl.id)
            if (!prev) {
              newIds.add(pl.id) // 새 재생목록
            } else {
              const hasNew = pl.videoIds.some(vid => !prev.has(vid))
              if (hasNew) newIds.add(pl.id)
            }
          }

          await saveYTPlaylistsAndVideos(user.uid, fresh, videosByPlaylist)
          setPlaylists(fresh)
          setNewPlaylistIds(newIds)
          setAccessToken(resp.access_token)

          // 현재 선택된 재생목록 새로고침
          if (selectedPlaylist) {
            const updated = fresh.find(p => p.id === selectedPlaylist.id)
            if (updated) {
              setSelectedPlaylist(updated)
              setVideos(videosByPlaylist[updated.id] ?? [])
            }
          }
        } catch (e: any) {
          setError(e.message)
        } finally {
          setSyncing(false)
        }
      },
    })
    client.requestAccessToken()
  }, [user, playlists, selectedPlaylist])

  return (
    <div className="flex flex-col gap-4">
      {/* 상단: 연동 버튼 + 안내 */}
      <div className="flex items-center justify-between">
        <p className="text-[#75716e] text-xs">
          YouTube 정책상 보안 연결은 브라우저 세션마다 재인증이 필요합니다
        </p>
        <button
          onClick={handleSync}
          disabled={!gisReady || syncing}
          className="flex items-center gap-2 px-4 py-2 bg-[#32302e] hover:bg-[#3d3a38] border border-white/10 hover:border-red-500/30 rounded-xl transition-all text-sm font-semibold text-white disabled:opacity-50 shrink-0"
        >
          {syncing ? (
            <svg className="w-4 h-4 animate-spin text-[#75716e]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : (
            <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          )}
          {syncing ? '동기화 중...' : playlists.length > 0 ? '재동기화' : 'YouTube 연동하기'}
        </button>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {playlists.length === 0 && !syncing ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <span className="text-4xl opacity-20">📋</span>
          <p className="text-[#75716e] text-sm">YouTube 연동하기를 눌러 재생목록을 가져오세요</p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-4">
          {/* 좌측: 재생목록 */}
          <aside className="w-full md:w-56 shrink-0">
            <p className="text-[#75716e] text-[10px] mb-2 uppercase tracking-wider">내 재생목록</p>
            <div className="flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 scrollbar-none">
              {playlists.map(pl => (
                <button
                  key={pl.id}
                  onClick={() => handleSelectPlaylist(pl)}
                  className={`relative text-left px-3 py-2.5 rounded-xl whitespace-nowrap md:whitespace-normal transition-all border ${
                    selectedPlaylist?.id === pl.id
                      ? 'bg-red-500/15 border-red-500/30 text-white'
                      : 'bg-[#32302e] border-transparent text-[#a4a09c] hover:bg-[#3d3a38] hover:text-white'
                  }`}
                >
                  {newPlaylistIds.has(pl.id) && (
                    <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">NEW</span>
                  )}
                  <p className="text-sm font-medium truncate max-w-[170px]">{pl.title}</p>
                  <p className="text-[10px] text-[#75716e] mt-0.5">{pl.itemCount}개</p>
                </button>
              ))}
            </div>
          </aside>

          {/* 우측: 영상 목록 */}
          <main className="flex-1 min-w-0">
            {!selectedPlaylist ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <span className="text-3xl mb-2 opacity-20">👈</span>
                <p className="text-[#75716e] text-sm">재생목록을 선택하면 영상이 표시됩니다</p>
              </div>
            ) : loadingVideos ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-red-500" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-white font-semibold text-sm truncate">{selectedPlaylist.title}</h3>
                  <span className="text-[#75716e] text-xs shrink-0">{videos.length}개</span>
                </div>
                {videos.length === 0 ? (
                  <p className="text-center py-12 text-[#75716e] text-sm">영상이 없습니다.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {videos.map(video => {
                      const isSummarized = summarizedIds.has(video.videoId)
                      const isNew = newPlaylistIds.has(selectedPlaylist.id) &&
                        !playlists.find(p => p.id === selectedPlaylist.id)?.videoIds.includes(video.videoId)
                      return (
                        <div key={video.videoId} className="bg-[#32302e] rounded-2xl border border-white/5 overflow-hidden hover:border-white/15 transition-all group">
                          <div className="relative overflow-hidden aspect-video bg-[#23211f]">
                            {video.thumbnail
                              ? <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                              : <div className="w-full h-full flex items-center justify-center text-3xl opacity-20">▶</div>
                            }
                            {isNew && (
                              <span className="absolute top-2 left-2 text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">NEW</span>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="text-[#e2e2e2] text-xs font-semibold leading-snug mb-1 line-clamp-2 group-hover:text-white transition-colors">{video.title}</p>
                            {video.channelTitle && <p className="text-[#75716e] text-[10px] mb-3 truncate">{video.channelTitle}</p>}
                            {isSummarized ? (
                              <div className="w-full py-2 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-xl text-center border border-emerald-500/20 flex items-center justify-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                요약완료
                              </div>
                            ) : (
                              <button
                                onClick={() => router.push(`/?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${video.videoId}`)}`)}
                                className="w-full py-2 bg-orange-500/10 hover:bg-orange-500 text-orange-400 hover:text-white text-xs font-bold rounded-xl transition-all border border-orange-500/20 hover:border-transparent"
                              >
                                AI 요약하기
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      )}
    </div>
  )
}
