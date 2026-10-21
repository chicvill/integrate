# ⚡ MQnet Canonical SaaS Template
> **표준 규격:** MQnet SaaS Application Development Guide (`NEW_APP_DEVELOPMENT_GUIDE.md`) 준수  
> **핵심 철학:** **Zero Build Step 번들리스 Vanilla JS/CSS**, **완전 분리형 FastAPI 백엔드**, **NoCacheStaticFiles 캐시 방어**, **공통 통합 인증(`/shared/ui/auth.js`) 내장**

MQnet 통합 플랫폼의 표준 풀스택 SaaS 골격 템플릿입니다.  
신규 앱 생성 시 복잡한 빌드 도구 의존성 없이 즉시 실행 및 배포 가능한 완벽한 프로덕션 규격을 제공합니다.

---

## 🌟 핵심 아키텍처 원칙

1. **빌드 프리(Zero Build Step) 번들리스 프론트엔드**:
   - `npm install`이나 `npm run build` 없이 브라우저 네이티브 ES Module (`import`/`export`) 기반으로 동작.
   - 코드 수정 즉시 브라우저 새로고침만으로 변경사항이 100% 반영되는 초고속 개발 워크플로우.
2. **정적 캐시 고착 원천 차단 (Cache Busting & NoCacheStaticFiles)**:
   - 중첩 `@import`를 금지하고 `index.html`에서 직접 `<link>` 태그와 버전 쿼리(`?v=1.0`) 로드.
   - 단일 게이트웨이(Port 8000/9000)에서 `NoCacheStaticFiles`를 통해 정적 파일 서빙.
3. **표준 데이터베이스 & 비동기 워커 코어**:
   - `shared.core.base_database.Base` 상속 SQLAlchemy ORM 모델 내장 (게이트웨이 기동 시 자동 테이블 생성).
   - CPU/IO 집약적 작업(AI 분석, 미디어 처리)은 `ThreadPoolExecutor`를 통해 비동기 이벤트 루프 차단(Blocking) 방지.
4. **동적 API Base URL 결정 (`getApiBase`)**:
   - 단독 실행(`http://localhost:{PORT}`), 서브패스(`http://domain/{APP_ID}`), 서브도메인(`{APP_ID}.domain`) 모두 소스 수정 없이 자동 적응.
5. **통합 인증 (`MQnetAuth v2.0`) 연동**:
   - `/shared/ui/auth.js` 모듈과 연동하여 로그인/회원가입 모달 및 JWT 로컬스토리지 자동 주입.
6. **다중 매장 / 멀티 테넌트 (Multi-Branch) 기본 지원**:
   - 상단 헤더의 지점 셀렉터(`branchSelector`)를 통해 실시간 매장별 데이터 분리 및 즉시 전환.
   - `AppBranch` 모델 및 `GET /branches`, `POST /branches`를 통한 신규 가맹점/지점 1-클릭 등록.
   - 모든 항목은 `branch_id` 기반으로 지점별 독립 관리 또는 본사 통합 관제 지원.
7. **계정 권한별 로그인 동적 분기 (Role & Branch Dynamic Routing)**:
   - `admin/1212`: 최고 관리자 -> 본사 매장 & 수납 관리 센터 (`branches.html`)
   - `admin01/1212`: 제1매장 점주/실장 -> 제1매장 전용 관제 (`index.html?branch=main`)
   - 일반 회원: 일반 이용 대시보드로 자동 분기.
8. **점주/실장 등업 신청 및 본사 승인 워크플로우**:
   - 개인이 회원가입한 후 `[점주/관리자 등업 신청]` 제출 -> 본사 관리자가 `branches.html`에서 검토 후 원클릭 승인/반려.
9. **비즈니스 도메인 논리 정합성 & 단일 정규화 (Domain Logic & Normalization)**:
   - 후불 입주월 비과세/익월 청구 등 현실 업무 규칙을 반영하여 '가짜 체납(Ghost Overdue)' 오판정을 원천 배제.
   - 지점 코드 에일리어스(`normalize_branch_id`)와 수납/계약 기본값(`fallback`)을 서비스 진입점에서 1회 단일 정규화(Single Source of Truth)하여 DB 불일치 방어.
