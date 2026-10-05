# Coolify 배포 및 운영 가이드

본 문서는 **MQnet 통합 SaaS 플랫폼**을 Coolify 서버(GCP / AWS / VPS 등)에 배포하고 운영하는 단계별 절차를 설명합니다.

---

## 🚀 1. 배포 전 점검 및 사전 준비

### 1) 리눅스 호환 완료 사항
* `docker-compose.yml` 내 Windows 드라이브 경로(`L:`)를 유연한 환경변수 `${MEDIA_PATH:-./media}`로 변경 완료.
* 호스트 외부 네트워크(`external: true`) 의존성을 제거하고 내부 통합 네트워크(`integrate_default`)로 통일.
* 디스크 사용량 감지 로직에 `/media` 및 `MEDIA_STORAGE_PATH` 환경변수 우선 탐색 추가.

### 2) Google Drive를 스토리지로 사용할 경우 (선택)
서버의 대용량 사진/미디어 경로를 Google Drive와 직접 연동하려면, Coolify가 설치된 리눅스 서버에서 `rclone`을 통해 마운트합니다.
```bash
# 1. 서버에 rclone 설치
sudo apt update && sudo apt install -y rclone

# 2. rclone 원격 저장소 설정 (gdrive)
rclone config

# 3. 마운트 포인트 생성 및 마운트 (백그라운드 서비스)
sudo mkdir -p /mnt/gdrive
sudo rclone mount gdrive: /mnt/gdrive --allow-other --vfs-cache-mode writes --daemon
```

---

## 📦 2. GitHub 저장소 푸시

로컬 작업 내역을 GitHub 원격 저장소(`main` 브랜치)에 푸시합니다:
```bash
git add .
git commit -m "feat: optimize docker-compose and paths for Coolify deployment"
git push origin main
```

---

## 🖥️ 3. Coolify 대시보드에서 애플리케이션 추가

1. **Coolify 접속 및 프로젝트 선택**:
   - Coolify 대시보드 로그인 후 사용할 **Project** 및 **Environment** 선택.
2. **+ New Resource** 클릭:
   - **Public / Private Repository** 선택.
   - GitHub Repository URL: `https://github.com/chicvill/integrate` (또는 연동된 GitHub App 선택).
   - Branch: `main`.
3. **Build Pack 선택**:
   - **Docker Compose** 선택.
   - Compose File Location: `docker-compose.yml` (기본값).
4. **Environment Variables (환경변수) 등록**:
   - 프로젝트 루트의 `.env.coolify.example` 내용을 복사하여 Coolify의 **Environment Variables** 탭에 붙여넣고 저장합니다.
   - 특히 필수 값 설정:
     - `MEDIA_PATH`: Google Drive 마운트 경로(예: `/mnt/gdrive`) 또는 로컬 볼륨 경로 지정.
     - `GEMINI_API_KEY`: Google Gemini API 키.
     - `JWT_SECRET`: 강력한 비밀키 설정.
5. **Persistent Storage (영구 볼륨) 확인**:
   - Coolify의 **Storages** 설정에서 컨테이너 내부의 `/media` 및 `/home/node/.n8n` 경로가 호스트 디렉터리 또는 Docker Volume에 안전하게 매핑되었는지 확인합니다.
6. **도메인(FQDN) 설정**:
   - `gateway` 서비스에 메인 도메인(예: `https://chicvill.store`) 설정.
   - `n8n` 서비스에 서브 도메인(예: `https://n8n.chicvill.store`) 설정.
   - Coolify의 내장 Traefik/Caddy 프록시가 자동으로 Let's Encrypt SSL 인증서를 발급합니다.

---

## ⚡ 4. 배포 (Deploy) 및 확인

1. 우측 상단의 **Deploy** 버튼 클릭.
2. **Deployments** 탭에서 빌드 및 실행 로그 실시간 확인.
3. 배포 완료 후 도메인으로 접속하여 각 서비스 동작 확인:
   - 통합 포털: `https://your-domain.com/portal`
   - 스터디카페: `https://your-domain.com/studycafe`
   - n8n 워크플로우: `https://n8n.your-domain.com`
