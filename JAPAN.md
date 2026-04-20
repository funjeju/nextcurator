# 일본 런칭 플랜

> 상태: 계획 단계 (한국 PMF 검증 후 착수)
> 작성: 2026-04-20

---

## 왜 지금 당장 안 하는가

한국 시장에서 Product-Market Fit 검증이 선행되어야 한다.
일본 런칭이 확정되는 시점에 아래 계획을 실행한다.
예상 소요: **3~4주** (전담 시)

---

## 현재 구조의 문제점

| 문제 | 위치 | 영향도 |
|------|------|--------|
| 한국어 UI 텍스트 하드코딩 | 전체 컴포넌트 | 높음 |
| AI 프롬프트가 한국어로 작성됨 | `lib/claude.ts` | 높음 |
| 자동수집 검색 쿼리가 한국어 | `app/api/cron/auto-collect/route.ts` | 높음 |
| 카테고리명·레이블 한국어 | `SquareClient.tsx` 등 | 중간 |
| 결제 모듈이 포트원(한국 전용) | 미구현 상태 | 높음 |
| 브랜드명 SSOKTUBE | 전체 | 중간 |

---

## 방법론: Locale 분리 전략

코드베이스를 하나로 유지하면서 locale별로 분기하는 방식.
별도 레포 분기 없이 단일 Next.js 앱에서 `/ja` 경로로 서비스.

### 구조
```
nextcurator/
├── messages/
│   ├── ko.json     ← 한국어 UI 텍스트
│   └── ja.json     ← 일본어 UI 텍스트
├── lib/
│   ├── claude.ts           ← locale 파라미터 추가
│   └── prompts/
│       ├── news.ko.ts
│       └── news.ja.ts      ← 일본어 프롬프트
└── app/
    ├── [locale]/           ← next-intl 라우팅
    │   ├── square/
    │   └── result/
    └── api/
        └── cron/
            └── auto-collect/  ← locale별 쿼리 분기
```

---

## 단계별 실행 계획

### Phase 1 — i18n 인프라 구축 (3~5일)

- [ ] `next-intl` 설치 및 라우팅 설정 (`/ko`, `/ja`)
- [ ] `messages/ko.json` 생성 — 현재 하드코딩된 한국어 텍스트 추출
- [ ] `messages/ja.json` 생성 — 번역 (DeepL API 초안 + 수동 검수)
- [ ] 컴포넌트에서 `useTranslations()` 훅으로 교체
- [ ] 우선순위: Header, SquareClient, 카테고리명, 에러메시지

### Phase 2 — AI 프롬프트 일본어화 (3~5일)

- [ ] `lib/claude.ts`의 모든 프롬프트에 `locale` 파라미터 추가
- [ ] 카테고리별 일본어 프롬프트 작성 (news, selfdev, recipe 등)
- [ ] 일본어 자막 → 일본어 요약 출력 검증
- [ ] `generateSummary(category, transcript, source, locale)` 시그니처 변경

### Phase 3 — 콘텐츠 수집 일본화 (2~3일)

- [ ] `CATEGORY_QUERIES`를 locale별 config로 분리
  ```ts
  // lib/collect-queries.ts
  export const QUERIES = {
    ko: [
      { category: 'news', query: '한국 뉴스 시사 최신', label: '뉴스/시사' },
      ...
    ],
    ja: [
      { category: 'news', query: '日本 ニュース 最新', label: 'ニュース' },
      ...
    ],
  }
  ```
- [ ] 자막 추출 — SocialKit 일본 영상 커버 여부 검증
- [ ] 일본어 자막 품질 체크 로직 (반복 감지 등)

### Phase 4 — 결제 교체 (3~5일)

- [ ] 포트원 → **Stripe** 로 교체 (일본 포함 글로벌 지원)
- [ ] JPY 통화 지원
- [ ] 일본 소비세(10%) 처리
- [ ] 특정상거래법 표기 페이지 추가 (법적 의무)

### Phase 5 — 법적·브랜딩 (1~2일)

- [ ] 個人情報保護法 대응 — 개인정보 처리방침 일본어 버전
- [ ] 特定商取래법 표기
- [ ] 일본 도메인 검토 (`.jp` 또는 별도 브랜드명)
- [ ] Firebase Auth — 일본 전화번호 인증 테스트

---

## 기술 결정 사항 (확정 시 업데이트)

| 항목 | 결정 | 이유 |
|------|------|------|
| i18n 라이브러리 | `next-intl` | App Router 공식 지원 |
| 결제 | Stripe | 글로벌, JPY 지원 |
| 번역 초안 | DeepL API | 일본어 품질 최상 |
| 자막 추출 | 검증 필요 | SocialKit 일본어 커버리지 미확인 |
| 배포 | 단일 Vercel 프로젝트 | `/ko`, `/ja` 경로 분기 |

---

## 체크포인트

한국 런칭 후 아래 지표 달성 시 일본 플랜 착수:
- DAU 500 이상 지속 or
- 유료 전환 유저 100명 이상 or
- 투자/파트너십 계약 확정
