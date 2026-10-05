"""
apps/photos/backend/routers/gallery.py
Gallery & Media file operations router adhering to the MQnet Canonical SaaS Template.
"""
import os
import io
import json
import shutil
import hashlib
import mimetypes
import unicodedata
import urllib.parse
from pathlib import Path
from typing import Optional, List
from datetime import datetime
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, HTTPException, Request, Response, UploadFile, File, Form, Query
from fastapi.responses import JSONResponse, StreamingResponse
import aiofiles
import aiofiles.os

from apps.photos.backend.config import settings
from shared.core.responses import safe_file_response, build_safe_content_disposition
from shared.storage.quota import (
    calculate_storage_quota,
    check_upload_quota,
    set_user_plan,
    get_user_plan,
    PLAN_QUOTAS,
)
from shared.auth import PhotosAuthSession, resolve_session_user
from fastapi import Header

try:
    from PIL import Image, ExifTags
except ImportError:
    Image = None
    ExifTags = None

router = APIRouter(prefix="", tags=["Photos & Media Gallery"])

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
TEXT_EXTENSIONS = {".txt", ".md", ".py", ".js", ".json", ".csv", ".html", ".css", ".log"}
DOCUMENT_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".hwp", ".hwpx",
    ".zip", ".rar", ".7z", ".tar", ".gz"
} | TEXT_EXTENSIONS

EXCLUDE_DIRS = {"$recycle.bin", "system volume information", ".git", ".vscode", "usb_temp", "__pycache__"}
THUMB_SIZE = (settings.THUMB_WIDTH, settings.THUMB_HEIGHT)
THUMB_QUALITY = settings.THUMB_QUALITY


