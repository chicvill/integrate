"""
templates/saas-template/backend/services/core_service.py
핵심 비즈니스 로직 및 이벤트 루프 블로킹 방지를 위한 스레드 풀 워커.
"""
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from ..db.models import AppItem
from ..schemas import ItemCreate, ItemUpdate
from ..config import settings

_executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="{{APP_ID}}_worker")


class CoreService:
    @staticmethod
    def list_items(db: Session, category: Optional[str] = None, status: Optional[str] = None, search: Optional[str] = None) -> List[AppItem]:
        q = db.query(AppItem)
        if category:
            q = q.filter(AppItem.category == category)
        if status:
            q = q.filter(AppItem.status == status)
        if search:
            q = q.filter(AppItem.title.ilike(f"%{search}%"))
        return q.order_by(AppItem.created_at.desc()).all()

    @staticmethod
    def get_item(db: Session, item_id: str) -> Optional[AppItem]:
        return db.query(AppItem).filter(AppItem.id == item_id).first()

    @staticmethod
    def create_item(db: Session, payload: ItemCreate, owner_id: Optional[str] = None) -> AppItem:
        item = AppItem(
            title=payload.title,
            category=payload.category,
            status=payload.status,
            detail=payload.detail,
            metadata_json=payload.metadata_json or {},
            owner_id=owner_id
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def update_item(db: Session, item_id: str, payload: ItemUpdate) -> Optional[AppItem]:
        item = db.query(AppItem).filter(AppItem.id == item_id).first()
        if not item:
            return None
        update_data = payload.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(item, key, value)
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def delete_item(db: Session, item_id: str) -> bool:
        item = db.query(AppItem).filter(AppItem.id == item_id).first()
        if not item:
            return False
        db.delete(item)
        db.commit()
        return True

    @staticmethod
    async def run_ai_task(prompt: str, item_detail: Optional[str] = None) -> Dict[str, Any]:
        """비동기 스레드 풀에서 안전하게 무거운 AI/분석 연산 실행 (메인 루프 차단 방지)"""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(_executor, CoreService._sync_ai_processing, prompt, item_detail)

    @staticmethod
    def _sync_ai_processing(prompt: str, detail: Optional[str]) -> Dict[str, Any]:
        # 모의 AI 처리 로직 (실전에서는 shared.ai 또는 Gemini 연동)
        return {
            "prompt": prompt,
            "insights": f"[{{APP_NAME}} AI 코파일럿] 분석 결과: '{prompt}' 관련 운영 전략이 최적화되었습니다.",
            "recommendations": [
                "주요 지표 추이를 실시간 관제하세요.",
                "사용자 활동 주기에 맞추어 리소스를 자동 스케일링하세요."
            ]
        }


service = CoreService()
