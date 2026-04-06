# 바이브 코딩 마스터 프롬프트
# Next Curator — Phase 1 개발 지시서

---

## 🎯 한 줄 목표
YouTube URL을 입력하면 AI가 영상 성격을 자동 감지하고,
카테고리별 전용 포맷으로 요약 + 타임스탬프를 생성해주는 웹앱.

---

## 📦 확정 기술 스택
- **프레임워크**: Next.js 14 (App Router)
- **스타일링**: Tailwind CSS + shadcn/ui (다크모드 기본)
- **DB**: Firebase Firestore
- **AI**: Claude API (claude-sonnet-4-20250514)
- **자막 추출**: youtube-transcript-api
- **음성 변환 fallback**: OpenAI Whisper API
- **호스팅**: Vercel
- **언어**: TypeScript

---

## 🏗️ 개발할 화면 3개

### 화면 1. 홈 (/)
- 중앙 정렬 레이아웃
- 서비스명: "Next Curator"
- 슬로건: "흘러가던 유튜브, 이제 AI가 내 창고에 쌓아준다"
- YouTube URL 입력창 (shadcn Input)
- "요약 시작하기" 버튼 (shadcn Button)
- 6개 카테고리 아이콘 뱃지 표시: 🍳요리 🔤영어 📐학습 🗞️뉴스 💪자기계발 🧳여행

### 화면 2. 로딩 (/loading 또는 인라인)
진행 단계를 순서대로 표시:
1. ✅ 영상 정보 확인 중...
2. ✅ 자막 추출 중...
3. ⏳ 카테고리 분류 중...
4. ⬜ 요약 생성 중...
5. ⬜ 타임스탬프 연결 중...
- shadcn Progress 바 포함

### 화면 3. 결과 (/result/[sessionId])
**상단 (고정)**:
- YouTube IFrame 플레이어 (16:9, 전체 너비)
- 카테고리 뱃지 + 영상 제목 + 채널명

**하단 (스크롤)**:
- 카테고리별 요약 카드 (아래 상세 명세 참고)
- 모든 타임스탬프는 클릭 시 플레이어 해당 시점으로 이동
- 각 섹션 우측 상단에 [📋 복사] 버튼

---

## 📋 6개 카테고리별 요약 포맷

### 1. 🍳 요리 (recipe)
```typescript
interface RecipeSummary {
  dish_name: string
  difficulty: '초보' | '중급' | '고급'
  total_time: string
  servings: string
  ingredients: { name: string; amount: string }[]
  steps: { step: number; desc: string; timestamp: string; tip?: string }[]
  key_tips: string[]
}
```
UI: 재료는 리스트, 단계는 번호+타임스탬프 뱃지, 핵심팁은 emerald 색상 강조

### 2. 🔤 영어학습 (english)
```typescript
interface EnglishSummary {
  song_or_title: string
  artist?: string
  expressions: { text: string; meaning: string; note: string; timestamp: string }[]
  vocabulary: { word: string; meaning: string; pronunciation: string }[]
  patterns: string[]
  cultural_context?: string
}
```
UI: 표현은 카드형, 단어는 3열 테이블, 패턴은 코드블록 스타일

### 3. 📐 일반학습 (learning)
```typescript
interface LearningSummary {
  subject: string
  concepts: { name: string; desc: string; timestamp: string }[]
  key_points: { point: string; timestamp: string }[]
  examples: { desc: string; timestamp: string }[]
}
```
UI: 개념은 아코디언 or 카드, 핵심포인트는 bullet+타임스탬프

### 4. 🗞️ 뉴스/정보 (news)
```typescript
interface NewsSummary {
  headline: string
  three_line_summary: string
  five_w: { who: string; when: string; where: string; what: string; how: string; why: string }
  background: { desc: string; timestamp: string }
  implications: { point: string; timestamp: string }[]
}
```
UI: 3줄 요약 강조, 육하원칙 2열 테이블, 배경/시사점은 타임스탬프 포함

### 5. 💪 자기계발 (selfdev)
```typescript
interface SelfDevSummary {
  core_message: { text: string; timestamp: string }
  insights: { point: string; timestamp: string }[]
  checklist: string[]
  quotes: { text: string; timestamp: string }[]
}
```
UI: 핵심메시지 large 텍스트 강조, 체크리스트는 shadcn Checkbox

### 6. 🧳 여행/브이로그 (travel)
```typescript
interface TravelSummary {
  destination: string
  places: { name: string; desc: string; price?: string; tip?: string; timestamp: string }[]
  route: string
  practical_info: string[]
  warnings: string[]
}
```
UI: 방문지 카드형 리스트, 동선은 → 연결, 주의사항은 amber 색상