def get_photos_session(
    request: Request,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> PhotosAuthSession:
    """Photos 전용 확장 세션 객체 의존성 주입"""
    return resolve_session_user(
        request=request,
        app_id="photos",
        session_cls=PhotosAuthSession,
        x_session_id=x_session_id,
        authorization=authorization,
    )


def _extract_user_id(request: Optional[Request]) -> str:
    """세션 객체 기반 사용자 식별자 추출 (하위 호환)"""
    if not request:
        return ""
    param_uid = request.query_params.get("user_id", "")
    if param_uid:
        return param_uid
    session = resolve_session_user(request, app_id="photos", session_cls=PhotosAuthSession)
    return session.user_id or ""


def get_media_root(user_id: str = "") -> Path:
    # 로그인 사용자 개인 격리 스토리지: /media/users/{user_id}/photos
    if user_id and user_id not in ("public", "all"):
        base_media = Path(os.getenv("MEDIA_STORAGE_PATH", os.getenv("MEDIA_PATH", "/media"))).resolve()
        user_root = base_media / "users" / user_id / "photos"
        user_root.mkdir(parents=True, exist_ok=True)
        return user_root

    p = Path(settings.PHOTOS_DIR).resolve()
    p.mkdir(parents=True, exist_ok=True)
    return p


def get_cache_dir() -> Path:
    p = Path(settings.CACHE_DIR).resolve()
    p.mkdir(parents=True, exist_ok=True)
    return p


def resolve_nfc_nfd(abs_path: Path, media_root: Optional[Path] = None) -> Path:
    """Normalize and match Unicode filenames across macOS (NFD) and Windows/Linux (NFC)."""
    if abs_path.exists() or os.path.lexists(abs_path):
        return abs_path

    nfc_str = unicodedata.normalize('NFC', str(abs_path))
    nfc_path = Path(nfc_str)
    if nfc_path.exists() or os.path.lexists(nfc_path):
        return nfc_path

    nfd_str = unicodedata.normalize('NFD', str(abs_path))
    nfd_path = Path(nfd_str)
    if nfd_path.exists() or os.path.lexists(nfd_path):
        return nfd_path

    root = media_root or get_media_root()
    try:
        rel = abs_path.relative_to(root)
        curr = root
        for part in rel.parts:
            part_nfc = unicodedata.normalize('NFC', part)
            matched = False
            if curr.exists() and curr.is_dir():
                for child in curr.iterdir():
                    if unicodedata.normalize('NFC', child.name) == part_nfc:
                        curr = child
                        matched = True
                        break
            if not matched:
                curr = curr / part
        return curr
    except Exception:
        pass

    return abs_path


def safe_path(relative: str, user_id: str = "") -> Optional[Path]:
    """Safely resolve user path under the isolated media directory, preventing directory traversal."""
    media_root = get_media_root(user_id)
    raw = urllib.parse.unquote(relative or "")
    cleaned = raw.lstrip("/").lstrip("\\")

    media_name = media_root.name
    if media_name:
        if cleaned == media_name:
            cleaned = ""
        elif cleaned.startswith(f"{media_name}/") or cleaned.startswith(f"{media_name}\\"):
            cleaned = cleaned[len(media_name) + 1:]

    abs_path = (media_root / cleaned).resolve()
    try:
        abs_path.relative_to(media_root)
        resolved = resolve_nfc_nfd(abs_path, media_root)
        if resolved.exists():
            return resolved
    except ValueError:
        pass

    # Fallback to public root if user-specific file is not found (allows shared preview)
    if user_id:
        pub_root = get_media_root("")
        pub_path = (pub_root / cleaned).resolve()
        try:
            pub_path.relative_to(pub_root)
            return resolve_nfc_nfd(pub_path, pub_root)
        except ValueError:
            pass

    return abs_path


def is_valid_entry(name: str) -> bool:
    return (
        name.lower() not in EXCLUDE_DIRS
        and not name.startswith("$")
        and not name.startswith(".")
    )


def thumb_cache_path(abs_path: Path) -> Path:
    try:
        mtime = abs_path.stat().st_mtime
    except Exception:
        mtime = 0
    key = f"{abs_path}:{mtime}"
    h = hashlib.md5(key.encode()).hexdigest()
    return get_cache_dir() / f"{h}.jpg"


def make_thumbnail(abs_path: Path) -> Optional[bytes]:
    if Image is None:
        return None
    try:
        with Image.open(abs_path) as img:
            try:
                exif = img._getexif()
                if exif:
                    for tag, value in exif.items():
                        if ExifTags and ExifTags.TAGS.get(tag) == "Orientation":
                            rotations = {3: 180, 6: 270, 8: 90}
                            if value in rotations:
                                img = img.rotate(rotations[value], expand=True)
            except Exception:
                pass

            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")

            img.thumbnail(THUMB_SIZE, Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=THUMB_QUALITY, optimize=True)
            return buf.getvalue()
    except Exception:
        return None


def get_doc_category(ext: str) -> str:
    if ext == ".pdf":
        return "pdf"
    if ext in TEXT_EXTENSIONS:
        return "text"
    if ext in {".doc", ".docx", ".hwp", ".hwpx"}:
        return "word"
    if ext in {".xls", ".xlsx"}:
        return "excel"
    if ext in {".ppt", ".pptx"}:
        return "ppt"
    if ext in {".zip", ".rar", ".7z", ".tar", ".gz"}:
        return "archive"
    return "general"


def get_route_prefix(request: Optional[Request] = None) -> str:
    if request and "/photos" in request.url.path:
        return "/api/photos"
    return "/api"


# ─── API: Album & File listing ────────────────────────────────────────────────
@router.get("/albums")
@router.get("/list")
async def list_albums(folder: str = "", request: Request = None, user_id: str = Query("")):
    uid = _extract_user_id(request) or user_id
    media_root = get_media_root(uid)
    abs_folder = safe_path(folder, uid)
    if not abs_folder or not abs_folder.exists() or not abs_folder.is_dir():
        if not folder:
            media_root.mkdir(parents=True, exist_ok=True)
            abs_folder = media_root
        else:
            raise HTTPException(status_code=404, detail="Folder not found")

    try:
        entries = sorted(await aiofiles.os.listdir(abs_folder))
    except Exception:
        entries = []

    prefix = get_route_prefix(request)
    folders, files = [], []
    q_suffix = f"?user_id={uid}" if uid else ""

    for entry in entries:
        if not is_valid_entry(entry):
            continue

        rel = (f"{folder}/{entry}".lstrip("/")) if folder else entry
        entry_path = abs_folder / entry
        ext = entry_path.suffix.lower()
        quoted = urllib.parse.quote(rel)

        try:
            stat = entry_path.stat()
            mtime = int(stat.st_mtime)
            size = stat.st_size
        except Exception:
            mtime = 0
            size = 0

        if entry_path.is_dir():
            cover_url = "/assets/folder-placeholder.svg"
            try:
                sub_entries = sorted(await aiofiles.os.listdir(entry_path))
                for se in sub_entries:
                    if Path(se).suffix.lower() in IMAGE_EXTENSIONS:
                        cover_rel = urllib.parse.quote(f"{rel}/{se}")
                        cover_url = f"{prefix}/thumb/{cover_rel}{q_suffix}"
                        break
            except Exception:
                pass

            folders.append({
                "type": "folder",
                "name": entry,
                "path": rel,
                "cover_url": cover_url,
                "mtime": mtime,
                "size": size,
            })
        elif ext in IMAGE_EXTENSIONS:
            files.append({
                "type": "image",
                "name": entry,
                "path": rel,
                "url": f"{prefix}/raw/{quoted}{q_suffix}",
                "thumb_url": f"{prefix}/thumb/{quoted}{q_suffix}",
                "mtime": mtime,
                "size": size,
            })
        elif ext in VIDEO_EXTENSIONS:
            files.append({
                "type": "video",
                "name": entry,
                "path": rel,
                "url": f"{prefix}/raw/{quoted}{q_suffix}",
                "thumb_url": f"{prefix}/thumb/{quoted}{q_suffix}",
                "mtime": mtime,
                "size": size,
            })
        elif ext in DOCUMENT_EXTENSIONS:
            files.append({
                "type": "document",
                "doc_category": get_doc_category(ext),
                "name": entry,
                "path": rel,
                "url": f"{prefix}/raw/{quoted}{q_suffix}",
                "thumb_url": f"{prefix}/raw/{quoted}{q_suffix}",
                "mtime": mtime,
                "size": size,
            })

    parent = str(Path(folder).parent).replace("\\", "/") if folder else None
    if parent == ".":
        parent = ""

    return JSONResponse({
        "current_folder": folder.replace("\\", "/"),
        "parent_folder": parent,
        "items": folders + files,
    })


# ─── API: Thumbnail ──────────────────────────────────────────────────────────
@router.get("/thumb/{file_path:path}")
async def get_thumbnail(file_path: str, request: Request = None, user_id: str = Query("")):
    uid = _extract_user_id(request) or user_id
    abs_path = safe_path(urllib.parse.unquote(file_path), uid)
    if not abs_path or not abs_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail source file not found")

    ext = abs_path.suffix.lower()
    if ext not in IMAGE_EXTENSIONS:
        return safe_file_response(str(abs_path), filename=abs_path.name, as_attachment=False)

    cache = thumb_cache_path(abs_path)
    if cache.exists():
        return safe_file_response(
            str(cache),
            filename=f"thumb_{abs_path.name}.jpg",
            media_type="image/jpeg",
            as_attachment=False,
            headers={"Cache-Control": "public, max-age=604800"}
        )

    data = make_thumbnail(abs_path)
    if data:
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_bytes(data)
        return safe_file_response(
            str(cache),
            filename=f"thumb_{abs_path.name}.jpg",
            media_type="image/jpeg",
            as_attachment=False,
            headers={"Cache-Control": "public, max-age=604800"}
        )
    else:
        return safe_file_response(str(abs_path), filename=abs_path.name, as_attachment=False)


# ─── API: Raw File Streaming & Range Playback ────────────────────────────────
@router.get("/raw/{file_path:path}")
async def get_raw(file_path: str, request: Request, user_id: str = Query("")):
    uid = _extract_user_id(request) or user_id
    abs_path = safe_path(urllib.parse.unquote(file_path), uid)
    if not abs_path or not abs_path.exists() or not abs_path.is_file():
        raise HTTPException(status_code=404, detail="Media file not found")

    file_size = abs_path.stat().st_size
    mime_type, _ = mimetypes.guess_type(str(abs_path))
    mime_type = mime_type or "application/octet-stream"

    if abs_path.suffix.lower() in TEXT_EXTENSIONS:
        mime_type = f"{mime_type}; charset=utf-8"

    range_header = request.headers.get("range")
    if range_header:
        try:
            range_val = range_header.replace("bytes=", "")
            start_str, _, end_str = range_val.partition("-")
            start = int(start_str) if start_str else 0
            end = int(end_str) if end_str else file_size - 1
            end = min(end, file_size - 1)
            chunk_size = end - start + 1

            async def range_stream():
                async with aiofiles.open(abs_path, "rb") as f:
                    await f.seek(start)
                    remaining = chunk_size
                    while remaining > 0:
                        read_size = min(131072, remaining)
                        data = await f.read(read_size)
                        if not data:
                            break
                        remaining -= len(data)
                        yield data

            cd_header = build_safe_content_disposition(abs_path.name, as_attachment=False)
            return StreamingResponse(
                range_stream(),
                status_code=206,
                media_type=mime_type,
                headers={
                    "Content-Range": f"bytes {start}-{end}/{file_size}",
                    "Accept-Ranges": "bytes",
                    "Content-Length": str(chunk_size),
                    "Content-Disposition": cd_header,
                    "Cache-Control": "public, max-age=86400",
                },
            )
        except Exception:
            raise HTTPException(status_code=416, detail="Invalid range")

    return safe_file_response(
        str(abs_path),
        filename=abs_path.name,
        as_attachment=False,
        media_type=mime_type,
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=86400",
        }
    )


