"""
apps/files/backend/routers/files_router.py
FastAPI router for MQnet Files Hub adhering to NEW_APP_DEVELOPMENT_GUIDE.md.
"""
import os
import shutil
import asyncio
import urllib.parse
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form, Query
from fastapi.responses import JSONResponse, FileResponse
import aiofiles

from apps.files.backend.config import settings
from apps.files.backend.schemas import (
    FolderListResponse,
    MkdirRequest,
    RenameRequest,
    DeleteRequest,
    SearchResponse,
    OperationResponse,
    SaveTextRequest
)
from apps.files.backend.services.files_service import (
    safe_resolve_path,
    list_directory_sync,
    search_files_sync,
    read_text_preview_sync,
    save_text_file_sync,
    get_storage_root,
    format_size
)
from shared.core.responses import safe_file_response

router = APIRouter(prefix="", tags=["MQnet Files Hub"])


def get_route_prefix(request: Optional[Request] = None) -> str:
    """
    게이트웨이 서빙(/api/files 또는 /api/filebrowser)과 독립 실행(/api) 동적 판별
    """
    if request:
        p = request.url.path
        if "/filebrowser" in p:
            return "/api/filebrowser"
        if "/files" in p:
            return "/api/files"
    return "/api"


# ─── 디렉토리 및 파일 목록 조회 ───
@router.get("/list", response_model=FolderListResponse)
async def list_files(
    folder: str = Query("", description="상대 폴더 경로"),
    scope: str = Query("", description="스토리지 범위 (files, all, photos, downloads)")
):
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, list_directory_sync, folder, scope)


# ─── 파일 검색 ───
@router.get("/search", response_model=SearchResponse)
async def search_files(
    q: str = Query(..., min_length=1),
    folder: str = Query(""),
    scope: str = Query("")
):
    loop = asyncio.get_running_loop()
    results = await loop.run_in_executor(None, search_files_sync, q, folder, scope)
    return SearchResponse(query=q, results=results, count=len(results))


# ─── 파일 다운로드 (안전한 RFC 5987 한글 파일명 헤더) ───
@router.get("/download")
async def download_file(
    path: str = Query(..., description="파일 상대 경로"),
    scope: str = Query("")
):
    target = safe_resolve_path(path, scope)
    if not target.is_file():
        raise HTTPException(status_code=404, detail="다운로드할 파일을 찾을 수 없습니다.")

    return safe_file_response(str(target), filename=target.name, as_attachment=True)


# ─── 파일 인라인 스트리밍 / 미리보기 (이미지, 영상, 오디오, PDF) ───
@router.get("/raw")
async def preview_raw_file(
    path: str = Query(..., description="파일 상대 경로"),
    scope: str = Query("")
):
    target = safe_resolve_path(path, scope)
    if not target.is_file():
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")

    return safe_file_response(str(target), filename=target.name, as_attachment=False)


# ─── 텍스트 / 코드 파일 내용 미리보기 ───
@router.get("/text-preview")
async def preview_text_file(
    path: str = Query(...),
    scope: str = Query("")
):
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, read_text_preview_sync, path, scope)


# ─── 텍스트 / 코드 파일 내용 저장 / 편집 ───
@router.post("/save-text", response_model=OperationResponse)
async def save_text_file(
    req: SaveTextRequest,
    scope: str = Query("")
):
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(None, save_text_file_sync, req.path, req.content, scope)
    return OperationResponse(
        success=True,
        message=f"'{result['name']}' 파일이 성공적으로 저장되었습니다.",
        data=result
    )


