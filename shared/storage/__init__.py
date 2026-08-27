# shared.storage - 파일 스토리지 공통 모듈
import os
from shared.storage.base import BaseStorageService
from shared.storage.local_storage import LocalStorageService
from shared.storage.r2_storage import R2StorageService


def get_storage_service(settings=None) -> BaseStorageService:
    """
    설정에 따른 적절한 스토리지 인스턴스를 반환하는 팩토리 함수.
    R2 설정이 유효하면 R2StorageService, 그렇지 않으면 LocalStorageService 반환.
    """
    if settings is None:
        from shared.core.base_config import get_base_settings
        settings = get_base_settings()

    if getattr(settings, "ENABLE_FILE_STORAGE", False) and getattr(settings, "R2_ACCOUNT_ID", None):
        return R2StorageService(
            account_id=settings.R2_ACCOUNT_ID,
            access_key_id=settings.R2_ACCESS_KEY_ID,
            secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            bucket_name=getattr(settings, "R2_BUCKET_NAME", "mqnet-uploads"),
        )
    return LocalStorageService()


__all__ = [
    "BaseStorageService",
    "LocalStorageService",
    "R2StorageService",
    "get_storage_service",
]
