# SocialKit API 레퍼런스

Base URL: `https://api.socialkit.dev`  
Auth: `x-access-key: {SOCIALKIT_API_KEY}` 헤더 (또는 `access_key` 쿼리 파라미터)  
GET / POST 둘 다 지원

---

## YouTube 엔드포인트 (공식 목록)

| 엔드포인트 | 용도 | 크레딧 |
|---|---|---|
| `youtube/search` | 키워드 검색 | ~2 |
| `youtube/videos` | 채널/플레이리스트의 영상 목록 (`url` 파라미터) | ~2 |
| `youtube/stats` | 단일 영상 메타+통계 (title, views, likes, duration 등) | ~1 |
| `youtube/transcript` | 자막 전문 + 타임스탬프 세그먼트 | ~2 |
| `youtube/comments` | 댓글 목록 | ~1 |
| `youtube/channel-stats` | 채널 상세 (구독자, 영상 수 등) | ~2 |
| `youtube/summarize` | AI 요약 (custom_response, custom_prompt 지원) | - |
| `youtube/download` | 영상 다운로드 | - |

> ⚠️ `youtube/video-details` 는 존재하지 않음 — 404 반환. `youtube/stats` 를 사용할 것.

---

## 엔드포인트별 상세

### `youtube/search`

**파라미터**
- `query` (필수) — 검색 키워드
- `limit` — 결과 수 (기본 10)
- `sortBy` — 정렬 기준 (relevance, uploadDate 등)
- `uploadDate` — 업로드 날짜 필터

**응답 `results[]` 필드** ⚠️ YouTube API와 필드명 다름 주의

| 필드 | 타입 | 설명 |
|---|---|---|
| `videoId` | string | YouTube 영상 ID (11자) |
| `title` | string | 영상 제목 |
| `channelName` | string | 채널명 (`channelTitle` 아님!) |
| `channelId` | string | 채널 ID |
| `duration` | string | `"MM:SS"` 또는 `"H:MM:SS"` 형식 |
| `views` | string/number | 조회수 (`viewCount` 아님!) |
| `publishedTime` | string | **상대 시간** ex) `"2 weeks ago"` (ISO 날짜 아님!) |
| `url` | string | `https://www.youtube.com/watch?v=...` |

---

### `youtube/stats`

**파라미터**
- `url` (필수) — `https://youtube.com/watch?v={videoId}` 형식
- `cache`, `cache_ttl` — 캐싱 옵션

**응답 `data` 필드**

| 필드 | 타입 | 설명 |
|---|---|---|
| `url` | string | 요청 URL |
| `title` | string | 영상 제목 |
| `description` | string | 영상 설명 |
| `channelName` | string | 채널명 |
| `channelLink` | string | 채널 URL (`https://youtube.com/channel/UCxxx`) |
| `views` | number | 조회수 |
| `likes` | number | 좋아요 수 |
| `comments` | number | 댓글 수 |
| `duration` | string | `"MM:SS"` 형식 |
| `thumbnailUrl` | string | 썸네일 URL |

> ⚠️ `publishedAt` 없음 — 날짜 정보는 `youtube/search`의 `publishedTime`으로만 확인 가능

---

### `youtube/transcript`

**파라미터**
- `url` (필수) — YouTube 영상 URL

**응답 `data` 필드**

| 필드 | 타입 | 설명 |
|---|---|---|
| `transcript` | string | 전체 자막 텍스트 |
| `transcriptSegments[]` | array | 타임스탬프 세그먼트 |
| `wordCount` | number | 단어 수 |
| `segments` | number | 세그먼트 수 |

각 세그먼트: `{ text, start (초), duration (초), timestamp (MM:SS) }`

---

### `youtube/summarize`

**파라미터**
- `url` (필수) — YouTube 영상 URL
- `custom_response` — 커스텀 JSON 스키마 (원하는 필드 정의)
- `custom_prompt` — 추가 프롬프트 지시

**응답 기본 `data` 필드**: `summary`, `mainTopics[]`, `keyPoints[]`, `tone`, `targetAudience`, `quotes[]`, `timeline`

---

### `youtube/videos`

**파라미터**
- `url` (필수) — 채널 URL 또는 플레이리스트 URL
- `limit` — 결과 수

**응답**: `results[]` (search와 동일한 필드 + `index`)

---

## AI 파이프라인 크레딧 설계 (매거진 1편 기준)

### ✅ 현재 구현 시나리오 (Search-first)

**Scout 단계** (서브카테고리당 1회)
- `youtube/search` × 3쿼리 = **6 크레딧**
- `youtube/stats` × 부족한 영상만 (최대 6개) = **최대 6 크레딧**
- 소계: **6~12 크레딧**

**Evaluate 단계** (후보 최대 6개)
- `youtube/transcript` × 최대 6개 = **최대 12 크레딧**
- 소계: **6~12 크레딧**

**매거진 1편 총 비용: ~12~24 크레딧**  
**3 서브카테고리 × 3회/일 → 하루 ~108~216 크레딧, 월 ~3,200~6,500 크레딧**

---

## 현재 사용 현황

| 기능 | 엔드포인트 | 파일 |
|---|---|---|
| 영상 자막 추출 | `youtube/transcript` | `lib/transcript.ts` |
| 댓글 수집 | `youtube/comments` | `lib/youtube-comments.ts`, `lib/transcript.ts` |
| Scout 후보 발굴 | `youtube/search` + `youtube/stats` (폴백) | `lib/ai-curator.ts` |

---

## TikTok 엔드포인트

| 엔드포인트 | 용도 |
|---|---|
| `tiktok/summarize` | AI 요약 |
| `tiktok/transcript` | 자막 |
| `tiktok/stats` | 통계 |
| `tiktok/comments` | 댓글 |
| `tiktok/channel-stats` | 채널 상세 |
| `tiktok/search` | 검색 |
| `tiktok/hashtag-search` | 해시태그 검색 |
