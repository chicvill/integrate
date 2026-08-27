"""
shared/utils/security.py
JWT 생성/검증 및 비밀번호 해싱/검증 공통 유틸리티.
모든 앱의 인증 로직에서 임포트하여 사용합니다.
"""
import hashlib
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Optional, Any

import bcrypt
from jose import JWTError, jwt


# ─── 비밀번호 유틸 (bcrypt 네이티브 사용) ───────────────────────
def hash_password(plain_password: str) -> str:
    """평문 비밀번호를 bcrypt 해시로 변환"""
    pwd_bytes = plain_password.encode("utf-8")[:72]
    return bcrypt.hashpw(pwd_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """평문 비밀번호와 해시 비밀번호를 비교"""
    try:
        pwd_bytes = plain_password.encode("utf-8")[:72]
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(pwd_bytes, hash_bytes)
    except Exception:
        return False


# ─── JWT 유틸 ────────────────────────────────────────────────
def create_access_token(
    data: dict,
    secret_key: str,
    algorithm: str = "HS256",
    expires_minutes: int = 1440,
) -> str:
    """
    JWT 액세스 토큰 생성.
    
    Args:
        data: 토큰에 포함할 페이로드 (user_id, email, app_id, role 등)
        secret_key: JWT 서명 시크릿 키
        algorithm: 서명 알고리즘 (기본: HS256)
        expires_minutes: 만료 시간 (분, 기본: 1440분 = 24시간)
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, secret_key, algorithm=algorithm)


def decode_access_token(
    token: str,
    secret_key: str,
    algorithm: str = "HS256",
) -> Optional[dict]:
    """
    JWT 토큰 검증 및 페이로드 반환.
    유효하지 않은 토큰이면 None 반환.
    """
    try:
        payload = jwt.decode(token, secret_key, algorithms=[algorithm])
        return payload
    except JWTError:
        return None


# ─── 난수 ID 유틸 ─────────────────────────────────────────────
def generate_short_code(length: int = 6) -> str:
    """
    영문 대문자 + 숫자 조합의 난수 코드 생성.
    QR 코드, 매장 코드, 세션 코드 등에 사용.
    
    예시: 'X7A9B2', 'K4MN8P'
    """
    chars = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


def generate_secure_token(length: int = 32) -> str:
    """보안 난수 토큰 생성 (API 키, 리셋 토큰 등)"""
    return secrets.token_urlsafe(length)


# ─── 기타 보안 유틸 ───────────────────────────────────────────
def sha256_hash(text: str) -> str:
    """SHA-256 해시 (구형 호환성용)"""
    return hashlib.sha256(text.encode()).hexdigest()
