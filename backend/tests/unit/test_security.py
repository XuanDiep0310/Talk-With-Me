"""Unit tests for security utilities: argon2 password hashing, JWT, refresh tokens."""

from datetime import timedelta

import pytest

from app.core.security import (
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)


def test_hash_and_verify_password() -> None:
    raw = "MySecretPass123!"
    hashed = hash_password(raw)
    assert hashed != raw
    assert verify_password(raw, hashed) is True


def test_verify_wrong_password_returns_false() -> None:
    raw = "MySecretPass123!"
    hashed = hash_password(raw)
    assert verify_password("WrongPassword123!", hashed) is False


def test_create_and_decode_access_token() -> None:
    payload = {"sub": "user-uuid-123", "role": "learner"}
    secret = "test-secret-key-at-least-32-chars-long"
    alg = "HS256"

    token = create_access_token(
        payload=payload,
        expires_delta=timedelta(minutes=15),
        secret=secret,
        algorithm=alg,
    )
    assert isinstance(token, str)

    decoded = decode_access_token(token, secret=secret, algorithm=alg)
    assert decoded["sub"] == "user-uuid-123"
    assert decoded["role"] == "learner"
    assert "exp" in decoded


def test_decode_invalid_token_raises() -> None:
    secret = "test-secret-key-at-least-32-chars-long"
    with pytest.raises(ValueError, match="Invalid or expired token"):
        decode_access_token("this.is.not.a.valid.jwt", secret=secret, algorithm="HS256")


def test_decode_wrong_secret_raises() -> None:
    payload = {"sub": "user-123"}
    token = create_access_token(
        payload=payload,
        expires_delta=timedelta(minutes=15),
        secret="secret-one-at-least-32-chars-long",
        algorithm="HS256",
    )
    with pytest.raises(ValueError, match="Invalid or expired token"):
        decode_access_token(token, secret="secret-two-at-least-32-chars-long", algorithm="HS256")


def test_generate_refresh_token_uniqueness() -> None:
    tokens = {generate_refresh_token() for _ in range(100)}
    assert len(tokens) == 100


def test_hash_refresh_token_deterministic() -> None:
    token = "fixed-sample-token-value"
    hash1 = hash_refresh_token(token)
    hash2 = hash_refresh_token(token)
    assert hash1 == hash2
    assert len(hash1) == 64  # SHA-256 hex digest


def test_validate_password_strength_rejects_weak_passwords() -> None:
    from app.core.security import validate_password_strength

    # Too short
    valid, msg = validate_password_strength("123", min_length=6)
    assert valid is False
    assert "6 ký tự" in (msg or "")

    # Common weak passwords (like 123456)
    for weak in ["123456", "12345678", "password", "qwerty", "111111", "admin123"]:
        valid, msg = validate_password_strength(weak, min_length=6)
        assert valid is False
        assert "quá đơn giản" in (msg or "")

    # Identical characters
    valid, msg = validate_password_strength("aaaaaa", min_length=6)
    assert valid is False

    # Valid strong password
    valid, msg = validate_password_strength("MySecurePass#2026", min_length=6)
    assert valid is True
    assert msg is None