# ─── API: Upload ─────────────────────────────────────────────────────────────
@router.post("/upload")
async def upload_files(request: Request):
    user_id = _extract_user_id(request)
    form_data = await request.form()
    folder = str(form_data.get("folder") or "")
    mode = str(form_data.get("mode") or "copy")
    relative_path = str(form_data.get("relative_path") or "")
    if not user_id and form_data.get("user_id"):
        user_id = str(form_data.get("user_id"))

    media_root = get_media_root(user_id)
    abs_folder = safe_path(folder, user_id)
    if not abs_folder or not abs_folder.exists() or not abs_folder.is_dir():
        if not folder:
            media_root.mkdir(parents=True, exist_ok=True)
            abs_folder = media_root
        else:
            raise HTTPException(status_code=404, detail="Target folder not found")

    # Extract all uploaded files flexibly from form_data
    upload_list: List[UploadFile] = []
    for key in ("files", "file", "upload"):
        items = [item for item in form_data.getlist(key) if hasattr(item, "filename") and item.filename]
        if items:
            upload_list.extend(items)
            break

    if not upload_list:
        seen_filenames = set()
        for key, item in form_data.multi_items():
            if hasattr(item, "filename") and item.filename and item.filename not in seen_filenames:
                seen_filenames.add(item.filename)
                upload_list.append(item)

    if not upload_list:
        if relative_path and not any(relative_path.lower().endswith(ext) for ext in IMAGE_EXTENSIONS | VIDEO_EXTENSIONS | DOCUMENT_EXTENSIONS):
            target_dir = abs_folder / Path(relative_path)
            target_dir.mkdir(parents=True, exist_ok=True)
            return JSONResponse({"success": True, "folder": str(target_dir.relative_to(media_root)), "uploaded": [], "errors": []})
        raise HTTPException(status_code=400, detail="업로드할 파일 데이터가 없습니다.")

    # ★ 500KB 스토리지 쿼터 사전 검증
    file_bytes_map = {}
    total_upload_size = 0
    for file in upload_list:
        content = await file.read()
        file_bytes_map[file] = content
        total_upload_size += len(content)

    quota_check = check_upload_quota(abs_folder, total_upload_size, user_id or "demo_user")
    if quota_check["exceeded"]:
        return JSONResponse(
            status_code=403,
            content={
                "detail": {
                    "error": "QUOTA_EXCEEDED",
                    "quota_info": quota_check,
                    "message": quota_check["message"]
                }
            }
        )

    saved_files = []
    errors = []

    for file in upload_list:
        raw_name = file.filename or Path(relative_path).name or "upload.bin"
        raw_rel = relative_path.strip() if relative_path else raw_name
        raw_rel = unicodedata.normalize("NFC", raw_rel)
        rel_p = Path(raw_rel)

        if any(part.startswith(".") or part.startswith("$") for part in rel_p.parts):
            errors.append(f"{file.filename}: Reserved or hidden path")
            continue

        target_file_path = abs_folder / rel_p
        target_file_path.parent.mkdir(parents=True, exist_ok=True)

        if mode == "copy" and target_file_path.exists():
            stem = target_file_path.stem
            suffix = target_file_path.suffix
            counter = 1
            while target_file_path.exists():
                target_file_path = target_file_path.parent / f"{stem}({counter}){suffix}"
                counter += 1

        try:
            target_file_path.relative_to(abs_folder)
        except ValueError:
            errors.append(f"{file.filename}: Invalid target path")
            continue

        try:
            content = file_bytes_map.get(file, b"")
            async with aiofiles.open(target_file_path, "wb") as out_file:
                await out_file.write(content)
            saved_files.append(target_file_path.name)
        except Exception as e:
            errors.append(f"{file.filename}: {str(e)}")

    if not saved_files and errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))

    return JSONResponse({
        "success": True,
        "folder": folder,
        "uploaded": saved_files,
        "errors": errors
    })


