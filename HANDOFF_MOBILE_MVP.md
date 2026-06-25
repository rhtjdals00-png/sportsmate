# SportsMate 모바일 MVP 인수인계

작성일: 2026-06-25  
작업 경로: `/Users/chan/Desktop/sportsProject/sportsmate`  
현재 브랜치: `codex/mobile-pwa-flask-mvp`  
원격 저장소: `origin https://github.com/mynarne/sportsmate.git`

## 프로젝트 방향

SportsMate는 기존 개인 아이디어였던 `matchmap`의 방향을 팀 프로젝트 주제에 맞게 확장한 운동 매칭 서비스다. 핵심은 사용자가 내 주변에서 같이 운동할 사람을 찾고, 모임을 만들고, 참여 신청과 채팅을 통해 실제 운동 모임으로 이어지게 하는 모바일 중심 PWA 웹앱이다.

현재 팀 프로젝트에서는 PC 버전에 힘이 실리는 상황이라, 이 브랜치에서는 PC 화면을 크게 건드리지 않고 모바일 경험을 독립적으로 완성하는 것을 목표로 했다. 구조는 React JavaScript 프론트엔드와 Python Flask 백엔드로 나누고, PC 컴포넌트와 모바일 컴포넌트를 분리해 조립식으로 확장할 수 있게 잡았다.

## 디자인 방향

초기 디자인 참고는 Figma/Stitch 화면이다. 모바일 우선 흐름은 다음 톤을 따른다.

- 흰색 카드 기반의 모바일 앱 UI
- 큰 배경/다크 포인트: `#111827`
- 주요 포인트 색상: `#EF4444`
- 그라데이션은 제거하고 단색 중심으로 정리
- 하단 탭, 카드, 칩, 버튼 중심의 조작
- 프로필/모임 생성 등 입력 화면은 모바일에서 손가락으로 누르기 쉬운 형태 우선

## 현재 구현 구조

### 프론트엔드

경로: `frontend`

주요 기술:

- React
- Vite
- JavaScript
- CSS 단일 스타일 파일: `frontend/src/index.css`
- PWA 기본 파일: `frontend/public/manifest.json`, `frontend/public/sw.js`

주요 라우트:

- `/`
- `/login`
- `/register`
- `/meetings`
- `/meetings/create`
- `/meetings/:meetingId`
- `/meetings/:meetingId/edit`
- `/chats`
- `/chats/:chatRoomId`
- `/notifications`
- `/mypage`
- `/mypage/profile`
- `/mypage/meetings`
- `/mypage/reviews`
- `/host`
- `/host/meetings/:meetingId`
- `/host/meetings/:meetingId/applicants`
- `/host/meetings/:meetingId/attendance`
- `/host/meetings/:meetingId/vote`
- `/host/meetings/:meetingId/stats`
- `/admin`
- `/admin/users`
- `/admin/meetings`
- `/admin/reports`

주요 모바일 컴포넌트:

- `frontend/src/components/home/mobile/MobileHome.jsx`
- `frontend/src/components/meeting/mobile/MobileMeetingList.jsx`
- `frontend/src/components/meeting/mobile/MobileMeetingDetail.jsx`
- `frontend/src/components/meeting/mobile/MobileMeetingCreate.jsx`
- `frontend/src/components/chat/mobile/MobileChatList.jsx`
- `frontend/src/components/chat/mobile/MobileChatRoom.jsx`
- `frontend/src/components/profile/mobile/MobileMyPage.jsx`
- `frontend/src/components/host/mobile/MobileHostDashboard.jsx`
- `frontend/src/components/notification/mobile/MobileNotifications.jsx`

주요 데이터/API 모듈:

- `frontend/src/api/client.js`
- `frontend/src/api/authApi.js`
- `frontend/src/api/userApi.js`
- `frontend/src/api/meetingApi.js`
- `frontend/src/api/sportApi.js`
- `frontend/src/api/locationApi.js`
- `frontend/src/api/chatApi.js`
- `frontend/src/api/notificationApi.js`
- `frontend/src/api/reportApi.js`
- `frontend/src/api/adminApi.js`
- `frontend/src/api/voteApi.js`

전국 지역 정적 데이터:

- `frontend/src/data/koreaRegions.js`

현재 이 파일은 프로필 수정과 모임 만들기에서 전국 시도/시군구 선택 UI에 사용된다.

### 백엔드

경로: `backend`

주요 기술:

- Flask
- Flask-SQLAlchemy
- Flask-JWT-Extended
- Flask-CORS
- SQLite 개발 DB

주요 파일:

- `backend/run.py`
- `backend/config.py`
- `backend/app/__init__.py`
- `backend/app/extensions.py`
- `backend/app/models/__init__.py`
- `backend/app/routes/*`
- `backend/app/services/*`

주요 API:

