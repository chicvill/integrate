"""
apps/photos/backend/routers/gallery.py
Gallery & Media file operations router adhering to the MQnet Canonical SaaS Template.
"""
import os
import io
import shutil
import hashlib
import mimetypes
import unicodedata
import urllib.parse
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Request, Response, UploadFile, File, Form, Query
from fastapi.responses import JSONResponse, StreamingResponse
import aiofiles
import aiofiles.os

from apps.photos.backend.config import settings
from shared.core.responses import safe_file_response, build_safe_content_disposition

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


def get_media_root() -> Path:
    p = Path(settings.PHOTOS_DIR).resolve()
    p.mkdir(parents=True, exist_ok=True)
    return p


def get_cache_dir() -> Path:
    p = Path(settings.CACHE_DIR).resolve()
    p.mkdir(parents=True, exist_ok=True)
    return p


def resolve_nfc_nfd(abs_path: Path) -> Path:
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

    media_root = get_media_root()
    try:
        rel = abs_path.relative_to(media_root)
        curr = media_root
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


def safe_path(relative: str) -> Optional[Path]:
    """Safely resolve user path under the isolated media directory, preventing directory traversal."""
    media_root = get_media_root()
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
        return resolve_nfc_nfd(abs_path)
    except ValueError:
        return None


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
async def list_albums(folder: str = "", request: Request = None):
    media_root = get_media_root()
    abs_folder = safe_path(folder)
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
                        cover_url = f"{prefix}/thumb/{cover_rel}"
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
                "url": f"{prefix}/raw/{quoted}",
                "thumb_url": f"{prefix}/thumb/{quoted}",
                "mtime": mtime,
                "size": size,
            })
        elif ext in VIDEO_EXTENSIONS:
            files.append({
                "type": "video",
                "name": entry,
                "path": rel,
                "url": f"{prefix}/raw/{quoted}",
                "thumb_url": f"{prefix}/thumb/{quoted}",
                "mtime": mtime,
                "size": size,
            })
        elif ext in DOCUMENT_EXTENSIONS:
            files.append({
                "type": "document",
                "doc_category": get_doc_category(ext),
                "name": entry,
                "path": rel,
                "url": f"{prefix}/raw/{quoted}",
                "thumb_url": f"{prefix}/raw/{quoted}",
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
async def get_thumbnail(file_path: str):
    abs_path = safe_path(urllib.parse.unquote(file_path))
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
async def get_raw(file_path: str, request: Request):
    abs_path = safe_path(urllib.parse.unquote(file_path))
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
    form_data = await request.form()
    folder = str(form_data.get("folder") or "")
    mode = str(form_data.get("mode") or "copy")
    relative_path = str(form_data.get("relative_path") or "")

    media_root = get_media_root()
    abs_folder = safe_path(folder)
    if not abs_folder or not abs_folder.exists() or not abs_folder.is_dir():
        if not folder:
            media_root.mkdir(parents=True, exist_ok=True)
            abs_folder = media_root
        else:
            raise HTTPException(status_code=404, detail="Target folder not found")

    # Extract all uploaded files flexibly from form_data (prioritize 'files', then fallback to others)
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
        # Check if relative_path was just requesting to create a subfolder
        if relative_path and not any(relative_path.lower().endswith(ext) for ext in IMAGE_EXTENSIONS | VIDEO_EXTENSIONS | DOCUMENT_EXTENSIONS):
            target_dir = abs_folder / Path(relative_path)
            target_dir.mkdir(parents=True, exist_ok=True)
            return JSONResponse({"success": True, "folder": str(target_dir.relative_to(media_root)), "uploaded": [], "errors": []})
        raise HTTPException(status_code=400, detail="업로드할 파일 데이터가 없습니다.")

    saved_files = []
    errors = []

    for file in upload_list:
        raw_name = file.filename or Path(relative_path).name or "upload.bin"
        raw_rel = relative_path.strip() if relative_path else raw_name
        # Normalize Korean Unicode (NFC)
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
            async with aiofiles.open(target_file_path, "wb") as out_file:
                while chunk := await file.read(1024 * 1024):
                    await out_file.write(chunk)
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
async def download_folder_zip(folder: str = Query("")):
    import zipfile
    abs_folder = safe_path(folder)
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


# ─── API: Storage Usage ──────────────────────────────────────────────────────
@router.get("/storage")
async def get_storage_info():
    try:
        media_root = get_media_root()
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
@router.post("/move")
async def move_item(src: str = Form(...), dest_folder: str = Form("")):
    abs_src = safe_path(src)
    abs_dest = safe_path(dest_folder)
    if not abs_src or not abs_src.exists():
        raise HTTPException(status_code=404, detail="Source item not found")
    if not abs_dest or not abs_dest.exists() or not abs_dest.is_dir():
        raise HTTPException(status_code=404, detail="Destination folder not found")

    target_path = abs_dest / abs_src.name
    shutil.move(str(abs_src), str(target_path))
    return JSONResponse({"success": True})


@router.post("/copy")
async def copy_item(src: str = Form(...), dest_folder: str = Form("")):
    abs_src = safe_path(src)
    abs_dest = safe_path(dest_folder)
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
async def delete_item(path: str = Form(...)):
    abs_path = safe_path(path)
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
async def batch_delete_items(paths: List[str] = Form(...)):
    deleted, errors = [], []
    for path in paths:
        abs_path = safe_path(path)
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
async def create_directory(folder: str = Form(""), name: str = Form(...)):
    media_root = get_media_root()
    abs_folder = safe_path(folder)
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
