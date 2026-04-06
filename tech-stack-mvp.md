# 기술 스택 명세 — 넥스트 큐레이터 Phase 1

## 1. 확정 스택

| 역할 | 도구 | 선택 이유 |
|------|------|----------|
| 프레임워크 | Next.js 14 (App Router) | Vercel 최적화, SSR+API Routes 통합 |
| 스타일링 | Tailwind CSS + shadcn/ui | 클린 텍스트 기반 디자인, 빠른 조립 |
| DB | Firebase (Firestore) | 확정, 실시간 DB, Phase 2 인증 연동 용이 |
| 호스팅 | Vercel | 확정, Next.js 최적화, 무료 시작 |
| AI 요약 | Claude API (claude-sonnet-4-20250514) | 구조화 JSON 출력 정확도 최상위 |
| 자막 추출 | youtube-transcript-api (Node) | 경량, 공식 자막 우선 추출 |
| 음성 변환 | OpenAI Whisper API | 자막 없는 영상 fallback |

---

## 2. Phase별 스택 확장 계획

### Phase 1 (현재)
```
Next.js + Tailwind + shadcn/ui
Firebase Firestore (요약 결과 임시 저장)
Claude API (요약)
Vercel (호스팅)
```

### Phase 2 (라이브러리 + 검색)
```
+ Firebase Auth (회원가입/로그인)
+ Firebase Firestore (사용자 라이브러리)
+ OpenAI text-embedding-3-small (벡터 임베딩)
+ Pinecone or Firebase Vector Search (AI 대화 검색)
+ GPT-4o-mini (Free 티어 라우팅)
```

### Phase 3 (탐색 + 블로그)
```
+ YouTube Data API v3 (AI 영상 탐색)
+ Stripe (결제)
+ Resend (이메일)
```

### Phase 4 (광장)
```
+ Firebase Realtime DB (피드, 알림)
+ Sentry (모니터링)
```

---

## 3. Phase 1 폴더 구조

```
next-curator/
├── app/
│   ├── page.tsx                  # 홈 (URL 입력)
│   ├── result/
│   │   └── page.tsx              # 요약 결과 화면
│   └── api/
│       ├── summarize/
│       │   └── route.ts          # 메인 요약 API
│       └── transcript/
│           └── route.ts          # 자막 추출 API
│
├── components/
│   ├── home/
│   │   ├── UrlInput.tsx          # URL 입력 컴포넌트
│   │   └── LoadingSteps.tsx      # 진행 상태 UI
│   ├── player/
│   │   └── YoutubePlayer.tsx     # 플레이어 + 타임스탬프 연동
│   └── summary/
│       ├── SummaryShell.tsx      # 공통 요약 래퍼
│       ├── RecipeSummary.tsx     # 요리
│       ├── EnglishSummary.tsx    # 영어학습
│       ├── LearningeSummary.tsx  # 일반학습
│       ├── NewsSummary.tsx       # 뉴스/정보
│       ├── SelfDevSummary.tsx    # 자기계발
│       └── TravelSummary.tsx     # 여행/브이로그
│
├── lib/
│   ├── transcript.ts             # 자막 추출 로직
│   ├── claude.ts                 # Claude API 클라이언트
│   ├── firebase.ts               # Firebase 초기화
│   └── prompts/
│       ├── classify.ts           # 카테고리 분류 프롬프트
│       ├── recipe.ts
│       ├── english.ts
│       ├── learning.ts
│       ├── news.ts
│       ├── selfdev.ts
│       └── travel.ts
│
├── types/
│   └── summary.ts                # 카테고리별 타입 정의
│
└── .env.local
    ANTHROPIC_API_KEY=
    OPENAI_API_KEY=
    NEXT_PUBLIC_FIREBASE_API_KEY=
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=
    NEXT_PUBLIC_FIREBASE_APP_ID=
```

---

## 4. 핵심 API 설계

### POST /api/summarize
```typescript
// Request
{
  url: string  // YouTube URL
}

// Response
{
  videoId: string,
  title: string,
  channel: string,
  thumbnail: string,
  duration: number,
  category: 'recipe' | 'english' | 'learning' | 'news' | 'selfdev' | 'travel',
  summary: RecipeSummary | EnglishSummary | ... // 카테고리별 구조
}
```

### 처리 파이프라인
```
URL 입력
  ↓
YouTube videoId 추출
  ↓
youtube-transcript-api로 자막 + 타임스탬프 추출
  ↓ (자막 없으면)
Whisper API fallback
  ↓
Claude API: 카테고리 자동 분류
  ↓
Claude API: 카테고리별 구조화 요약 생성
  ↓
Firebase Firestore: 결과 저장 (sessionId 기반)
  ↓
클라이언트에 반환
```

---

## 5. Firebase 스키마 (Phase 1)

```
summaries/ (컬렉션)
  └── {sessionId}/ (문서)
        ├── videoId: string
        ├── url: string
        ├── title: string
        ├── channel: string
        ├── thumbnail: string
        ├── category: string
        ├── summary: object      // 카테고리별 구조화 데이터
        ├── createdAt: timestamp
        └── userId: null         // Phase 2에서 연결
```

---

## 6. Claude 프롬프트 구조

### 분류 프롬프트
```
다음 YouTube 영상 자막을 보고 카테고리를 분류하세요.

카테고리:
- recipe: 요리, 베이킹, 음식 만들기
- english: 영어 학습, 팝송, 영어 표현
- learning: 수학, 과학, 역사, 강의, 자격증
- news: 뉴스, 시사, 정보, 리뷰, 해설
- selfdev: 자기계발, 동기부여, 심리, 명상
- travel: 여행, 브이로그, 맛집, 장소 소개

자막: {transcript}

JSON만 응답:
{"category": "...", "confidence": 0.0~1.0}
```

### 요약 프롬프트 (레시피 예시)
```
다음 요리 영상 자막을 레시피 카드로 정리하세요.
타임스탬프는 반드시 "MM:SS" 형식으로 포함하세요.

자막(타임스탬프 포함): {transcript}

JSON만 응답:
{
  "dish_name": "요리명",
  "difficulty": "초보/중급/고급",
  "total_time": "총 시간",
  "servings": "인분",
  "ingredients": [
    {"name": "재료명", "amount": "분량"}
  ],
  "steps": [
    {"step": 1, "desc": "설명", "timestamp": "MM:SS", "tip": "팁(선택)"}
  ],
  "key_tips": ["핵심팁1", "핵심팁2"]
}
```

---

## 7. 타임스탬프 플레이어 연동

```typescript
// YouTube IFrame API 활용
// 타임스탬프 클릭 시 해당 초로 이동

function seekTo(timestamp: string) {
  const [min, sec] = timestamp.split(':').map(Number);
  const seconds = min * 60 + sec;
  player.seekTo(seconds, true);
}
```
