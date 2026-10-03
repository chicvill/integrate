# MQnet SaaS 플랫폼 신규 앱 개발 표준 적용 가이드
> **문서 버전:** v1.0.0 (2026-10-03 기준)  
> **대상:** MQnet 통합 플랫폼 내 3번째 이후 신규 SaaS 앱을 설계·개발·배포하는 모든 엔지니어  
> **목적:** 1번째 앱(`YTDownloader`) 및 2번째 앱(`photos`) 개발을 거치며 확립된 아키텍처 규칙과 발생했던 문제 해결책을 표준화하여, 다음 앱 개발 시 시행착오 없이 안정적으로 골격을 적용할 수 있도록 함.

---

## 📑 목차
1. [아키텍처 철학 및 핵심 원칙](#1-아키텍처-철학-및-핵심-원칙)
2. [표준 디렉토리 구조 규격](#2-표준-디렉토리-구조-규격)
3. [백엔드 (FastAPI) 개발 기준](#3-백엔드-fastapi-개발-기준)
4. [프론트엔드 (Vanilla JS/CSS) 개발 기준](#4-프론트엔드-vanilla-jscss-개발-기준)
5. [게이트웨이 (gateway/main.py) 연동 규격](#5-게이트웨이-gatewaymainpy-연동-규격)
6. [성능 및 리소스 최적화 기준](#6-성능-및-리소스-최적화-기준)
7. [배포 및 핫 싱크(Hot-Sync) 워크플로우](#7-배포-및-핫-싱크hot-sync-워크플로우)
8. [신규 앱 출시 전 10대 필수 체크리스트](#8-신규-앱-출시-전-10대-필수-체크리스트)

---

## 1. 아키텍처 철학 및 핵심 원칙

MQnet 통합 플랫폼은 **"독립적인 단독 개발(Standalone)이 가능하면서도, 단일 게이트웨이(Gateway)를 통해 일관된 SaaS 서비스로 통합 운영되는 하이브리드 아키텍처"**를 지향합니다.

```
┌─────────────────────────────────────────────────────────────┐
│                 단일 진입점: Gateway (Port 8000/9000)        │
│   - 서브도메인 라우팅 (app.chicvill.store -> /app/)          │
│   - 통합 인증 (/auth) 및 멀티테넌트 미들웨어 (X-App-ID)        │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
       ┌───────▼────────┐              ┌───────▼────────┐
       │ /api/{app_id}  │              │    /{app_id}   │
       │ (백엔드 라우터) │              │ (프론트엔드 정적)│
       └───────┬────────┘              └───────┬────────┘
               │                               │
┌──────────────▼───────────────────────────────▼──────────────┐
│        apps/{app_id}/ (각 마이크로 앱 독립 코드베이스)       │
│   - backend/ : FastAPI 라우터, 서비스 로직, DB 모델          │
│   - frontend/: HTML/CSS/JS (Vanilla 모듈 번들리스 아키텍처)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────▼───────────────┐
               │    shared/ (공통 기반 프레임워크) │
               │ - BaseConfig, BaseDatabase    │
               │ - 통합 JWT Auth, Gemini AI    │
               └───────────────────────────────┘
```

### 3대 핵심 원칙
1. **비침습성 (Non-Invasive Isolation):**  
   새로운 앱을 추가하거나 수정할 때 기존 운영 중인 앱(`studycafe`, `YTDownloader` 등)의 코드나 라우팅에 일절 영향을 주지 않아야 합니다.
2. **동적 컨텍스트 수용 (Dynamic Base Adaptability):**  
   앱은 로컬 단독 테스트(`http://localhost:8006/`)와 게이트웨이 통합 서빙(`http://domain:9000/{app_id}/` 또는 서브도메인) 환경 모두에서 소스 수정 없이 동작해야 합니다.
3. **자원 효율성 및 메모리 보호 (Low Footprint):**  
   서버는 제한된 메모리(예: GCP e2 VM 4GB RAM)에서 여러 앱이 상주하므로, CPU 집약적 연산이나 대용량 파일 IO는 메인 이벤트 루프를 차단하지 않고 제어된 스레드 풀에서 캐시 기반으로 처리되어야 합니다.

---

## 2. 표준 디렉토리 구조 규격

신규 앱은 반드시 아래 구조를 엄격히 준수하여 생성합니다.

```
apps/{new_app}/
├── backend/
│   ├── __init__.py
│   ├── config.py              # BaseConfig 상속 앱 전용 설정
│   ├── main.py                # 단독 로컬 실행용 FastAPI 엔트리포인트
│   ├── schemas.py             # Pydantic 입출력 데이터 모델
│   ├── db/
│   │   ├── __init__.py
│   │   └── models.py          # SQLAlchemy 테이블 모델 (Base 상속)
│   ├── routers/
│   │   ├── __init__.py
│   │   └── main_router.py     # prefix="" 로 정의된 핵심 API 라우터
│   └── services/
│       ├── __init__.py
│       └── core_service.py    # 비즈니스 로직 및 스레드 풀 워커
└── frontend/
    ├── index.html             # 메인 UI 구조 (CSS/JS 직접 링크)
    ├── style.css              # 앱 기본 스타일
    ├── css/
    │   ├── variables.css      # 디자인 토큰 (색상, 여백, 폰트)
    │   ├── layout.css         # Grid/Flexbox 컨테이너 및 뷰포트 배치
    │   └── components.css     # 버튼, 모달, 카드, 뱃지 등 UI 컴포넌트
    ├── app.js                 # 프론트엔드 메인 엔트리포인트 (초기화)
    └── js/
        ├── api.js             # getApiBase() 기반 백엔드 통신 모듈
        ├── state.js           # 전역 반응형 상태 저장소
        ├── ui.js              # DOM 렌더링 및 UI 유틸리티
        └── modals.js          # 팝업 및 상세 비교/조작 모달 제어
```

---

## 3. 백엔드 (FastAPI) 개발 기준

### 3.1. `BaseConfig` 상속 및 영구 스토리지 경로 사용
백엔드 설정은 절대 `os.getenv`를 파일 곳곳에 흩뿌려 두지 않고, `shared.core.base_config.BaseConfig`를 상속한 단일 `config.py`에서 관리합니다.

```python
# apps/{new_app}/backend/config.py
import os
from shared.core.base_config import BaseConfig

class NewAppConfig(BaseConfig):
    APP_ID: str = "new_app"
    APP_NAME: str = "신규 서비스 명칭"
    APP_CATEGORY: str = "utility"
    PORT: int = int(os.getenv("PORT", "8010"))

    # 앱 전용 설정
    MAX_ITEMS: int = 100
    ENABLE_AI_FEATURE: bool = True

    @property
    def STORAGE_DIR(self) -> str:
        # shared의 get_app_storage_dir을 사용하여
        # 영구 마운트 볼륨(/media/new_app)과 로컬 폴백을 자동 해석
        return self.get_app_storage_dir("new_app/data")

settings = NewAppConfig()

def get_settings() -> NewAppConfig:
    return settings
```

### 3.2. 라우터 정의 규칙 (`prefix=""`와 `get_route_prefix`)
- **라우터 내부 정의 시:** `router = APIRouter(prefix="", tags=[...])` 로 작성합니다.  
  (게이트웨이에서 `app.include_router(router, prefix="/api/new_app")` 형태로 마운트하기 때문입니다.)
- **URL 경로 역참조 또는 절대 URL 생성 시:** 클라이언트가 요청한 경로에 따라 동적으로 프리픽스를 결정하는 `get_route_prefix` 유틸리티를 반드시 사용합니다.

```python
# apps/{new_app}/backend/routers/main_router.py
from typing import Optional
from fastapi import APIRouter, Request

router = APIRouter(prefix="", tags=["New App Core"])

def get_route_prefix(request: Optional[Request] = None) -> str:
    """게이트웨이 마운트 경로(/api/new_app)와 단독 실행(/api)을 동적 판정"""
    if request and "/new_app" in request.url.path:
        return "/api/new_app"
    return "/api"

@router.get("/items")
async def list_items(request: Request):
    prefix = get_route_prefix(request)
    return {
        "items": [],
        "download_url_pattern": f"{prefix}/download/{{item_id}}"
    }
```

### 3.3. CPU/IO 블로킹 방지 및 비동기 처리
FastAPI는 비동기 싱글 스레드 이벤트 루프를 기반으로 합니다.  
이미지 해싱, 썸네일 변환, 다운로드, 파일 압축 등 **CPU 집약적이거나 긴 동기 IO 작업**을 `async def` 안에서 그대로 실행하면 **전체 서버의 다른 모든 SaaS 앱 응답이 멈춥니다(Latency Spike).**

```python
# 올바른 구현 패턴
import asyncio
from concurrent.futures import ThreadPoolExecutor

# CPU 코어 수에 맞추어 스레드 풀 제한 (예: 2~4개)
_executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="new_app_worker")

def _heavy_cpu_task(file_path: str) -> dict:
    # 무거운 연산 또는 디스크 작업 (예: 이미지 해시/리사이즈)
    ...
    return {"status": "ok"}

@router.post("/process")
async def process_task(file_path: str):
    loop = asyncio.get_running_loop()
    # 이벤트 루프를 차단하지 않고 별도 스레드에서 실행
    result = await loop.run_in_executor(_executor, _heavy_cpu_task, file_path)
    return result
```

### 3.4. 데이터베이스 모델 등록
SQLAlchemy 모델 생성 시 반드시 `shared.core.base_database.Base`를 상속해야 게이트웨이 기동 시 자동으로 테이블이 생성됩니다.

```python
# apps/{new_app}/backend/db/models.py
from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from shared.core.base_database import Base

class NewAppRecord(Base):
    __tablename__ = "new_app_records"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
```

---

## 4. 프론트엔드 (Vanilla JS/CSS) 개발 기준

### 4.1. 동적 API Base URL 결정 (`getApiBase()`)
프론트엔드 JavaScript에서 절대 `/api/new_app/...`을 하드코딩해서는 안 됩니다. 서브도메인 접속, 게이트웨이 접속, 로컬 단독 접속에 모두 대응하도록 유틸리티를 작성합니다.

```javascript
// apps/{new_app}/frontend/js/api.js
export function getApiBase() {
  const p = window.location.pathname;
  // 게이트웨이 하위 경로로 접속한 경우
  if (p.startsWith('/new_app')) {
    return '/api/new_app';
  }
  // 독립 도메인(newapp.chicvill.store) 또는 로컬 단독 실행인 경우
  return '/api';
}

export async function fetchItems() {
  const base = getApiBase();
  const res = await fetch(`${base}/items?t=${Date.now()}`, {
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}
```

### 4.2. 정적 자산 로딩 및 브라우저 캐시 무효화 (Cache Busting)
> **핵심 교훈:**  
> CSS 파일 안에서 `@import url('./css/components.css');`를 중첩 선언하면, 브라우저가 디스크 캐시를 강하게 유지하여 서버에서 코드를 업데이트해도 사용자의 브라우저 화면이 깨지는 치명적인 문제가 발생합니다.

#### 준수 사항:
1. `index.html`에서 모든 CSS 파일을 **개별 `<link>` 태그**로 직접 임포트합니다.
2. 배포 및 업데이트 시 **쿼리 버전 파라미터(`?v=1.0`)**를 부여합니다.
3. JavaScript 모듈 임포트 시에도 `import ... from './module.js?v=1.0'` 형태로 버전을 명시합니다.

```html
<!-- apps/{new_app}/frontend/index.html -->
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MQnet New App</title>
  
  <!-- CSS 모듈 직접 로드 + 버전 태그 -->
  <link rel="stylesheet" href="./css/variables.css?v=1.0">
  <link rel="stylesheet" href="./css/layout.css?v=1.0">
  <link rel="stylesheet" href="./css/components.css?v=1.0">
  <link rel="stylesheet" href="./style.css?v=1.0">
</head>
<body>
  ...
  <!-- 메인 스크립트 버전 태그 -->
  <script type="module" src="./app.js?v=1.0"></script>
</body>
```

### 4.3. UI/CSS 레이아웃 함정 방지 (Flexbox 압축 버그)
스크롤 영역 안에 카드 목록이나 결과 아이템을 배치할 때, Flexbox 기본 동작(`flex-shrink: 1`)으로 인해 항목의 높이가 0px 또는 수 px로 압축되어 내용이 사라지는 현상이 빈번합니다.

#### 필수 CSS 방어 코드:
```css
/* apps/{new_app}/frontend/css/components.css */

/* 스크롤 컨테이너 */
.result-scroll-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
  min-height: 0; /* Flex 자식 스크롤 허용 필수 */
  max-height: 75vh;
}

/* 스크롤 내부의 카드 아이템 */
.result-item-card {
  display: flex;
  flex-shrink: 0; /* ★ 절대 압축되지 않도록 필수 적용 */
  min-height: fit-content;
  border-radius: 16px;
  background: var(--card-bg, #1a2234);
  padding: 1rem;
}
```

### 4.4. 공통 인증(Auth) UI 및 세션 연동 표준 (단 3줄 적용)
MQnet 통합 플랫폼의 모든 앱은 플랫폼 공통 모듈 `/shared/ui/auth.js`를 통해 통일된 로그인/회원가입 UI 및 세션을 손쉽게 연동할 수 있습니다.

#### 프론트엔드 연동 규격:
1. **HTML 헤더에 사용자 배지 컨테이너 배치:**
```html
<header class="app-header">
  ...
  <!-- 사용자 로그인/프로필 배지 영역 -->
  <div id="userAuthBadge"></div>
</header>
```

2. **JavaScript에서 단 3줄로 초기화 및 배지 연동 (`app.js`):**
```javascript
import { MQnetAuth } from '/shared/ui/auth.js?v=1.0';

// 1. 초기화 (앱 ID 지정 및 로그인 변경 리스너 등록)
MQnetAuth.init({
  appId: 'files',
  onAuthChange: (user) => {
    // 로그인/로그아웃 시 개인 데이터 재조회 처리
  }
});

// 2. 배지 렌더링 (로그인 시 [👤 이름 | 🚪], 비로그인 시 [🔑 로그인] 자동 처리)
MQnetAuth.renderBadge('userAuthBadge');

// 3. 비로그인 사용자 작업 제한 시 모달 호출
if (!MQnetAuth.isLoggedIn()) {
  MQnetAuth.openModal({ title: '개인 저장소 접근을 위해 로그인해 주세요.' });
}
```

3. **백엔드 API 호출 시 인증 헤더 첨부 (`api.js`):**
```javascript
const res = await fetch(url, {
  headers: {
    'Content-Type': 'application/json',
    ...MQnetAuth.getAuthHeader() // Authorization: Bearer {token} 자동 첨부
  }
});
```

### 4.5. 개인 스토리지 격리 & 500KB 무료 쿼터 및 유료 전환 모달 표준
개인 데이터를 다루는 앱(`photos`, `files` 등)은 서버 스토리지 용량 한계를 방어하고 유료 모델(SaaS)로 전환할 수 있는 공통 쿼터 아키텍처를 따릅니다.

#### 1. 스토리지 격리 원칙:
- **로그인 사용자:** `/media/users/{user_id}/{app_name}/` 경로로 자동 격리 (타 사용자 접근 원천 차단)
- **비로그인 사용자:** `/media/{app_name}/` 공용 디렉토리 또는 읽기 전용 접근 제한

#### 2. 500KB 쿼터 정책 및 업로드 사전 차단:
- 무료 플랜(`free`)의 개인별 기본 용량 한도는 **500KB**(`512,000 Byte`)입니다.
- 파일 업로드 API(`POST /upload`) 진입 시 현재 누적 사용량과 업로드 파일 크기를 사전 계산(`check_upload_quota`)하여 500KB 초과 시 즉시 `403 Forbidden` (`QUOTA_EXCEEDED`)을 반환합니다.

#### 3. 유료 전환 안내 모달 표준:
- 500KB 초과 에러 발생 시 또는 헤더의 `⚡ Pro` 버튼 클릭 시 **"MQnet Pro Storage 전환 안내"** 모달을 띄웁니다.
- 모달 구성요소:
  - 현재 실시간 사용량 프로그레스 바 (`0 B / 500 KB (0%)`)
  - 카테고리별(사진, 문서, 영상, 음악 등) 실시간 용량 분석 차트
  - Pro 플랜(월 2,900원 / 10GB 제공) 업그레이드 안내 카드
  - 테스트용 `[⚡ Pro 플랜 업그레이드]` 및 `[🔄 무료(500KB)로 재설정]` 버튼 연동

### 4.6. 통합 계정(SSO), 객체 지향 세션 상속 모델 및 RBAC 권한 분기 표준
MQnet 통합 SaaS는 단일 계정(Universal Account)으로 가입하여 모든 앱에 접속하되, 각 앱마다 고유한 항목을 **객체 지향 상속(OOP Inheritance)**을 통해 확장하는 **`BaseAuthSession` 기반 중앙 집중식 SSO & RBAC** 구조를 따릅니다.

#### 1. 공통 세션 객체와 앱별 상속 모델 (`shared/auth/session.py`):
정회원(Member)과 비회원(Guest) 모두 동일한 기본 인터페이스(`BaseAuthSession`)를 공유하며, 각 앱은 이를 상속하여 독특한 필드를 추가합니다.

```python
# 1. 플랫폼 공통 기본 세션 객체
class BaseAuthSession(BaseModel):
    session_id: str = Field(...)           # 고유 세션 ID
    user_id: Optional[str] = None          # 로그인 회원의 고유 ID (게스트는 None)
    email: Optional[str] = None            # 이메일
    role: str = "guest"                    # superadmin, owner, manager, staff, customer, guest
    is_authenticated: bool = False         # 정식 로그인 여부 (게스트: False)
    allowed_apps: List[str] = ["*"]        # 허용된 앱 목록
    app_roles: Dict[str, str] = {}         # 앱별 역할 맵

# 2. 매장 관리 앱 전용 상속 확장 객체
class StoreAuthSession(BaseAuthSession):
    app_id: str = "store"
    store_code: Optional[str] = None       # 매장 지점 코드 (예: "store-gangnam-01")
    pos_terminal_id: Optional[str] = None  # POS 단말기 번호
    duty_shift: Optional[str] = None       # 근무 조 (오전, 오후, 마감)

# 3. 유튜브 다운로더 전용 상속 확장 객체 (비로그인 임시 세션 물리 격리)
class YTDownloadAuthSession(BaseAuthSession):
    app_id: str = "ytdownload"
    download_root: str = "/media/downloads"
    
    @property
    def session_dir(self) -> str:
        return os.path.join(self.download_root, "sessions", self.session_id)
        
    def cleanup(self) -> bool:
        """세션 종료 시 해당 클라이언트의 임시 파일만 안전하게 선별 삭제"""
        if os.path.exists(self.session_dir):
            shutil.rmtree(self.session_dir, ignore_errors=True)
            return True
        return False
```

#### 2. 앱별 역할(Role) 분기 규칙 (매장 관리 앱 사례):
하나의 계정이 매장 관리 앱에서는 다른 업무 권한을 가집니다.
| 역할 코드 (`role`) | 명칭 | 허용 업무 및 접근 권한 범위 |
| :--- | :--- | :--- |
| **`owner`** | 점주 (대표) | 매장 전체 관리, 매출/정산 조회, 직원 권한 부여, 환경 설정, 세무 자료 |
| **`manager`** | 점장 (매니저) | 매장 운영, 재고 관리, 발주, 주문 접수, 직원 근무표 및 근태 관리 |
| **`staff`** | 점원 (스태프) | POS 주문 결제, 영수증 출력, 고객 응대, 배달 픽업 처리 |
| **`customer`** | 고객 (단골) | 모바일 테이블 주문, 스탬프/포인트 적립 내역 조회, 리뷰 작성 |

#### 3. 백엔드 RBAC 인가 1줄 적용 (`require_role`):
```python
from shared.auth.router import require_role

# 점주(owner) 또는 점장(manager)만 정산 및 관리 데이터 조회 가능
@router.get("/settlement")
async def get_settlement(current_user: User = Depends(require_role("store", ["owner", "manager"]))):
    return {"sales": 15000000}
```

#### 4. 프론트엔드 OOP 세션 객체 활용 (`MQnetAuth.getSessionUser()`):
```javascript
import { MQnetAuth } from '/shared/ui/auth.js?v=2.0';

// 현재 앱에 맞는 확장 세션 객체 획득 (StoreSessionUser 또는 YTDownloadSessionUser)
const session = MQnetAuth.getSessionUser();

// 점주(owner) 전용 UI 탭 노출 제어
if (session.isOwner) {
  document.getElementById('settlementMenu').style.display = 'block';
}
```

---

### 4.7. YTDownloader 및 세션 격리(동시 접속자 임시자료 격리) 표준
다수의 클라이언트가 동시에 접속하는 다운로더/변환기/임시작업 앱(`YTDownloader` 등)은 **공통 상속 세션 객체(`YTDownloadAuthSession`)를 기반으로 세션이 살아있는 동안 완벽한 물리 격리 및 자동 청소**를 수행합니다.

#### 1. 고유 세션 ID (`session_id`) 발급 및 영속:
- 클라이언트 접속 시 브라우저 `sessionStorage`에 UUID 기반의 `session_id`를 발급하고, 모든 API 요청 헤더에 `X-Session-ID: {session_id}`를 전달합니다.
- 비로그인 이용자라도 백엔드에서는 **`YTDownloadAuthSession(is_guest=True, role="guest")` 임시 로그인 객체**로 정형화되어 안전하게 다루어집니다.

#### 2. 세션별 전용 격리 디렉토리 저장:
- 다운로드/변환 파일은 공용 루트가 아닌 **`/media/downloads/sessions/{session_id}/`** 디렉토리에 개별 저장됩니다.
- 타 세션의 클라이언트는 다른 세션의 임시 파일 목록을 조회하거나 다운로드할 수 없습니다.

#### 3. 세션 종료 및 브라우저 이탈 시 자동 정리 (Cleanup):
- 브라우저 창 종료/이탈(`beforeunload` 이벤트) 시 `navigator.sendBeacon('/api/download/session/cleanup')` 호출.
- 사용자가 UI에서 `[🧹 내 세션 임시자료 초기화]` 버튼을 클릭했을 때도 동일하게 `session.cleanup()`이 실행되어 **자신의 임시 디렉토리만 안전하게 삭제 (`shutil.rmtree`)** 합니다.
- 다른 클라이언트가 다운로드 중인 임시 파일에는 아무런 영향을 주지 않습니다.

---

## 5. 게이트웨이 (`gateway/main.py`) 연동 규격

신규 앱을 전체 통합 환경에 등록할 때 `gateway/main.py`에 다음 4개 항목을 추가합니다.

### 5.1. 라우터 임포트 및 마운트
```python
# 1. 라우터 임포트
from apps.new_app.backend.routers.main_router import router as new_app_router

# 2. API 엔드포인트 마운트
app.include_router(new_app_router, prefix="/api/new_app", tags=["신규 앱 서비스"])
# 단독 라우팅 호환을 위한 보조 마운트 (필요 시)
app.include_router(new_app_router, prefix="/api", include_in_schema=False)
```

### 5.2. 헬스체크 및 시스템 상태 엔드포인트
게이트웨이 모니터링 대시보드와 연동하기 위해 시스템 상태 API를 반드시 제공합니다.
```python
@app.get("/api/new_app/system-status", tags=["신규 앱 서비스"])
def get_new_app_system_status():
    from apps.new_app.backend.config import settings as app_settings
    return {
        "app_id": app_settings.APP_ID,
        "app_name": app_settings.APP_NAME,
        "status": "HEALTHY",
        "storage_dir": app_settings.STORAGE_DIR,
        "features": app_settings.get_app_info()["features"]
    }
```

### 5.3. 정적 프론트엔드 서빙 마운트
정적 파일은 캐시 제어 옵션이 포함된 `StaticFiles` 또는 `NoCacheStaticFiles`를 통해 마운트합니다.
```python
new_app_frontend = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "new_app", "frontend"))
if os.path.exists(new_app_frontend):
    app.mount("/new_app", NoCacheStaticFiles(directory=new_app_frontend, html=True), name="new_app_frontend")
```

### 5.4. 서브도메인 라우팅 등록
`subdomain_host_router_middleware` 내에 호스트 매핑을 추가합니다.
```python
subdomain_routes = {
    ...
    "newapp.chicvill.store": "/new_app/",
}
```

---

## 6. 성능 및 리소스 최적화 기준

| 항목 | 표준 기준 | 적용 목적 |
| :--- | :--- | :--- |
| **메모리 한도** | 상시 150MB 이하, 피크 시 350MB 이하 | 공유 VM 서버의 OOM(Out of Memory) 방지 |
| **결과 캐싱** | 파일 해시, 분석 결과는 로컬 JSON/SQLite 캐싱 | 동일 파일에 대한 불필요한 재계산 100% 방지 |
| **이미지/자산** | 브라우저 전달 시 WebP 권장, 썸네일 해상도 제한 (최대 480px) | 모바일 네트워크 대역폭 및 렌더링 속도 최적화 |
| **지연 로딩** | 이미지 태그에 `loading="lazy"` 속성 필수 부여 | 수백 개 리스트 렌더링 시 브라우저 멈춤 방지 |

---

## 7. 배포 및 핫 싱크(Hot-Sync) 워크플로우

신규 앱 개발 시 전체 서버를 중단하거나 무거운 전체 컨테이너를 재빌드할 필요 없이, **해당 앱만 2초 내에 반영**할 수 있는 핫 싱크 스크립트를 작성하여 사용합니다.

### 표준 동기화 스크립트 패턴 (`scripts/sync_{new_app}.ps1` 또는 `.sh`)
```bash
#!/bin/bash
# 1. 신규 앱의 변경사항을 압축
tar --exclude='__pycache__' --exclude='*.pyc' --exclude='node_modules' \
    -czf update_{new_app}.tar.gz apps/{new_app}

# 2. 원격 서버 전송
gcloud compute scp update_{new_app}.tar.gz instance-1:~/workstation/

# 3. 원격 서버 풀기 및 Uvicorn 리로드 트리거
gcloud compute ssh instance-1 --command "
  tar -xzf ~/workstation/update_{new_app}.tar.gz -C ~/workstation/ &&
  rm ~/workstation/update_{new_app}.tar.gz &&
  touch ~/workstation/gateway/main.py
"
```
> `gateway/main.py`의 타임스탬프를 `touch`하면 `--reload` 모드로 동작 중인 Uvicorn이 다른 앱의 중단 없이 즉시 변경사항을 감지하여 다시 로드합니다.

---

## 8. 신규 앱 출시 전 10대 필수 체크리스트

다음 10개 항목이 모두 통과되었는지 확인한 후 운영(Production)에 배포합니다.

- [ ] **1. `BaseConfig` 상속 여부:** 설정 클래스가 `shared.core.base_config.BaseConfig`를 올바르게 상속했는가?
- [ ] **2. 하드코딩 경로 금지:** 절대 경로 대신 `get_app_storage_dir()`을 통해 파일 스토리지를 참조하는가?
- [ ] **3. `get_route_prefix` 적용:** 백엔드 응답의 링크가 통합 경로(`/api/new_app`)와 단독 경로를 모두 지원하는가?
- [ ] **4. `getApiBase()` 프론트 연동:** 프론트엔드 API 호출이 `getApiBase()`를 통해 동적으로 결정되는가?
- [ ] **5. 자산 캐시 무효화:** `index.html`에서 모든 CSS/JS 파일에 `?v=X.X` 버전 쿼리가 적용되어 있는가?
- [ ] **6. CSS 압축 방지:** 스크롤 컨테이너 내부의 카드/아이템 요소에 `flex-shrink: 0`이 명시되었는가?
- [ ] **7. 비동기 스레드 풀:** 무거운 IO/CPU 작업이 메인 이벤트 루프를 막지 않고 `ThreadPoolExecutor`에서 실행되는가?
- [ ] **8. 헬스체크 엔드포인트:** `/api/new_app/system-status` 가 정상 응답(200 OK, HEALTHY)을 반환하는가?
- [ ] **9. 기존 앱 무영향성 검증:** 신규 앱 등록 후 기존 앱(예: `ytdownloader`, `studycafe`)의 정상 동작을 확인했는가?
- [ ] **10. 브라우저 실사 테스트:** 데스크톱 및 모바일 뷰포트에서 레이아웃 깨짐 없이 동작하는지 실측 검증했는가?
