# MQnet FileBrowser Service

L: 드라이브 전체 파일(문서, 음악, 동영상, 압축파일 등)을 웹에서 탐색, 업로드 및 다운로드할 수 있는 웹 파일 매니저 서비스입니다.

---

## 서비스 정보
* **내부 포트**: `8082`
* **접속 URL**: `http://localhost:8082`
* **기본 마운트**: `L:\` -> `/srv`
* **기본 로그인 계정**: `admin` / `admin` (최초 로그인 후 비밀번호 변경 권장)

---

## 실행 방법
```bash
# Docker Compose로 실행
docker compose up -d

# 또는 루트의 DOCKER_RUN.bat 실행
```
