"""
apps/files/backend/services/files_service.py
Core file and directory operations for MQnet Files Hub with ThreadPool safety.
"""
import os
import shutil
import mimetypes
import unicodedata
from pathlib import Path
from datetime import datetime
from typing import List, Tuple, Optional, Dict, Any
from concurrent.futures import ThreadPoolExecutor

from fastapi import HTTPException
from apps.files.backend.config import settings
from apps.files.backend.schemas import FileItem, BreadcrumbItem, FolderListResponse

# CPU/IO 워커 스레드 풀
_io_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="files_io_worker")

# 카테고리별 확장자 매핑
CATEGORY_MAP = {
    "image": {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".ico", ".tiff"},
    "video": {".mp4", ".mkv", ".mov", ".avi", ".webm", ".flv", ".wmv", ".m4v"},
    "audio": {".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a", ".wma"},
    "document": {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".hwp", ".hwpx", ".odt", ".rtf"},
    "code": {".txt", ".md", ".json", ".js", ".ts", ".html", ".css", ".py", ".sh", ".bat", ".sql", ".yaml", ".yml", ".xml", ".csv", ".log"},
    "archive": {".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz", ".iso"},
}

EXCLUDE_NAMES = {"$recycle.bin", "system volume information", ".git", ".vscode", "__pycache__", ".DS_Store"}


def get_storage_root(scope: str = "", user_id: str = "") -> Path:
    base_media = Path(os.getenv("MEDIA_STORAGE_PATH", os.getenv("MEDIA_PATH", "/media"))).resolve()
    
    # 로그인 사용자 개인 격리 스토리지: /media/users/{user_id}/
    if user_id:
        user_root = base_media / "users" / user_id
        if scope in ("photos", "gallery"):
            target = user_root / "photos"
        else:
            target = user_root / "files"
        target.mkdir(parents=True, exist_ok=True)
        return target

    # 비로그인 / 시스템 공통 스토리지
    if scope in ("all", "media", "root") and base_media.exists():
        return base_media
    elif scope in ("photos", "gallery"):
        p = base_media / "photos"
        p.mkdir(parents=True, exist_ok=True)
        return p
    elif scope in ("downloads", "download"):
        p = base_media / "downloads"
        p.mkdir(parents=True, exist_ok=True)
        return p

    p = Path(settings.STORAGE_ROOT).resolve()
    p.mkdir(parents=True, exist_ok=True)
    return p


def safe_resolve_path(rel_path: str = "", scope: str = "", user_id: str = "") -> Path:
    """
    상대 경로를 안전하게 절대 경로로 변환.
    Directory Traversal (상위 디렉터리 탈출 공격) 방지.
    """
    root = get_storage_root(scope, user_id)
    clean_rel = rel_path.strip().replace("\\", "/").lstrip("/")
    
    # NFC/NFD 정규화
    clean_rel = unicodedata.normalize("NFC", clean_rel)
    
    target = (root / clean_rel).resolve()
    
    # root를 벗어나는지 검증
    try:
        target.relative_to(root)
    except ValueError:
        raise HTTPException(status_code=403, detail="액세스 거부: 허용된 스토리지 범위를 벗어날 수 없습니다.")
        
    return target


def format_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"


def categorize_file(suffix: str) -> Tuple[str, bool]:
    s = suffix.lower()
    for cat, exts in CATEGORY_MAP.items():
        if s in exts:
            can_prev = cat in {"image", "video", "audio", "code", "document"} and s in {
                ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg",
                ".mp4", ".webm", ".mov",
                ".mp3", ".wav", ".ogg",
                ".txt", ".md", ".json", ".js", ".ts", ".html", ".css", ".py", ".csv", ".log",
                ".pdf"
            }
            return cat, can_prev
    return "general", False


def get_free_disk_space(path: Path) -> str:
    try:
        total, used, free = shutil.disk_usage(path)
        return f"{format_size(free)} 사용 가능 / 전체 {format_size(total)}"
    except Exception:
        return "스토리지 정상"


def build_breadcrumbs(rel_path: str) -> List[BreadcrumbItem]:
    crumbs = [BreadcrumbItem(name="홈 (Root)", path="")]
    if not rel_path:
        return crumbs
        
    parts = [p for p in rel_path.replace("\\", "/").strip("/").split("/") if p]
    accum = []
    for part in parts:
        accum.append(part)
        crumbs.append(BreadcrumbItem(name=part, path="/".join(accum)))
    return crumbs


