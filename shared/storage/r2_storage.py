"""
shared/storage/r2_storage.py
Cloudflare R2 (S3 호환) 오브젝트 스토리지 서비스 구현체.
boto3가 없거나 인증 정보 누락 시 안전하게 LocalStorageService로 폴백합니다.
"""
import io
import logging
from typing import Optional
from shared.storage.base import BaseStorageService
from shared.storage.local_storage import LocalStorageService

logger = logging.getLogger("mqnet.storage.r2")


class R2StorageService(BaseStorageService):
    def __init__(
        self,
        account_id: str,
        access_key_id: str,
        secret_access_key: str,
        bucket_name: str = "mqnet-uploads",
        public_custom_domain: Optional[str] = None,
    ):
        self.account_id = account_id
        self.bucket_name = bucket_name
        self.public_custom_domain = public_custom_domain
        self._s3_client = None
        self._fallback_local = None

        if account_id and access_key_id and secret_access_key:
            try:
                import boto3
                endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"
                self._s3_client = boto3.client(
                    "s3",
                    endpoint_url=endpoint_url,
                    aws_access_key_id=access_key_id,
                    aws_secret_access_key=secret_access_key,
                    region_name="auto",
                )
                logger.info(f"Cloudflare R2 클라이언트 초기화 완료. 버킷: {bucket_name}")
            except ImportError:
                logger.warning("boto3 패키지가 설치되지 않아 로컬 스토리지로 폴백합니다. (pip install boto3)")
                self._fallback_local = LocalStorageService()
            except Exception as e:
                logger.warning(f"R2 연결 설정 오류 ({e}). 로컬 스토리지로 폴백합니다.")
                self._fallback_local = LocalStorageService()
        else:
            self._fallback_local = LocalStorageService()

    async def upload_bytes(
        self,
        data: bytes,
        path: str,
        content_type: str = "application/octet-stream",
    ) -> str:
        if self._s3_client:
            try:
                clean_path = path.lstrip("/")
                self._s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=clean_path,
                    Body=data,
                    ContentType=content_type,
                )
                logger.info(f"R2 업로드 성공: {clean_path}")
                return self.get_public_url(clean_path)
            except Exception as e:
                logger.error(f"R2 업로드 실패 ({e}), 로컬 스토리지로 저장 시도")
                if not self._fallback_local:
                    self._fallback_local = LocalStorageService()
                return await self._fallback_local.upload_bytes(data, path, content_type)
        return await self._fallback_local.upload_bytes(data, path, content_type)

    async def get_file_bytes(self, path: str) -> Optional[bytes]:
        if self._s3_client:
            try:
                clean_path = path.lstrip("/")
                response = self._s3_client.get_object(Bucket=self.bucket_name, Key=clean_path)
                return response["Body"].read()
            except Exception as e:
                logger.error(f"R2 파일 조회 실패: {e}")
                return None
        return await self._fallback_local.get_file_bytes(path)

    async def delete_file(self, path: str) -> bool:
        if self._s3_client:
            try:
                clean_path = path.lstrip("/")
                self._s3_client.delete_object(Bucket=self.bucket_name, Key=clean_path)
                return True
            except Exception as e:
                logger.error(f"R2 파일 삭제 실패: {e}")
                return False
        return await self._fallback_local.delete_file(path)

    def get_public_url(self, path: str) -> str:
        clean_path = path.lstrip("/")
        if self.public_custom_domain:
            return f"https://{self.public_custom_domain.rstrip('/')}/{clean_path}"
        if self._s3_client:
            return f"https://pub-{self.account_id}.r2.dev/{clean_path}"
        return self._fallback_local.get_public_url(path) if self._fallback_local else f"/uploads/{clean_path}"

    def get_file_path(self, path: str) -> Optional[str]:
        if self._fallback_local:
            return self._fallback_local.get_file_path(path)
        return None

    def file_exists(self, path: str) -> bool:
        if self._s3_client:
            try:
                self._s3_client.head_object(Bucket=self.bucket_name, Key=path.lstrip("/"))
                return True
            except Exception:
                return False
        if self._fallback_local:
            return self._fallback_local.file_exists(path)
        return False

    async def list_files(
        self,
        prefix: str = "",
        extensions: Optional[list[str]] = None,
        reverse: bool = True,
    ) -> list[str]:
        if self._s3_client:
            try:
                clean_prefix = prefix.lstrip("/")
                resp = self._s3_client.list_objects_v2(Bucket=self.bucket_name, Prefix=clean_prefix)
                contents = resp.get("Contents", [])
                ext_set = {ext.lower() if ext.startswith(".") else f".{ext.lower()}" for ext in extensions} if extensions else None
                keys = []
                for item in contents:
                    key = item.get("Key", "")
                    if ext_set:
                        _, ext = os.path.splitext(key)
                        if ext.lower() not in ext_set:
                            continue
                    keys.append(key)
                keys.sort(reverse=reverse)
                return keys
            except Exception as e:
                logger.error(f"R2 파일 목록 조회 실패: {e}")
                return []
        if self._fallback_local:
            return await self._fallback_local.list_files(prefix, extensions, reverse)
        return []
