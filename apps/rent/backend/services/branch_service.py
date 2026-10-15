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
        """등록된 모든 부동산 지점 조회 (에일리어스 중복 데이터 자동 통합 및 정제)"""
        try:
            # 1. 에일리어스 중복 데이터 통합 (chicvill01 -> main, chicvill02 -> branch_9027)
            alias_1 = ["chicvill01", "chicvill", "chicvill1"]
            db.query(RentRoom).filter(RentRoom.branch_id.in_(alias_1)).update({RentRoom.branch_id: "main"}, synchronize_session=False)
            db.query(RentPayment).filter(RentPayment.branch_id.in_(alias_1)).update({RentPayment.branch_id: "main"}, synchronize_session=False)
            db.query(RentExpense).filter(RentExpense.branch_id.in_(alias_1)).update({RentExpense.branch_id: "main"}, synchronize_session=False)
            db.query(RentTenantHistory).filter(RentTenantHistory.branch_id.in_(alias_1)).update({RentTenantHistory.branch_id: "main"}, synchronize_session=False)
            db.query(RentBranch).filter(RentBranch.branch_id.in_(alias_1)).delete(synchronize_session=False)

            alias_2 = ["chicvill02", "chicvill2"]
            db.query(RentRoom).filter(RentRoom.branch_id.in_(alias_2)).update({RentRoom.branch_id: "branch_9027"}, synchronize_session=False)
            db.query(RentPayment).filter(RentPayment.branch_id.in_(alias_2)).update({RentPayment.branch_id: "branch_9027"}, synchronize_session=False)
            db.query(RentExpense).filter(RentExpense.branch_id.in_(alias_2)).update({RentExpense.branch_id: "branch_9027"}, synchronize_session=False)
            db.query(RentTenantHistory).filter(RentTenantHistory.branch_id.in_(alias_2)).update({RentTenantHistory.branch_id: "branch_9027"}, synchronize_session=False)
            db.query(RentBranch).filter(RentBranch.branch_id.in_(alias_2)).delete(synchronize_session=False)
            db.commit()

            # 2. 메인 지점 명칭 표준화
            main_b = db.query(RentBranch).filter(RentBranch.branch_id == "main").first()
            if main_b:
                main_b.name = "시크빌 1호점 (본점, 29개실)"
                db.commit()

            # 3. 호실이 존재하는 실제 지점 자동 감지
            room_branches = [r[0] for r in db.query(RentRoom.branch_id).distinct().all() if r[0]]
            existing_branches = {b.branch_id: b for b in db.query(RentBranch).all()}

            has_new = False
            for b_id in room_branches:
                canon_id = normalize_branch_id(b_id)
                if canon_id not in existing_branches:
                    name = "시크빌 2호점" if ("9027" in canon_id or "2" in canon_id) else f"지점 ({canon_id})"
                    new_b = RentBranch(
                        branch_id=canon_id,
                        name=name,
                        contact_phone="010-2345-6789",
                        address="서울특별시 서초구 서초대로 456" if "2" in name else "주소 등록됨",
                        fee_plan="원룸 프리미엄 29실형",
                        monthly_fee=150000,
                        billing_due_day=25,
                        billing_status="PAID",
                        is_active=True
                    )
                    db.add(new_b)
                    existing_branches[canon_id] = new_b
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

    def reset_branch_data(self, db: Session, branch_id: str, new_branch_name: Optional[str] = None) -> Dict[str, Any]:
        """특정 부동산의 입주자/수납/지출/이력 데이터를 초기화하여 깨끗한 공실 상태로 리셋"""
        canon_id = self.normalize_branch_id(branch_id)
        b = self.get_branch(db, canon_id)
        if not b:
            return {"success": False, "message": "초기화할 부동산 정보를 찾을 수 없습니다."}

        # 1. 수납, 지출, 퇴실이력 완전 삭제
        db.query(RentPayment).filter(RentPayment.branch_id == canon_id).delete(synchronize_session=False)
        db.query(RentExpense).filter(RentExpense.branch_id == canon_id).delete(synchronize_session=False)
        db.query(RentTenantHistory).filter(RentTenantHistory.branch_id == canon_id).delete(synchronize_session=False)

        # 2. 모든 호실 공실화 (호실 번호는 보존, 입주자/연락처/임대조건 초기화)
        rooms = db.query(RentRoom).filter(RentRoom.branch_id == canon_id).all()
        for r in rooms:
            r.name = ""
            r.phone = ""
            r.deposit = 0
            r.rent = 0
            r.maintenance = 0
            r.pay_day = 25
            r.start_date = None
            r.end_date = None
            r.move_out = False
            r.move_out_date = None
            r.note = ""

        # 3. 건물명 변경 요청이 있으면 반영
        if new_branch_name and new_branch_name.strip():
            b.name = new_branch_name.strip()

        db.commit()
        return {
            "success": True,
            "branch_id": canon_id,
            "branch_name": b.name,
            "total_rooms": len(rooms),
            "message": f"'{b.name}' 부동산의 모든 수납 장부와 임차인 정보가 초기화(공실화)되었습니다."
        }

    def factory_reset(self, db: Session, new_building_name: str = "새로운 임대건물 (29개실)") -> Dict[str, Any]:
        """독립 서버 전산 공장 초기화 (테스트 데이터 완전 청소 후 백지 상태로 리셋)"""
        # 모든 장부 및 이력 일괄 삭제
        db.query(RentPayment).delete(synchronize_session=False)
        db.query(RentExpense).delete(synchronize_session=False)
        db.query(RentTenantHistory).delete(synchronize_session=False)

        # 서브 지점 삭제 (main만 보존)
        db.query(RentBranch).filter(RentBranch.branch_id != "main").delete(synchronize_session=False)
        main_b = db.query(RentBranch).filter(RentBranch.branch_id == "main").first()
        if main_b:
            main_b.name = new_building_name
        else:
            main_b = RentBranch(
                branch_id="main",
                name=new_building_name,
                contact_phone="010-0000-0000",
                address="주소 미지정",
                fee_plan="원룸 프리미엄 29실형",
                monthly_fee=0,
                billing_status="PAID",
                is_active=True
            )
            db.add(main_b)

        # 메인 29개실 공실화
        rooms = db.query(RentRoom).filter(RentRoom.branch_id == "main").all()
        for r in rooms:
            r.name = ""
            r.phone = ""
            r.deposit = 0
            r.rent = 0
            r.maintenance = 0
            r.pay_day = 25
            r.start_date = None
            r.end_date = None
            r.move_out = False
            r.move_out_date = None
            r.note = ""

        db.commit()
        return {
            "success": True,
            "message": f"시스템이 성공적으로 초기화되었습니다. ('{new_building_name}' 29개실 공실 상태)"
        }


# 싱글톤 인스턴스
branch_service = BranchService()
