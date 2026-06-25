# SportsMate

SportsMate는 위치 기반 운동 메이트 모집 및 스포츠 커뮤니티 PWA 웹앱입니다.

## 작업 요약

- React + Vite 기반 모바일 우선 PWA 프론트엔드
- Flask + SQLAlchemy 기반 REST API 백엔드
- PC/모바일 공통 URL 라우트
- `pages`는 공통으로 유지하고 `components/*/{mobile,desktop,shared}` 구조로 UI 분리
- 모바일 홈, 모임 목록, 모임 상세, 모임 생성, 채팅, 마이페이지, 방장 관리, 알림 화면 구현
- 모임 생성 시 참여자와 채팅방이 자동 생성되는 백엔드 서비스 로직 구현
- 인증 보호 라우트, 방장 신청자 승인/거절, 프로필 수정, 내 모임, 후기 작성 구현
- 신고 접수, 관리자 데이터 화면, 공지 조회/작성, 투표 생성/참여, 출석 체크 기본 흐름 구현

## 프로젝트 구조

```txt
frontend/
  src/
    routes/
    layouts/
    pages/
    components/
    api/
    hooks/
    contexts/
    utils/
backend/
  app/
    models/
    routes/
    services/
    schemas/
    utils/
```

## 로컬 실행

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
flask --app run.py init-db
flask --app run.py run --port 5001
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

프론트엔드는 기본적으로 `http://localhost:5001/api/v1`을 API 서버로 사용합니다. 다른 주소를 사용할 경우 `frontend/.env`에 `VITE_API_BASE_URL`을 설정합니다.

## MVP 범위

- 이메일 회원가입/로그인
- 모임 목록/상세/생성
- 참여 신청, 승인, 거절
- 승인된 사용자 채팅 접근
- 마이페이지
- 후기 작성 API 기반
- 인앱 알림
- 신고 작성 및 관리자 신고 조회
- 공지 조회/작성
- 투표 생성/참여
- 출석 체크/현황 조회
- PWA manifest 및 Service Worker 기본 등록

## 데모 계정

```txt
방장: demo@sportsmate.kr / password123
일반 사용자: mate@sportsmate.kr / password123
```
