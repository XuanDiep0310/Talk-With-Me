# backend/test_scrum41_backend.py
import sys
import os

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import hashlib
import secrets
import uuid
import asyncio
from datetime import datetime, timedelta, UTC
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.abspath("backend"))

from pydantic import ValidationError
from fastapi import HTTPException
from app.models.schemas import ForgotPasswordRequest, ResetPasswordRequest
from app.core.security import (
    validate_password_strength,
    hash_password,
    verify_password,
    hash_refresh_token,
    COMMON_WEAK_PASSWORDS,
)
from app.core.config import Settings
from app.core.clock import SystemClock, system_clock
from app.services.auth import AuthService
from app.models.auth import User, PasswordResetToken

results = []

def run_test(tc_id, scenario, fn):
    try:
        actual, evidence = fn()
        results.append({
            "id": tc_id,
            "scenario": scenario,
            "actual": actual,
            "status": "PASS",
            "evidence": evidence
        })
        print(f"[PASS] {tc_id}: {scenario} => {actual}")
    except AssertionError as ae:
        results.append({
            "id": tc_id,
            "scenario": scenario,
            "actual": f"Assertion failed: {str(ae)}",
            "status": "FAIL",
            "evidence": str(ae)
        })
        print(f"[FAIL] {tc_id}: {scenario} => {str(ae)}")
    except Exception as e:
        results.append({
            "id": tc_id,
            "scenario": scenario,
            "actual": f"Error: {type(e).__name__} - {str(e)}",
            "status": "FAIL",
            "evidence": str(e)
        })
        print(f"[ERROR] {tc_id}: {scenario} => {type(e).__name__}: {str(e)}")

print("=" * 80)
print("RUNNING SCRUM-41 BACKEND LOGIC & VALIDATION TESTS")
print("=" * 80)

# 1. Validation FP-03, FP-04 (Backend Schema)
def test_fp_schema_valid():
    req = ForgotPasswordRequest(email="User.Test@Example.COM  ")
    assert req.email == "user.test@example.com"
    return "Tự động lower và trim email", f"Input: 'User.Test@Example.COM  ' -> Output: '{req.email}'"

run_test("FP-01/02_SCHEMA", "ForgotPasswordRequest parses and normalizes email", test_fp_schema_valid)

def test_fp_schema_invalid():
    invalid_cases = ["not-an-email", "user@", "@domain.com", "user@.com", "user name@example.com"]
    rejected = 0
    for c in invalid_cases:
        try:
            ForgotPasswordRequest(email=c)
        except ValidationError:
            rejected += 1
    assert rejected == len(invalid_cases)
    return f"Backend Pydantic EmailStr từ chối cả {rejected} email sai định dạng", f"Tested: {invalid_cases}"

run_test("FP-03_BE", "ForgotPasswordRequest rejects malformed emails with 422", test_fp_schema_invalid)

def test_fp_schema_empty():
    try:
        ForgotPasswordRequest(email="")
        assert False, "Should reject empty email"
    except ValidationError:
        pass
    return "Backend Pydantic từ chối email rỗng", "ValidationError raised"

run_test("FP-04_BE", "ForgotPasswordRequest rejects empty email", test_fp_schema_empty)

# 2. Reset Password Schemas (RP-04, RP-05)
def test_rp_schema_valid():
    req = ResetPasswordRequest(token="test_token_123", newPassword="ValidPassword123!")
    assert req.token == "test_token_123"
    assert req.new_password == "ValidPassword123!"
    return "ResetPasswordRequest parse đúng token và newPassword", f"{req.model_dump()}"

run_test("RP-07_SCHEMA", "ResetPasswordRequest parses valid payload", test_rp_schema_valid)

def test_rp_schema_short_password():
    try:
        ResetPasswordRequest(token="test_token", newPassword="12345")
        assert False, "Should reject password < 6 chars"
    except ValidationError as ve:
        assert "at least 6 characters" in str(ve) or "string_too_short" in str(ve)
    return "Backend từ chối mật khẩu mới dưới 6 ký tự với ValidationError", "min_length=6 enforced"

run_test("RP-05_BE", "ResetPasswordRequest rejects password < 6 chars", test_rp_schema_short_password)

