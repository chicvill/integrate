"""
apps/rent2/backend/routers/auth.py
인증, 계정 관리(회원가입/로그인/사용자 목록/승인/수정/삭제), 권한 등업 신청 및 승인
"""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, Depends, HTTPException

from ..domain import Building
from ..kernel.identity import UpgradeRequest, User
from .common import me, serialize_user

router = APIRouter()
Body_ = Body(default={})


def _user(uid: str) -> User:
    u = User.get(uid)
    if not u:
        raise HTTPException(400, f"계정을 찾을 수 없습니다: {uid}")
    return u


@router.post("/auth/register")
def register(p: Dict[str, Any] = Body(...)):
    u = User.create(
        p.get("username", ""),
        p.get("password", ""),
        name=(p.get("name") or "").strip(),
        phone=(p.get("phone") or "").strip(),
        branch=p.get("assigned_branch_id") or p.get("target_branch_id"),
        reason=(p.get("reason") or "").strip()
    )
    return {
        "success": True,
        "message": "회원가입 신청이 완료되었습니다. 본사 관리자(admin) 승인 후 로그인하실 수 있습니다.",
        "user_id": u.id,
        "username": u.username,
        "status": u.status
    }


@router.post("/auth/login")
@router.post("/auth/admin-login")
def login(p: Dict[str, Any] = Body(...)):
    try:
        u = User.login(p.get("username", ""), p.get("password", ""))
    except ValueError as e:
        raise HTTPException(401, str(e))
    except PermissionError as e:
        raise HTTPException(403, str(e))
    b = Building.resolve(u.branch) if u.branch else None
    user_info = {
        "user_id": u.id,
        "username": u.username,
        "name": u.name,
        "role": u.role,
        "branch": u.branch,
        "branch_name": b.name if b else ("본사 총괄" if u.role == "superadmin" else (u.branch or ""))
    }
    return {
        "success": True,
        "user_id": u.id,
        "username": u.username,
        "name": u.name,
        "role": u.role,
        "assigned_branch_id": u.branch,
        "access_token": u.token(),
        "user": user_info
    }


@router.get("/auth/me")
def auth_me(user: User = Depends(me)):
    b = Building.resolve(user.branch) if user.branch else None
    user_info = {
        "user_id": user.id,
        "username": user.username,
        "name": user.name,
        "role": user.role,
        "branch": user.branch,
        "branch_name": b.name if b else ("본사 총괄" if user.role == "superadmin" else (user.branch or ""))
    }
    return {
        "success": True,
        "user_id": user.id,
        "username": user.username,
        "name": user.name,
        "role": user.role,
        "assigned_branch_id": user.branch,
        "assigned_branch_name": user_info["branch_name"],
        "user": user_info
    }


@router.get("/auth/users")
def users():
    rows = [serialize_user(u) for u in sorted(User.all(), key=lambda u: u.created, reverse=True)]
    return {"success": True, "total": len(rows), "users": rows}


@router.patch("/auth/users/{uid}/status")
def approve_user(uid: str, p: Dict[str, Any] = Body(...)):
    u = _user(uid)
    if p.get("action") == "APPROVE":
        u.status, u.branch, u.role = "APPROVED", p.get("assigned_branch_id") or u.branch, p.get("role") or u.role
    elif p.get("action") == "REJECT":
        u.status = "REJECTED"
    u.reason = p.get("reason") or u.reason
    u.save(u.status.lower())
    return {
        "success": True,
        "message": f"계정이 {u.status} 처리되었습니다.",
        "user_id": u.id,
        "status": u.status,
        "assigned_branch_id": u.branch
    }


@router.patch("/auth/users/{uid}")
def update_user(uid: str, p: Dict[str, Any] = Body(...)):
    u = _user(uid)
    for k, attr in (("name", "name"), ("status", "status"), ("role", "role")):
        if p.get(k):
            setattr(u, attr, p[k].strip())
    if p.get("phone") is not None:
        u.phone = p["phone"].strip()
    if p.get("assigned_branch_id") is not None:
        u.branch = p["assigned_branch_id"].strip() or None
    if p.get("password"):
        u.set_password(p["password"])
    u.save("updated")
    return {"success": True, "message": "사용자 정보가 성공적으로 수정되었습니다.", "user_id": u.id}


@router.delete("/auth/users/{uid}")
def delete_user(uid: str):
    u = _user(uid)
    if u.username == "admin":
        raise HTTPException(400, "본사 최고관리자(admin) 계정은 삭제할 수 없습니다.")
    u.delete()
    return {"success": True, "message": f"계정({u.username})이 삭제되었습니다."}


# ── 등업 신청 ──
@router.post("/upgrade-request")
def upgrade_request(p: Dict[str, Any] = Body(...)):
    r = UpgradeRequest(
        user_name=p.get("user_name", ""),
        contact=p.get("contact", ""),
        target_branch=p.get("target_branch_id", ""),
        reason=p.get("reason") or ""
    ).save("requested")
    return {"success": True, "message": "등업 신청이 접수되었습니다. 본사 승인 대기 중입니다.", "request_id": r.id}


@router.get("/upgrade-requests")
def upgrade_requests():
    return {
        "success": True,
        "requests": [
            r.model_dump() | {"target_branch_id": r.target_branch, "assigned_branch_id": r.assigned_branch}
            for r in UpgradeRequest.all()
        ]
    }


@router.post("/upgrade-requests/approve")
def upgrade_approve(p: Dict[str, Any] = Body(...)):
    r = UpgradeRequest.get(p.get("request_id", ""))
    if not r:
        raise HTTPException(404, "등업 신청 내역을 찾을 수 없습니다.")
    r.status = "APPROVED" if p.get("action") == "APPROVE" else "REJECTED"
    r.assigned_branch = (p.get("assigned_branch_id") or r.target_branch) if r.status == "APPROVED" else r.assigned_branch
    r.save(r.status.lower())
    return {"success": True, "status": r.status}


@router.get("/auth/upgrade/requests")
def upgrade_list():
    rows = [
        {
            "id": u["id"],
            "username": u["username"],
            "name": u["name"],
            "user_name": f"{u['name']} ({u['username']})",
            "contact": u["phone"],
            "target_branch_id": u["assigned_branch_id"] or "미지정",
            "reason": u["reason"] or "",
            "created_at": u["created_at"],
            "status": u["status"],
            "assigned_branch_id": u["assigned_branch_name"]
        }
        for u in map(serialize_user, User.all()) if u["username"] != "admin"
    ]
    return {"success": True, "requests": rows}


@router.post("/auth/upgrade/requests/{rid}/approve")
def upgrade_req_approve(rid: str, p: Dict[str, Any] = Body_):
    return approve_user(rid, {"action": "APPROVE", "assigned_branch_id": p.get("assigned_branch_id")})


@router.post("/auth/upgrade/requests/{rid}/reject")
def upgrade_req_reject(rid: str):
    return approve_user(rid, {"action": "REJECT"})
