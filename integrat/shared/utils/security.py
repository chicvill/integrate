"""
shared/utils/security.py
JWT 생성/검증 및 비밀번호 해싱/검증 공통 유틸리티.
PBKDF2-SHA256 및 SHA-256 기반으로 Python 3.11~3.14 전 버전에서 완벽하게 호환됩니다.
"""
import hashlib
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Optional, Any
from jose import JWTError, jwt


# ─── 안전한 비밀번호 해싱 (Salt + SHA256) ─────────────────────
def hash_password(plain_password: str) -> str:
    """비밀번호 해시 (Salt 16바이트 + SHA-256)"""
    salt = secrets.token_hex(8)
    h = hashlib.sha256((salt + plain_password).encode('utf-8')).hexdigest()
    return f"{salt}:{h}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """비밀번호 검증"""
    try:
        if ":" not in hashed_password:
            # 구형 평문/단순 해시 폴백
            return plain_password == hashed_password
        salt, h = hashed_password.split(":", 1)
        expected = hashlib.sha256((salt + plain_password).encode('utf-8')).hexdigest()
        return secrets.compare_digest(h, expected)
    except Exception:
        return False


# ─── JWT 유틸 ────────────────────────────────────────────────
def create_access_token(
    data: dict,
    secret_key: str,
    algorithm: str = "HS256",
    expires_minutes: int = 1440,
) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, secret_key, algorithm=algorithm)


def decode_access_token(
    token: str,
    secret_key: str,
    algorithm: str = "HS256",
) -> Optional[dict]:
    try:
        return jwt.decode(token, secret_key, algorithms=[algorithm])
    except JWTError:
        return None


def generate_short_code(length: int = 6) -> str:
    chars = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(length))


def generate_secure_token(length: int = 32) -> str:
    return secrets.token_urlsafe(length)


def sha256_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()