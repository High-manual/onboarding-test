# Onboarding 시험 & 팀 매칭 (Next.js + Supabase)

OT 날 진행되는 객관식 시험과 점수 기반 팀 매칭을 빠르게 배포할 수 있는 Next.js 앱입니다. 브라우저에서는 익명 로그인 + RLS로 학생 데이터만 접근하고, 관리자 기능은 서버에서 Supabase Service Role Key로 실행합니다.

## 환경 변수

`.env.local`에 값을 채운 뒤 `NEXT_PUBLIC_` 프리픽스 규칙을 지켜주세요(브라우저 번들링 허용).

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # 서버 전용
ADMIN_PASSWORD=...              # 관리자 단순 비번
```

## Supabase 준비

1. 프로젝트 생성 후 **Auth → Providers**에서 Anonymous Sign-ins 활성화.
2. SQL Editor에 스키마 및 RLS 정책 실행:
   - `students`, `questions`, `attempts`, `responses`, `team_runs`, `teams`, `team_members` 테이블 생성
   - `students/attempts/responses`는 `auth.uid()` 기반 RLS 정책 설정
3. `questions`에 최소 30문항을 insert(예시 3문항은 SQL에 포함되어 있음).

## 로컬 개발

패키지 설치 후 개발 서버를 실행합니다. (네트워크 정책으로 설치가 막힐 수 있으니 환경에 맞게 레지스트리를 설정하세요.)

```bash
npm install
npm run dev
```

## 주요 화면/플로우

- `/start`: 이름 입력 → `supabase.auth.signInAnonymously()` → `students` upsert → `/exam` 이동
- `/exam`: 문항 로드(최대 30개) → 로컬 선택 상태 → `/api/submit`으로 제출/채점 → 점수 표시
- `/admin/login`: `ADMIN_PASSWORD` 비교 후 httpOnly 쿠키 발급
- `/admin/attempts`: 서비스 롤 키로 응시 목록 조회 + 점수순 팀 매칭 실행(라운드로빈)

## API 개요

- `POST /api/attempts`: 인증된 학생의 응시 생성
- `GET /api/attempts`: 최신 응시 조회
- `GET /api/questions`: 문항 30개 조회
- `POST /api/submit`: 서비스 롤 키로 채점/응시 업데이트
- `POST /api/admin/login`: 관리자 세션 쿠키 발급
- `GET /api/admin/attempts`: 전체 응시 조회(관리자)
- `POST /api/admin/team-run`: 점수 순 라운드로빈 팀 매칭 생성
- `POST /api/admin/team-move`: 팀 편성 수정(관리자)

## 구현 메모

- 학생 플로우는 전부 Supabase 익명 세션 + RLS로 보호됩니다.
- 관리자 API만 서비스 롤 키를 사용하며, 간단 비밀번호로 쿠키 세션을 부여합니다.
- LangGraph 기반 리포트 생성/팀 편성 인터럽트는 API 레이어에서 확장할 수 있도록 채점/팀 매칭 로직을 분리해 둡니다.