# ─── 파일 업로드 (다중 파일 지원) ───
@router.post("/upload", response_model=OperationResponse)
async def upload_files(
    folder: str = Form(""),
    scope: str = Form(""),
    files: List[UploadFile] = File(...)
):
    target_dir = safe_resolve_path(folder, scope)
    if not target_dir.is_dir():
        raise HTTPException(status_code=400, detail="업로드 대상 폴더가 유효하지 않습니다.")

    saved_files = []
    for upload in files:
        # 안전한 파일명 추출
        fname = Path(upload.filename).name
        dest = target_dir / fname
        
        # 파일 중복 시 접미사 추가
        counter = 1
        stem = dest.stem
        suffix = dest.suffix
        while dest.exists():
            dest = target_dir / f"{stem}_{counter}{suffix}"
            counter += 1

        async with aiofiles.open(dest, "wb") as out_file:
            while chunk := await upload.read(1024 * 1024):  # 1MB 버퍼
                await out_file.write(chunk)
                
        saved_files.append(dest.name)

    return OperationResponse(
        success=True,
        message=f"{len(saved_files)}개 파일 업로드가 완료되었습니다.",
        data={"files": saved_files}
    )


# ─── 새 폴더 생성 ───
@router.post("/mkdir", response_model=OperationResponse)
async def create_folder(req: MkdirRequest, scope: str = Query("")):
    base_dir = safe_resolve_path(req.path, scope)
    folder_name = req.folder_name.strip()
    
    if not folder_name or "/" in folder_name or "\\" in folder_name:
        raise HTTPException(status_code=400, detail="유효하지 않은 폴더 이름입니다.")

    new_dir = base_dir / folder_name
    if new_dir.exists():
        raise HTTPException(status_code=409, detail="이미 동일한 이름의 폴더가 존재합니다.")

    new_dir.mkdir(parents=True, exist_ok=True)
    return OperationResponse(
        success=True,
        message=f"'{folder_name}' 폴더가 생성되었습니다.",
        data={"folder_name": folder_name}
    )


# ─── 이름 변경 (파일 또는 폴더) ───
@router.post("/rename", response_model=OperationResponse)
async def rename_item(req: RenameRequest, scope: str = Query("")):
    target = safe_resolve_path(req.path, scope)
    if not target.exists():
        raise HTTPException(status_code=404, detail="이름을 변경할 항목을 찾을 수 없습니다.")

    new_name = req.new_name.strip()
    if not new_name or "/" in new_name or "\\" in new_name:
        raise HTTPException(status_code=400, detail="유효하지 않은 새 이름입니다.")

    dest = target.parent / new_name
    if dest.exists():
        raise HTTPException(status_code=409, detail="이미 동일한 이름의 항목이 존재합니다.")

    target.rename(dest)
    return OperationResponse(
        success=True,
        message=f"'{target.name}' 항목의 이름이 '{new_name}'(으)로 변경되었습니다.",
        data={"old_name": target.name, "new_name": new_name}
    )


# ─── 삭제 (단일 및 다중 삭제 지원) ───
@router.post("/delete", response_model=OperationResponse)
async def delete_items(req: DeleteRequest, scope: str = Query("")):
    if not req.paths:
        raise HTTPException(status_code=400, detail="삭제할 항목이 지정되지 않았습니다.")

    deleted = []
    errors = []
    root = get_storage_root(scope)

    for rel_p in req.paths:
        try:
            target = safe_resolve_path(rel_p, scope)
            if target == root:
                errors.append("루트 디렉토리는 삭제할 수 없습니다.")
                continue

            if target.is_dir():
                shutil.rmtree(target)
            elif target.is_file():
                target.unlink()
            deleted.append(target.name)
        except Exception as e:
            errors.append(f"{rel_p}: {str(e)}")

    if not deleted and errors:
        raise HTTPException(status_code=500, detail=", ".join(errors))

    return OperationResponse(
        success=True,
        message=f"{len(deleted)}개 항목이 성공적으로 삭제되었습니다." + (f" (실패: {len(errors)})" if errors else ""),
        data={"deleted": deleted, "errors": errors}
    )


# ─── 시스템 상태 헬스체크 ───
@router.get("/system-status")
def get_system_status():
    root = get_storage_root()
    return {
        "app_id": settings.APP_ID,
        "app_name": settings.APP_NAME,
        "status": "HEALTHY",
        "storage_root": str(root),
        "features": {
            "upload": True,
            "stream_preview": True,
            "text_preview": True,
            "search": True,
            "batch_delete": True
        }
    }
