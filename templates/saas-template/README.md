# ⚡ MQnet Smart SaaS Template (15 SaaS Archetypes)

MQnet 통합 플랫폼의 표준 풀스택 SaaS 스타터 킷 및 15개 도메인별 실시간 아키타입 템플릿입니다.  
**FastAPI (Python)** 백엔드와 **Vite + React (JavaScript)** 프론트엔드, 그리고 **@mqnet/ui** 공통 디자인 시스템이 완벽히 통합되어 있습니다.

---

## 🌟 주요 특징

1. **15대 표준 SaaS 아키타입(Archetype) 프리셋 내장**:
   - 비즈니스, 교육, IoT 센서 관제, AI 비전, 미디어, 게임, 자동화 등 15개 도메인별 현실적인 KPI 지표, CRUD 모의 데이터, AI 코파일럿 프롬프트 제공.
2. **반응형 라이브 아키타입 탐색기 (UI Morphing)**:
   - 프론트엔드 대시보드에서 15개 SaaS 중 하나를 클릭하면 즉시 해당 도메인의 브랜드 컬러, 아이콘, 4대 KPI 지표, 운영 리스트, AI 코파일럿으로 인터페이스가 실시간 변환됩니다.
3. **표준화된 백엔드 코어 (FastAPI)**:
   - `shared.core.base_app.create_base_app` 팩토리 함수 상속.
   - CORS, 헬스체크 (`/health`), 요청 로깅, 표준 예외 처리기, 비즈니스 에러 핸들러 자동 등록.
   - Pydantic v2 기반 요청/응답 유효성 검증.
4. **글래스모피즘 현대적 디자인 시스템 (@mqnet/ui)**:
   - 다크 네온 글래스 테마 (`--mq-glass`), 세련된 블러 효과, 반응형 상태 비콘 (`ONLINE 🟢`).
   - 포털 통합 내비게이션 `PortalHeader` 내장 (포트 9000 메인 포털과 원활한 링크).
5. **1-클릭 CLI 스캐폴더**:
   - `python scripts/create_app.py --preset <app_id>` 명령 하나로 15개 아키타입 중 원하는 서비스를 즉시 독립 앱(`apps/<app_id>`)으로 복제 및 생성.

---

## 🧭 15개 SaaS 예시 아키타입 목록

| # | App ID | 서비스 명칭 | 아이콘 | 카테고리 | 기본 포트 | 핵심 기능 및 도메인 지표 |
|---|---|---|:---:|---|:---:|---|
| 1 | `studycafe` | 스터디카페 관리 | ☕ | Business | 9002 | 좌석 점유율(78.4%), NFC 도어락 원격 제어, 시간권/정기권 결제 |
| 2 | `store` | 매장 QR 주문 & POS | 🍽️ | Business | 9004 | 비대면 테이블 QR 주문, 주방 KDS 실시간 연동, 토스 결제 |
| 3 | `selfstudy` | 자기주도학습 관리 | 📚 | Education | 9003 | 일일 순공시간 측정, 주간 달성률(89.5%), AI 오답노트 |
| 4 | `grammer` | Grammar Quest (AI 영문법) | 🔤 | Education | 9014 | 수능/STEM 예문 무한 생성, 초저지연 Edge TTS 음성 섀도잉 발음 코칭 |
| 5 | `smartfarm` | 스마트팜 센서 관제 | 🌿 | IoT | 9005 | 온·습도/CO2/토양수분 IoT 텔레메트리, 환풍/급수 밸브 자동화 |
| 6 | `ai_gwansang` | AI 관상 분석 | 🔮 | AI Vision | 9009 | 얼굴 랜드마크 468포인트 스캔, Gemini 2.5 Flash 오행 운세 진단 |
| 7 | `face_analy` | 테토/에겐 AI 얼굴 분석 | 🧑‍🎨 | AI Vision | 9010 | 테토상 vs 에겐상 비율 판별 (60 FPS 온디바이스), 퍼스널 스타일링 |
| 8 | `photos` | 스마트 갤러리 (Immich AI) | 📸 | Media | 9006 | AI 얼굴인식 인물 분류, CLIP 시맨틱 자연어 검색, GPS 위치 지도 |
| 9 | `videobooth` | 레트로 TV 비디오 부스 | 📺 | Media | 9013 | 브라운관 CRT 주사선 필터, 웹캠 무손실 녹화, 음성 카운트다운 방명록 |
| 10 | `ytdownloader` | 유튜브 미디어 다운로더 | 🎬 | Media | 9008 | 4K MP4/MP3 고속 추출, 로컬 고속 캐싱, AI 영상 3줄 핵심 요약 |
| 11 | `mqhome` | MQnet 브랜드 홈페이지 | 🌐 | Portal | 9001 | 15개 통합 SaaS 솔루션 쇼케이스, B2B 도입 문의, 기술 백서 |
| 12 | `filebrowser` | 통합 파일 탐색기 | 📁 | Utility | 9007 | 대용량 클라우드 파일 관리, 미디어 스트리밍, AES-256 암호화 링크 |
| 13 | `clock` | 모던 스마트 클락 | ⏰ | Utility | 9012 | 네온 아날로그/디지털 듀얼 시계, 글로벌 5대 도시 세계시, 뽀모도로 |
| 14 | `ironman` | 아이언맨 제스처 게임 | 🎮 | Game | 9011 | 실시간 핸드 트래킹 모션 인식, p5.js 리펄서 빔, 글로벌 랭킹 리더보드 |
| 15 | `n8n` | n8n AI 워크플로우 자동화 | ⚡ | Automation | 5678 | 농협 계좌 입금 알림 자동 기장, 토스 결제 슬랙 알림, DB 정기 백업 |

