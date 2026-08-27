# MQnet YTDownloader SaaS Platform

MQnet YTDownloader는 **SaaS 클라우드 비디오 다운로드 포털**과 **N100 오프라인 미디어 다운로더**를 단일 코드베이스로 지원하는 초고속 유튜브 & 미디어 다운로드 플랫폼입니다.

---

## 🌟 주요 특징

1. **단일 코어 (Single Core) 아키텍처**
   * `.env` 설정 하나로 **SaaS 클라우드 포털** 또는 **N100 로컬 다운로더**로 운영 방식 전환
   * 비동기 다운로드 큐, 포맷/음질 선택, 모바일 클라이언트 우회 파이프라인
2. **지능형 미디어 변환 & AI 자막 요약**
   * H.264/AAC MP4 비디오 및 high quality M4A/MP3 오디오 변환
   * Gemini AI 기반 비디오 내용 요약 및 음성 자막 추출 기능 탑재
3. **하이브리드 전용 URL 라우팅 (Single Port 8004)**
   * `http://localhost:8004/` ➔ 통합 SaaS 포털
   * `http://localhost:8004/downloader` ➔ 초고속 영상/음원 다운로더 전용 화면
   * `http://localhost:8004/library` ➔ 미디어 보관함 & 재생 전용 화면

---

## ⚙️ 실행 환경 설정 (`.env`)

```env
# 운영 모드 선택 (SAAS_PORTAL 또는 LOCAL_STANDALONE)
DEPLOYMENT_MODE=SAAS_PORTAL

# AI 요약 및 자막 사용 여부 (true / false)
ENABLE_AI_TRANSCRIPTION=true

# 서버 포트
PORT=8004
HOST=0.0.0.0
```

---

## 🚀 빠른 시작 (Quick Start)

```cmd
RUN_PROD.bat
```
