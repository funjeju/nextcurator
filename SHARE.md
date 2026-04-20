# 공유하기 기능 확장 플랜

> 상태: 계획 단계
> 작성: 2026-04-20

---

## 목표 UI

공유하기 버튼 클릭 시 바텀시트 or 드롭다운:

```
┌─────────────────────────┐
│  📋 URL 복사            │  ← 현재 구현됨
│  💬 카카오톡            │  ← Phase 1
│  💼 Slack               │  ← Phase 2
│  📝 Notion에 저장       │  ← Phase 2
└─────────────────────────┘
```

---

## Phase 1 — 카카오톡 공유 (1일)

**방식:** Kakao JavaScript SDK
**효과:** URL만 복사되던 것 → 썸네일+제목+설명 미리보기 카드로 공유

### 구현 내용
- [ ] Kakao Developers 앱 등록 + JavaScript 키 발급
- [ ] `NEXT_PUBLIC_KAKAO_JS_KEY` 환경변수 추가
- [ ] `app/layout.tsx`에 Kakao SDK 스크립트 추가
- [ ] 공유 버튼 컴포넌트에 `Kakao.Share.sendDefault()` 연결
- [ ] 공유 내용: 영상 썸네일, 제목, 카테고리, 요약 첫 줄, 결과 URL

### 공유 카드 구성
```
[썸네일]
제목: {video.title}
{category} 요약 | SSOKTUBE
{three_line_summary 첫 줄}
→ 링크: ssoktube.com/result/{sessionId}
```

---

## Phase 2 — Slack / Notion (각 2~3일)

### 공통 구조
- 마이페이지 → "연동 설정" 탭에서 토큰/웹훅 한 번 등록
- Firestore `users/{uid}` 에 `slackWebhook`, `notionToken`, `notionDbId` 저장
- 공유 버튼에서 저장된 설정 확인 후 즉시 전송
- 미설정 시 → 설정 페이지로 안내

### Slack
- [ ] Incoming Webhook URL 입력란 (마이페이지)
- [ ] `/api/share/slack` route — 웹훅으로 Block Kit 메시지 POST
- [ ] Block Kit 구성: 썸네일, 제목, 3줄 요약, 원본 링크 버튼

### Notion
- [ ] Notion Integration 토큰 + 데이터베이스 ID 입력란 (마이페이지)
- [ ] `/api/share/notion` route — Notion API로 페이지 생성
- [ ] 페이지 구성: 제목, 카테고리, 3줄 요약, 육하원칙, 시사점, 원본 링크
- [ ] Notion API: `POST /v1/pages`

---

## 현재 공유 버튼 위치

- `components/summary/CopyButton.tsx` — 결과 페이지 상단
- 결과 페이지 헤더 영역

## 변경 방향
CopyButton을 ShareButton으로 교체 or 옆에 추가 버튼 배치.
클릭 시 바텀시트(모바일) or 드롭다운(데스크탑) 표시.
