# Grammar Quest TV - Docker 및 구글 서버(GCP) 배포 가이드

이 문서는 `chicvill/grammer` 애플리케이션을 Docker 이미지로 패키징하고, 구글 클라우드(Google Cloud Platform) 서버에서 운영하는 방법을 안내합니다.

---

## 🌟 왜 Google Cloud Run을 권장하나요?

1. **무료 HTTPS 기본 제공**: 
   - 이 앱은 **음성 인식(Web Speech API)** 및 오디오 기능을 사용합니다. 최신 브라우저와 안드로이드 TV/스마트 TV는 보안상 **HTTPS 연결에서만 마이크 권한을 허용**하므로 Cloud Run의 기본 HTTPS 도메인이 필수적입니다.
2. **넉넉한 무료 티어**: 매월 200만 건 요청 무료, 미사용 시 0원으로 자동 스케일다운(Scale-to-Zero).
3. **로컬 Docker 데몬 불필요**: `gcloud`를 통해 소스코드를 구글 서버(Cloud Build)로 전송하여 구글 자체에서 컨테이너를 빌드하고 배포합니다.

---

## 🚀 방법 1: Google Cloud Run 원클릭 배포 (가장 간편한 방법)

현재 PC에 이미 `gcloud` CLI(Google Cloud SDK)가 설치되어 있고 프로젝트(`mqnet-503200`)가 연결되어 있으므로, 명령어 한 줄로 즉시 배포할 수 있습니다.

### 1-1. 스크립트 실행
프로젝트 루트의 `deploy-cloudrun.bat` 파일을 더블 클릭하거나, 터미널에서 다음 명령을 실행합니다:

```powershell
.\deploy-cloudrun.bat
```

### 1-2. 직접 CLI 명령어로 배포할 경우
```powershell
gcloud run deploy grammer-tv ^
    --source . ^
    --region asia-northeast3 ^
    --allow-unauthenticated ^
    --port 3000
```
> **진행 과정**:
> 1. 현재 폴더의 소스코드가 Google Cloud Build로 안전하게 업로드됩니다.
> 2. 구글 클라우드 서버에서 `Dockerfile`을 기반으로 컨테이너 이미지를 자동 빌드합니다.
> 3. 이미지가 Artifact Registry에 안전하게 저장됩니다.
> 4. Cloud Run 서비스가 생성되며, 고유한 **HTTPS 주소**(예: `https://grammer-tv-xxxxxx-du.a.run.app`)가 출력됩니다.
> 5. 이제 스마트 TV나 PC의 브라우저에서 해당 URL로 접속하여 즉시 플레이할 수 있습니다.

---

## 🐳 방법 2: 로컬 Docker에서 직접 빌드 및 구글 저장소(GCR / Artifact Registry)에 푸시

로컬 PC의 Docker Desktop을 실행한 뒤, 이미지를 직접 빌드하여 구글 컨테이너 레지스트리에 푸시할 수도 있습니다.

### 2-1. Docker 데몬 실행
- Windows 시작 메뉴에서 **Docker Desktop**을 실행합니다.

### 2-2. Google Artifact Registry 인증 구성
```powershell
gcloud auth configure-docker asia-northeast3-docker.pkg.dev
```

### 2-3. 로컬에서 Docker 이미지 빌드
```powershell
# 프로젝트 ID: mqnet-503200
docker build -t asia-northeast3-docker.pkg.dev/mqnet-503200/cloud-run-source-deploy/grammer-tv:latest .
```

### 2-4. 구글 서버(Artifact Registry)로 이미지 푸시
```powershell
docker push asia-northeast3-docker.pkg.dev/mqnet-503200/cloud-run-source-deploy/grammer-tv:latest
```

### 2-5. 푸시된 이미지를 Cloud Run에 배포
```powershell
gcloud run deploy grammer-tv ^
    --image asia-northeast3-docker.pkg.dev/mqnet-503200/cloud-run-source-deploy/grammer-tv:latest ^
    --region asia-northeast3 ^
    --allow-unauthenticated ^
    --port 3000
```

---

## 🌐 방법 3: Docker Hub에 저장 후 구글 Compute Engine(VM)에서 실행

Docker Hub에 공개/비공개 저장소로 올린 뒤 구글 가상 머신(GCE VM)에서 실행하는 방법입니다.

### 3-1. Docker Hub로 푸시
```powershell
docker login
docker build -t [본인_DockerHub_아이디]/grammer-tv:latest .
docker push [본인_DockerHub_아이디]/grammer-tv:latest
```

### 3-2. 구글 Compute Engine(GCE) 가상 머신에서 실행
GCE 인스턴스(Ubuntu/Debian 등)의 터미널(SSH)에 접속한 뒤:
```bash
# 도커 설치 후 컨테이너 실행
sudo docker run -d \
  --name grammer-tv \
  --restart always \
  -p 80:3000 \
  [본인_DockerHub_아이디]/grammer-tv:latest
```
*(참고: GCE 방화벽 규칙에서 `tcp:80` 포트가 열려 있어야 외부에서 접속 가능합니다.)*

---

## 💻 로컬에서 Docker 컨테이너 테스트

Docker Desktop이 실행 중인 상태에서 로컬 테스트를 진행할 수 있습니다:

```powershell
# Docker Compose로 실행
docker compose up -d

# 실행 상태 확인
docker ps

# 로그 확인
docker compose logs -f

# 종료
docker compose down
```
접속 주소: `http://localhost:3000`

---

## 📺 샤오미 TV / 안드로이드 TV 접속 방법

1. Cloud Run 배포 완료 후 제공된 **HTTPS URL**을 확인합니다.
2. 스마트 TV의 **TV Bro** 또는 웹 브라우저 앱을 엽니다.
3. 해당 URL을 주소창에 입력하고 즐겨찾기에 등록합니다.
4. 리모컨 D-Pad 및 음성 인식을 사용하여 플레이합니다.
