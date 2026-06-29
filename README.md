# SportsMate

SportsMate는 위치 기반 운동 메이트 모집 및 스포츠 커뮤니티 서비스입니다.
PC와 모바일을 하나의 React 앱에서 반응형으로 분기하고, Flask API와 PostgreSQL/Supabase 기반 데이터베이스를 사용합니다.

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Frontend | React |
| Backend | Flask |
| Language | Python / JavaScript |
| Database | PostgreSQL |
| Style | Tailwind CSS |
| Realtime | Supabase Realtime |

## 실행

루트에서 한 번에 실행합니다.

```bash
npm run dev
```

포트는 코드에 고정하지 않고 env 값을 기준으로 사용합니다.

```env
# frontend/.env
VITE_DEV_HOST=0.0.0.0
VITE_DEV_PORT=5173
VITE_API_BASE_URL=/api/v1
VITE_API_PROXY_TARGET=http://127.0.0.1:5002

# backend/.env
FLASK_RUN_HOST=0.0.0.0
FLASK_RUN_PORT=5002
FRONTEND_ORIGIN=http://localhost:5173
```

기본 접속 주소는 다음과 같습니다.

```txt
Frontend: http://localhost:5173
Backend:  http://localhost:5002
API:      http://localhost:5173/api/v1 -> http://127.0.0.1:5002/api/v1 proxy
```

## Supabase PostgreSQL

로컬 백엔드는 `backend/.env`의 `DATABASE_URL`을 사용합니다. Supabase Direct connection이 IPv6 문제로 막히는 경우 Session Pooler 주소를 사용합니다.

```env
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@<pooler-host>.supabase.com:5432/postgres?sslmode=require
```

## 프로젝트 구조

```txt
frontend/
  src/
    routes/
    pages/
    components/
    api/
    hooks/
    contexts/
backend/
  app/
    models/
    routes/
    services/
```

## 참고

- `app.py`는 이전 정적 HTML 확인용 서버입니다. 필요한 경우 `STATIC_RUN_HOST`, `STATIC_RUN_PORT` env 값을 사용합니다.
- 현재 개발 실행은 `npm run dev` 기준입니다.
