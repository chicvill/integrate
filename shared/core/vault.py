"""
shared/core/vault.py
MQnet 시크릿 암호화 및 런타임 자동 복호화 모듈.
- 알고리즘: AES-256-GCM (표준 라이브러리/경량 fallback 지원)
- 목적: .env.shared의 민감한 DB/API 키를 .env.encrypted로 암호화하여 Git에 안전하게 포함.
- 런타임: 마스터 키로 메모리 상에서 복호화하여 os.environ에 자동 주입.
"""
import os
import sys
import hmac
import base64
import hashlib
import logging
from typing import Optional

logger = logging.getLogger("mqnet.vault")

# 기본 마스터 시크릿 (코드베이스 내부 고정 마스터 키)
DEFAULT_MASTER_KEY = "Fz8vH6_Y_9V7lDZb9uJc7mR2nL1pT4aQ5sX3k6M1z4Y="


def _get_derived_key(master_key: str) -> bytes:
    """마스터 키 문자열로부터 32바이트 AES 키 도출"""
    return hashlib.sha256(master_key.encode("utf-8")).digest()


def encrypt_text(plaintext: str, master_key: str = DEFAULT_MASTER_KEY) -> str:
    """
    텍스트를 AES-GCM(또는 ChaCha20/HMAC-CTR)로 암호화하여 Base64 문자열 반환.
    cryptography 라이브러리가 있으면 AES-GCM 사용, 없으면 표준 라이브러리 HMAC-CTR 사용.
    """
    key = _get_derived_key(master_key)
    raw_bytes = plaintext.encode("utf-8")

    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        aesgcm = AESGCM(key)
        nonce = os.urandom(12)
        ciphertext = aesgcm.encrypt(nonce, raw_bytes, None)
        # format: b"GCM:" + nonce + ciphertext
        payload = b"GCM:" + nonce + ciphertext
        return base64.b64encode(payload).decode("ascii")
    except Exception:
        # Fallback: 표준 라이브러리(hashlib, hmac, os.urandom) 기반 CTR 스트림 암호화 + HMAC-SHA256 인증
        nonce = os.urandom(16)
        out = bytearray()
        block_idx = 0
        while len(out) < len(raw_bytes):
            counter_bytes = block_idx.to_bytes(4, "big")
            keystream_block = hashlib.sha256(key + nonce + counter_bytes).digest()
            for b in keystream_block:
                if len(out) < len(raw_bytes):
                    out.append(raw_bytes[len(out)] ^ b)
                else:
                    break
            block_idx += 1
        tag = hmac.new(key, nonce + bytes(out), hashlib.sha256).digest()
        payload = b"CTR:" + nonce + tag + bytes(out)
        return base64.b64encode(payload).decode("ascii")


def decrypt_text(encrypted_b64: str, master_key: str = DEFAULT_MASTER_KEY) -> str:
    """Base64 암호화 문자열을 복호화하여 평문 텍스트 반환"""
    key = _get_derived_key(master_key)
    try:
        payload = base64.b64decode(encrypted_b64.encode("ascii"))
    except Exception as e:
        raise ValueError(f"잘못된 Base64 데이터: {e}")

    if payload.startswith(b"GCM:"):
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        aesgcm = AESGCM(key)
        nonce = payload[4:16]
        ciphertext = payload[16:]
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        return plaintext.decode("utf-8")

    elif payload.startswith(b"CTR:"):
        nonce = payload[4:20]
        tag = payload[20:52]
        ciphertext = payload[52:]
        expected_tag = hmac.new(key, nonce + ciphertext, hashlib.sha256).digest()
        if not hmac.compare_digest(tag, expected_tag):
            raise ValueError("암호문 무결성 검증 실패 (HMAC 불일치 또는 마스터 키 오류)")
        
        out = bytearray()
        block_idx = 0
        while len(out) < len(ciphertext):
            counter_bytes = block_idx.to_bytes(4, "big")
            keystream_block = hashlib.sha256(key + nonce + counter_bytes).digest()
            for b in keystream_block:
                if len(out) < len(ciphertext):
                    out.append(ciphertext[len(out)] ^ b)
                else:
                    break
            block_idx += 1
        return bytes(out).decode("utf-8")
    else:
        raise ValueError("알 수 없는 암호화 포맷입니다.")


def load_encrypted_env(file_path: Optional[str] = None, master_key: Optional[str] = None) -> bool:
    """
    .env.encrypted 파일을 복호화하여 현재 프로세스의 os.environ에 주입합니다.
    기존에 이미 주입된 환경변수가 있다면 덮어쓰지 않습니다.
    """
    if file_path is None:
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        file_path = os.path.join(base_dir, ".env.encrypted")

    if not os.path.exists(file_path):
        return False

    key = master_key or os.getenv("MASTER_CRYPTO_KEY", DEFAULT_MASTER_KEY)

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            encrypted_content = f.read().strip()

        decrypted_env = decrypt_text(encrypted_content, key)
        loaded_count = 0
        for line in decrypted_env.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'\"")
                # 기존에 명시적으로 설정된 변수가 없으면 주입
                if k and not os.environ.get(k):
                    os.environ[k] = v
                    loaded_count += 1
        logger.info(f"🔒 Vault: .env.encrypted에서 {loaded_count}개의 환경변수를 성공적으로 복호화하여 로드했습니다.")
        return True
    except Exception as e:
        logger.warning(f"⚠️ Vault: .env.encrypted 복호화 중 오류 발생: {e}")
        return False


if __name__ == "__main__":
    # CLI 모드: python -m shared.core.vault [encrypt/decrypt]
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    src_file = os.path.join(base_dir, ".env.shared")
    enc_file = os.path.join(base_dir, ".env.encrypted")

    if len(sys.argv) > 1 and sys.argv[1] == "decrypt":
        if not os.path.exists(enc_file):
            print(f"Error: {enc_file} does not exist.")
            sys.exit(1)
        with open(enc_file, "r", encoding="utf-8") as f:
            enc_data = f.read().strip()
        dec = decrypt_text(enc_data, DEFAULT_MASTER_KEY)
        print("Decrypted Content:\n" + dec)
    else:
        if not os.path.exists(src_file):
            print(f"Error: {src_file} does not exist.")
            sys.exit(1)
        with open(src_file, "r", encoding="utf-8") as f:
            src_data = f.read()
        encrypted = encrypt_text(src_data, DEFAULT_MASTER_KEY)
        with open(enc_file, "w", encoding="utf-8") as f:
            f.write(encrypted)
        print(f"[SUCCESS] Encryption complete: {src_file} -> {enc_file}")
        print(f"[INFO] Ciphertext size: {len(encrypted)} bytes")
