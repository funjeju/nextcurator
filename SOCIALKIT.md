# SocialKit API 레퍼런스

Base URL: `https://api.socialkit.dev`  
Auth: `x-access-key: {SOCIALKIT_API_KEY}` 헤더

## YouTube 엔드포인트

| 엔드포인트 | 용도 | YouTube API 대체 | 크레딧 |
|---|---|---|---|
| `youtube/search` | 키워드 검색 | search.list 대체 | ~2 |
| `youtube/channel-videos` | 채널의 최근 영상 목록 | playlistItems.list 대체 | ~2 |
| `youtube/playlist-videos` | 재생목록 영상 | playlistItems.list 대체 | ~2 |
| `youtube/video-details` | 영상 상세 정보 | videos.list 대체 | ~2 |
| `youtube/channel-details` | 채널 상세 | channels.list 대체 | ~2 |
| `youtube/stats` | 조회수·좋아요 등 | videos.list statistics | ~1 |
| `youtube/transcript` | 자막 | YouTube API엔 없음 (SocialKit 독점) | ~2 |
| `youtube/comments` | 댓글 | commentThreads.list 대체 | ~1 |
| `youtube/summarize` | AI 요약 | YouTube API엔 없음 | - |

## TikTok 엔드포인트

- `tiktok/transcript`
- `tiktok/summary`
- `tiktok/stats`
- `tiktok/comments`

---

## AI 파이프라인 크레딧 설계 (매거진 1편 기준)

### ❌ 비효율 시나리오 (채널별 풀스캔)
- 채널 영상 조회: 60채널 × 2크레딧 × 3회/일 = **360 크레딧/일**
- 영상 상세: 20영상 × 2크레딧 × 3회/일 = **120 크레딧/일**
- 자막: 3영상 × 2크레딧 = **6 크레딧/일**
- 댓글: 3영상 × 1크레딧 = **3 크레딧/일**
- 합계: 하루 ~500 크레딧, 월 ~15,000 크레딧 → $39~79/월 플랜 필요

### ✅ 최소 크레딧 시나리오 (Search-first)
> YouTube API quota는 0 소모, SocialKit 크레딧만 사용

**Scout 단계** (서브카테고리당 1회 실행)
- `youtube/search` × 2쿼리 = **4 크레딧**
- `youtube/video-details` × 상위 6개 = **12 크레딧**
- 소계: **16 크레딧**

**Evaluate 단계** (후보 3~5개)
- `youtube/transcript` × 3개 = **6 크레딧**
- 소계: **6 크레딧**

**Summarize 단계** (최종 당선 1개)
- transcript는 Evaluate에서 캐시 재사용 → 0 크레딧
- `youtube/comments` × 1개 = **1 크레딧**
- 소계: **1 크레딧**

**매거진 1편 총 비용: ~23 크레딧**  
**3 서브카테고리 × 3회/일 = 9회/일 → ~207 크레딧/일, 월 ~6,200 크레딧**

---

## 현재 사용 현황

| 기능 | 엔드포인트 | 파일 |
|---|---|---|
| 영상 자막 추출 | `youtube/transcript` | `lib/transcript.ts` |
| 댓글 수집 | `youtube/comments` | `lib/youtube-comments.ts`, `lib/transcript.ts` |
| **Scout 후보 발굴** | `youtube/search` + `youtube/video-details` | 미구현 (YouTube API 사용 중) |