10. **예외·오류 시각적 안내 & 회복 탄력성 UX (Alert Banner & State Restoration)**:
   - 투박한 브라우저 `alert()`를 퇴출하고, 모달/화면 내 맥락별 컬러 안내 배너(`updateAppAlert`) 기본 내장:
     - ⚠️ 황색(Warning/Info): 미납 없음 / 이미 전액 완납 / 중복 실행 방지
     - ⚖️ 주황색(Diff/Mismatch): 입력 금액과 청구 금액 차액 실시간 계산 및 확인 안내
     - ❌ 적색(Error): 서버/네트워크 실패 시 구체적 원인 및 복구 안내 (무음 에러 삼킴 원천 차단)
     - ✅ 녹색(Success): 처리 완료 및 영수증/클립보드 연계
   - 전산 처리 시 버튼 로딩 스피너 및 비활성화(Debounce) 적용, 에러 발생 시 버튼 자동 원상 복구 보장.
11. **스마트 인제스트 & 모바일 카메라 AI 스캔 코어 (Universal Smart Ingest & Camera Core)**:
    - 키보드 타이핑 없는 초고속 모바일 현장 전산 입력 기본 제공:
      - 💬 **알림 문자 / 카톡 자동 파싱**: 입금, 결제, 승인, 출결 등 문자 데이터를 자동 파싱하여 원클릭 수납/반영.
      - 📊 **구글 스프레드시트 URL**: 클라우드 장부 URL 실시간 감지 및 양방향 동기화.
      - 📁 **로컬 파일 경로**: `.xlsx`, `.csv`, `.tsv` 데이터 파일 및 `.jpg`, `.png` 사진 파일 자동 감지.
      - 📷 **클립보드 사진(Ctrl+V) & 모바일 후면 카메라(`capture="environment"`)**: 영수증, 계약서, 신청서, 전표를 실시간 Gemini Vision AI로 OCR 파싱하여 자동 등록.



---

## 📁 표준 프로젝트 구조

```text
templates/saas-template/
├── backend/
│   ├── __init__.py
│   ├── config.py              # BaseConfig 상속 (APP_ID, PORT, STORAGE_DIR)
│   ├── main.py                # 단독 로컬 실행용 FastAPI 엔트리포인트
│   ├── schemas.py             # Pydantic v2 입출력 데이터 모델
│   ├── db/
│   │   ├── __init__.py
│   │   ├── database.py        # Base, get_db, SessionLocal 세션 팩토리
│   │   └── models.py          # SQLAlchemy 테이블 모델 (Base 상속)
│   ├── routers/
│   │   ├── __init__.py
│   │   └── main_router.py     # prefix="" 로 정의된 핵심 API 라우터
│   └── services/
│       ├── __init__.py
│       └── core_service.py    # 비즈니스 로직 및 ThreadPoolExecutor 워커
└── frontend/
    ├── index.html             # 메인 UI 구조 (CSS/JS 직접 링크, 캐시 버스팅)
    ├── style.css              # 앱 기본 스타일
    ├── css/
    │   ├── variables.css      # 디자인 토큰 (네온 다크, 글래스모피즘, 폰트)
    │   ├── layout.css         # Grid/Flexbox 컨테이너 및 뷰포트 배치 (flex-shrink:0 방어)
    │   └── components.css     # 버튼, 모달, 카드, 뱃지 등 UI 컴포넌트
    ├── app.js                 # 프론트엔드 메인 엔트리포인트 (초기화 및 모듈 바인딩)
    └── js/
        ├── api.js             # getApiBase() 기반 백엔드 통신 모듈 & X-App-ID 헤더
        ├── state.js           # 전역 반응형 상태 저장소
        ├── ui.js              # DOM 렌더링 및 UI 유틸리티
        └── modals.js          # 팝업 및 조작 모달 제어
```

---

## 🚀 빠른 시작 (Local Run)

