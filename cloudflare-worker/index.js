/**
 * Cloudflare Worker: YouTube Caption Proxy (v9)
 *
 * 전략 (순서):
 * 1. watch 페이지 HTML 파싱 — captionTracks baseUrl 추출 (Method B)
 * 2. InnerTube API (WEB → MWEB 순) — watch 페이지 실패 시 폴백
 *
 * 에러 코드:
 *   NO_CAPTIONS  (404) → 자막 트랙 자체가 없는 영상 → SocialKit STT 필요
 *   FETCH_FAILED (502) → YouTube 접근 실패 → SocialKit 폴백
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
}

const LANG_PRIORITY = ['ko', 'en', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'fr', 'de', 'id', 'th']

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export default {
  async fetch(request, _env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    const url = new URL(request.url)
    const videoId = url.searchParams.get('videoId')

    if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return json({ error: 'INVALID_VIDEO_ID' }, 400)
    }

    const errors = []

    // ── 전략 1: watch 페이지 HTML 파싱 (Method B) ──
    try {
      const { transcript, cookies } = await fetchViaWatchPage(videoId)
      return json({ transcript, source: 'watchpage' })
    } catch (e) {
      const msg = e.message
      errors.push(`watchpage: ${msg}`)
      const isNoCaption = msg === 'NO_CAPTION_TRACKS' || msg === 'EMPTY_TRACKS'
      if (isNoCaption) {
        console.warn(`[Worker] watch page confirms no caption tracks: ${videoId}`)
      } else {
        console.warn(`[Worker] watch page failed (${msg}) for ${videoId}`)
      }
    }

    // ── 전략 2a: InnerTube ANDROID (IP 제한 우회율 높음) ──
    try {
      const transcript = await fetchViaInnerTubeAndroid(videoId)
      return json({ transcript, source: 'innertube-android' })
    } catch (e) {
      const msg = e.message
      errors.push(`innertube-android: ${msg}`)
      console.warn(`[Worker] InnerTube ANDROID failed (${msg}) for ${videoId}`)
    }

    // ── 전략 2b: InnerTube WEB ──
    try {
      const transcript = await fetchViaInnerTube(videoId, 'WEB', '2.20240415.01.00')
      return json({ transcript, source: 'innertube-web' })
    } catch (e) {
      const msg = e.message
      errors.push(`innertube-web: ${msg}`)
      console.warn(`[Worker] InnerTube WEB failed (${msg}) for ${videoId}`)
    }

    // 모두 실패 — 자막 없음 vs 접근 실패 판별
    const noCaption = errors.some(e =>
      e.includes('NO_CAPTION_TRACKS') || e.includes('EMPTY_TRACKS') || e.includes('NO_CAPTIONS')
    ) && !errors.some(e => e.includes('HTTP_4') || e.includes('HTTP_5') || e.includes('FAILED'))

    if (noCaption) {
      console.warn(`[Worker] Confirmed no captions for ${videoId}`)
      return json({ error: 'NO_CAPTIONS', videoId }, 404)
    }

    // 두 InnerTube 모두 NO_CAPTIONS → 자막 없음 확정
    const allNoCaption = errors.every(e => e.includes('NO_CAPTIONS') || e.includes('NO_CAPTION'))
    if (allNoCaption) {
      return json({ error: 'NO_CAPTIONS', videoId }, 404)
    }

    console.error(`[Worker] All strategies failed for ${videoId}:`, errors)
    return json({ error: 'FETCH_FAILED', details: errors }, 502)
  },
}

// ─────────────────────────────────────────────
// 전략 1: watch 페이지 직접 스크래핑 (Method B)
// ─────────────────────────────────────────────
async function fetchViaWatchPage(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=ko&gl=KR`, {
    headers: {
      'User-Agent': BROWSER_UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    },
    cf: { cacheTtl: 0, scrapeShield: false },
    signal: AbortSignal.timeout(20000),
    redirect: 'follow',
  })

  console.log(`[Worker] watch page status: ${res.status} for ${videoId}`)
  if (!res.ok) throw new Error(`HTTP_${res.status}`)

  // 쿠키 캡처 (자막 다운로드에 재사용)
  const cookies = res.headers.get('set-cookie') ?? ''

  const html = await res.text()

  if (html.includes('consent.youtube.com')) throw new Error('CONSENT_PAGE')
  if (html.length < 30000) throw new Error(`SHORT_RESPONSE_${html.length}`)

  // ytInitialPlayerResponse JSON 파싱 (1차)
  const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});(?:\s*var\s|\s*<\/script>|\s*window\[)/)
  if (playerMatch) {
    try {
      const playerData = JSON.parse(playerMatch[1])
      const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks
      if (tracks?.length) {
        console.log(`[Worker] Found ${tracks.length} tracks via ytInitialPlayerResponse`)
        return { transcript: await fetchTranscriptFromTracks(tracks, cookies), cookies }
      }
    } catch (err) {
      console.warn(`[Worker] ytInitialPlayerResponse parse failed: ${err.message}`)
    }
  }

  // 정규식 폴백 (2차) — ytInitialPlayerResponse가 너무 크거나 파싱 실패 시
  const match = html.match(/"captionTracks":(\[.*?\])/)
  if (!match) throw new Error('NO_CAPTION_TRACKS')

  let tracks
  try {
    tracks = JSON.parse(match[1])
  } catch {
    throw new Error('PARSE_FAILED')
  }

  if (!tracks?.length) throw new Error('EMPTY_TRACKS')
  console.log(`[Worker] Found ${tracks.length} tracks via regex`)
  return { transcript: await fetchTranscriptFromTracks(tracks, cookies), cookies }
}

// ─────────────────────────────────────────────
// 전략 2a: InnerTube ANDROID (IP 제한 우회율 높음)
// Android 앱 클라이언트는 captions 필드를 포함하는 경우 많음
// ─────────────────────────────────────────────
async function fetchViaInnerTubeAndroid(videoId) {
  // Android 클라이언트는 youtubei.googleapis.com + 별도 API 키 사용
  const res = await fetch(
    `https://youtubei.googleapis.com/youtubei/v1/player?key=AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 9; gzip)',
        'X-YouTube-Client-Name': '3',
        'X-YouTube-Client-Version': '19.09.37',
        'X-Goog-Visitor-Id': '',
      },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '19.09.37',
            hl: 'ko',
            gl: 'KR',
          },
        },
      }),
      signal: AbortSignal.timeout(15000),
    }
  )

  console.log(`[Worker] InnerTube ANDROID status: ${res.status}`)
  if (!res.ok) throw new Error(`HTTP_${res.status}`)

  const data = await res.json()
  const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks
  console.log(`[Worker] ANDROID caption tracks count: ${tracks?.length ?? 0}`)
  if (!tracks || tracks.length === 0) throw new Error('NO_CAPTIONS')

  return await fetchTranscriptFromTracks(tracks, '')
}

// ─────────────────────────────────────────────
// 전략 2b: InnerTube WEB/MWEB
// ─────────────────────────────────────────────
async function fetchViaInnerTube(videoId, clientName, clientVersion) {
  const res = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8&prettyPrint=false`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': BROWSER_UA,
        'X-YouTube-Client-Name': clientName === 'MWEB' ? '2' : '1',
        'X-YouTube-Client-Version': clientVersion,
        'Origin': 'https://www.youtube.com',
        'Referer': `https://www.youtube.com/watch?v=${videoId}`,
      },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName,
            clientVersion,
            hl: 'ko',
            gl: 'KR',
          },
        },
      }),
      signal: AbortSignal.timeout(15000),
    }
  )

  console.log(`[Worker] InnerTube ${clientName} status: ${res.status}`)
  if (!res.ok) throw new Error(`HTTP_${res.status}`)

  const data = await res.json()
  const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks
  console.log(`[Worker] ${clientName} caption tracks count: ${tracks?.length ?? 0}`)
  if (!tracks || tracks.length === 0) throw new Error('NO_CAPTIONS')

  return await fetchTranscriptFromTracks(tracks, '')
}

// ─────────────────────────────────────────────
// captionTracks → 자막 다운로드 및 파싱
// ─────────────────────────────────────────────
async function fetchTranscriptFromTracks(tracks, cookies) {
  let track = null
  for (const lang of LANG_PRIORITY) {
    track = tracks.find(
      t => t.languageCode === lang || t.vssId === `.${lang}` || t.vssId === `a.${lang}`
    )
    if (track) break
  }
  if (!track) track = tracks[0]

  const baseUrl = track.baseUrl

  // json3 포맷 우선, XML 폴백
  const formats = [
    baseUrl.includes('fmt=') ? baseUrl.replace(/fmt=[^&]*/, 'fmt=json3') : baseUrl + '&fmt=json3',
    baseUrl.includes('fmt=') ? baseUrl.replace(/fmt=[^&]*/, 'fmt=srv3') : baseUrl + '&fmt=srv3',
    baseUrl,  // 기본 XML
  ]

  const headers = {
    'User-Agent': BROWSER_UA,
    'Referer': 'https://www.youtube.com/',
    'Accept': '*/*',
    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  }
  // watch 페이지 쿠키를 전달해서 서명 검증 통과
  if (cookies) {
    const cookieStr = cookies.split(',').map(c => c.trim().split(';')[0]).join('; ')
    if (cookieStr) headers['Cookie'] = cookieStr
  }

  for (const url of formats) {
    try {
      const captionRes = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(10000),
      })

      console.log(`[Worker] Caption fetch: ${captionRes.status} fmt=${url.match(/fmt=([^&]*)/)?.[1] ?? 'xml'} lang=${track.languageCode}`)
      if (!captionRes.ok) continue

      const text = await captionRes.text()
      if (!text || text.length < 10) continue

      // JSON3 파싱
      if (url.includes('fmt=json3') || url.includes('fmt=srv3')) {
        try {
          const data = JSON.parse(text)
          const lines = parseJson3(data)
          if (lines.length > 0) return lines.join('\n')
          continue
        } catch { continue }
      }

      // XML 파싱 (기본 포맷)
      const lines = parseXmlCaptions(text)
      if (lines.length > 0) return lines.join('\n')
    } catch { /* 다음 포맷 시도 */ }
  }

  throw new Error('EMPTY_RESPONSE')
}

