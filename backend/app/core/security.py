"""
Security utilities: password hashing, JWT creation/validation, refresh token generation.
Uses passlib (argon2) for password hashing and python-jose for JWT.
"""

import hashlib
import secrets
from base64 import urlsafe_b64encode
from datetime import timedelta

from jose import JWTError, jwt
from passlib.context import CryptContext

_pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Hash a plain-text password using argon2."""
    return str(_pwd_context.hash(plain))


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against its argon2 hash."""
    return bool(_pwd_context.verify(plain, hashed))


def create_access_token(
    payload: dict[str, object], expires_delta: timedelta, secret: str, algorithm: str
) -> str:
    """Create a signed JWT access token."""
    to_encode = payload.copy()
    import datetime as _dt

    expire = _dt.datetime.now(_dt.UTC) + expires_delta
    to_encode.update({"exp": expire})
    return str(jwt.encode(to_encode, secret, algorithm=algorithm))


def decode_access_token(token: str, secret: str, algorithm: str) -> dict[str, object]:
    """
    Decode and verify a JWT access token.
    Raises ValueError if the token is invalid or expired.
    """
    try:
        payload: dict[str, object] = jwt.decode(token, secret, algorithms=[algorithm])
        return payload
    except JWTError as exc:
        raise ValueError("Invalid or expired token") from exc


def generate_refresh_token() -> str:
    """Generate a cryptographically secure random refresh token (URL-safe base64)."""
    return urlsafe_b64encode(secrets.token_bytes(32)).decode()


def hash_refresh_token(token: str) -> str:
    """Hash a refresh token with SHA-256 for storage."""
    return hashlib.sha256(token.encode()).hexdigest()


# Common trivially weak passwords that must not be accepted
COMMON_WEAK_PASSWORDS = {
    "123456",
    "1234567",
    "12345678",
    "123456789",
    "password",
    "password123",
    "qwerty",
    "111111",
    "000000",
    "123123",
    "admin123",
    "abc123456",
    "abcdef",
}


def validate_password_strength(password: str, min_length: int = 6) -> tuple[bool, str | None]:
    """
    Validate password strength consistency across register, reset, and change password.
    Returns (is_valid, error_message).
    """
    if len(password) < min_length:
        return False, f"Mật khẩu phải có ít nhất {min_length} ký tự."

    clean = password.strip().lower()
    if clean in COMMON_WEAK_PASSWORDS:
        return False, "Mật khẩu quá đơn giản hoặc dễ đoán. Vui lòng chọn mật khẩu mạnh hơn."

    if len(set(clean)) == 1:
        return False, "Mật khẩu không được gồm toàn các ký tự trùng lặp."

    return True, None
