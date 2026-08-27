"""
shared/storage/base.py
MQnet 통합 SaaS 파일 스토리지 공통 추상 인터페이스.
Cloudflare R2, AWS S3, 로컬 파일 시스템 등을 통일된 API로 사용할 수 있도록 합니다.
"""
from abc import ABC, abstractmethod
from typing import Optional, BinaryIO, Union


class BaseStorageService(ABC):
    """파일 스토리지 서비스 공통 인터페이스"""

    @abstractmethod
    async def upload_bytes(
        self,
        data: bytes,
        path: str,
        content_type: str = "application/octet-stream",
    ) -> str:
        """바이트 데이터를 스토리지에 업로드하고 접근 URL 또는 식별자 반환"""
        pass

    @abstractmethod
    async def get_file_bytes(self, path: str) -> Optional[bytes]:
        """스토리지에서 파일 바이트 데이터를 조회"""
        pass

    @abstractmethod
    async def delete_file(self, path: str) -> bool:
        """파일 삭제"""
        pass

    @abstractmethod
    def get_public_url(self, path: str) -> str:
        """파일의 공개 접근 URL 반환"""
        pass
