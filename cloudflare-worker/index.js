/**
 * Cloudflare Worker: YouTube Transcript Proxy (v5)
 *
 * 전략:
 * 1. 직접 YouTube watch 페이지 스크래핑 (성공 시 가장 빠름)
 * 2. SocialKit API 폴백 (YouTube가 cloud IP 차단 시)
 *
 * SocialKit API 키는 CF Worker 환경변수/시크릿으로 관리
 * Vercel에는 CLOUDFLARE_WORKER_URL 하나만 설정하면 됨
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
}

const LANG_PRIORITY = ['ko', 'en', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'fr', 'de', 'id', 'th']

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    const url = new URL(request.url)
    const videoId = url.searchParams.get('videoId')

    if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return json({ error: 'Invalid videoId' }, 400)
    }

    const errors = []

    // 전략 1: YouTube watch 페이지 직접 스크래핑 (Googlebot UA)
    try {
      const transcript = await fetchViaWatchPage(videoId)
      return json({ transcript })
    } catch (e) {
      errors.push(`watch: ${e.message}`)
    }

    // 전략 2: SocialKit API (YouTube IP 차단 우회 전문 서비스)
    const socialkitKey = env.SOCIALKIT_API_KEY
    if (socialkitKey) {
      try {
        const transcript = await fetchViaSocialKit(videoId, socialkitKey)
        return json({ transcript })
      } catch (e) {
        errors.push(`socialkit: ${e.message}`)
      }
    } else {
      errors.push('socialkit: SOCIALKIT_API_KEY not configured in worker env')
    }

    console.error('[Worker] All strategies failed:', errors)
    return json({ error: 'TRANSCRIPT_UNAVAILABLE', details: errors }, 404)
  },
}

// ─────────────────────────────────────────────
// 전략 1: watch 페이지 직접 스크래핑
// ─────────────────────────────────────────────
async function fetchViaWatchPage(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
    headers: {
      // Googlebot UA: GDPR 동의 페이지 우회 가능성
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Accept': 'text/html',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    cf: { cacheTtl: 0 },
  })

  if (!res.ok) throw new Error(`HTTP_${res.status}`)

  const html = await res.text()

  if (html.includes('consent.youtube.com')) {
    throw new Error('CONSENT_PAGE')
  }
  if (html.length < 50000) {
    throw new Error('SUSPICIOUS_SHORT_RESPONSE')
  }

  // ytInitialPlayerResponse JSON 파싱
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
// 전략 2: SocialKit API
// ─────────────────────────────────────────────
async function fetchViaSocialKit(videoId, apiKey) {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`

  const res = await fetch(
    `https://api.socialkit.dev/youtube/transcript?url=${encodeURIComponent(videoUrl)}`,
    {
      headers: { 'x-access-key': apiKey },
      signal: AbortSignal.timeout(30000),
    }
  )

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`HTTP_${res.status}: ${errText.slice(0, 100)}`)
  }

  const data = await res.json()

  if (!data.success || !data.data) {
    throw new Error(`FAILED: ${data.error || 'unknown'}`)
  }

  // transcriptSegments → 타임스탬프 포함 포맷
  const segs = data.data.transcriptSegments
  if (segs?.length > 0) {
    return segs
      .map(s => `[${s.timestamp}] ${s.text.replace(/\n/g, ' ').trim()}`)
      .filter(line => line.length > 10)
      .join('\n')
  }

  if (data.data.transcript?.trim().length > 50) {
    return data.data.transcript.trim()
  }

  throw new Error('EMPTY_RESPONSE')
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