- `/api/health`
- `/api/v1/auth/register`
- `/api/v1/auth/login`
- `/api/v1/auth/me`
- `/api/v1/users/me`
- `/api/v1/meetings`
- `/api/v1/meetings/:id`
- `/api/v1/meetings/:id/join`
- `/api/v1/meetings/:id/applicants`
- `/api/v1/meetings/:id/notices`
- `/api/v1/meetings/:id/votes`
- `/api/v1/meetings/:id/attendance`
- `/api/v1/chatrooms`
- `/api/v1/notifications`
- `/api/v1/reports`
- `/api/v1/admin/*`
- `/api/v1/sport-categories`
- `/api/v1/sports`
- `/api/v1/sport-purposes`
- `/api/v1/regions`
- `/api/v1/map/search`

## 지금까지 구현한 핵심 기능

### 인증

- 회원가입
- 로그인
- JWT 기반 보호 라우트
- 현재 사용자 조회

테스트 계정:

- `demo@sportsmate.kr / password123`
- `mate@sportsmate.kr / password123`

### 모임

- 모임 목록
- 모임 상세
- 모임 생성
- 모임 수정
- 모임 취소 상태 처리
- 참여 신청
- 신청 취소
- 방장 신청 승인/거절
- 후기 작성/조회
- 공지 작성/조회
- 투표 작성/참여
- 출석 조회/체크

### 채팅

- 모임별 채팅방
- 승인된 참여자 접근
- 메시지 조회/전송

### 프로필

- 닉네임 수정
- 프로필 이미지 첨부
- 전국 지역 선택
- 선호 종목 선택
- 종목별 운동 수준 선택 옵션
- 선택한 종목 요약 칩 표시
- 요약 칩에서 `x`로 제거

현재 프로필 이미지는 파일 업로드 서버 저장이 아니라 브라우저에서 data URL로 읽어 `profile_image_url` 필드에 저장한다. 백엔드 모델은 이를 위해 `profile_image_url`을 `Text` 타입으로 변경했다.

### 지역/지도/주소

- `frontend/src/data/koreaRegions.js`에 전국 시도/시군구 정적 목록 추가
- Flask에 지역/지도 프록시 API 추가
- `VWORLD_API_KEY`가 있으면 VWorld 검색 API 사용
- 키가 없으면 로컬 Region DB에서 검색 fallback
- 모임 만들기 주소 검색에서 `/api/v1/map/search` 사용
- 주소 검색 결과 클릭 시 장소명, 주소, 위도, 경도 자동 입력

### 스포츠 카테고리

명세 기준으로 대분류/종목/목적 구조를 반영했다.

- 구기 종목: 축구, 풋살, 농구, 배구, 야구, 족구
- 라켓 스포츠: 배드민턴, 탁구, 테니스, 스쿼시
- 러닝 / 야외: 러닝, 등산, 트래킹, 자전거, 산책
- 피트니스: 헬스, 크로스핏, 클라이밍, 요가, 필라테스
- 기타: 볼링, 당구, 골프, 수영

### 관리자/방장

- 관리자용 사용자/모임/신고 조회 기본 화면
- 방장 대시보드
- 신청자 관리
- 출석 관리
- 투표 관리
- 통계 화면

## 최근 UI 변경 사항

### 색상 테마

현재 테마:

- 배경/다크 포인트: `#111827`
- 포인트 색상: `#EF4444`
- 연한 활성 배경: `#FEF2F2`
- 연한 포인트 보더: `#FECACA`

그라데이션은 제거했다. `frontend/src/index.css`에서 `linear-gradient`가 남지 않게 정리했다.

### 프로필 수정

파일:

- `frontend/src/pages/ProfileEditPage.jsx`
- `frontend/src/index.css`

현재 상태:

- 지역은 `큰지역`과 `세부지역` select 2개
- 선호 종목 대분류는 5열 가로 정렬
- 대분류 클릭 시 소분류가 열림
- 같은 대분류를 다시 누르면 닫힘
- 소분류 버튼은 텍스트 중앙 정렬
- `수준 선택하기` 체크 시 하단에 종목별 운동 수준 선택 패널 표시
- 저장 버튼 위에 선택한 종목 요약 표시
- 수준 선택이 켜져 있으면 `러닝:중급` 같은 형태로 표시

### 모임 만들기

파일:

- `frontend/src/components/meeting/mobile/MobileMeetingCreate.jsx`
- `frontend/src/index.css`

현재 상태:

- 지역은 프로필 수정과 같은 전국 지역 인터페이스
- 주소 검색은 `/api/v1/map/search` 사용
- 주소 검색 결과 클릭 시 장소명/주소/좌표 자동 입력
- 시작 날짜와 시작 시간 분리
- 종료 날짜와 종료 시간 분리
- 시작 날짜는 오늘 이전 선택 불가
- 오늘 날짜 선택 시 현재 시간 이전 선택 불가
- 정원은 기존 숫자 입력 유지

## 환경변수

예시 파일:

- `.env.example`
- `backend/.env.example`
- `frontend/.env`
- `backend/.env`

