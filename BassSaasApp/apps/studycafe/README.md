# MQnet StudyCafe Unified Management System

MQnet StudyCafe는 **SaaS 클라우드 포털 모드**와 **N100 오프라인 스탠드얼론 모드**를 단일 코드베이스로 지원하며, **SelfStudy AI 학습 케어 엔진**을 사이드 모듈로 포함하는 통합 스터디카페 관리 플랫폼입니다.

---

## 🌟 주요 특징

1. **단일 코어 (Single Core) 아키텍처**
   * `.env` 설정 하나로 **SaaS 포털** 또는 **N100 로컬 스탠드얼론**으로 운영 방식 전환
   * 로컬 N100 PC 오프라인 동작 지원 (SQLite 기반 100% 미연결 구동)
2. **Offline-First 데이터 동기화**
   * 오프라인 상태에서 결제/입퇴실 데이터 저장 후 인터넷 복구 시 자동 Sync
3. **SelfStudy AI 사이드 모듈**
   * Gemini AI RAG 기반 공부 질문응답 및 학습 플래너
   * 반응형 학습 몰입도 및 출석 리포트

---

## ⚙️ 실행 환경 설정 (`.env`)

```env
# 운영 모드 선택 (SAAS_PORTAL 또는 LOCAL_STANDALONE)
DEPLOYMENT_MODE=LOCAL_STANDALONE

# SelfStudy AI 모듈 사용 여부 (true / false)
ENABLE_SELFSTUDY=true

# 데이터베이스 접속 정보 (SQLite 또는 PostgreSQL)
DATABASE_URL=sqlite:///./studycafe.db

# AI 및 보안 키
GEMINI_API_KEY=your_gemini_api_key_here
SECRET_KEY=your_secret_key_here
```

---

## 🚀 빠른 시작 (Quick Start)

### Windows 환경 1-Click 실행
`RUN_PROD.bat` 파일을 더블 클릭하면 자동으로 백엔드 및 프론트엔드가 실행됩니다.

```cmd
RUN_PROD.bat
```

### Docker / N100 실행
```bash
docker-compose up -d --build
```
