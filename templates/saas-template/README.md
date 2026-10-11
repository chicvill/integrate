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
