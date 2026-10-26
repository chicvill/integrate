# MQnet Store Unified Situation Room & POS System

MQnet Store는 **SaaS 클라우드 관제 포털 모드**와 **N100 오프라인 로컬 POS 모드**를 단일 코드베이스로 지원하는 지능형 매장 관제 및 POS 시스템입니다.

---

## 🌟 주요 특징

1. **단일 코어 (Single Core) 아키텍처**
   * `.env` 설정 하나로 **SaaS 포털** 또는 **N100 로컬 스탠드얼론**으로 운영 방식 전환
   * 인터넷 미연결 시 로컬 SQLite 기반 100% 독립 구동 (Offline-First)
2. **실시간 상황실 (Situation Room)**
   * 매장 주문, 매출, 이상 징후, 장비 상태 통합 모니터링
3. **하이브리드 전용 URL 라우팅 (Single Port 8001)**
   * `http://localhost:8001/` ➔ 통합 관리자 포털
   * `http://localhost:8001/situation` ➔ 매장 실시간 상황실 전용 화면
   * `http://localhost:8001/pos` ➔ 카운터 POS / 주문 전용 화면

---

## ⚙️ 실행 환경 설정 (`.env`)

```env
# 운영 모드 선택 (SAAS_PORTAL 또는 LOCAL_STANDALONE)
DEPLOYMENT_MODE=LOCAL_STANDALONE

# AI 관제 분석 사용 여부 (true / false)
ENABLE_AI_ANALYTICS=true

# 데이터베이스 접속 정보 (SQLite 또는 PostgreSQL)
DATABASE_URL=sqlite:///./store.db

# API 키
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## 🚀 빠른 시작 (Quick Start)

### Windows 환경 1-Click 실행
`RUN_PROD.bat` 파일을 더블 클릭하면 자동으로 백엔드 및 프론트엔드가 실행됩니다.

```cmd
RUN_PROD.bat
```