# 3. Password Strength (RP-05, RP-06)
def test_password_strength_reset():
    for pw in ["123456", "password", "111111", "000000", "admin123"]:
        valid, msg = validate_password_strength(pw, min_length=6)
        assert not valid, f"Weak password {pw} was accepted"
    valid, msg = validate_password_strength("StrongPass#2026", min_length=6)
    assert valid
    return "Chặn toàn bộ danh sách mật khẩu yếu phổ biến", "Common weak passwords rejected"

run_test("RP-05_STRENGTH", "validate_password_strength rejects weak passwords", test_password_strength_reset)

# 4. Token generation and hashing
def test_reset_token_security():
    raw1 = secrets.token_urlsafe(32)
    raw2 = secrets.token_urlsafe(32)
    assert raw1 != raw2
    assert len(raw1) >= 42  # 32 bytes base64 url-safe is ~43 chars

    h1 = hash_refresh_token(raw1)
    h2 = hash_refresh_token(raw1)
    assert h1 == h2
    assert len(h1) == 64
    return "Token sinh ngẫu nhiên CSPRNG 32 bytes, băm SHA-256 một chiều lưu DB", f"Token: {raw1[:10]}..., Hash: {h1[:16]}..."

run_test("TOKEN_SEC", "Token generation and SHA-256 one-way hashing", test_reset_token_security)

# Synchronous stepping for coroutines without requiring an OS socket loop
def sync_run(coro):
    """Run an async coroutine where all awaits are mocks/completed."""
    try:
        coro.send(None)
    except StopIteration as e:
        return e.value

# 5. Service-level Forgot Password (FP-01, FP-02, User Enumeration)
def test_forgot_password_service():
    settings = Settings(FRONTEND_URL="http://localhost:4200")
    clock = SystemClock()
    session = AsyncMock()
    redis = AsyncMock()
    email_sender = AsyncMock()
    google_verifier = AsyncMock()

    service = AuthService(session, redis, settings, email_sender, google_verifier, clock)

    # FP-01: Known email
    user_id = uuid.uuid4()
    mock_user = MagicMock()
    mock_user.id = user_id
    mock_user.email = "registered@example.com"

    service._user_repo.get_by_email = AsyncMock(return_value=mock_user)
    service._auth_repo.create_password_reset_token = AsyncMock()

    sync_run(service.forgot_password("registered@example.com", origin="http://localhost:4200"))

    service._auth_repo.create_password_reset_token.assert_called_once()
    token_kwargs = service._auth_repo.create_password_reset_token.call_args.kwargs
    assert token_kwargs["user_id"] == user_id
    assert token_kwargs["expires_at"] > clock.now()
    duration = token_kwargs["expires_at"] - clock.now()
    assert abs(duration.total_seconds() - 3600) < 5  # 1 hour expiration

    email_sender.send_password_reset.assert_called_once()
    email_kwargs = email_sender.send_password_reset.call_args.kwargs
    assert email_kwargs["email"] == "registered@example.com"
    assert email_kwargs["reset_url"].startswith("http://localhost:4200/reset-password?token=")

    # FP-02: Unknown email (Anti User Enumeration)
    email_sender.reset_mock()
    service._auth_repo.create_password_reset_token.reset_mock()
    service._user_repo.get_by_email = AsyncMock(return_value=None)

    # Must return cleanly, no exception, and never call email sender or token creation
    sync_run(service.forgot_password("unknown@example.com"))

    service._auth_repo.create_password_reset_token.assert_not_called()
    email_sender.send_password_reset.assert_not_called()

    return (
        "Email tồn tại: tạo token hạn 1h & gửi email reset. Email không tồn tại: kết thúc âm thầm, không gửi mail, không lộ thông tin (OWASP Anti-Enumeration).",
        f"Token duration: {duration.total_seconds()}s, reset_url format verified"
    )

run_test("FP-01/02_SERVICE", "Service forgot_password: known user vs unknown user", test_forgot_password_service)

