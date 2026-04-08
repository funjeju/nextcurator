/**
 * Cloudflare Worker: YouTube Transcript Proxy (v2)
 * watch 페이지 스크래핑 → timedtext API 직접 호출로 변경
 * 더 단순한 요청 = 차단될 가능성 낮음
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
}

const LANG_PRIORITY = ['ko', 'en', 'ja', 'zh-Hans', 'zh-Hant', 'es', 'fr', 'de', 'id', 'th']

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    const url = new URL(request.url)
    const videoId = url.searchParams.get('videoId')

    if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return json({ error: 'Invalid videoId' }, 400)
    }

    // 전략 1: timedtext API 직접 호출 (watch 페이지 불필요)
    try {
      const transcript = await fetchViaTimedtextAPI(videoId)
      return json({ transcript })
    } catch (e1) {
      console.log('timedtext direct failed:', e1.message)
    }

    // 전략 2: watch 페이지에서 baseUrl 추출 후 호출
    try {
      const transcript = await fetchViaWatchPage(videoId)
      return json({ transcript })
    } catch (e2) {
      console.log('watch page failed:', e2.message)
      return json({ error: 'TRANSCRIPT_UNAVAILABLE' }, 404)
    }
  },
}

// ─────────────────────────────────────────────
// 전략 1: YouTube timedtext API 직접 호출
// ─────────────────────────────────────────────
async function fetchViaTimedtextAPI(videoId) {
  for (const lang of LANG_PRIORITY) {
    // auto-generated caption endpoint
    for (const kind of ['', 'asr']) {
      const params = new URLSearchParams({
        lang,
        v: videoId,
        fmt: 'json3',
        xorb: '2',
        xobt: '3',
        xovt: '3',
        ...(kind ? { kind } : {}),
      })
      
      const res = await fetch(
        `https://www.youtube.com/api/timedtext?${params}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
          },
          cf: { cacheTtl: 3600 }, // CF 캐싱
        }
      )

      if (!res.ok) continue

      const text = await res.text()
      if (!text || text.trim().length < 10) continue

      let data
      try {
        data = JSON.parse(text)
      } catch {
        continue
      }

      const lines = parseJson3(data)
      if (lines.length > 0) return lines.join('\n')
    }
  }
  throw new Error('NO_TIMEDTEXT_FOUND')
}

// ─────────────────────────────────────────────
// 전략 2: watch 페이지 파싱 후 baseUrl 사용
// ─────────────────────────────────────────────
async function fetchViaWatchPage(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      'Accept': 'text/html,application/xhtml+xml',
      'Cookie': 'CONSENT=YES+42',
    },
    cf: { cacheTtl: 0 },
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) throw new Error(`WATCH_PAGE_${res.status}`)

  const html = await res.text()

  // captionTracks 추출
  const match = html.match(/"captionTracks":(\[.*?\])/)
  if (!match) throw new Error('NO_CAPTION_TRACKS')

  let tracks
  try {
    tracks = JSON.parse(match[1])
  } catch {
    throw new Error('CAPTION_PARSE_FAILED')
  }

  if (!tracks?.length) throw new Error('EMPTY_CAPTION_TRACKS')

  // 우선순위 언어 선택
  let track = null
  for (const lang of LANG_PRIORITY) {
    track = tracks.find(t =>
      t.languageCode === lang || t.vssId === `.${lang}` || t.vssId === `a.${lang}`
    )
    if (track) break
  }
  if (!track) track = tracks[0]

  let captionUrl = track.baseUrl
  captionUrl = captionUrl.includes('fmt=')
    ? captionUrl.replace(/fmt=[^&]*/, 'fmt=json3')
    : captionUrl + '&fmt=json3'

  const captionRes = await fetch(captionUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  })
  if (!captionRes.ok) throw new Error(`CAPTION_FETCH_${captionRes.status}`)

  const data = await captionRes.json()
  const lines = parseJson3(data)
  if (!lines.length) throw new Error('EMPTY_TRANSCRIPT')

  return lines.join('\n')
}

// ─────────────────────────────────────────────
// JSON3 포맷 파서
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
