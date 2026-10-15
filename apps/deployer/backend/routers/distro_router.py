"""
apps/deployer/backend/routers/distro_router.py
MQnet Solution Distro & Packaging REST API Router.
"""
import os
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, Body, Response
from fastapi.responses import FileResponse

from ..services.distro_engine import distro_engine, DIST_DIR

router = APIRouter(prefix="", tags=["솔루션 배포 & 패키징 센터"])


@router.get("/apps")
async def get_available_apps():
    """배포 가능한 솔루션 앱 목록 및 실데이터 DB 상태 조회"""
    try:
        apps = distro_engine.get_apps_status()
        return {"success": True, "total": len(apps), "apps": apps}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/build")
async def build_distribution_package(payload: Dict[str, Any] = Body(...)):
    """
    선택된 조건(앱, 타깃 플랫폼, 데이터 정책)에 따라 납품용 독립 패키지(.ZIP) 생성
    """
    try:
        result = distro_engine.build_package(payload)
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"패키징 빌드 실패: {str(e)}")


@router.get("/packages")
async def list_generated_packages():
    """생성된 배포용 패키지 목록 및 다운로드 링크 조회"""
    try:
        packages = distro_engine.list_packages()
        return {"success": True, "total": len(packages), "packages": packages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/download/{filename}")
async def download_package(filename: str):
    """빌드된 배포 ZIP 파일 다운로드 스트리밍 (파일 미존재 시 온디맨드 실시간 자동 빌드 지원)"""
    safe_name = os.path.basename(filename)
    target_path = os.path.join(DIST_DIR, safe_name)
    
    # 만약 파일이 없으면 온디맨드 자동 빌드
    if not os.path.exists(target_path) or os.path.getsize(target_path) == 0:
        app_id = "rent" if "rent" in safe_name else "studycafe"
        print(f"⚠️ 요청된 패키지({safe_name})가 없어 온디맨드 자동 빌드를 시작합니다: app={app_id}")
        res = distro_engine.build_package({
            "selected_apps": [app_id],
            "target_platform": "docker-linux",
            "data_policy": "current",
            "package_type": "full"
        })
        new_pkg_name = res.get("package_name")
        new_target_path = os.path.join(DIST_DIR, new_pkg_name)
        if os.path.exists(new_target_path):
            target_path = new_target_path
            safe_name = new_pkg_name
        elif not os.path.exists(target_path):
            raise HTTPException(status_code=404, detail="요청하신 패키지 파일을 찾을 수 없습니다.")

    return FileResponse(
        path=target_path,
        filename=safe_name,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'}
    )


@router.get("/install/{app_id}")
async def get_one_click_install_script(app_id: str):
    """
    새 서버에서 curl -sSL http://34.31.10.12/install/rent | bash
    단 한 줄로 무인 자동 설치되는 원클릭 쉘 스크립트 스트리밍
    """
    clean_id = app_id.replace(".sh", "").strip().lower()
    app_meta = distro_engine.get_apps_status()
    target_app = next((a for a in app_meta if a["id"] == clean_id), None)
    app_name = target_app["name"] if target_app else f"MQnet {clean_id.upper()}"

    script_content = f"""#!/bin/bash
set -e

echo "========================================================"
echo "🚀 {app_name} 원클릭 무인 자동 설치를 시작합니다"
echo "• 대상 디렉토리: $HOME/{clean_id}"
echo "========================================================"

# 0. 기본 유틸리티(unzip, curl) 확인 및 설치
if ! command -v unzip &> /dev/null || ! command -v curl &> /dev/null; then
    echo "📦 필수 유틸리티(unzip, curl) 점검 및 설치 중..."
    sudo apt-get update -qq 2>/dev/null || true
    sudo apt-get install -y -qq unzip curl 2>/dev/null || sudo yum install -y unzip curl 2>/dev/null || true
fi

# 1. Docker 엔진 미설치 시 자동 설치
if ! command -v docker &> /dev/null; then
    echo "📦 Docker 엔진 자동 설치 진행 중..."
    curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
    sudo sh /tmp/get-docker.sh
    sudo usermod -aG docker $USER || true
    sudo systemctl enable --now docker || true
    rm -f /tmp/get-docker.sh
fi

# 2. Docker Compose 플러그인 확인
COMPOSE_CMD="sudo docker compose"
if ! sudo docker compose version &> /dev/null; then
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="sudo docker-compose"
    else
        echo "📦 docker-compose-plugin 자동 설치 중..."
        sudo apt-get update -qq 2>/dev/null && sudo apt-get install -y -qq docker-compose-plugin 2>/dev/null || true
    fi
fi

# 3. 패키지 다운로드 및 압축 해제
echo "📥 중앙 서버에서 공식 실데이터 패키지 다운로드 중..."
TARGET_DIR="$HOME/{clean_id}"
mkdir -p "$TARGET_DIR"

PKG_DOWNLOADED=0
for PKG_URL in "http://34.31.10.12/api/deployer/download/{clean_id}_standalone.zip" "http://34.31.10.12/download/{clean_id}_standalone.zip" "http://34.31.10.12/api/deployer/download/rent_standalone.zip"; do
    if curl -f -sSL "$PKG_URL" -o "$TARGET_DIR/package.zip" 2>/dev/null; then
        if [ -s "$TARGET_DIR/package.zip" ] && unzip -t "$TARGET_DIR/package.zip" &>/dev/null; then
            PKG_DOWNLOADED=1
            echo "✅ 패키지 다운로드 완료: $PKG_URL"
            break
        fi
    fi
done

if [ "$PKG_DOWNLOADED" -ne 1 ]; then
    echo "❌ 패키지 다운로드에 실패했거나 ZIP 파일이 손상되었습니다."
    echo "중앙 서버(34.31.10.12) 연결 상태를 확인해주세요."
    exit 1
fi

echo "📂 압축 해제 중..."
unzip -o "$TARGET_DIR/package.zip" -d "$TARGET_DIR"
rm -f "$TARGET_DIR/package.zip"

# 4. 도커 컨테이너 빌드 및 백그라운드 기동
cd "$TARGET_DIR"
echo "⚡ 도커 컨테이너 빌드 및 기동 중..."
$COMPOSE_CMD down 2>/dev/null || true
$COMPOSE_CMD up -d --build

SERVER_IP=$(hostname -I 2>/dev/null | awk '{{print $1}}' || echo "서버IP")

echo "========================================================"
echo "🎉 {app_name} 설치 및 기동이 성공적으로 완료되었습니다!"
echo "👉 웹 브라우저에서 서버 IP (포트 80)로 접속하세요: http://$SERVER_IP/"
echo "========================================================"
"""
    return Response(content=script_content, media_type="text/plain; charset=utf-8")


@router.delete("/packages/{filename}")
async def delete_package(filename: str):
    """임시 생성된 배포 패키지 파일 정리/삭제"""
    ok = distro_engine.delete_package(filename)
    if not ok:
        raise HTTPException(status_code=404, detail="삭제할 파일을 찾을 수 없습니다.")
    return {"success": True, "message": f"'{filename}' 패키지가 안전하게 삭제되었습니다."}
