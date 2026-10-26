from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from schemas import AuthPayload, ProfilePayload
from deps import context

router = APIRouter(prefix="/knowledge", tags=["Auth & Profile"])

class UpdateUserPayload(BaseModel):
    user_id: str
    name: str
    password: str

class CheckInPayload(BaseModel):
    user_id: str
    qr_code: Optional[str] = None

@router.post("/signup")
async def signup(payload: AuthPayload):
    print(f"[DEBUG] Attempting signup for user_id: {payload.user_id}")
    success = context.user_repo.register_user(payload.user_id, payload.password, payload.name or "")
    print(f"[DEBUG] Signup result for {payload.user_id}: {success}")
    if success:
        return {"status": "success", "success": True, "message": "User registered successfully"}
    else:
        return {"status": "error", "success": False, "message": "User ID already exists or failed to register"}

@router.post("/login")
async def login(payload: AuthPayload):
    print(f"[DEBUG] Attempting login for user_id: {payload.user_id}")
    user_info = context.user_repo.get_user_info(payload.user_id)
    print(f"[DEBUG] User info retrieved: {user_info is not None}")
    if user_info and user_info["password"] == payload.password:
        print(f"[DEBUG] Login successful for {payload.user_id}")
        return {
            "status": "success",
            "success": True,
            "message": "Login successful",
            "name": user_info["name"],
            "role": user_info.get("role", "GENERAL"),
            "is_locked": bool(user_info.get("is_locked", False))
        }
    else:
        print(f"[DEBUG] Login failed for {payload.user_id} - invalid credentials")
        return {"status": "error", "success": False, "message": "Invalid user ID or password"}

@router.post("/check-in")
async def check_in(payload: CheckInPayload, request: Request):
    user_info = context.user_repo.get_user_info(payload.user_id)
    if not user_info:
        raise HTTPException(status_code=404, detail="User not found")
        
    client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "127.0.0.1").split(",")[0].strip()
    
    cafe_ip = context.cafe_settings_repo.get_setting("CAFE_WIFI_IP")
    current_qr = context.cafe_settings_repo.get_setting("CURRENT_QR_CODE")
    
    is_valid_ip = cafe_ip and client_ip == cafe_ip
    is_valid_qr = payload.qr_code and current_qr and payload.qr_code == current_qr
    
    if is_valid_ip or is_valid_qr:
        context.user_repo.update_user_visit(payload.user_id)
        return {"status": "success", "message": "인증 완료", "method": "IP" if is_valid_ip else "QR"}
    else:
        return {"status": "error", "message": "인증 실패. 올바른 매장 Wi-Fi에 연결하거나 유효한 QR 코드를 스캔하세요.", "client_ip": client_ip}

@router.get("/user/{user_id}")
async def get_user_info(user_id: str):
    user_info = context.user_repo.get_user_info(user_id)
    if user_info:
        return {"status": "success", "data": user_info}
    else:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

@router.post("/user/update")
async def update_user(payload: UpdateUserPayload):
    success = context.user_repo.update_user_info(payload.user_id, payload.name, payload.password)
    if success:
        return {"status": "success", "message": "개인 정보가 수정되었습니다."}
    else:
        return {"status": "error", "message": "정보 수정에 실패했습니다."}

@router.get("/profile/{user_id}")
async def get_profile(user_id: str):
    profile_data = context.user_repo.get_user_profile(user_id)
    return {"status": "success", "data": profile_data}

@router.post("/profile")
async def save_profile(payload: ProfilePayload):
    success = context.user_repo.save_user_profile(payload.user_id, payload.form_data)
    if success:
        return {"status": "success", "message": "Profile saved successfully"}
    return {"status": "error", "message": "Failed to save profile"}
