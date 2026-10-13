"""
apps/rent/backend/services/auth_service.py
사용자/관리자 인증, 회원가입 신청, 본사 승인 및 권한 관리 전담 서비스 (Clean Architecture).
"""
import uuid
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from ..db.database import init_db
from ..db.models import RentUser, RentBranch
from ..schemas import RegisterRequest, UserApprovePayload, UserUpdatePayload


class AuthService:
    """사용자 계정/인증/승인 비즈니스 로직 전담 클래스"""

    _admins_seeded: bool = False

    def ensure_default_admins(self, db: Session) -> None:
        """기본 관리자 계정(admin, admin01, admin02) 시드 캐싱"""
        if self._admins_seeded:
            return

        try:
            init_db()
        except Exception as e:
            print(f"[AuthService] init_db warning: {e}")

        default_users = [
            {
                "username": "admin",
                "password": "1212",
                "name": "본사 총괄 최고관리자",
                "phone": "010-0000-0000",
                "role": "superadmin",
                "assigned_branch_id": None,
                "status": "APPROVED",
                "reason": "시스템 기본 최고관리자"
            },
            {
                "username": "admin01",
                "password": "1212",
                "name": "시크빌 1호점 실장",
                "phone": "010-1111-1111",
                "role": "branch_admin",
                "assigned_branch_id": "main",
                "status": "APPROVED",
                "reason": "1호점 기본 관리자"
            },
            {
                "username": "admin02",
                "password": "1212",
                "name": "시크빌 2호점 실장",
                "phone": "010-2222-2222",
                "role": "branch_admin",
                "assigned_branch_id": "branch_3765",
                "status": "APPROVED",
                "reason": "2호점 기본 관리자"
            }
        ]

        for u in default_users:
            existing = db.query(RentUser).filter(RentUser.username == u["username"]).first()
            if not existing:
                user_obj = RentUser(
                    id=str(uuid.uuid4()),
                    username=u["username"],
                    password=u["password"],
                    name=u["name"],
                    phone=u["phone"],
                    role=u["role"],
                    assigned_branch_id=u["assigned_branch_id"],
                    status=u["status"],
                    reason=u["reason"]
                )
                db.add(user_obj)
            else:
                if str(getattr(existing, "password", "")) == "password":
                    setattr(existing, "password", str(u["password"]))
        db.commit()
        self._admins_seeded = True

    def register_user(self, db: Session, payload: RegisterRequest) -> Dict[str, Any]:
        """점주/실장 신규 회원가입 신청 (기본 상태: PENDING)"""
        self.ensure_default_admins(db)
        u_name = payload.username.strip()
        if not u_name or not payload.password:
            raise ValueError("아이디와 비밀번호를 모두 입력해주세요.")

        existing = db.query(RentUser).filter(RentUser.username == u_name).first()
        if existing:
            raise ValueError(f"이미 존재하는 아이디입니다: {u_name}")

        new_user = RentUser(
            id=str(uuid.uuid4()),
            username=u_name,
            password=payload.password.strip(),
            name=payload.name.strip(),
            phone=(payload.phone or "").strip(),
            role="branch_admin",
            assigned_branch_id=payload.assigned_branch_id or payload.target_branch_id or None,
            status="PENDING",
            reason=(payload.reason or "").strip()
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return {
            "success": True,
            "message": "회원가입 신청이 완료되었습니다. 본사 관리자(admin) 승인 후 로그인하실 수 있습니다.",
            "user_id": new_user.id,
            "username": new_user.username,
            "status": new_user.status
        }

    def authenticate_user(self, db: Session, username: str, password: str) -> Dict[str, Any]:
        """점주/관리자 로그인 인증 및 지점 라우팅 판정"""
        self.ensure_default_admins(db)
        u_name = username.strip()
        pwd = password.strip()

        user = db.query(RentUser).filter(RentUser.username == u_name).first()
        if not user:
            raise ValueError("아이디 또는 비밀번호가 올바르지 않습니다.")

        if user.password != pwd:
            raise ValueError("비밀번호가 올바르지 않습니다.")

        if user.status == "PENDING":
            raise PermissionError("본사 관리자 승인 대기 중인 계정입니다.\n본사 승인 후 로그인하실 수 있습니다.")
        if user.status == "REJECTED":
            raise PermissionError("가입 승인이 거절된 계정입니다. 본사로 문의해주세요.")
        if user.status != "APPROVED":
            raise PermissionError(f"비활성화된 계정입니다 (상태: {user.status})")

        redirect_url = "/rent/branches.html" if user.role == "superadmin" else (
            f"/rent/?branch={user.assigned_branch_id}" if user.assigned_branch_id else "/rent/"
        )

        return {
            "success": True,
            "user_id": user.id,
            "username": user.username,
            "name": user.name,
            "role": user.role,
            "assigned_branch_id": user.assigned_branch_id,
            "redirect_url": redirect_url,
            "access_token": f"rent_token_{user.id}_{uuid.uuid4().int % 10000000000}"
        }

    def list_users(self, db: Session, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """계정 목록 조회 (본사 관리자용)"""
        self.ensure_default_admins(db)
        query = db.query(RentUser)
        if status:
            query = query.filter(RentUser.status == status)
        users = query.order_by(RentUser.created_at.desc()).all()

        branches_map: Dict[str, str] = {str(b.branch_id): str(b.name) for b in db.query(RentBranch).all()}
        result = []
        for u in users:
            branch_key = str(u.assigned_branch_id) if u.assigned_branch_id else ""
            b_name = branches_map.get(branch_key, branch_key) if branch_key else "전체 권한(본사)"
            result.append({
                "id": u.id,
                "username": u.username,
                "name": u.name,
                "phone": u.phone,
                "role": u.role,
                "assigned_branch_id": u.assigned_branch_id,
                "assigned_branch_name": b_name,
                "status": u.status,
                "reason": u.reason,
                "created_at": u.created_at.strftime("%Y-%m-%d %H:%M:%S") if u.created_at else ""
            })
        return result

    def approve_user(self, db: Session, user_id: str, payload: UserApprovePayload) -> Dict[str, Any]:
        """신규 가입 계정 승인/반려 및 담당 건물 지정"""
        self.ensure_default_admins(db)
        user = db.query(RentUser).filter(RentUser.id == user_id).first()
        if not user:
            raise ValueError(f"계정을 찾을 수 없습니다: {user_id}")

        if payload.action == "APPROVE":
            user.status = "APPROVED"
            if payload.assigned_branch_id:
                user.assigned_branch_id = payload.assigned_branch_id
            if payload.role:
                user.role = payload.role
        elif payload.action == "REJECT":
            user.status = "REJECTED"

        if payload.reason:
            user.reason = payload.reason

        db.commit()
        db.refresh(user)
        return {
            "success": True,
            "message": f"계정이 {user.status} 처리되었습니다.",
            "user_id": user.id,
            "status": user.status,
            "assigned_branch_id": user.assigned_branch_id
        }

    def update_user(self, db: Session, user_id: str, payload: UserUpdatePayload) -> Dict[str, Any]:
        """사용자 정보/비밀번호/건물 변경"""
        self.ensure_default_admins(db)
        user = db.query(RentUser).filter(RentUser.id == user_id).first()
        if not user:
            raise ValueError(f"계정을 찾을 수 없습니다: {user_id}")

        if payload.name:
            user.name = payload.name.strip()
        if payload.phone is not None:
            user.phone = payload.phone.strip()
        if payload.password:
            user.password = payload.password.strip()
        if payload.assigned_branch_id is not None:
            user.assigned_branch_id = payload.assigned_branch_id.strip() or None
        if payload.status:
            user.status = payload.status
        if payload.role:
            user.role = payload.role

        db.commit()
        db.refresh(user)
        return {
            "success": True,
            "message": "사용자 정보가 성공적으로 수정되었습니다.",
            "user_id": user.id
        }

    def delete_user(self, db: Session, user_id: str) -> Dict[str, Any]:
        """사용자 계정 삭제"""
        self.ensure_default_admins(db)
        user = db.query(RentUser).filter(RentUser.id == user_id).first()
        if not user:
            raise ValueError(f"계정을 찾을 수 없습니다: {user_id}")
        if user.username == "admin":
            raise ValueError("본사 최고관리자(admin) 계정은 삭제할 수 없습니다.")

        db.delete(user)
        db.commit()
        return {"success": True, "message": f"계정({user.username})이 삭제되었습니다."}


# 싱글톤 인스턴스
auth_service = AuthService()
