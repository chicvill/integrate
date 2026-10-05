# MQnet Immich AI Smart Gallery (Full-Stack)

오픈소스 최고의 사진 관리 플랫폼인 **정식 Immich 풀스택(Server + Machine Learning + Vector DB + Redis)** 환경입니다.

---

## 1. 서비스 구성
* **Immich Server**: 포트 `8007` (내부 2283)
* **Immich Machine Learning**: 안면인식, 인물 클러스터링, CLIP 자연어 시맨틱 검색
* **Vector DB**: PostgreSQL 16 + pgvecto-rs (벡터 임베딩 저장)
* **Redis**: 백그라운드 큐 처리

---

## 2. L: 드라이브 사진 자동 색인 방법 (외부 라이브러리)
1. 브라우저에서 `http://localhost:8007` 접속 후 관리자 계정 생성
2. 우측 상단 `설정 / Administration` -> `External Libraries (외부 라이브러리)` 이동
3. `Create Library` 클릭 후 가져올 경로에 **`/usr/src/app/external`** 입력
4. `Scan All Libraries`를 누르면 L: 드라이브의 모든 사진이 자동 스캔 및 AI 분석(얼굴/검색/타임라인)됩니다.

---

## 3. 스마트폰 모바일 앱 연동
* iOS / Android 앱스토어에서 `Immich` 앱 설치
* 서버 주소에 `http://<서버IP>:8007` (또는 Cloudflare 도메인) 입력 후 로그인
* 스마트폰 사진 실시간 자동 백업 가능
