# 배포 가이드

## 1. Render 배포

1. GitHub 저장소 연결
2. Render에서 새 Web Service 생성
3. 루트 디렉터리를 이 프로젝트로 설정
4. Build Command 입력
   ```bash
   npm install && npm run build
   ```
5. Start Command 입력
   ```bash
   npm run start
   ```
6. 환경 변수 추가
   ```bash
   PORT=4000
   NODE_ENV=production
   FRONTEND_URL=https://your-frontend-url
   GEMINI_API_KEY=your_key
   SUPABASE_URL=your_url
   SUPABASE_SERVICE_ROLE_KEY=your_key
   STRIPE_SECRET_KEY=your_key
   ```

## 2. GitHub Actions

- 저장소의 Secrets에 아래 값 추가
  - `RENDER_API_KEY`
  - `RENDER_SERVICE_ID`

- `main` 브랜치에 push하면 자동 배포됩니다.

## 3. Supabase 설정

- SQL Editor에서 [supabase/schema.sql](supabase/schema.sql) 실행
- supabase project URL과 anon/service role key를 환경 변수로 넣기

## 4. Stripe 설정

- 테스트 모드 사용
- webhook 엔드포인트는 필요 시 추가 구성
- 실제 결제는 서버에 연결하여 처리 가능

## 5. 운영 체크리스트

- 로그 확인
- API health 확인
- 세션 생성 테스트
- 결제 테스트
- AI 분석 테스트
- 사용자별 테넌트 분리 확인