def list_directory_sync(rel_path: str = "", scope: str = "", user_id: str = "") -> FolderListResponse:
    target = safe_resolve_path(rel_path, scope, user_id)
    if not target.exists() or not target.is_dir():
        raise HTTPException(status_code=404, detail="지정한 폴더를 찾을 수 없습니다.")

    root = get_storage_root(scope, user_id)
    norm_rel = str(target.relative_to(root)).replace("\\", "/")
    if norm_rel == ".":
        norm_rel = ""

    folders: List[FileItem] = []
    files: List[FileItem] = []
    total_size = 0

    try:
        with os.scandir(target) as it:
            for entry in it:
                name = entry.name
                if name.lower() in EXCLUDE_NAMES or name.startswith("._"):
                    continue

                rel_item_path = f"{norm_rel}/{name}".lstrip("/") if norm_rel else name
                
                try:
                    stat = entry.stat()
                    mod_time = stat.st_mtime
                    mod_str = datetime.fromtimestamp(mod_time).strftime("%Y-%m-%d %H:%M")
                    
                    if entry.is_dir(follow_symlinks=False):
                        folders.append(FileItem(
                            name=name,
                            path=rel_item_path,
                            is_dir=True,
                            size=0,
                            size_formatted="폴더",
                            extension="",
                            modified=mod_time,
                            modified_formatted=mod_str,
                            mime_type="inode/directory",
                            category="folder",
                            can_preview=False,
                        ))
                    else:
                        sz = stat.st_size
                        total_size += sz
                        ext = Path(name).suffix
                        cat, can_prev = categorize_file(ext)
                        mime, _ = mimetypes.guess_type(name)
                        files.append(FileItem(
                            name=name,
                            path=rel_item_path,
                            is_dir=False,
                            size=sz,
                            size_formatted=format_size(sz),
                            extension=ext,
                            modified=mod_time,
                            modified_formatted=mod_str,
                            mime_type=mime or "application/octet-stream",
                            category=cat,
                            can_preview=can_prev,
                        ))
                except (OSError, PermissionError):
                    continue
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"디렉토리 읽기 실패: {str(e)}")

    # 정렬: 폴더 이름순, 파일 이름순
    folders.sort(key=lambda x: x.name.lower())
    files.sort(key=lambda x: x.name.lower())

    return FolderListResponse(
        current_path=norm_rel,
        breadcrumbs=build_breadcrumbs(norm_rel),
        folders=folders,
        files=files,
        total_count=len(folders) + len(files),
        total_size_bytes=total_size,
        total_size_formatted=format_size(total_size),
        free_space_formatted=get_free_disk_space(target),
        storage_root=str(root)
    )


def search_files_sync(query: str, rel_path: str = "", scope: str = "", user_id: str = "") -> List[FileItem]:
    target = safe_resolve_path(rel_path, scope, user_id)
    root = get_storage_root(scope, user_id)
    q = query.lower().strip()
    if not q:
        return []

    results: List[FileItem] = []
    # 최대 100개 검색 제한
    max_results = 100

    for current_dir, dirs, files_in_dir in os.walk(target):
        # 제외 폴더 필터링
        dirs[:] = [d for d in dirs if d.lower() not in EXCLUDE_NAMES and not d.startswith(".")]
        
        for fname in files_in_dir:
            if fname.lower() in EXCLUDE_NAMES or fname.startswith("."):
                continue
            if q in fname.lower():
                fp = Path(current_dir) / fname
                try:
                    stat = fp.stat()
                    rel_p = str(fp.relative_to(root)).replace("\\", "/")
                    sz = stat.st_size
                    ext = fp.suffix
                    cat, can_prev = categorize_file(ext)
                    mime, _ = mimetypes.guess_type(fname)
                    results.append(FileItem(
                        name=fname,
                        path=rel_p,
                        is_dir=False,
                        size=sz,
                        size_formatted=format_size(sz),
                        extension=ext,
                        modified=stat.st_mtime,
                        modified_formatted=datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M"),
                        mime_type=mime or "application/octet-stream",
                        category=cat,
                        can_preview=can_prev,
                    ))
                    if len(results) >= max_results:
                        return results
                except Exception:
                    continue
    return results


def read_text_preview_sync(rel_path: str, scope: str = "", user_id: str = "") -> Dict[str, Any]:
    target = safe_resolve_path(rel_path, scope, user_id)
    if not target.is_file():
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")

    size = target.stat().st_size
    if size > settings.MAX_TEXT_PREVIEW_SIZE:
        raise HTTPException(status_code=400, detail="텍스트 미리보기가 가능한 파일 크기(5MB)를 초과했습니다.")

    content = ""
    # utf-8, cp949, latin-1 순차 시도
    raw = target.read_bytes()
    for enc in ["utf-8", "cp949", "euc-kr", "latin-1"]:
        try:
            content = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue

    return {
        "name": target.name,
        "path": rel_path,
        "size_formatted": format_size(size),
        "content": content,
        "extension": target.suffix.lower()
    }


def save_text_file_sync(rel_path: str, content: str, scope: str = "", user_id: str = "") -> Dict[str, Any]:
    target = safe_resolve_path(rel_path, scope, user_id)
    if not target.is_file():
        raise HTTPException(status_code=404, detail="편집할 파일을 찾을 수 없습니다.")

    try:
        target.write_text(content, encoding="utf-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일 저장 실패: {str(e)}")

    stat = target.stat()
    return {
        "name": target.name,
        "path": rel_path,
        "size_formatted": format_size(stat.st_size),
        "modified_formatted": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M")
    }