// ─────────────────────────────────────────────
// XML 자막 파서 (<text start="..." dur="...">...</text>)
// ─────────────────────────────────────────────
function parseXmlCaptions(xml) {
  const results = []
  const regex = /<text[^>]+start="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g
  let match
  while ((match = regex.exec(xml)) !== null) {
    const startMs = Math.round(parseFloat(match[1]) * 1000)
    const mm = String(Math.floor(startMs / 60000)).padStart(2, '0')
    const ss = String(Math.floor((startMs % 60000) / 1000)).padStart(2, '0')
    const text = match[2]
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
      .replace(/<[^>]+>/g, '').replace(/\n/g, ' ').trim()
    if (text) results.push(`[${mm}:${ss}] ${text}`)
  }
  return results
}

// ─────────────────────────────────────────────
// JSON3 파서
// ─────────────────────────────────────────────
function parseJson3(data) {
  const events = data?.events || []
  return events
    .filter(e => e.segs?.length > 0)
    .map(e => {
      const ms = e.tStartMs || 0
      const mm = String(Math.floor(ms / 60000)).padStart(2, '0')
      const ss = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')
      const text = e.segs.map(s => s.utf8 || '').join('').replace(/\n/g, ' ').trim()
      return text ? `[${mm}:${ss}] ${text}` : null
    })
    .filter(Boolean)
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: CORS_HEADERS })
}
