"""
apps/studycafe/backend/routers/auth.py
Auth and User registration router for StudyCafe.
- 계정별(admin, admin01, admin02) 지점 배정 및 자동 리다이렉트 라우팅
- 일반 회원 등업 신청 및 본사 승인 워크플로우
- PIN 간편 로그인 및 관리자 ID/PW 로그인 동시 지원
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from apps.studycafe.backend.db.database import get_db
import apps.studycafe.backend.models as models

router = APIRouter(prefix="", tags=["StudyCafe Auth & Users"])


class UserCreate(BaseModel):
    name: str
    phone: str
    pin: Optional[str] = None
    user_type: Optional[str] = "GENERAL"


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class UpgradeRequestPayload(BaseModel):
    phone: str
    target_branch_id: str
    reason: Optional[str] = "가맹점/지점 운영 관리자 희망"


class UpgradeApprovePayload(BaseModel):
    assigned_branch_id: Optional[str] = None


def ensure_default_admins(db: Session):
    """기본 관리자 계정 시드 (admin, admin01, admin02) 보장"""
    defaults = [
        {
            "username": "admin",
            "password": "1212",
            "name": "본사 총괄 최고관리자",
            "phone": "010-0000-0000",
            "role": "superadmin",
            "assigned_branch_id": "studycafe-main",
            "user_type": "MANAGED"
        },
        {
            "username": "admin01",
            "password": "1212",
            "name": "강남역점 점주실장",
            "phone": "010-1111-1111",
            "role": "branch_admin",
            "assigned_branch_id": "sc-gangnam",
            "user_type": "MANAGED"
        },
        {
            "username": "admin02",
            "password": "1212",
            "name": "대치학원가점 점주실장",
            "phone": "010-2222-2222",
            "role": "branch_admin",
            "assigned_branch_id": "sc-daechi",
            "user_type": "MANAGED"
        },
    ]

    for d in defaults:
        existing = db.query(models.StudyCafeUser).filter(
            (models.StudyCafeUser.username == d["username"]) | (models.StudyCafeUser.phone == d["phone"])
        ).first()
        if not existing:
            user = models.StudyCafeUser(
                username=d["username"],
                password=d["password"],
                name=d["name"],
                phone=d["phone"],
                role=d["role"],
                assigned_branch_id=d["assigned_branch_id"],
                user_type=d["user_type"],
                pin_code="1212",
                upgrade_status="APPROVED"
            )
            db.add(user)
        else:
            # 기존 계정에 username 및 role 보정
            if not existing.username:
                existing.username = d["username"]
            if not existing.password:
                existing.password = d["password"]
            existing.role = d["role"]
            existing.assigned_branch_id = d["assigned_branch_id"]
    try:
        db.commit()
    except Exception:
        db.rollback()


@router.post("/login", summary="관리자 ID/PW 로그인 (역할 및 지점별 자동 분기)")
def login_admin(payload: AdminLoginRequest, db: Session = Depends(get_db)):
    """
    관리자 ID/PW 검증 및 역할/지점에 따른 전용 페이지 리다이렉트 URL 반환:
    - admin/1212: 본사 관리 센터 (/studycafe/branches.html)
    - admin01/1212: 제1매장 강남점 관제 (/studycafe/admin.html?branch=sc-gangnam)
    - admin02/1212: 제2매장 대치점 관제 (/studycafe/admin.html?branch=sc-daechi)
    """
    ensure_default_admins(db)

    user = db.query(models.StudyCafeUser).filter(
        models.StudyCafeUser.username == payload.username.strip()
    ).first()

    if not user or user.password != payload.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호가 일치하지 않습니다."
        )

    branch_id = user.assigned_branch_id or "studycafe-main"

    # 역할별 자동 분기 페이지 결정
    if user.role == "superadmin":
        redirect_url = "/studycafe/branches.html"
    elif user.role == "branch_admin":
        redirect_url = f"/studycafe/admin.html?branch={branch_id}"
    elif user.role == "parent":
        redirect_url = f"/studycafe/parent.html?phone={user.parent_phone or user.phone}"
    else:
        redirect_url = f"/studycafe/?branch={branch_id}"

    return {
        "success": True,
        "message": f"환영합니다, {user.name}님!",
        "user": {
            "id": user.id,
            "username": user.username,
            "name": user.name,
            "phone": user.phone,
            "role": user.role,
            "assigned_branch_id": branch_id,
            "user_type": user.user_type
        },
        "redirect_url": redirect_url
    }


@router.post("/register", summary="개인 회원가입 (기본 학생/일반회원)")
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.StudyCafeUser).filter(models.StudyCafeUser.phone == user.phone).first()
    if db_user:
        if user.user_type:
            db_user.user_type = user.user_type
        if user.name:
            db_user.name = user.name
        db.commit()
        db.refresh(db_user)
        return {
            "id": db_user.id,
            "name": db_user.name,
            "phone": db_user.phone,
            "role": db_user.role,
            "user_type": db_user.user_type
        }
    
    new_user = models.StudyCafeUser(
        name=user.name,
        phone=user.phone,
        pin_code=user.pin or user.phone[-4:],
        role="student",
        user_type=user.user_type or "GENERAL",
        upgrade_status="NONE"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {
        "id": new_user.id,
        "name": new_user.name,
        "phone": new_user.phone,
        "role": new_user.role,
        "user_type": new_user.user_type
    }


@router.post("/login-pin", summary="학생 010 전화번호 PIN 간편 로그인")
def login_with_pin(phone: str, pin: str, db: Session = Depends(get_db)):
    ensure_default_admins(db)
    user = db.query(models.StudyCafeUser).filter(models.StudyCafeUser.phone == phone).first()
    if not user or user.pin_code != pin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="전화번호 또는 PIN 번호가 일치하지 않습니다."
        )
    
    branch_id = user.assigned_branch_id or "studycafe-main"
    if user.role in ("superadmin", "branch_admin"):
        redirect_url = f"/studycafe/admin.html?branch={branch_id}"
    else:
        redirect_url = f"/studycafe/?branch={branch_id}"

    return {
        "id": user.id,
        "name": user.name,
        "phone": user.phone,
        "role": user.role,
        "assigned_branch_id": branch_id,
        "user_type": user.user_type,
        "redirect_url": redirect_url
    }


# ── 🎯 점주/실장 등업 신청 및 본사 승인 워크플로우 ──
@router.post("/upgrade/request", summary="점주/관리자 등업 신청 제출")
def request_role_upgrade(payload: UpgradeRequestPayload, db: Session = Depends(get_db)):
    """일반 회원이 특정 지점의 점주/관리자로 등업을 신청합니다."""
    user = db.query(models.StudyCafeUser).filter(models.StudyCafeUser.phone == payload.phone).first()
    if not user:
        raise HTTPException(status_code=404, detail="가입된 회원 정보를 찾을 수 없습니다.")

    user.upgrade_status = "PENDING"
    user.upgrade_requested_branch = payload.target_branch_id
    user.upgrade_requested_reason = payload.reason
    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "message": f"'{user.name}'님의 '{payload.target_branch_id}' 매장 관리자 등업 신청이 접수되었습니다. 본사 승인 후 권한이 부여됩니다.",
        "upgrade_status": user.upgrade_status
    }


@router.get("/upgrade/requests", summary="등업 신청 목록 조회 (본사용)")
def list_upgrade_requests(db: Session = Depends(get_db)):
    """본사 관리자가 검토 대기 중인 등업 신청자 목록을 조회합니다."""
    users = db.query(models.StudyCafeUser).filter(
        models.StudyCafeUser.upgrade_status.in_(["PENDING", "APPROVED", "REJECTED"])
    ).all()

    return {
        "success": True,
        "requests": [
            {
                "user_id": u.id,
                "name": u.name,
                "phone": u.phone,
                "role": u.role,
                "assigned_branch_id": u.assigned_branch_id,
                "upgrade_status": u.upgrade_status,
                "target_branch_id": u.upgrade_requested_branch,
                "reason": u.upgrade_requested_reason,
                "created_at": u.created_at.strftime("%Y-%m-%d %H:%M") if u.created_at else ""
            }
            for u in users
        ]
    }


@router.post("/upgrade/requests/{user_id}/approve", summary="등업 신청 승인 (본사용)")
def approve_upgrade_request(user_id: str, payload: UpgradeApprovePayload = None, db: Session = Depends(get_db)):
    """본사 관리자가 회원을 특정 지점의 점주/실장(branch_admin)으로 승격합니다."""
    user = db.query(models.StudyCafeUser).filter(models.StudyCafeUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")

    branch_to_assign = (payload and payload.assigned_branch_id) or user.upgrade_requested_branch or "studycafe-main"

    user.role = "branch_admin"
    user.assigned_branch_id = branch_to_assign
    user.upgrade_status = "APPROVED"
    if not user.username:
        user.username = f"admin_{user.phone[-4:]}"
    if not user.password:
        user.password = "1212"

    db.commit()
    db.refresh(user)

    return {
        "success": True,
        "message": f"'{user.name}'님이 '{branch_to_assign}' 지점 점주(branch_admin)로 승인되었습니다.",
        "user": {
            "id": user.id,
            "username": user.username,
            "name": user.name,
            "role": user.role,
            "assigned_branch_id": user.assigned_branch_id
        }
    }


@router.post("/upgrade/requests/{user_id}/reject", summary="등업 신청 반려 (본사용)")
def reject_upgrade_request(user_id: str, db: Session = Depends(get_db)):
    """등업 신청을 반려합니다."""
    user = db.query(models.StudyCafeUser).filter(models.StudyCafeUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="회원을 찾을 수 없습니다.")

    user.upgrade_status = "REJECTED"
    db.commit()
    return {
        "success": True,
        "message": f"'{user.name}'님의 등업 신청이 반려되었습니다."
    }


@router.get("/users")
def list_users(db: Session = Depends(get_db)):
    users = db.query(models.StudyCafeUser).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "name": u.name,
            "phone": u.phone,
            "role": u.role,
            "assigned_branch_id": u.assigned_branch_id,
            "user_type": u.user_type,
            "upgrade_status": u.upgrade_status
        }
        for u in users
    ]
