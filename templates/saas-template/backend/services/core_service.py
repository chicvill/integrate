"""
templates/saas-template/backend/services/core_service.py
핵심 비즈니스 로직, 다중 매장(Multi-Branch) CRUD 및 솔루션 이용료 수납(Billing) 관리.
"""
import asyncio
import uuid
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from ..db.models import AppItem, AppBranch, AppUpgradeRequest
from ..schemas import ItemCreate, ItemUpdate, BranchCreate, BranchUpdate, BranchBillingUpdate
from ..config import settings

_executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="{{APP_ID}}_worker")


class CoreService:
    # ── 지점(매장) & 수납 관리 ──
    @staticmethod
    def ensure_default_branches(db: Session):
        """기본 지점 데이터 보장 (본점, 강남점 등) 및 수납 데이터 시드"""
        try:
            count = db.query(AppBranch).count()
            if count == 0:
                defaults = [
                    AppBranch(
                        id=str(uuid.uuid4()),
                        branch_id="main",
                        name="MQnet 본점",
                        contact_phone="02-1234-5678",
                        address="서울특별시 서초구 서초대로 396",
                        fee_plan="프리미엄 관리형",
                        monthly_fee=150000,
                        billing_status="PAID",
                        billing_due_day=25,
                        last_paid_at=datetime.now().strftime("%Y-%m-01"),
                        is_active=True
                    ),
                    AppBranch(
                        id=str(uuid.uuid4()),
                        branch_id="branch-gangnam",
                        name="MQnet 강남역점",
                        contact_phone="02-555-1234",
                        address="서울특별시 강남구 테헤란로 101",
                        fee_plan="엔터프라이즈",
                        monthly_fee=250000,
                        billing_status="PAID",
                        billing_due_day=25,
                        last_paid_at=datetime.now().strftime("%Y-%m-01"),
                        is_active=True
                    ),
                    AppBranch(
                        id=str(uuid.uuid4()),
                        branch_id="branch-daechi",
                        name="MQnet 대치학원가점",
                        contact_phone="02-777-9876",
                        address="서울특별시 강남구 삼성로 212",
                        fee_plan="프리미엄 관리형",
                        monthly_fee=180000,
                        billing_status="PENDING",
                        billing_due_day=10,
                        last_paid_at="2026-09-10",
                        is_active=True
                    ),
                ]
                for b in defaults:
                    db.add(b)
                db.commit()
        except Exception:
            db.rollback()

    @staticmethod
    def list_branches(db: Session, active_only: bool = False) -> List[AppBranch]:
        CoreService.ensure_default_branches(db)
        q = db.query(AppBranch)
        if active_only:
            q = q.filter(AppBranch.is_active == True)
        return q.order_by(AppBranch.created_at.asc()).all()

    @staticmethod
    def get_branch(db: Session, branch_id: str) -> Optional[AppBranch]:
        return db.query(AppBranch).filter(AppBranch.branch_id == branch_id).first()

    @staticmethod
    def create_branch(db: Session, payload: BranchCreate) -> AppBranch:
        existing = db.query(AppBranch).filter(AppBranch.branch_id == payload.branch_id).first()
        if existing:
            raise ValueError(f"이미 존재하는 지점 코드입니다: {payload.branch_id}")
        branch = AppBranch(
            id=str(uuid.uuid4()),
            branch_id=payload.branch_id.strip(),
            name=payload.name.strip(),
            contact_phone=payload.contact_phone,
            address=payload.address,
            fee_plan=payload.fee_plan or "프리미엄 관리형",
            monthly_fee=payload.monthly_fee if payload.monthly_fee is not None else 150000,
            billing_status=payload.billing_status or "PAID",
            billing_due_day=payload.billing_due_day or 25,
            last_paid_at=payload.last_paid_at or datetime.now().strftime("%Y-%m-%d"),
            is_active=payload.is_active,
            metadata_json=payload.metadata_json or {}
        )
        db.add(branch)
        db.commit()
        db.refresh(branch)
        return branch

    @staticmethod
    def update_branch(db: Session, branch_id: str, payload: BranchUpdate) -> Optional[AppBranch]:
        branch = db.query(AppBranch).filter(AppBranch.branch_id == branch_id).first()
        if not branch:
            return None
        data = payload.model_dump(exclude_unset=True)
        for k, v in data.items():
            setattr(branch, k, v)
        db.commit()
        db.refresh(branch)
        return branch

    @staticmethod
    def update_branch_billing(db: Session, branch_id: str, payload: BranchBillingUpdate) -> Optional[AppBranch]:
        branch = db.query(AppBranch).filter(AppBranch.branch_id == branch_id).first()
        if not branch:
            return None
        branch.billing_status = payload.billing_status
        if payload.last_paid_at:
            branch.last_paid_at = payload.last_paid_at
        elif payload.billing_status == "PAID":
            branch.last_paid_at = datetime.now().strftime("%Y-%m-%d")
        db.commit()
        db.refresh(branch)
        return branch

    @staticmethod
    def delete_branch(db: Session, branch_id: str) -> bool:
        branch = db.query(AppBranch).filter(AppBranch.branch_id == branch_id).first()
        if not branch:
            return False
        # 소속된 아이템과 함께 삭제 또는 비활성화 처리
        db.delete(branch)
        db.commit()
        return True

    # ── 아이템 관리 (지점별 필터링 지원) ──
    @staticmethod
    def list_items(
        db: Session,
        branch_id: Optional[str] = None,
        category: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[AppItem]:
        q = db.query(AppItem)
        if branch_id:
            q = q.filter(AppItem.branch_id == branch_id)
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
            branch_id=payload.branch_id or "main",
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

    # ── 비동기 AI 분석 워커 ──
    @staticmethod
    async def run_ai_task(prompt: str, item_detail: Optional[str] = None, branch_id: Optional[str] = None) -> Dict[str, Any]:
        """비동기 스레드 풀에서 안전하게 무거운 AI/분석 연산 실행 (메인 루프 차단 방지)"""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(_executor, CoreService._sync_ai_processing, prompt, item_detail, branch_id)

    @staticmethod
    def _sync_ai_processing(prompt: str, detail: Optional[str], branch_id: Optional[str] = None) -> Dict[str, Any]:
        branch_info = f" [지점: {branch_id}]" if branch_id else ""
        return {
            "prompt": prompt,
            "recommendations": [
                "선택된 매장의 주요 지표 추이를 실시간 관제하세요.",
                "지점별 활동량과 리소스 사용량에 맞춰 자동 리밸런싱을 적용하세요."
            ]
        }

    # ── 등업 신청(Upgrade Requests) DB 영속화 및 상태 관리 ──
    @classmethod
    def create_upgrade_request(cls, db: Optional[Session], payload) -> Dict[str, Any]:
        req_id = f"req_{uuid.uuid4().hex[:8]}"
        created_at_str = datetime.now().strftime("%Y-%m-%d %H:%M")
        if db:
            db_item = AppUpgradeRequest(
                id=req_id,
                user_name=payload.user_name,
                contact=payload.contact,
                target_branch_id=payload.target_branch_id,
                reason=payload.reason,
                status="PENDING"
            )
            db.add(db_item)
            try:
                db.commit()
                db.refresh(db_item)
                created_at_str = db_item.created_at.strftime("%Y-%m-%d %H:%M") if db_item.created_at else created_at_str
            except Exception:
                db.rollback()

        return {
            "id": req_id,
            "user_name": payload.user_name,
            "contact": payload.contact,
            "target_branch_id": payload.target_branch_id,
            "reason": payload.reason,
            "status": "PENDING",
            "created_at": created_at_str
        }

    @classmethod
    def list_upgrade_requests(cls, db: Optional[Session]) -> List[Dict[str, Any]]:
        if db:
            items = db.query(AppUpgradeRequest).order_by(AppUpgradeRequest.created_at.desc()).all()
            return [
                {
                    "id": item.id,
                    "user_name": item.user_name,
                    "contact": item.contact,
                    "target_branch_id": item.target_branch_id,
                    "assigned_branch_id": item.assigned_branch_id,
                    "reason": item.reason,
                    "status": item.status,
                    "created_at": item.created_at.strftime("%Y-%m-%d %H:%M") if item.created_at else ""
                }
                for item in items
            ]
        return []

    @classmethod
    def approve_upgrade_request(cls, db: Optional[Session], req_id: str, assigned_branch_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        if db:
            item = db.query(AppUpgradeRequest).filter(AppUpgradeRequest.id == req_id).first()
            if item:
                item.status = "APPROVED"
                item.assigned_branch_id = assigned_branch_id or item.target_branch_id
                db.commit()
                return {
                    "id": item.id,
                    "user_name": item.user_name,
                    "assigned_branch_id": item.assigned_branch_id,
                    "status": item.status
                }
        return None

    @classmethod
    def reject_upgrade_request(cls, db: Optional[Session], req_id: str) -> bool:
        if db:
            item = db.query(AppUpgradeRequest).filter(AppUpgradeRequest.id == req_id).first()
            if item:
                item.status = "REJECTED"
                db.commit()
                return True
        return False


service = CoreService()
