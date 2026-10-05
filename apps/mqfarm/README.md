# MQnet SmartFarm Unified Control & Analytics Platform

MQnet SmartFarm은 **SaaS 클라우드 멀티농장 관제 포털**과 **N100 오프라인 로컬 스마트팜 제어기**를 단일 코드베이스로 지원하는 지능형 스마트팜 IoT 제어 및 데이터 로깅 플랫폼입니다.

---

## 🌟 주요 특징

1. **단일 코어 (Single Core) 아키텍처**
   * `.env` 설정 하나로 **SaaS 클라우드 포털** 또는 **N100 로컬 제어기**로 운영 방식 전환
   * 인터넷 미연결 시 로컬 SQLite 기반 100% 독립 구동 (Offline-First)
2. **실시간 IoT 센서 & 액추에이터 제어**
   * 온습도, CO2, 조도, 토양 수분, pH/EC 센서 실시간 수집 및 팬, 히터, LED, 펌프 제어
3. **지능형 생장 모델 및 비전 분석**
   * 식물 생장 예측 모델 및 이미지 기반 녹색 픽셀 분석 엔진 탑재
4. **하이브리드 전용 URL 라우팅 (Single Port 8003)**
   * `http://localhost:8003/` ➔ 통합 농장 관리자 포털
   * `http://localhost:8003/monitoring` ➔ 센서 실시간 모니터링 전용 화면
   * `http://localhost:8003/control` ➔ 장비 액추에이터 제어 전용 화면

---

## ⚙️ 실행 환경 설정 (`.env`)

```env
# 운영 모드 선택 (SAAS_PORTAL 또는 LOCAL_STANDALONE)
DEPLOYMENT_MODE=LOCAL_STANDALONE

# 생장 AI 및 비전 분석 사용 여부 (true / false)
ENABLE_GROWTH_AI=true

# 데이터베이스 접속 정보
DATABASE_URL=sqlite:///./smartfarm.db

# 서버 포트
PORT=8003
HOST=0.0.0.0
```

---

## 🚀 빠른 시작 (Quick Start)

```cmd
RUN_PROD.bat
```
