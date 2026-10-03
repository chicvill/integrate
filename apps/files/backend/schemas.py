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
