"""
templates/saas-template/backend/schemas.py
Pydantic v2 데이터 유효성 검증 모델.
"""
from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field


class ItemBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200, description="아이템 명칭")
    category: str = Field(default="일반", max_length=50)
    status: str = Field(default="active", max_length=30)
    detail: Optional[str] = Field(default=None)
    metadata_json: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ItemCreate(ItemBase):
    pass


class ItemUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[str] = None
    status: Optional[str] = None
    detail: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None


class ItemResponse(ItemBase):
    id: str
    owner_id: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ItemListResponse(BaseModel):
    success: bool = True
    total: int
    items: List[ItemResponse]


class AiAnalysisRequest(BaseModel):
    prompt: str = Field(..., min_length=2, description="AI 분석/작업 요청 프롬프트")
    context_item_id: Optional[str] = Field(None, description="분석 대상 아이템 ID")


class SystemStatusResponse(BaseModel):
    app_id: str
    app_name: str
    status: str
    deployment_mode: str
    items_count: int
    storage_dir: str
