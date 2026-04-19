# SSOKTUBE 이슈 & 기술 히스토리

날짜 | 유형 | 증상 | 원인 | 해결
형식으로 기록. 최신순.

---

## 2026-04-20

### [기능] 매거진 URL 지정 수동 생성
- **증상**: 어드민에서 특정 요약 페이지를 지정해 매거진을 바로 만들 수 없었음
- **원인**: 기존 수동 트리거는 자동 선택 알고리즘(hotScore)에 의존
- **해결**: `lib/magazine-server.ts`에 `getSummaryBySessionIdAdmin()` 추가, `app/api/cron/generate-post/route.ts` POST에 `sessionId` 파라미터 처리, `components/admin/CurationTab.tsx` "지금 바로 생성" 섹션에 URL 입력 + 초안/즉시발행 버튼 추가. 요약 URL(`/result/SESSION_ID`) 또는 sessionId 직접 입력 지원

---

## 2026-04-19 (추가)

### [기능] 어드민 GA4 대시보드 링크 추가
- **증상**: 어드민 Analytics 탭에서 실시간 방문자·페이지뷰 등 트래픽 통계를 볼 수 없었음
- **원인**: GA4 Data API 연동 복잡도 대비 실익 낮음 (쿼터 제한, 추가 인증 필요)
- **해결**: `components/admin/AnalyticsTab.tsx` 상단에 GA4 외부 링크 배너 추가. DB 기반 지표(가입·분석 수)는 기존 유지, 트래픽 지표는 GA4 직접 링크로 연결

---

## 2026-04-19

### [개선] Gemini STT 폴백 추가
- **증상**: SocialKit이 404 반환하는 영상(스포츠 하이라이트 등) 자막 추출 실패 → description 기반 저품질 요약
- **원인**: SocialKit이 해당 영상 오디오에 접근 불가 (이유 불명확)
- **해결**: `lib/transcript.ts`에 Gemini 2.5-flash YouTube 네이티브 처리 폴백 추가. SocialKit 실패 시 자동으로 Gemini STT 시도

### [이슈] text-embedding-004 deprecated
- **증상**: `/api/embed` 500 에러 — `text-embedding-004 is not found for API version v1beta`
- **원인**: Google이 text-embedding-004 모델 deprecated
- **해결**: `app/api/embed/route.ts` → `text-embedding-005`로 변경

### [이슈] 매거진 댓글 API 500 에러
- **증상**: `/api/magazine/comments?postId=...` 500 반환
- **원인**: Firestore `where + orderBy` 복합 인덱스 미생성
- **해결**: `orderBy` 제거하고 JS에서 `sort()` 처리

### [이슈] AI 댓글 문장 중간 잘림 (2차)
- **증상**: AI 댓글이 "그의" 같은 조사/단어 중간에서 잘림
- **원인**: `maxOutputTokens: 600` — 한글 300자 ≈ 600토큰인데 시스템 프롬프트 토큰까지 합산되면 이미 초과
- **해결**: `app/api/ai-comment/route.ts` `maxOutputTokens` 600 → 1500. 실제 길이 제한은 코드(350자)가 담당하므로 토큰은 여유 있게 설정

### [이슈] AI 반응 MAX_TOKENS 에러
- **증상**: AI 반응 버튼 클릭 시 "AI 응답이 너무 길어 잘렸습니다" 에러
- **원인**: `MAX_TOKENS` finish reason 감지 즉시 throw — 350자 제한 로직 도달 전에 에러 처리
- **해결**: `app/api/ai-comment/route.ts` MAX_TOKENS throw 제거. 잘린 응답도 350자 제한 로직이 처리하도록

### [이슈] 헤더 매거진 링크 2개 중복
- **증상**: 상단 네비게이션에 "매거진" 메뉴가 2개 표시
- **원인**: if/else 블록 내부 + 외부에 각각 Link 추가됨
- **해결**: `components/common/Header.tsx` 103번 줄 중복 링크 제거