# ─── API: Download Folder as ZIP ──────────────────────────────────────────────
@router.get("/download_folder")
async def download_folder_zip(folder: str = Query(""), request: Request = None, user_id: str = Query("")):
    import zipfile
    uid = _extract_user_id(request) or user_id
    abs_folder = safe_path(folder, uid)
    if not abs_folder or not abs_folder.exists() or not abs_folder.is_dir():
        raise HTTPException(status_code=404, detail="Folder not found")

    zip_filename = f"{abs_folder.name or 'Photos_Album'}.zip"
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for file_path in abs_folder.rglob("*"):
            if file_path.is_file() and not file_path.name.startswith(".") and not file_path.name.startswith("$"):
                arcname = file_path.relative_to(abs_folder)
                zip_file.write(file_path, arcname)

    zip_buffer.seek(0)
    cd_header = build_safe_content_disposition(zip_filename, as_attachment=True)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": cd_header,
            "Cache-Control": "no-cache"
        }
    )


# ─── API: Storage Quota & Plan Management (★ 500KB 무료 플랜 및 유료 전환) ──────
@router.get("/quota")
async def get_photos_quota(request: Request, user_id: str = Query("")):
    uid = _extract_user_id(request) or user_id or "demo_user"
    media_root = get_media_root(uid)
    quota_info = calculate_storage_quota(media_root, uid)
    return JSONResponse(quota_info)


@router.post("/upgrade-plan")
async def upgrade_photos_plan(request: Request):
    data = await request.json()
    plan_tier = data.get("plan_tier", "pro")
    uid = _extract_user_id(request) or data.get("user_id") or "demo_user"
    set_user_plan(uid, plan_tier)
    media_root = get_media_root(uid)
    quota_info = calculate_storage_quota(media_root, uid)
    return JSONResponse({"success": True, "quota": quota_info})