### 1. 단독 백엔드 + 프론트엔드 실행
```bash
# 워크스페이스 루트에서 실행
py -3.14 -m uvicorn templates.saas-template.backend.main:app --port 8015 --reload
```
- 웹 대시보드: [http://localhost:8015](http://localhost:8015)
- API Swagger 문서: [http://localhost:8015/docs](http://localhost:8015/docs)
- 시스템 상태 조회: [http://localhost:8015/api/status](http://localhost:8015/api/status)

---

## 🛠️ 새 SaaS 앱 생성 (CLI Scaffolding)

이 표준 템플릿을 기반으로 새로운 독립 SaaS 서비스를 생성하려면 아래 명령어를 실행합니다:

```bash
# 예시: 스마트 펫케어 앱 생성
py -3.14 scripts/create_app.py --id petcare --name "스마트 펫케어" --icon "🐾" --category "iot" --port 8016
```
- 생성 완료 즉시 `apps/petcare/` 디렉토리가 구성되며, 별도의 빌드 과정 없이 바로 게이트웨이 또는 단독으로 실행 가능합니다.

---

## 🔐 암호화된 시크릿 관리 (In-Repo Encrypted Secrets)

MQnet 통합 플랫폼은 민감한 환경변수(DB 접속 주소, 결제 비밀키, Gemini API Key 등)가 Git 저장소나 클라우드 배포 시 누락되거나 평문으로 유출되는 문제를 원천 차단하기 위해 **암호화된 볼트(Vault) 파이프라인**을 표준 내장하고 있습니다.

### 1. 도입 배경 및 해결 과제

- **기존 방식의 한계**:
  - 일반적인 `.env`는 보안을 위해 `.gitignore`로 제외되므로, 신규 배포나 서버 이전 시 매번 수동으로 키를 복사/전달해야 했습니다.
  - 키가 누락되면 런타임에 500/502 오류가 발생하거나, AI 서비스가 모의 응답(mock fallback)으로만 동작하는 원인 규명이 어려운 장애가 빈번히 발생했습니다.
  - 반대로 `.env`를 그대로 Git에 올리면 외부 노출로 인한 심각한 보안 사고가 발생합니다.
- **해결책 (In-Repo Encrypted Secrets)**:
  - 비밀키를 표준 암호화(HMAC-SHA256 CTR / AES)하여 **`.env.encrypted` 파일 형태로 코드와 항상 함께 Git으로 안전하게 전달**합니다.
  - 서버나 다른 개발 환경은 별도의 수동 복사 없이 `git pull`만으로 모든 최신 시크릿을 안전하게 수신합니다.
  - 앱 기동 시 **디스크에 평문 파일을 남기지 않고 프로세스 메모리(`os.environ`)에만 즉시 복호화 주입**하므로 디스크 유출 위험이 없습니다.

---

### 2. 전체 전달 및 배포 파이프라인 (End-to-End Pipeline)

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. 개발자 로컬 환경 (Local Developer)                                                       │
│    .env.shared (평문 키 작성 / .gitignore로 Git 추적 차단)                                   │
│         │                                                                                   │
│         ▼ `python shared/core/vault.py` 실행                                                │
│    .env.encrypted (암호문 생성)                                                             │
└─────────┬───────────────────────────────────────────────────────────────────────────────────┘
          │
          ▼ 2. 코드와 함께 전달 (Git Commit & Push)
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ GitHub / 원격 리포지토리 (Secure Transport)                                                  │
│    - .env.encrypted (안전하게 암호화된 상태로 코드와 함께 보관 & 동행)                         │
└─────────┬───────────────────────────────────────────────────────────────────────────────────┘
          │
          ▼ 3. 배포 서버 / 협업 환경 (Deployment Server / Coolify / Docker)
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ `git pull`로 .env.encrypted 수신                                                             │
│         │                                                                                   │
│         ▼ FastAPI 부팅 단계 (`BaseConfig` / `gateway/main.py`)                               │
│    `load_encrypted_env()`가 .env.encrypted를 메모리 복호화                                  │
│         │                                                                                   │
│         ▼ (디스크 쓰기 없음 / In-Memory Injection)                                           │
│    `os.environ`에 실시간 환경변수 자동 주입 완료! (GEMINI_API_KEY, DATABASE_URL 등)         │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 3. 단계별 환경변수 암호화 및 전달 절차 (Step-by-Step)

#### [1단계] 로컬에서 환경변수 정의 (`.env.shared`)
- 워크스페이스 루트의 `.env.shared` 파일에 신규 API Key나 환경변수를 평문으로 작성합니다.
- *(이 파일은 `.gitignore`에 등록되어 있어 원격 저장소에 절대 평문으로 커밋되지 않습니다.)*
```ini
# 예시: 워크스페이스 루트의 .env.shared
GEMINI_API_KEY=AIzaSyD...실제_비밀키...
DATABASE_URL=sqlite:///./integrat.db
JWT_SECRET=Fz8vH6_Y_9V7lDZb9uJc7mR2nL1pT4aQ5sX3k6M1z4Y=
STRIPE_SECRET_KEY=sk_test_51...
```

#### [2단계] 볼트 암호화 및 자동 동기화 (`auto_sync_vault` & Git Hook)
> **💡 자동 암호화 지원 (수동 실행 불필요):**  
> 개발자가 암호화 명령을 매번 기억하지 않아도 누락되지 않도록 **2중 자동 동기화 방어선**이 구축되어 있습니다.
> 1. **서버 기동 및 핫리로드 시 자동 감지:** 앱 실행 또는 소스 변경 감지 시 `BaseConfig`가 `.env.shared`의 수정 시간을 확인하여 변경되었으면 `.env.encrypted`를 백그라운드에서 자동 재암호화합니다.
> 2. **Git 커밋 시 자동 암호화 및 스테이징 (`Git Pre-Commit Hook`):** `git commit` 실행 시 훅이 자동으로 `.env.shared` 변경 사항을 `.env.encrypted`로 암호화하고 커밋 대상(`git add`)에 자동 포함시킵니다.

- **수동 동기화/재암호화 필요 시:**
  ```bash
  python shared/core/vault.py sync    # 변경 감지 시에만 동기화
  python shared/core/vault.py         # 강제 즉시 암호화
  ```
- **성공 메시지 출력 예시:**
  ```text
  [SUCCESS] Synced .env.shared -> .../.env.encrypted
  [INFO] Ciphertext size: 5344 bytes
  ```

#### [3단계] 코드와 함께 Git 커밋 및 전달 (Push)
- `.env.encrypted`는 안전한 암호문이므로 Git 저장소를 통해 항상 코드와 함께 전달됩니다. (Git 훅에 의해 커밋 시 자동 포함됨)
```bash
git push origin main
```

#### [4단계] 수신 서버에서의 자동 복호화 (Zero-Config Run)
- 배포 서버(GCP VM, Coolify, Docker 컨테이너 등)에서는 코드를 `git pull`하는 순간 최신 `.env.encrypted`가 함께 들어옵니다.
- `shared.core.base_config.BaseConfig` 또는 `gateway/main.py` 기동 시 자동으로 `load_encrypted_env()`가 실행되어 메모리(`os.environ`)에 주입됩니다.
- 개발자나 운영자가 서버 콘솔에 접속하여 수동으로 환경변수를 복사/붙여넣기할 필요가 전혀 없습니다.

---

### 4. 개발 및 디버깅 유틸리티 (Verification)

#### 암호화 내용 확인 (복호화 검증)
로컬에서 현재 `.env.encrypted`에 정상적으로 모든 키가 포함되어 있는지 복호화하여 확인하고 싶을 때:
```bash
python shared/core/vault.py decrypt
```

#### 환경변수 우선순위 계층 (Precedence)
1. **호스트 시스템 환경변수** (Docker `-e` 또는 OS 환경변수): 최우선 적용
2. **로컬 평문 `.env` / `.env.shared`** (로컬 개발 시): 우선 적용
3. **`.env.encrypted` (볼트 암호문)**: 기존 변수가 비어있는 경우에만 자동 주입 (`override=False` 원칙)

#### 마스터 키 커스텀
기본 마스터 키 외에 별도의 격리된 마스터 키를 사용하려면 시스템 환경변수에 `MASTER_CRYPTO_KEY`를 지정하여 운용할 수 있습니다.

---

## 📦 듀얼 모드 독립 분리 및 앱 추출기 (`export_app.py`)

MQnet 통합 플랫폼의 모든 앱은 **중앙 SaaS 모노레포에서 통합 개발·검증**하면서도, 고객의 요구(전용 클라우드 구축, 관리실 PC 인트라넷 폐쇄망 운영, 패키지 판매)에 맞춰 언제든 **단독 실행형(Standalone) 패키지로 원클릭 분리 추출**할 수 있는 **듀얼 모드(Dual-Mode)** 표준을 지원합니다.

### 1. 앱 단독 패키지 원클릭 추출 명령어

```bash
# 기본 사용법: 특정 앱을 단독 납품 폴더 및 ZIP 압축 파일로 추출
py scripts/export_app.py --app rent --zip

# 사용자 정의 출력 경로 지정
py scripts/export_app.py --app petcare --output ./dist/petcare_v1.0 --zip
```

### 2. 추출되는 단독 패키지 구성품

추출기(`export_app.py`)가 실행되면 아래와 같은 완전 자립형 솔루션 패키지가 자동 생성됩니다:

```text
dist/{app_id}_standalone/
├── Dockerfile                  # 단독 컨테이너 빌드 명세
├── docker-compose.yml          # 단독 1-클릭 실행 컴포즈 (포트 80 자동 매핑)
├── standalone_runner.py        # FastAPI API + 프론트엔드 단일 통합 진입점
├── START.bat                   # 윈도우 관리실 PC 바탕화면 원클릭 실행기
├── UPDATE.bat                  # 기존 DB 보존하며 10초 만에 새 버전 갱신
├── requirements.txt            # 최소 필수 라이브러리 목록
├── README.md                   # 고객/관리자용 1분 설치 및 운영 매뉴얼
├── data/                       # ★ 고객 DB 영구 보존 볼륨 마운트 디렉토리
├── media/                      # 첨부파일 및 영수증 사진 저장소
├── frontend/                   # 번들리스 정적 웹 클라이언트
├── backend/                    # FastAPI 마이크로서비스 백엔드
└── shared/                     # 필수 공통 코어 라이브러리 번들
```

### 3. 판매 및 운영 시나리오별 배포 방법

#### ① 고객 관리사무소 로컬 PC / 사내 인트라넷 운영 (정보 보호 폐쇄망)
- **대상**: 임차인 개인정보 및 수납 장부의 외부 클라우드 유출을 극도로 꺼리는 개인 건물주
- **설치**: 압축 해제 후 `START.bat` 더블클릭 -> Docker 또는 로컬 Python으로 자동 기동
- **장점**: **외부 인터넷 연결 없이도 사내 공유기(Wi-Fi) 내에서 스마트폰/PC 관제 가능**, 클라우드 비용 0원, 데이터 100% 사내 하드디스크 보관

#### ② 고객 전용 클라우드 서버 운영 (독립 GCP VM / AWS EC2)
- **대상**: 여러 관리자가 외부/모바일에서 24시간 원격 관제하길 원하는 임대법인/위탁사
- **설치**: 고객 소유 클라우드에 접속하여 `docker compose up -d --build` 실행
- **장점**: 본사 중앙 서버와 물리적으로 완전히 분리되어 트래픽/데이터 간섭 제로, 독자 도메인 연결 용이

#### ③ 데이터 보존 원클릭 업데이트 (`UPDATE.bat`)
- 데이터베이스(`rent.db` 등)는 프로그램 코드가 아닌 `./data/` 폴더에 물리적으로 격리 보존됩니다.
- 신규 기능이 추가된 업데이트 패키지를 전달받은 후 `UPDATE.bat`을 더블클릭하면, **기존의 모든 계약·수납·지출 데이터는 100% 안전하게 유지된 채 10초 만에 최신 프로그램으로 자동 갱신**됩니다.
