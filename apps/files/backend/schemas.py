"""
apps/files/backend/schemas.py
Pydantic data models for MQnet Files Hub.
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class BreadcrumbItem(BaseModel):
    name: str
    path: str


class FileItem(BaseModel):
    name: str
    path: str
    is_dir: bool = False
    size: int = 0
    size_formatted: str = "0 B"
    extension: str = ""
    modified: float = 0.0
    modified_formatted: str = ""
    mime_type: str = "application/octet-stream"
    category: str = "general"  # document, image, video, audio, archive, code, general
    can_preview: bool = False


class FolderListResponse(BaseModel):
    current_path: str = ""
    breadcrumbs: List[BreadcrumbItem] = []
    folders: List[FileItem] = []
    files: List[FileItem] = []
    total_count: int = 0
    total_size_bytes: int = 0
    total_size_formatted: str = "0 B"
    free_space_formatted: str = ""
    storage_root: str = ""


class MkdirRequest(BaseModel):
    path: str = ""
    folder_name: str


class RenameRequest(BaseModel):
    path: str
    new_name: str


class DeleteRequest(BaseModel):
    paths: List[str]


class SearchResponse(BaseModel):
    query: str
    results: List[FileItem] = []
    count: int = 0


class OperationResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None


class SaveTextRequest(BaseModel):
    path: str
    content: str


class CategoryBreakdownItem(BaseModel):
    category: str
    label: str
    bytes: int = 0
    formatted: str = "0 B"
    percentage: float = 0.0
    count: int = 0


class StorageQuotaResponse(BaseModel):
    user_id: str = "demo_user"
    plan_tier: str = "free"  # free (500KB) | pro (10GB)
    plan_name: str = "무료 플랜"
    max_quota_bytes: int = 512000  # 기본 500 KB
    max_quota_formatted: str = "500 KB"
    total_used_bytes: int = 0
    total_used_formatted: str = "0 B"
    usage_percentage: float = 0.0
    is_exceeded: bool = False
    breakdown: List[CategoryBreakdownItem] = []


class UpgradePlanRequest(BaseModel):
    plan_tier: str = "pro"  # pro | free
    user_id: Optional[str] = None