---

## 📁 프로젝트 구조

```text
templates/saas-template/
├── backend/
│   ├── config.py          # BaseConfig 상속 앱 설정 (동적 프리셋 메타데이터 연동)
│   ├── main.py            # FastAPI 코어 앱 (CRUD, Metrics, AI Copilot, Telemetry API)
│   └── presets.py         # 15개 SaaS 아키타입의 KPI, 기본 데이터, AI 프롬프트 정의
├── frontend/
│   ├── index.html         # Google Fonts (Pretendard & Outfit) 연동
│   ├── package.json       # React 18, Vite 5, @mqnet/ui
│   ├── vite.config.js     # 경량 Vite 번들러 설정
│   └── src/
│       ├── App.jsx        # 15대 아키타입 전환기, 4대 KPI 카드, CRUD, AI 스튜디오, 스캐폴더
│       ├── index.css      # 글래스모피즘 테마 토큰, 스크롤바, 상태 비콘 애니메이션
│       └── main.jsx       # React 마운트 엔트리포인트
└── README.md              # 템플릿 사용 및 개발자 가이드
```

---

## 🚀 빠른 시작 (Local Run)

### 1. 백엔드 실행
```bash
# 워크스페이스 루트에서 실행
python -m uvicorn templates.saas-template.backend.main:app --port 9015 --reload
```
- API Swagger 문서: [http://localhost:9015/docs](http://localhost:9015/docs)
- 시스템 헬스체크: [http://localhost:9015/health](http://localhost:9015/health)

### 2. 프론트엔드 개발 서버 실행
```bash
cd templates/saas-template/frontend
npm install
npm run dev
```
- 프론트엔드 대시보드: [http://localhost:3000](http://localhost:3000)

### 3. 프로덕션 빌드 검증
```bash
cd templates/saas-template/frontend
npm run build
```

---

## 🛠️ 새 SaaS 앱 생성 (CLI Scaffolding)

이 템플릿을 기반으로 15개 아키타입 중 하나를 복제하여 새로운 서비스로 생성하려면 아래 명령어를 실행합니다:

```bash
# 예시 1: 스터디카페 아키타입 기반 신규 서비스 생성
python scripts/create_app.py --preset studycafe --id my_cafe --name "메가 스터디카페" --port 9016

# 예시 2: 스마트팜 아키타입 기반 신규 서비스 생성
python scripts/create_app.py --preset smartfarm --id my_farm --name "스마트 수직농장" --port 9017

# 예시 3: 커스텀 SaaS 앱 생성
python scripts/create_app.py --id petcare --name "스마트 펫케어" --icon "🐾" --category "iot" --port 9018
```

명령 실행 후 생성된 `apps/<app_id>` 디렉토리에서 프론트엔드 빌드 후 바로 프로덕션 수준의 SaaS를 구동할 수 있습니다.