현재 실제 키는 gitignore 대상인 `.env`에 들어간다. 커밋하지 말아야 한다.

사용 중인 주요 변수:

```env
DATABASE_URL=sqlite:///sportsmate.db
JWT_SECRET_KEY=...
FRONTEND_ORIGIN=http://localhost:5173
VITE_API_BASE_URL=http://localhost:5001/api/v1
VWORLD_API_KEY=
VWORLD_DOMAIN=
MOLIT_API_KEY=
MOLIT_REGION_API_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Supabase 키는 `/Volumes/sc/matchmap/.env`에서 현재 프로젝트 `.env`로 복사했다. 다만 현재 앱의 실제 저장소는 아직 Supabase가 아니라 Flask + SQLite 구조다. Supabase 영구 저장 연동은 다음 작업으로 남아 있다.

## 실행 방법

백엔드:

```bash
cd /Users/chan/Desktop/sportsProject/sportsmate/backend
./.venv/bin/flask --app run.py run --host 0.0.0.0 --port 5001
```

프론트엔드:

```bash
cd /Users/chan/Desktop/sportsProject/sportsmate/frontend
npm run dev
```

접속:

```text
http://localhost:5173/
```

DB 초기화가 필요할 때:

```bash
cd /Users/chan/Desktop/sportsProject/sportsmate/backend
./.venv/bin/flask --app run.py init-db
```

주의: `init-db`는 기존 SQLite 데이터를 삭제하고 시드 데이터를 다시 넣는다.

## 검증한 명령

프론트 빌드:

```bash
cd /Users/chan/Desktop/sportsProject/sportsmate/frontend
npm run build
```

백엔드 문법 검사:

```bash
cd /Users/chan/Desktop/sportsProject/sportsmate/backend
./.venv/bin/python -m compileall app config.py run.py
```

백엔드 health:

```bash
curl -s http://localhost:5001/api/health
```

최근 검증 결과:

- `npm run build` 통과
- 백엔드 `compileall` 통과
- `/api/health` 정상
- 주소 검색 API 정상
- 브라우저에서 여러 화면 수동 검증 완료

## 현재 Git 상태와 주의사항

현재 브랜치:

```text
codex/mobile-pwa-flask-mvp
```

현재 remote:

```text
origin https://github.com/mynarne/sportsmate.git
```

따라서 현재 상태에서 `git push origin codex/mobile-pwa-flask-mvp` 같은 명령을 실행하면 `mynarne/sportsmate` 개인 레포로 push된다.

아직 `git add`, `git commit`, `git push`는 하지 않았다. 사용자가 명시적으로 요청하기 전까지 절대 실행하지 말 것.

현재 변경사항에는 기존 placeholder `test.txt` 삭제가 많이 포함되어 있다. 사용자가 요청해서 모든 `test.txt` 파일을 삭제한 상태다.

## 다음 작업 추천

1. Supabase 실제 영구 저장 연결
   - 현재 Supabase 키는 들어가 있지만 저장은 Flask/SQLite가 담당한다.
   - 선택지는 두 가지다.
   - Flask가 Supabase Postgres에 붙도록 `DATABASE_URL`을 Supabase DB URL로 전환
   - 또는 Supabase Auth/Storage/API를 프론트와 백엔드에 별도로 연동

2. 프로필 이미지 업로드 개선
   - 현재 data URL 저장 방식이다.
   - Supabase Storage나 Flask 업로드 엔드포인트로 바꾸는 것이 좋다.

3. 지도 화면 구현
   - `/api/v1/map/search`는 준비되어 있다.
   - VWorld 지도 렌더링 또는 다른 지도 SDK 렌더링은 아직 본격 구현 전이다.

4. 모임 만들기 UX 검증
   - 주소 검색 결과 클릭 후 장소명/주소 자동 입력은 구현했다.
   - 실제 VWorld 키가 들어간 상태에서 검색 결과 품질 확인 필요.

5. PC 화면과 모바일 화면의 책임 분리 강화
   - 현재 PC 화면은 기본 대시보드형으로 존재한다.
   - 모바일 완성도를 우선하고 PC는 팀 작업과 충돌하지 않게 유지하는 방향.

6. README 정리와 커밋 준비
   - 사용자가 커밋을 요청하면 README에 당일 작업 내용도 같이 정리해야 한다.
   - 커밋 전 `git status`를 보고 `.env`, `node_modules`, `.venv`, DB 파일이 절대 포함되지 않게 확인해야 한다.

## 중요한 개발 원칙

- PC 화면은 불필요하게 건드리지 않는다.
- 모바일 UX를 우선한다.
- 디자인은 Figma/Stitch의 방향을 계승하되 현재는 빠르게 작동하는 MVP를 우선한다.
- 실제 외부 API 키는 프론트에 직접 노출하지 않고 Flask 프록시를 우선한다.
- 사용자가 명시하기 전까지 push 금지.
- `.env` 파일은 절대 커밋 금지.