# ─── API: Storage Usage ──────────────────────────────────────────────────────
@router.get("/storage")
async def get_storage_info(request: Request = None, user_id: str = Query("")):
    try:
        uid = _extract_user_id(request) or user_id
        media_root = get_media_root(uid)
        total, used, free = shutil.disk_usage(media_root)
        percent = round((used / total) * 100, 1) if total > 0 else 0.0
        return JSONResponse({
            "success": True,
            "total": total,
            "used": used,
            "free": free,
            "percent": percent,
            "storage_path": str(media_root)
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── API: Move / Copy / Delete / Mkdir ─────────────────────────────────────────
def _unique_move_target(target_path: Path) -> Path:
    if not target_path.exists():
        return target_path
    if target_path.is_file():
        stem = target_path.stem
        suffix = target_path.suffix
        counter = 1
        while target_path.exists():
            target_path = target_path.parent / f"{stem}({counter}){suffix}"
            counter += 1
    else:
        name = target_path.name
        counter = 1
        while target_path.exists():
            target_path = target_path.parent / f"{name}({counter})"
            counter += 1
    return target_path


def _is_subpath(child: Path, parent: Path) -> bool:
    try:
        child.relative_to(parent)
        return True
    except ValueError:
        return False


@router.get("/folders")
async def list_all_folders(request: Request = None, user_id: str = Query("")):
    uid = _extract_user_id(request) or user_id
    media_root = get_media_root(uid)
    folder_list = [{"name": "L:\\ (최상위 루트)", "path": "", "depth": 0}]

    def scan_folders(current_dir: Path, rel_base: str, depth: int):
        if depth > 8:
            return
        try:
            entries = sorted(os.scandir(current_dir), key=lambda e: e.name.lower())
            for entry in entries:
                if entry.is_dir() and is_valid_entry(entry.name):
                    rel = f"{rel_base}/{entry.name}".lstrip("/") if rel_base else entry.name
                    folder_list.append({
                        "name": entry.name,
                        "path": rel,
                        "depth": depth + 1
                    })
                    scan_folders(Path(entry.path), rel, depth + 1)
        except Exception:
            pass

    scan_folders(media_root, "", 0)
    return JSONResponse({"success": True, "folders": folder_list})


@router.post("/move")
async def move_item(src: str = Form(...), dest_folder: str = Form(""), request: Request = None):
    uid = _extract_user_id(request)
    abs_src = safe_path(src, uid)
    abs_dest = safe_path(dest_folder, uid)
    if not abs_src or not abs_src.exists():
        raise HTTPException(status_code=404, detail="이동할 원본 파일을 찾을 수 없습니다.")
    if not abs_dest or not abs_dest.exists() or not abs_dest.is_dir():
        raise HTTPException(status_code=404, detail="대상 폴더를 찾을 수 없습니다.")

    if abs_src == abs_dest:
        return JSONResponse({"success": True, "note": "이미 대상 폴더에 위치해 있습니다."})
    if abs_src.is_dir() and _is_subpath(abs_dest, abs_src):
        raise HTTPException(status_code=400, detail="폴더를 자기 자신 또는 하위 폴더로 이동할 수 없습니다.")

    if abs_src.parent.resolve() == abs_dest.resolve():
        return JSONResponse({"success": True, "note": "이미 대상 폴더에 위치해 있습니다."})

    target_path = _unique_move_target(abs_dest / abs_src.name)
    shutil.move(str(abs_src), str(target_path))

    cache = thumb_cache_path(abs_src)
    if cache.exists():
        try:
            cache.unlink()
        except Exception:
            pass

    return JSONResponse({"success": True, "target": str(target_path.name)})


@router.post("/batch_move")
async def batch_move_items(paths: List[str] = Form(...), dest_folder: str = Form(""), request: Request = None):
    uid = _extract_user_id(request)
    abs_dest = safe_path(dest_folder, uid)
    if not abs_dest or not abs_dest.exists() or not abs_dest.is_dir():
        raise HTTPException(status_code=404, detail="대상 폴더를 찾을 수 없습니다.")

    moved, errors = [], []
    for path in paths:
        abs_src = safe_path(path, uid)
        if not abs_src or not abs_src.exists():
            errors.append(f"{path}: 원본 항목을 찾을 수 없음")
            continue

        if abs_src == abs_dest:
            continue
        if abs_src.is_dir() and _is_subpath(abs_dest, abs_src):
            errors.append(f"{path}: 폴더를 자기 자신 또는 하위 폴더로 이동할 수 없음")
            continue

        if abs_src.parent.resolve() == abs_dest.resolve():
            moved.append(path)
            continue

        try:
            target_path = _unique_move_target(abs_dest / abs_src.name)
            shutil.move(str(abs_src), str(target_path))
            cache = thumb_cache_path(abs_src)
            if cache.exists():
                try:
                    cache.unlink()
                except Exception:
                    pass
            moved.append(path)
        except Exception as e:
            errors.append(f"{path}: {str(e)}")

    return JSONResponse({"success": True, "moved": moved, "errors": errors})


@router.post("/copy")
async def copy_item(src: str = Form(...), dest_folder: str = Form(""), request: Request = None):
    uid = _extract_user_id(request)
    abs_src = safe_path(src, uid)
    abs_dest = safe_path(dest_folder, uid)
    if not abs_src or not abs_src.exists():
        raise HTTPException(status_code=404, detail="Source item not found")
    if not abs_dest or not abs_dest.exists() or not abs_dest.is_dir():
        raise HTTPException(status_code=404, detail="Destination folder not found")

    target_path = abs_dest / abs_src.name
    if abs_src.is_dir():
        shutil.copytree(str(abs_src), str(target_path))
    else:
        shutil.copy2(str(abs_src), str(target_path))
    return JSONResponse({"success": True})


@router.post("/delete")
async def delete_item(path: str = Form(...), request: Request = None):
    uid = _extract_user_id(request)
    abs_path = safe_path(path, uid)
    if not abs_path or not abs_path.exists():
        return JSONResponse({"success": True, "note": "Already removed"})

    cache = thumb_cache_path(abs_path)
    if abs_path.is_dir() and not abs_path.is_symlink():
        shutil.rmtree(str(abs_path))
    else:
        os.remove(str(abs_path))

    if cache.exists():
        cache.unlink()

    return JSONResponse({"success": True, "path": path})


@router.post("/batch_delete")
async def batch_delete_items(paths: List[str] = Form(...), request: Request = None):
    uid = _extract_user_id(request)
    deleted, errors = [], []
    for path in paths:
        abs_path = safe_path(path, uid)
        if not abs_path or not abs_path.exists():
            deleted.append(path)
            continue
        try:
            cache = thumb_cache_path(abs_path)
            if abs_path.is_dir() and not abs_path.is_symlink():
                shutil.rmtree(str(abs_path))
            else:
                os.remove(str(abs_path))
            if cache.exists():
                cache.unlink()
            deleted.append(path)
        except Exception as e:
            errors.append(f"{path}: {str(e)}")
    return JSONResponse({"success": True, "deleted": deleted, "errors": errors})


@router.post("/mkdir")
async def create_directory(folder: str = Form(""), name: str = Form(...), request: Request = None):
    uid = _extract_user_id(request)
    media_root = get_media_root(uid)
    abs_folder = safe_path(folder, uid)
    if not abs_folder or not abs_folder.exists() or not abs_folder.is_dir():
        if not folder:
            media_root.mkdir(parents=True, exist_ok=True)
            abs_folder = media_root
        else:
            raise HTTPException(status_code=404, detail="Parent folder not found")

    folder_name = unicodedata.normalize("NFC", name.strip())
    if not folder_name or folder_name.startswith(".") or folder_name.startswith("$"):
        raise HTTPException(status_code=400, detail="Invalid folder name")

    new_dir = abs_folder / folder_name
    new_dir.mkdir(parents=True, exist_ok=True)
    rel_created = str(new_dir.relative_to(media_root)).replace("\\", "/")
    return JSONResponse({"success": True, "folder": rel_created, "name": folder_name})


def format_size(size_bytes: int) -> str:
    if size_bytes == 0:
        return "0 B"
    sizes = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    size = float(size_bytes)
    while size >= 1024 and i < len(sizes) - 1:
        size /= 1024
        i += 1
    return f"{size:.1f} {sizes[i]}"


# Persistent in-memory and disk difference hash (dHash) cache
DHASH_CACHE = {}


def _get_dhash_cache_file() -> Path:
    return get_cache_dir() / "dhash_cache.json"


def _load_dhash_cache():
    global DHASH_CACHE
    cfile = _get_dhash_cache_file()
    if cfile.exists():
        try:
            with open(cfile, "r", encoding="utf-8") as f:
                DHASH_CACHE = json.load(f)
        except Exception:
            DHASH_CACHE = {}


def _save_dhash_cache():
    cfile = _get_dhash_cache_file()
    try:
        with open(cfile, "w", encoding="utf-8") as f:
            json.dump(DHASH_CACHE, f)
    except Exception:
        pass


def _fast_compute_dhash(args):
    p, cache_dir = args
    if not Image:
        return None
    try:
        try:
            st = p.stat()
            mtime = st.st_mtime
            size = st.st_size
        except Exception:
            return None

        # 1. Check persistent memory cache (instant: 0.00001s)
        ckey = f"{p}:{mtime}:{size}"
        if ckey in DHASH_CACHE:
            return (p, DHASH_CACHE[ckey])

        # 2. Check thumbnail cache next
        key = f"{p}:{mtime}"
        h = hashlib.md5(key.encode()).hexdigest()
        cached_thumb = cache_dir / f"{h}.jpg"
        source_p = cached_thumb if cached_thumb.exists() else p

        with Image.open(source_p) as img:
            if source_p == p and getattr(img, "format", "") in ("JPEG", "JPG"):
                try:
                    img.draft("L", (32, 32))
                except Exception:
                    pass
            # Downsample to 9x8 with fast BOX filter
            img = img.convert("L").resize((9, 8), Image.Resampling.BOX)
            pixels = list(img.getdata())
            val = 0
            for row in range(8):
                rs = row * 9
                for col in range(8):
                    val = (val << 1) | (1 if pixels[rs + col] > pixels[rs + col + 1] else 0)

            DHASH_CACHE[ckey] = val
            return (p, val)
    except Exception:
        return None


@router.get("/duplicates")
async def find_duplicates(
    folder: str = Query("", description="Folder to scan under (empty for root)"),
    recursive: bool = Query(True, description="Recursively search subfolders"),
    mode: str = Query("all", description="Detection mode: 'all', 'exact' or 'visual'"),
    include_videos: bool = Query(True, description="Include video duplicates"),
    limit: int = Query(150, description="Max duplicate groups"),
    request: Request = None,
    user_id: str = Query(""),
):
    uid = _extract_user_id(request) or user_id
    prefix = get_route_prefix(request)
    media_root = get_media_root(uid)
    if folder:
        scan_dir = safe_path(folder, uid)
        if not scan_dir or not scan_dir.exists() or not scan_dir.is_dir():
            raise HTTPException(status_code=404, detail="지정한 폴더를 찾을 수 없습니다.")
    else:
        scan_dir = media_root

    target_exts = set(IMAGE_EXTENSIONS)
    if include_videos:
        target_exts |= VIDEO_EXTENSIONS

    candidates = []
    try:
        if recursive:
            for root, dirs, files in os.walk(str(scan_dir)):
                dirs[:] = [d for d in dirs if is_valid_entry(d)]
                for fname in files:
                    ext = Path(fname).suffix.lower()
                    if ext in target_exts and is_valid_entry(fname):
                        full_p = Path(root) / fname
                        candidates.append(full_p)
        else:
            for entry in scan_dir.iterdir():
                if entry.is_file() and entry.suffix.lower() in target_exts and is_valid_entry(entry.name):
                    candidates.append(entry)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"디렉터리 탐색 오류: {str(e)}")

    if not candidates:
        return JSONResponse({
            "total_files_scanned": 0,
            "total_groups": 0,
            "total_duplicate_files": 0,
            "total_wasted_bytes": 0,
            "formatted_wasted_bytes": "0 B",
            "groups": []
        })

    groups = []
    exact_duplicate_sets = []

    # ─────────────────────────────────────────────────────────────
    # Step 1. Fast Exact Duplicate Detection (Runs for 'all', 'exact', and 'visual')
    # Exact matching is ultra-fast (< 0.1s) and guarantees 100% identical duplicates are included!
    # ─────────────────────────────────────────────────────────────
    size_groups = defaultdict(list)
    for p in candidates:
        try:
            sz = p.stat().st_size
            if sz > 0:
                size_groups[sz].append(p)
        except Exception:
            continue

    same_size_candidates = {sz: plist for sz, plist in size_groups.items() if len(plist) > 1}

    hash_groups = defaultdict(list)
    for sz, plist in same_size_candidates.items():
        for p in plist:
            try:
                with open(p, "rb") as f:
                    q_hash = hashlib.sha256(f.read(65536)).hexdigest()
                hash_groups[(sz, q_hash)].append(p)
            except Exception:
                continue

    collision_candidates = [plist for plist in hash_groups.values() if len(plist) > 1]

    final_exact_groups = defaultdict(list)
    for plist in collision_candidates:
        for p in plist:
            try:
                h = hashlib.sha256()
                with open(p, "rb") as f:
                    for chunk in iter(lambda: f.read(65536), b""):
                        h.update(chunk)
                full_hash = h.hexdigest()
                final_exact_groups[full_hash].append(p)
            except Exception:
                continue

    for fhash, plist in final_exact_groups.items():
        if len(plist) < 2:
            continue
        exact_duplicate_sets.append(frozenset(plist))

        items_info = []
        for p in plist:
            try:
                st = p.stat()
                rel_p = str(p.relative_to(media_root)).replace("\\", "/")
                folder_rel = str(p.parent.relative_to(media_root)).replace("\\", "/") if p.parent != media_root else ""
                items_info.append({
                    "path": rel_p,
                    "name": p.name,
                    "size": st.st_size,
                    "formatted_size": format_size(st.st_size),
                    "mtime": st.st_mtime,
                    "mtime_str": datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M"),
                    "url": f"{prefix}/raw/{urllib.parse.quote(rel_p)}",
                    "thumb": f"{prefix}/thumb/{urllib.parse.quote(rel_p)}",
                    "folder": folder_rel,
                    "folder_display": f"L:\\{folder_rel.replace('/', chr(92))}" if folder_rel else "L:\\"
                })
            except Exception:
                continue

        if len(items_info) < 2:
            continue

        items_info.sort(key=lambda x: x["mtime"])
        for i, it in enumerate(items_info):
            it["is_suggested_original"] = (i == 0)

        file_size = items_info[0]["size"] if items_info else 0
        wasted = file_size * (len(items_info) - 1)
        groups.append({
            "group_id": f"exact_{fhash[:12]}",
            "type": "exact",
            "type_label": "👑 완전 일치 (동일 파일)",
            "similarity": 100,
            "file_size": file_size,
            "formatted_size": format_size(file_size),
            "wasted_size": wasted,
            "formatted_wasted_size": format_size(wasted),
            "items": items_info
        })

    # ─────────────────────────────────────────────────────────────
    # Step 2. Ultra-Fast Parallel Visual Similarity Search
    # (executed when mode in ("visual", "all"))
    # ─────────────────────────────────────────────────────────────
    if mode in ("visual", "all") and Image:
        cache_dir = get_cache_dir()
        if not DHASH_CACHE:
            _load_dhash_cache()

        img_candidates = [p for p in candidates if p.suffix.lower() in IMAGE_EXTENSIONS]

        # Multi-threaded dHash calculation with draft/box and persistent caching
        worker_args = [(p, cache_dir) for p in img_candidates]
        image_hashes = []
        max_workers = min(8, (os.cpu_count() or 4) * 2)

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            for res in executor.map(_fast_compute_dhash, worker_args):
                if res and res[1] is not None:
                    image_hashes.append(res)

        # Save newly computed hashes persistently so future scans are instant
        _save_dhash_cache()

        # Cluster similar images (Hamming distance <= 4 -> similarity >= 93.8%)
        used = set()
        for i in range(len(image_hashes)):
            if i in used:
                continue
            p1, h1 = image_hashes[i]
            cluster = [p1]
            min_dist = 64
            for j in range(i + 1, len(image_hashes)):
                if j in used:
                    continue
                p2, h2 = image_hashes[j]
                dist = bin(h1 ^ h2).count("1")
                if dist <= 4:
                    cluster.append(p2)
                    min_dist = min(min_dist, dist)
                    used.add(j)

            if len(cluster) >= 2:
                # If this entire cluster is already grouped in an exact set, skip duplicating
                cluster_set = frozenset(cluster)
                already_in_exact = False
                for ex_set in exact_duplicate_sets:
                    if cluster_set.issubset(ex_set) or ex_set.issubset(cluster_set):
                        already_in_exact = True
                        break

                if already_in_exact:
                    continue

                used.add(i)

                items_info = []
                for p in cluster:
                    try:
                        st = p.stat()
                        rel_p = str(p.relative_to(media_root)).replace("\\", "/")
                        folder_rel = str(p.parent.relative_to(media_root)).replace("\\", "/") if p.parent != media_root else ""
                        items_info.append({
                            "path": rel_p,
                            "name": p.name,
                            "size": st.st_size,
                            "formatted_size": format_size(st.st_size),
                            "mtime": st.st_mtime,
                            "mtime_str": datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M"),
                            "url": f"{prefix}/raw/{urllib.parse.quote(rel_p)}",
                            "thumb": f"{prefix}/thumb/{urllib.parse.quote(rel_p)}",
                            "folder": folder_rel,
                            "folder_display": f"L:\\{folder_rel.replace('/', chr(92))}" if folder_rel else "L:\\"
                        })
                    except Exception:
                        continue

                if len(items_info) < 2:
                    continue

                items_info.sort(key=lambda x: x["mtime"])
                for idx, it in enumerate(items_info):
                    it["is_suggested_original"] = (idx == 0)

                total_sz = sum(it["size"] for it in items_info[1:])
                sim_pct = max(88, round((1.0 - (min_dist / 64.0)) * 100))
                groups.append({
                    "group_id": f"visual_{i}",
                    "type": "visual",
                    "type_label": f"📷 유사 사진 ({sim_pct}% 유사)",
                    "similarity": sim_pct,
                    "file_size": items_info[0]["size"] if items_info else 0,
                    "formatted_size": format_size(items_info[0]["size"]) if items_info else "0 B",
                    "wasted_size": total_sz,
                    "formatted_wasted_size": format_size(total_sz),
                    "items": items_info
                })

    # Sort groups by wasted size descending so largest space savings come first
    groups.sort(key=lambda g: g["wasted_size"], reverse=True)
    if limit and len(groups) > limit:
        groups = groups[:limit]

    total_wasted = sum(g["wasted_size"] for g in groups)
    total_dup_files = sum(len(g["items"]) - 1 for g in groups)

    return JSONResponse({
        "total_files_scanned": len(candidates),
        "total_groups": len(groups),
        "total_duplicate_files": total_dup_files,
        "total_wasted_bytes": total_wasted,
        "formatted_wasted_bytes": format_size(total_wasted),
        "groups": groups
    })
