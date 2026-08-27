from fastapi import APIRouter, Request, HTTPException
import uuid
from pydantic import BaseModel
from deps import context

router = APIRouter(prefix="/api/settings", tags=["Admin Settings"])

class IpResponse(BaseModel):
    ip: str

class QrResponse(BaseModel):
    qr_code: str

@router.post("/wifi-ip", response_model=IpResponse)
def set_wifi_ip(request: Request):
    """현재 관리자의 접속 IP를 카페의 공인 IP로 등록합니다."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    # x-forwarded-for 헤더가 있다면 그것을 우선으로 사용
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
        
    success = context.cafe_settings_repo.set_setting("CAFE_WIFI_IP", client_ip)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save IP setting.")
    return {"ip": client_ip}

@router.get("/wifi-ip", response_model=IpResponse)
def get_wifi_ip():
    """현재 등록된 카페의 공인 IP를 반환합니다."""
    ip = context.cafe_settings_repo.get_setting("CAFE_WIFI_IP")
    if not ip:
        return {"ip": ""}
    return {"ip": ip}

@router.post("/qr-code", response_model=QrResponse)
def generate_qr_code():
    """새로운 고정형 QR 코드를 생성(또는 갱신)합니다."""
    new_qr = str(uuid.uuid4())
    success = context.cafe_settings_repo.set_setting("CURRENT_QR_CODE", new_qr)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to generate QR code.")
    return {"qr_code": new_qr}

@router.get("/qr-code", response_model=QrResponse)
def get_qr_code():
    """현재 등록된 고정형 QR 코드를 반환합니다. 없으면 새로 생성합니다."""
    qr = context.cafe_settings_repo.get_setting("CURRENT_QR_CODE")
    if not qr:
        return generate_qr_code()
    return {"qr_code": qr}
