# AI 관상 SaaS

이 프로젝트는 단일 로컬 앱을 다중 사용자 SaaS 구조로 전환한 운영형 베이스입니다.

## 핵심 기능

- 멀티테넌트 구조: tenantId 기반 격리
- 사용자 인증: 로그인 / 회원가입 / 토큰 기반 권한 체크
- 세션 관리: 사용자별 분석 세션 생성, 조회
- 요금제 모델: Starter / Pro / Enterprise
- 결제 시뮬레이션: `/api/billing/checkout` 제공
- 배포 준비: Dockerfile / Render 배포 설정 포함

## 실행 방법

1. 의존성 설치
   ```bash
   npm install
   ```

2. 환경 변수 설정
   ```bash
   cp .env.example .env
   ```

3. 개발 서버 실행
   ```bash
   npm run dev
   ```

4. 브라우저 접속
   - Frontend: http://localhost:5173
   - API Health: http://localhost:4000/api/health

## API 예시

### 요금제 목록
```bash
curl http://localhost:4000/api/plans
```

### 회원가입
```bash
curl -X POST http://localhost:4000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId":"demo-office",
    "fullName":"홍길동",
    "email":"hong@example.com",
    "password":"password123",
    "planId":"pro"
  }'
```

### 세션 생성
```bash
curl -X POST http://localhost:4000/api/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"tenantId":"demo-office","userName":"홍길동"}'
```

### 분석 실행
```bash
curl -X POST http://localhost:4000/api/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "tenantId":"demo-office",
    "sessionId":"<sessionId>",
    "userName":"홍길동",
    "imageData":"data:image/png;base64,example"
  }'
```

## 배포

### Docker 실행
```bash
docker build -t ai-physiognomy-saas .
docker run -p 4000:4000 ai-physiognomy-saas
```

### Render 배포
- GitHub 레포지토리 연결
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`
- 환경 변수: `PORT=4000`

## 다음 단계

- 실제 Gemini API 키 연동
- PostgreSQL 또는 Supabase DB 마이그레이션
- Stripe 결제 계좌 연결
- 관리자 대시보드/권한 관리
- 보안 로깅 및 모니터링 추가
