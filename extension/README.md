# 쏙튜브 Chrome Extension

## 설치 방법 (개발자 모드)

1. Chrome 브라우저에서 `chrome://extensions/` 열기
2. 우측 상단 **개발자 모드** 토글 ON
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. 이 `extension/` 폴더 선택

## 아이콘 교체

`icons/` 폴더에 아래 파일 넣기 (PNG 형식):
- `icon16.png` — 16×16px
- `icon48.png` — 48×48px  
- `icon128.png` — 128×128px

## 기능

- 유튜브 watch 페이지 접속 시 사이드패널 자동 오픈
- 카테고리 선택 (자동/요리/영어/뉴스/여행/IT/재테크/교육/엔터)
- 한국어 / 원문 언어 선택
- AI 요약 생성 (ssoktube.com API)
- 결과 복사 / 라이브러리 저장 / 쏙튜브에서 보기
- Q&A — 영상에 대해 자유롭게 질문
- Google 로그인 연동

## 로그인 방법

1. 사이드패널 상단 **Google 로그인** 클릭
2. ssoktube.com/extension-auth 페이지에서 Google 계정으로 로그인
3. 로그인 완료 후 탭 닫기
4. 사이드패널에 로그인 상태 반영됨