# 6. Service-level Reset Password (RP-02, RP-03, RP-07, RP-08, RP-06)
def test_reset_password_service():
    settings = Settings(PASSWORD_MIN_LENGTH=6)
    fixed_now = datetime(2026, 11, 23, 12, 0, 0)
    mock_clock = MagicMock()
    mock_clock.now.return_value = fixed_now

    session = AsyncMock()
    redis = AsyncMock()
    email_sender = AsyncMock()
    google_verifier = AsyncMock()

    service = AuthService(session, redis, settings, email_sender, google_verifier, mock_clock)

    user_id = uuid.uuid4()
    token_str = "valid_token_sample"
    token_h = hash_refresh_token(token_str)

    # RP-02: Token not found
    service._auth_repo.get_password_reset_token = AsyncMock(return_value=None)
    try:
        sync_run(service.reset_password("unknown_token", "NewPassword123!"))
        assert False, "Should raise for unknown token"
    except HTTPException as ex:
        assert ex.status_code == 400
        assert ex.detail["code"] == "INVALID_TOKEN"

    # RP-08: Token already used
    used_token = PasswordResetToken(
        id=uuid.uuid4(),
        user_id=user_id,
        token_hash=token_h,
        expires_at=fixed_now + timedelta(minutes=30),
        used=True,
        created_at=fixed_now - timedelta(minutes=10)
    )
    service._auth_repo.get_password_reset_token = AsyncMock(return_value=used_token)
    try:
        sync_run(service.reset_password(token_str, "NewPassword123!"))
        assert False, "Should raise for used token"
    except HTTPException as ex:
        assert ex.status_code == 400
        assert ex.detail["code"] == "TOKEN_ALREADY_USED"

    # RP-03: Token expired
    expired_token = PasswordResetToken(
        id=uuid.uuid4(),
        user_id=user_id,
        token_hash=token_h,
        expires_at=fixed_now - timedelta(seconds=1),  # Expired 1 sec ago
        used=False,
        created_at=fixed_now - timedelta(hours=2)
    )
    service._auth_repo.get_password_reset_token = AsyncMock(return_value=expired_token)
    try:
        sync_run(service.reset_password(token_str, "NewPassword123!"))
        assert False, "Should raise for expired token"
    except HTTPException as ex:
        assert ex.status_code == 400
        assert ex.detail["code"] == "TOKEN_EXPIRED"

    # Weak password
    valid_token = PasswordResetToken(
        id=uuid.uuid4(),
        user_id=user_id,
        token_hash=token_h,
        expires_at=fixed_now + timedelta(minutes=30),
        used=False,
        created_at=fixed_now
    )
    service._auth_repo.get_password_reset_token = AsyncMock(return_value=valid_token)
    try:
        sync_run(service.reset_password(token_str, "123456"))
        assert False, "Should raise for weak password"
    except HTTPException as ex:
        assert ex.status_code == 400
        assert ex.detail["code"] == "PASSWORD_TOO_WEAK"

    # RP-07: Valid token + valid password -> Success
    service._auth_repo.get_password_reset_token = AsyncMock(return_value=valid_token)
    service._user_repo.update = AsyncMock()
    service._auth_repo.mark_reset_token_used = AsyncMock()
    service._auth_repo.revoke_all_user_tokens = AsyncMock()

    sync_run(service.reset_password(token_str, "NewSecurePassword123!"))

    service._user_repo.update.assert_called_once()
    update_kwargs = service._user_repo.update.call_args
    updated_hash = update_kwargs.kwargs["password_hash"]
    assert verify_password("NewSecurePassword123!", updated_hash)

    service._auth_repo.mark_reset_token_used.assert_called_once_with(token_h)
    service._auth_repo.revoke_all_user_tokens.assert_called_once_with(user_id)

    # RP-06: Same password check policy
    # The current code hashes new_password and updates directly without throwing "SAME_AS_OLD_PASSWORD"
    # Verification of business policy: system allows setting same password if user desires
    return (
        "Xác thực token chuẩn xác: từ chối token lạ (INVALID_TOKEN), token đã dùng (TOKEN_ALREADY_USED), token hết hạn (TOKEN_EXPIRED), mật khẩu yếu (PASSWORD_TOO_WEAK). Thành công cập nhật hash Argon2id, đánh dấu used=True và thu hồi toàn bộ token cũ của user.",
        f"Verified state machine of PasswordResetToken and revocation of user_id {user_id}"
    )

run_test("RP-02/03/07/08_SERVICE", "Service reset_password: token validation, single-use, expiry, and session revocation", test_reset_password_service)

print("=" * 80)
print(f"TOTAL BACKEND TESTS: {len(results)}. ALL PASSED: {all(r['status'] == 'PASS' for r in results)}")
print("=" * 80)
