"""
shared/storage/local_storage.py
로컬 파일 시스템 기반 스토리지 구현체.
개발 환경 또는 오프라인/단독 실행 시 사용됩니다.
"""
import os
import aiofiles
import logging
from typing import Optional
from shared.storage.base import BaseStorageService

logger = logging.getLogger("mqnet.storage.local")


class LocalStorageService(BaseStorageService):
    def __init__(self, base_dir: str = "uploads", base_url: str = "/uploads"):
        self.base_dir = os.path.abspath(base_dir)
        self.base_url = base_url.rstrip("/")
        os.makedirs(self.base_dir, exist_ok=True)

    async def upload_bytes(
        self,
        data: bytes,
        path: str,
        content_type: str = "application/octet-stream",
    ) -> str:
        clean_path = path.lstrip("/").replace("/", os.sep)
        full_path = os.path.join(self.base_dir, clean_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        async with aiofiles.open(full_path, "wb") as f:
            await f.write(data)

        logger.info(f"로컬 파일 저장 완료: {full_path}")
        return self.get_public_url(path)

    async def get_file_bytes(self, path: str) -> Optional[bytes]:
        clean_path = path.lstrip("/").replace("/", os.sep)
        full_path = os.path.join(self.base_dir, clean_path)
        if not os.path.exists(full_path):
            return None
        async with aiofiles.open(full_path, "rb") as f:
            return await f.read()

    async def delete_file(self, path: str) -> bool:
        clean_path = path.lstrip("/").replace("/", os.sep)
        full_path = os.path.join(self.base_dir, clean_path)
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
                return True
            except Exception as e:
                logger.error(f"로컬 파일 삭제 실패 ({full_path}): {e}")
                return False
        return False

    def get_public_url(self, path: str) -> str:
        clean_path = path.lstrip("/").replace("\\", "/")
        return f"{self.base_url}/{clean_path}"

    def get_file_path(self, path: str) -> Optional[str]:
        clean_path = path.lstrip("/").replace("/", os.sep)
        full_path = os.path.join(self.base_dir, clean_path)
        return full_path if os.path.exists(full_path) else None

    def file_exists(self, path: str) -> bool:
        clean_path = path.lstrip("/").replace("/", os.sep)
        full_path = os.path.join(self.base_dir, clean_path)
        return os.path.isfile(full_path)

    async def list_files(
        self,
        prefix: str = "",
        extensions: Optional[list[str]] = None,
        reverse: bool = True,
    ) -> list[str]:
        target_dir = os.path.join(self.base_dir, prefix.lstrip("/").replace("/", os.sep))
        if not os.path.exists(target_dir):
            return []

        files = []
        ext_set = {ext.lower() if ext.startswith(".") else f".{ext.lower()}" for ext in extensions} if extensions else None

        for item in os.listdir(target_dir):
            full_item_path = os.path.join(target_dir, item)
            if os.path.isfile(full_item_path):
                if ext_set:
                    _, ext = os.path.splitext(item)
                    if ext.lower() not in ext_set:
                        continue
                rel_path = os.path.relpath(full_item_path, self.base_dir).replace(os.sep, "/")
                files.append(rel_path)

        files.sort(reverse=reverse)
        return files
