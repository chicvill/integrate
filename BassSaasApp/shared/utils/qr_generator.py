"""shared/utils/qr_generator.py - QR 코드 생성 유틸리티"""
import io
import base64
from shared.utils.security import generate_short_code


def generate_qr_base64(data: str, size: int = 200) -> str:
    """QR 코드를 base64 이미지 문자열로 반환"""
    try:
        import qrcode
        qr = qrcode.make(data)
        buffer = io.BytesIO()
        qr.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")
    except ImportError:
        return f"qrcode 패키지 필요: pip install qrcode pillow"


def generate_table_qr(tenant_id: str, table_number: str, base_url: str) -> dict:
    """
    매장 테이블용 QR 코드 생성.
    반환: {"short_code": "X7A9B2", "qr_url": "...", "qr_base64": "..."}
    """
    short_code = generate_short_code(6)
    url = f"{base_url}/order?store={tenant_id}&table={table_number}&code={short_code}"
    return {
        "short_code": short_code,
        "qr_url": url,
        "qr_base64": generate_qr_base64(url),
    }
