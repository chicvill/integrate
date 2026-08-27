# MQnet 통합 멀티 SaaS 플랫폼

> 하나의 백엔드 서버에서 5개의 SaaS 서비스를 **상속 기반 공통 모듈**로 운영하는 통합 플랫폼

## 📐 아키텍처 개요

```
integrat/
├── shared/          # ★ 공통 공유 모듈 (모든 앱이 상속)
│   ├── core/        # BaseConfig, BaseDatabase, BaseApp 기반 클래스
│   ├── auth/        # 통합 인증/회원 (JWT, 회원가입/로그인)
│   ├── tenant/      # 앱 레지스트리, X-App-ID 미들웨어
│   ├── ai/          # Gemini AI 공통 클라이언트
│   ├── payment/     # Stripe 결제 공통 모듈
│   └── utils/       # JWT, 비밀번호 해싱, QR코드, 난수 생성
│
├── apps/            # ★ 각 SaaS 앱 (shared를 상속)
│   ├── studycafe/   # 스터디카페: StudyCafeConfig(BaseConfig)
│   ├── store/       # 매장 QR 주문: StoreConfig(BaseConfig)
│   ├── selfstudy/   # 자기주도학습: SelfStudyConfig(BaseConfig)
│   ├── smartfarm/   # 스마트팜: SmartFarmConfig(BaseConfig)
│   └── ai_gwansang/ # AI 관상: AiGwansangConfig(BaseConfig)
│
└── gateway/         # ★ 단일 진입점 (포트 8000)
    └── main.py      # 모든 앱 라우터 통합
```

## 🔗 상속 구조 (클래스 계층)

```
BaseConfig (shared/core/base_config.py)
├── StudyCafeConfig (apps/studycafe/backend/config.py)
├── StoreConfig     (apps/store/backend/config.py)
├── SelfStudyConfig (apps/selfstudy/backend/config.py)
├── SmartFarmConfig (apps/smartfarm/backend/config.py)
└── AiGwansangConfig (apps/ai_gwansang/backend/config.py)

GeminiClient (shared/ai/gemini_client.py)
├── FarmAIService   (apps/smartfarm/backend/db/farm_ai_service.py)
├── StudyAIService  (apps/selfstudy/backend/db/study_ai_service.py)
└── GwansangAIService (apps/ai_gwansang/backend/db/gwansang_ai_service.py)

AuthService (shared/auth/service.py)
└── 각 앱에서 상속 확장 가능
```

## 🚀 빠른 시작

### 1. 환경 설정
```bash
cp .env.shared.template .env.shared
# .env.shared 파일을 열어 실제 값 입력
```

### 2. 의존성 설치
```bash
pip install -r requirements.txt
```

### 3. 실행

**통합 게이트웨이 (모든 앱 포함, 포트 8000):**
```bash
uvicorn gateway.main:app --host 0.0.0.0 --port 8000 --reload
```

**개별 앱 실행:**
```bash
# 스터디카페 (포트 8001)
uvicorn apps.studycafe.backend.main:app --port 8001 --reload

# 매장 QR 주문 (포트 8002)
uvicorn apps.store.backend.main:app --port 8002 --reload

# 자기주도학습 (포트 8003)
uvicorn apps.selfstudy.backend.main:app --port 8003 --reload

# 스마트팜 (포트 8004)
uvicorn apps.smartfarm.backend.main:app --port 8004 --reload

# AI 관상 (포트 8005)
uvicorn apps.ai_gwansang.backend.main:app --port 8005 --reload
```

**Docker Compose (전체):**
```bash
docker-compose up -d
```

## 📡 API 엔드포인트

| 경로 | 설명 |
|------|------|
| `GET  /docs` | Swagger UI (전체 API 문서) |
| `GET  /health` | 플랫폼 헬스체크 |
| `GET  /apps` | 등록된 앱 목록 |
| `POST /auth/register` | 공통 회원가입 (X-App-ID 필수) |
| `POST /auth/login` | 공통 로그인 (X-App-ID 필수) |
| `GET  /api/studycafe/seats` | 스터디카페 좌석 현황 |
| `POST /api/store/orders` | 매장 QR 주문 |
| `POST /api/ai_gwansang/analyze` | AI 관상 분석 |
| `GET  /api/smartfarm/sensors` | 스마트팜 센서 데이터 |
| `GET  /api/selfstudy/plans` | 학습 계획 조회 |

## 📦 공통 모듈 활용법

### 새 앱 추가 방법 (3단계)

**1. `shared/tenant/registry.py`에 앱 등록:**
```python
APP_REGISTRY["new_app"] = {
    "app_id": "new_app",
    "app_name": "새로운 앱",
    "backend_port": 8006,
    "features": {"my_feature": True},
}
```

**2. `apps/new_app/backend/config.py` 생성:**
```python
from shared.core.base_config import BaseConfig

class NewAppConfig(BaseConfig):
    APP_ID: str = "new_app"
    MY_FEATURE_FLAG: bool = True
```

**3. `apps/new_app/backend/main.py` 생성:**
```python
from shared.core.base_app import create_base_app
from shared.auth.router import auth_router
from .config import NewAppConfig

settings = NewAppConfig()
app = create_base_app(settings)
app.include_router(auth_router, prefix="/auth")
```

## 🌐 Cloudflare 배포

Cloudflare Tunnel로 로컬 서버를 외부에 노출합니다:
```bash
# cloudflared 설치 후
cloudflared tunnel --url http://localhost:8000
```

## 🏗️ 기술 스택

- **백엔드**: Python 3.11 + FastAPI + SQLAlchemy
- **DB**: Supabase (PostgreSQL) + app_id 멀티테넌트
- **AI**: Google Gemini 2.5 Flash
- **인증**: JWT (python-jose + passlib/bcrypt)
- **결제**: Stripe
- **파일 저장소**: Cloudflare R2
- **컨테이너**: Docker + Docker Compose
