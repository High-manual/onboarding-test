# 프로젝트 역량 평가 & 팀 매칭 시스템

OT 날 진행되는 CS/협업/AI 역량 평가 시험과 자동 팀 매칭을 제공하는 Next.js 앱입니다. Supabase를 활용한 실시간 데이터 관리와 Vercel/Netlify를 통한 무료 배포가 가능합니다.

## 주요 기능

### 수강생 기능
- **익명 로그인**: 이름만 입력하면 시작
- **30문항 역량 평가**: CS(10) + 협업(10) + AI(10) 역량 측정
- **실시간 결과 분석**: 
  - 총점 및 카테고리별 점수
  - 역량별 시각화 차트
  - 강점/약점 분석 및 추천사항

### 관리자 기능
- **응시 현황 대시보드**: 전체 수강생 점수 및 제출 현황
- **팀 매칭 생성**:
  - 팀 개수 직접 입력
  - 점수 순 (라운드로빈) / 역량 균형 (지그재그) 방식 선택
- **팀 편성 수정**: 드래그앤드롭 방식으로 팀원 이동

## 평가 문항 구성

### CS 역량 (10문항)
- 에러 디버깅 및 문제 해결
- API 성능 최적화
- Git 버전 관리
- 웹 성능 개선
- 보안 및 데이터베이스 기초

### 협업 역량 (10문항)
- 코드 리뷰 및 피드백
- 팀 커뮤니케이션
- Git 협업 전략
- 문서화 및 지식 공유
- 갈등 해결 및 우선순위 설정

### AI 역량 (10문항)
- LLM 프롬프트 엔지니어링
- AI 코드 생성 도구 활용
- AI 출력 검증 및 수정
- AI를 활용한 디버깅
- AI 윤리 및 한계 이해

## 환경 변수

`.env.local` 파일을 생성하고 다음 값을 설정하세요:

```env
# Supabase 설정 (필수)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# 관리자 비밀번호 (필수)
ADMIN_PASSWORD=your_admin_password

# OpenAI API 키 (선택 - AI 리포트 생성용)
OPENAI_API_KEY=your_openai_api_key
```

**OpenAI API 키 설정**:
- **있을 때**: LangGraph가 GPT-4o-mini를 사용해 개인화된 리포트 생성
- **없을 때**: 규칙 기반 fallback 로직으로 리포트 생성 (기본 기능은 정상 작동)

## Supabase 설정

### 1. Auth 설정
- **Auth → Providers**에서 Anonymous Sign-ins 활성화

### 2. 데이터베이스 스키마
`docs/new_questions.sql` 파일의 질문 데이터를 Supabase SQL Editor에서 실행하여 30개 질문을 추가합니다.

### 3. RLS 정책
- `students`, `attempts`, `responses` 테이블에 `auth.uid()` 기반 RLS 정책 적용
- 관리자 API는 Service Role Key로 RLS 우회

## 로컬 개발

```bash
npm install
npm run dev
```

## 배포

### Vercel 배포
```bash
vercel
```

### Netlify 배포
```bash
netlify deploy --prod
```

환경변수는 각 플랫폼의 대시보드에서 설정하세요.

## 주요 화면 플로우

1. **홈페이지 (`/`)**: 
   - 프로젝트 소개 및 기능 설명
   - 수강생/관리자 진입 버튼

2. **시작 페이지 (`/start`)**: 
   - 이름 입력
   - 익명 로그인 자동 처리
   - students 테이블에 저장

3. **시험 페이지 (`/exam`)**: 
   - 30문항 객관식 문제
   - 카테고리별 라벨 표시
   - 이전/다음 네비게이션
   - 제출 후 즉시 결과 표시

4. **결과 페이지** (시험 완료 후):
   - 총점 및 역량별 점수
   - 프로그레스 바 시각화
   - AI 생성 리포트 (강점/약점/추천)

5. **관리자 로그인 (`/admin/login`)**: 
   - 비밀번호 인증

6. **관리자 대시보드 (`/admin/attempts`)**: 
   - 전체 응시 현황 테이블
   - 팀 매칭 생성 및 결과 표시
   - 팀원 이동 기능

## API 엔드포인트

### 학생용
- `GET /api/questions` - 문제 30개 조회
- `POST /api/attempts` - 응시 생성
- `GET /api/attempts` - 본인 응시 조회
- `POST /api/submit` - 답안 제출 및 채점

### 관리자용
- `POST /api/admin/login` - 관리자 로그인
- `GET /api/admin/attempts` - 전체 응시 조회
- `POST /api/admin/team-run` - 팀 매칭 생성
- `POST /api/admin/team-move` - 팀원 이동

## 기술 스택

- **Frontend**: Next.js 14, React 18, TypeScript
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Anonymous Auth + RLS
- **AI**: 
  - LangGraph (워크플로우)
  - OpenAI GPT-4o-mini (리포트 생성, 선택사항)
- **Deployment**: Vercel / Netlify

## LangGraph 워크플로우

리포트 생성 프로세스:

1. **Analyze Node**: 역량별 점수 분석 → 강점/약점 파악
2. **Summary Node**: OpenAI GPT-4o-mini로 종합 평가 생성 (API 키 없으면 규칙 기반)
3. **Recommend Node**: GPT-4o-mini로 개인화된 학습 추천 (API 키 없으면 규칙 기반)

```
START → Analyze → Summary → Recommend → END
         ↓         ↓          ↓
      강점/약점  종합평가   맞춤추천
```

## 개발 노트

- 학생 데이터는 RLS로 보호되어 본인만 조회 가능
- 관리자 API는 Service Role Key 사용으로 RLS 우회
- 팀 매칭 알고리즘은 프론트엔드에서 시뮬레이션
- AI 리포트는 LangGraph를 통해 생성

## 라이선스

MIT
