/**
 * Cloudflare Worker: YouTube Caption Proxy (v7)
 *
 * 역할: YouTube watch 페이지에서 공식/자동생성 자막 직접 추출
 *       자막이 없거나 실패하면 명확한 에러 코드 반환 → Next.js가 SocialKit STT로 넘김
 *
 * 에러 코드:
 *   NO_CAPTIONS  (404) → 자막 트랙 자체가 없는 영상 → SocialKit STT 필요
 *   FETCH_FAILED (502) → YouTube 접근 실패(일시적) → SocialKit 폴백
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
}

const LANG_PRIORITY = ['ko', 'en', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'fr', 'de', 'id', 'th']

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

    try {
      const transcript = await fetchViaWatchPage(videoId)
      return json({ transcript })
    } catch (e) {
      const msg = e.message

      // 자막 트랙 자체가 없는 경우 → SocialKit STT 필요함을 명시
      if (msg === 'NO_CAPTION_TRACKS' || msg === 'EMPTY_TRACKS') {
        console.warn(`[Worker] No captions for ${videoId}: ${msg}`)
        return json({ error: 'NO_CAPTIONS', videoId }, 404)
      }

      // 그 외 일시적 오류 (YouTube 접근 실패, 파싱 오류 등)
      console.error(`[Worker] Fetch failed for ${videoId}: ${msg}`)
      return json({ error: 'FETCH_FAILED', detail: msg }, 502)
    }
  },
}

// ─────────────────────────────────────────────
// watch 페이지 직접 스크래핑 → 자막 추출
// ─────────────────────────────────────────────
async function fetchViaWatchPage(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Accept': 'text/html',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    cf: { cacheTtl: 0 },
    signal: AbortSignal.timeout(20000),
  })

  if (!res.ok) throw new Error(`HTTP_${res.status}`)

  const html = await res.text()

  if (html.includes('consent.youtube.com')) {
    throw new Error('CONSENT_PAGE')
  }
  if (html.length < 50000) {
    throw new Error('SUSPICIOUS_SHORT_RESPONSE')
  }

  // ytInitialPlayerResponse JSON 파싱 (1차)
  const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});(?:\s*var\s|\s*<\/script>|\s*window\[)/)
  if (playerMatch) {
    try {
      const playerData = JSON.parse(playerMatch[1])
      const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks
      if (tracks?.length) {
        return await fetchTranscriptFromTracks(tracks)
      }
    } catch {
      // JSON 파싱 실패 → 정규식 폴백
    }
  }

  // 정규식 폴백 (2차)
  const match = html.match(/"captionTracks":(\[.*?\])/)
  if (!match) throw new Error('NO_CAPTION_TRACKS')

  let tracks
  try {
    tracks = JSON.parse(match[1])
  } catch {
    throw new Error('PARSE_FAILED')
  }

  if (!tracks?.length) throw new Error('EMPTY_TRACKS')
  return await fetchTranscriptFromTracks(tracks)
}

// ─────────────────────────────────────────────
// captionTracks → 자막 다운로드 및 파싱
// ─────────────────────────────────────────────
async function fetchTranscriptFromTracks(tracks) {
  let track = null
  for (const lang of LANG_PRIORITY) {
    track = tracks.find(
      t => t.languageCode === lang || t.vssId === `.${lang}` || t.vssId === `a.${lang}`
    )
    if (track) break
  }
  if (!track) track = tracks[0]

  let captionUrl = track.baseUrl
  captionUrl = captionUrl.includes('fmt=')
    ? captionUrl.replace(/fmt=[^&]*/, 'fmt=json3')
    : captionUrl + '&fmt=json3'

  const captionRes = await fetch(captionUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://www.youtube.com/',
    },
    signal: AbortSignal.timeout(10000),
  })

  if (!captionRes.ok) throw new Error(`CAPTION_HTTP_${captionRes.status}`)

  const text = await captionRes.text()
  if (!text || text.length < 10) throw new Error('EMPTY_RESPONSE')

  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('JSON_PARSE_FAILED')
  }

  const lines = parseJson3(data)
  if (!lines.length) throw new Error('EMPTY_TRANSCRIPT')
  return lines.join('\n')
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