---

## 🔌 API 설계

### POST /api/summarize
```typescript
// Request Body
{ url: string }

// Response
{
  sessionId: string,
  videoId: string,
  title: string,
  channel: string,
  thumbnail: string,
  duration: number,
  category: 'recipe' | 'english' | 'learning' | 'news' | 'selfdev' | 'travel',
  summary: RecipeSummary | EnglishSummary | LearningSummary | NewsSummary | SelfDevSummary | TravelSummary
}
```

### 처리 순서
```
1. URL에서 videoId 추출
2. youtube-transcript-api로 자막+타임스탬프 추출
   → 실패 시 Whisper API fallback
3. Claude API: 카테고리 분류 (JSON 응답)
4. Claude API: 카테고리별 구조화 요약 생성 (JSON 응답)
5. Firebase Firestore에 sessionId로 저장
6. 결과 반환
```

---

## 🎨 디자인 시스템

```
다크모드 기본 (next-themes 사용)

배경: bg-zinc-950
카드: bg-zinc-900, border border-zinc-800
텍스트: text-zinc-100
서브텍스트: text-zinc-400
강조(타임스탬프): text-blue-400, hover:bg-blue-500
핵심팁: text-emerald-400
주의사항: text-amber-400

카테고리 색상:
  recipe: orange
  english: blue
  learning: violet
  news: zinc
  selfdev: emerald
  travel: cyan
```

---

## 🔧 환경변수 (.env.local)

```
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

---

## ⚙️ YouTube 플레이어 + 타임스탬프 연동

```typescript
// YouTube IFrame API 사용
// 타임스탬프 클릭 시 해당 초로 seekTo

// 타임스탬프 형식: "MM:SS"
function timestampToSeconds(ts: string): number {
  const [min, sec] = ts.split(':').map(Number)
  return min * 60 + sec
}

// 플레이어 인스턴스는 전역 상태로 관리
// 타임스탬프 뱃지 클릭 시 player.seekTo(seconds, true) 호출
```

타임스탬프 뱃지 스타일:
```tsx
<Badge
  variant="outline"
  className="cursor-pointer font-mono text-xs
             hover:bg-blue-500 hover:text-white hover:border-blue-500
             transition-colors"
  onClick={() => player.seekTo(timestampToSeconds(ts), true)}
>
  ▶ {timestamp}
</Badge>
```

---

## 📁 Firebase 저장 구조

```
Firestore:
  summaries/ (컬렉션)
    {sessionId}/ (문서)
      videoId: string
      url: string
      title: string
      channel: string
      thumbnail: string
      category: string
      summary: object
      createdAt: Timestamp
      userId: null  ← Phase 2에서 연결
```

---

## ✅ Claude 프롬프트 원칙
- 모든 응답은 JSON만 (마크다운 코드블록 없이)
- 타임스탬프는 반드시 "MM:SS" 형식
- 한국어 기본 (영어학습 카드는 영어+한국어 병기)
- temperature: 0.3 (일관성 우선)
- max_tokens: 2000

---

## 🚀 개발 우선순위

1. 프로젝트 셋업 (Next.js + Tailwind + shadcn + Firebase 초기화)
2. /api/summarize 라우트 (자막추출 → 분류 → 요약)
3. 홈 화면 UI
4. 로딩 화면 UI
5. YouTube 플레이어 컴포넌트 + seekTo 연동
6. 6개 카테고리별 요약 카드 컴포넌트
7. 결과 화면 조립
8. Firebase 저장 연동
9. 반응형 + 다크모드 점검
10. Vercel 배포

---

## ⚠️ 주의사항
- youtube-transcript-api는 서버사이드에서만 실행 (API Route에서 호출)
- Claude API 호출은 서버사이드에서만 (API Key 노출 방지)
- 자막 없는 영상: Whisper API fallback 처리
- 비공개/삭제 영상: 에러 메시지 처리
- 중복 URL: sessionId로 캐싱하여 재처리 방지

---

## 🔮 Phase 2 확장을 위한 준비사항
(지금 당장 구현 안 해도 되지만 구조는 열어둘 것)

- Firebase Auth: userId 필드는 null로 유지
- 라이브러리 저장 버튼: UI만 표시, 기능은 비활성화
- 벡터 임베딩: summary 텍스트를 하나의 문자열로 합쳐 저장 (나중에 임베딩 생성용)
- LLM 라우팅: llm-router.ts 파일만 만들어두기 (Free/Pro 분기 준비)
