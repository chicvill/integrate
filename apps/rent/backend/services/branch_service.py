"""
apps/rent/backend/services/branch_service.py
멀티테넌트 부동산 지점(건물) CRUD 및 구독 빌링 전담 서비스 (Clean Architecture).
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session

from ..db.models import RentBranch, RentPayment, RentRoom, RentExpense, RentTenantHistory
from ..schemas import BranchCreate, BranchUpdate, BranchBillingUpdate


def normalize_branch_id(branch_id: Optional[str]) -> str:
    """지점 코드 에일리어스 정규화 (chicvill01 -> main, chicvill02 -> branch_9027)"""
    if not branch_id:
        return "main"
    bid = branch_id.strip().lower()
    if bid in ("chicvill01", "chicvill1", "chicvill", "main"):
        return "main"
    if bid in ("chicvill02", "chicvill2", "branch_9027"):
        return "branch_9027"
    return branch_id


class BranchService:
    """부동산 지점(건물) 관리 전담 클래스"""

    def normalize_branch_id(self, branch_id: Optional[str]) -> str:
        return normalize_branch_id(branch_id)

    def list_branches(self, db: Session, active_only: bool = False) -> List[RentBranch]:
        """등록된 모든 부동산 지점 조회 (호실/수납 데이터가 존재하는 지점 자동 감지 동기화)"""
        try:
            room_branches = [r[0] for r in db.query(RentRoom.branch_id).distinct().all() if r[0]]
            existing_branches = {b.branch_id: b for b in db.query(RentBranch).all()}

            has_new = False
            for b_id in room_branches:
                if b_id not in existing_branches:
                    name = "시크빌2" if ("9027" in b_id or "2" in b_id or "3765" in b_id) else f"지점 ({b_id})"
                    new_b = RentBranch(
                        branch_id=b_id,
                        name=name,
                        contact_phone="010-2345-6789",
                        address="주소 등록됨",
                        fee_plan="원룸 프리미엄 29실형",
                        monthly_fee=150000,
                        billing_due_day=25,
                        billing_status="PAID",
                        is_active=True
                    )
                    db.add(new_b)
                    existing_branches[b_id] = new_b
                    has_new = True

            if has_new:
                db.commit()
        except Exception as e:
            print(f"[BranchService] list_branches auto-sync warning: {e}")

        q = db.query(RentBranch)
        if active_only:
            q = q.filter(RentBranch.is_active == True)
        return q.order_by(RentBranch.created_at.asc()).all()

    def get_branch(self, db: Session, branch_id: str) -> Optional[RentBranch]:
        """특정 부동산 지점 조회 (에일리어스 지원)"""
        b = db.query(RentBranch).filter(RentBranch.branch_id == branch_id).first()
        if not b:
            norm_id = normalize_branch_id(branch_id)
            if norm_id != branch_id:
                b = db.query(RentBranch).filter(RentBranch.branch_id == norm_id).first()
        return b

    def create_branch(self, db: Session, data: BranchCreate) -> RentBranch:
        """신규 부동산 지점 등록"""
        existing = self.get_branch(db, data.branch_id)
        if existing:
            return existing

        b = RentBranch(
            branch_id=data.branch_id,
            name=data.name,
            contact_phone=data.contact_phone or "",
            address=data.address or "",
            fee_plan=data.fee_plan or "원룸 프리미엄 29실형",
            monthly_fee=data.monthly_fee or 150000,
            billing_due_day=data.billing_due_day or 25,
            billing_status="PAID",
            is_active=True
        )
        db.add(b)
        db.commit()
        db.refresh(b)
        return b

    def update_branch(self, db: Session, branch_id: str, data: BranchUpdate) -> Optional[RentBranch]:
        """부동산 지점 정보 수정"""
        b = self.get_branch(db, branch_id)
        if not b:
            return None
        for f, v in data.model_dump(exclude_unset=True).items():
            setattr(b, f, v)
        db.commit()
        db.refresh(b)
        return b

    def update_branch_billing(self, db: Session, branch_id: str, data: BranchBillingUpdate) -> Optional[RentBranch]:
        """부동산 지점 구독 빌링 상태 갱신"""
        b = self.get_branch(db, branch_id)
        if not b:
            return None
        b.billing_status = data.billing_status
        if data.last_paid_at:
            b.last_paid_at = data.last_paid_at
        db.commit()
        db.refresh(b)
        return b

    def delete_branch(self, db: Session, branch_id: str) -> Dict[str, Any]:
        """부동산(지점) 삭제 및 관련 호실/수납/지출/전출이력 데이터 일괄 정리"""
        if branch_id == "main":
            return {"success": False, "message": "기본 본사 부동산(시크빌)은 삭제할 수 없습니다."}

        b = self.get_branch(db, branch_id)
        if not b:
            return {"success": False, "message": "삭제할 부동산 정보를 찾을 수 없습니다."}

        branch_name = b.name
        # 연관 데이터 삭제
        db.query(RentPayment).filter(RentPayment.branch_id == branch_id).delete(synchronize_session=False)
        db.query(RentRoom).filter(RentRoom.branch_id == branch_id).delete(synchronize_session=False)
        db.query(RentExpense).filter(RentExpense.branch_id == branch_id).delete(synchronize_session=False)
        db.query(RentTenantHistory).filter(RentTenantHistory.branch_id == branch_id).delete(synchronize_session=False)
        db.delete(b)
        db.commit()
        return {
            "success": True,
            "branch_id": branch_id,
            "message": f"'{branch_name}' 부동산과 관련 데이터가 성공적으로 삭제되었습니다."
        }


# 싱글톤 인스턴스
branch_service = BranchService()