### [개선] 요약 API 병렬화
- **증상**: 요약 시 딜레이 체감
- **원인**: `getVideoInfo` + `getTranscript` + `getVideoMeta` 순차 실행, `getVideoInfo` 내부도 SocialKit + YouTube HTML 순차
- **해결**: `app/api/summarize/route.ts` Promise.all로 병렬화. 예상 10-15초 단축

### [이슈] 발행된 매거진 포스트 FAQ/체크리스트/시청자반응 미표시
- **증상**: 초안 미리보기엔 FAQ·핵심체크리스트·시청자반응 보이는데 발행본엔 없음
- **원인**: `MagazinePostClient.tsx` 작성 시 `post.body`(마크다운)만 렌더링, `faq`·`checklist`·`comments` 필드 렌더링 코드 누락
- **해결**: `app/magazine/[slug]/MagazinePostClient.tsx`에 FaqItem 컴포넌트, 체크리스트 섹션, 시청자반응 섹션 추가

---

## 2026-04-18 (이전 대화 기준)

### [이슈] SquareClient 빌드 에러 (syntax error)
- **증상**: SquareClient.tsx 911번 줄 `)}` 문법 에러로 빌드 실패
- **원인**: 매거진 탭을 `<Link>`로 전환하면서 삼항연산자 제거 후 닫는 괄호 잔여
- **해결**: 잔여 `)}` 제거

### [이슈] SaveModal 타입 에러
- **증상**: `onClick={onClose}` 타입 불일치 빌드 에러
- **원인**: `onClose: (saved?: SavedResult) => void` 로 시그니처 변경 후 MouseEvent 전달 케이스 미처리
- **해결**: `onClick={() => onClose()}`로 수정

### [이슈] 모바일 저장 버튼 상태 미갱신
- **증상**: 저장 완료 후에도 버튼이 "저장하기"로 남아있음
- **원인**: 저장 후 Firestore 재조회 로직이 모바일에서 실패하면서 상태 미업데이트
- **해결**: `SaveModal.onClose`에 `SavedResult` 직접 전달, 재조회 없이 상태 업데이트

### [이슈] 매거진 연관영상 링크 클릭 시 에러
- **증상**: 매거진 포스트 내 영상 링크 클릭 → "요약을 불러오지 못했습니다"
- **원인**: `summaryIds`에 Firestore doc ID가 저장됐어야 하는데 `sessionId` 필드값이 저장됨
- **해결**: `lib/magazine.ts` → `summaryIds: [item.sessionId || item.id]`

### [이슈] 매거진 글 목록 Square K에 미노출
- **증상**: Square K 매거진 탭에 발행된 글 안 뜸
- **원인**: Firestore `where(status==published) + orderBy(publishedAt)` 복합 인덱스 없음
- **해결**: `orderBy` 제거, JS에서 `.sort()` 처리

### [이슈] AI 자동분류 저장 시 폴더 중복 생성
- **증상**: 같은 이름 폴더가 여러 개 생성됨
- **원인**: `createFolder`에 중복 체크 없음 + 대소문자/공백 미정규화로 비교 실패
- **해결**: `lib/db.ts` `createFolder`에 trim+toLowerCase 정규화 후 기존 폴더 반환 로직 추가

---

## 자막 추출 기술 히스토리

| 시도 | 결과 | 이유 |
|------|------|------|
| Gemini YouTube 네이티브 처리 (1차) | 실패 | 당시 API 차단 |
| Cloudflare 우회 | 실패 | 개인 사용자 불허 정책 |
| SocialKit | 성공 → 현재 1순위 | 유료($17/4000크레딧), 안정적 |
| Gemini YouTube 네이티브 처리 (2차, 2026-04-19) | 성공 | API 정책 변경 추정, SocialKit 실패 시 폴백으로 추가 |
