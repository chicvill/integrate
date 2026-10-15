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
    """빌드된 배포 ZIP 파일 다운로드 스트리밍"""
    safe_name = os.path.basename(filename)
    target_path = os.path.join(DIST_DIR, safe_name)
    if not os.path.exists(target_path) or not safe_name.endswith(".zip"):
        raise HTTPException(status_code=404, detail="요청하신 패키지 파일을 찾을 수 없습니다.")

    return FileResponse(
        path=target_path,
        filename=safe_name,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'}
    )


@router.delete("/packages/{filename}")
async def delete_package(filename: str):
    """임시 생성된 배포 패키지 파일 정리/삭제"""
    ok = distro_engine.delete_package(filename)
    if not ok:
        raise HTTPException(status_code=404, detail="삭제할 파일을 찾을 수 없습니다.")
    return {"success": True, "message": f"'{filename}' 패키지가 안전하게 삭제되었습니다."}
