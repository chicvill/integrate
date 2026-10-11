# Coolify 앱별 독립(분리) 배포 가이드 (Monorepo Architecture)

본 가이드는 MQnet 16대 SaaS 애플리케이션을 전체 44분 통합 빌드 대신, **각 앱별로 분리하여 3초~1분 만에 초고속 배포**하는 완벽한 세팅 매뉴얼입니다.

---

## ⚡ 분리 배포의 핵심 이점
1. **압도적인 배포 속도**: 정적 앱(HTML/JS)은 **3~5초**, 파이썬 백엔드 앱은 **1분 내외**로 배포 완료.
2. **장애 격리**: 한 앱을 수정하거나 빌드 실패해도 다른 15개 앱 및 게이트웨이는 절대 중단되지 않음.
3. **단일 모노레포 유지**: GitHub 저장소는 `chicvill/integrate` 하나로 통합 관리 유지.

---

## 📋 16대 앱별 Coolify 배포 설정 매트릭스

Coolify 대시보드([http://34.31.10.12:8000](http://34.31.10.12:8000))에서 **`+ New Resource` ➡️ `Public/Private Repository`**로 들어간 뒤, 원하는 앱의 아래 설정을 입력하시면 됩니다.

| 앱 명칭 | 디렉터리 (Base Directory) | 빌드팩 (Build Pack) | 예상 소요시간 | 내부 포트 | 추천 서브도메인 / URL |
|---|---|---|:---:|:---:|---|
| **1. AI 실생활 실습 가이드** | `/apps/ai_guide` | `Dockerfile` | **3초** | `80` | `guide.chicvill.store` (또는 `:8080`) |
| **2. MQnet 브랜드 홈페이지** | `/apps/MQhome` | `Dockerfile` | **3초** | `80` | `home.chicvill.store` (또는 `:8081`) |
| **3. 모던 스마트 클락** | `/apps/Clock` | `Dockerfile` | **3초** | `80` | `clock.chicvill.store` (또는 `:8082`) |
| **4. 아이언맨 제스처 게임** | `/apps/260731_iron man game` | `Dockerfile` | **3초** | `80` | `ironman.chicvill.store` (또는 `:8083`) |
| **5. 레트로 TV 비디오 부스** | `/apps/videoBooth` | `Dockerfile` | **15초** | `3000` | `video.chicvill.store` (또는 `:8084`) |
| **6. 테토/에겐 AI 얼굴분석** | `/apps/face_analy` | `Dockerfile` | **3초** | `80` | `face.chicvill.store` (또는 `:8085`) |
| **7. 통합 파일 탐색기 허브** | `/apps/files` | `Dockerfile` | **3초** | `80` | `files.chicvill.store` (또는 `:8086`) |
| **8. 스터디카페 관리** | `/apps/studycafe` | `Dockerfile` | **1분** | `8001` | `studycafe.chicvill.store` (또는 `:9002`) |
| **9. 매장 POS & QR 주문** | `/apps/store` | `Dockerfile` | **1분** | `8002` | `store.chicvill.store` (또는 `:9004`) |
| **10. 자기주도학습 플래너** | `/apps/selfstudy` | `Dockerfile` | **1분** | `8003` | `selfstudy.chicvill.store` (또는 `:9003`) |
| **11. 스마트팜 센서 관제** | `/apps/mqfarm` | `Dockerfile` | **1분** | `8005` | `farm.chicvill.store` (또는 `:9005`) |
| **12. AI 관상 분석** | `/apps/ai_gwansang` | `Dockerfile` | **1분** | `8009` | `gwansang.chicvill.store` (또는 `:9009`) |
| **13. 유튜브 다운로더** | `/apps/YTDownloader` | `Dockerfile` | **1.5분** | `8008` | `youtube.chicvill.store` (또는 `:9008`) |
| **14. Grammar Quest (영문법)** | `/apps/grammer` | `Dockerfile` | **1분** | `9014` | `grammar.chicvill.store` (또는 `:9014`) |
| **15. 스마트 갤러리** | `/apps/photos` | `Dockerfile` | **1분** | `8007` | `photos.chicvill.store` (또는 `:9006`) |
| **16. n8n 워크플로우 자동화** | *(Docker Image)* | `docker.n8n.io/n8nio/n8n:latest` | **즉시** | `5678` | `n8n.chicvill.store` (또는 `:5678`) |

---

## 🏛️ 통합 게이트웨이 & 포털 (Central Hub)
16대 앱을 한눈에 보고 공통 로그인(`/auth`) 및 통합 관제를 수행하는 중앙 허브는 아래와 같이 단독 배포합니다:

* **Base Directory**: `/`
* **Build Pack**: `Docker Compose` 
* **Compose File Location**: `docker-compose.gateway.yml` (또는 `gateway/Dockerfile`)
* **메인 도메인**: `https://chicvill.store` 또는 `http://34.31.10.12`
* ⚡ **소요 시간**: **약 1.5분**
