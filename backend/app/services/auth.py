"""
Auth service: registration, login, token refresh, logout, password reset, Google OAuth.

All time calls go through an injected Clock (AGENTS.md §6).
"""

import logging
import secrets
import uuid
from datetime import timedelta

from fastapi import HTTPException
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import Clock, system_clock
from app.core.config import Settings
from app.core.providers.email_sender import EmailSender
from app.core.providers.google_token_verifier import GoogleTokenVerifier
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    validate_password_strength,
    verify_password,
)
from app.models.auth import User, UserProfile, UserSettings
from app.repositories.auth import AuthRepository
from app.repositories.user import UserRepository

logger = logging.getLogger(__name__)
_RATE_LIMIT_KEY = "rate_limit:login:{email}:{ip}"


class AuthService:
    def __init__(
        self,
        session: AsyncSession,
        redis: Redis,
        settings: Settings,
        email_sender: EmailSender,
        google_verifier: GoogleTokenVerifier,
        clock: Clock = system_clock,
    ) -> None:
        self._user_repo = UserRepository(session)
        self._auth_repo = AuthRepository(session)
        self._session = session
        self._redis = redis
        self._settings = settings
        self._email_sender = email_sender
        self._google_verifier = google_verifier
        self._clock = clock

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _make_access_token(self, user_id: str) -> str:
        return create_access_token(
            payload={"sub": user_id},
            expires_delta=timedelta(minutes=self._settings.ACCESS_TOKEN_EXPIRE_MINUTES),
            secret=self._settings.JWT_SECRET_KEY,
            algorithm=self._settings.JWT_ALGORITHM,
        )

    async def _make_refresh_token(
        self,
        user_id: uuid.UUID,
        remember_me: bool = True,
    ) -> str:

        days = (
            self._settings.REFRESH_TOKEN_REMEMBER_DAYS
            if remember_me
            else self._settings.REFRESH_TOKEN_NO_REMEMBER_DAYS
        )
        raw = generate_refresh_token()
        token_hash = hash_refresh_token(raw)
        now = self._clock.now()
        await self._auth_repo.create_refresh_token(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=now + timedelta(days=days),
            created_at=now,
        )
        return raw

    async def _check_rate_limit(self, email: str, client_ip: str) -> None:
        key = _RATE_LIMIT_KEY.format(email=email, ip=client_ip)
        count_raw = await self._redis.get(key)
        count = int(count_raw) if count_raw else 0
        if count >= self._settings.LOGIN_MAX_ATTEMPTS:
            ttl = await self._redis.ttl(key)
            raise HTTPException(
                status_code=429,
                detail={
                    "code": "TOO_MANY_REQUESTS",
                    "message": "Too many failed login attempts. Please try again later.",
                    "details": {"retryAfter": max(ttl, 0)},
                },
            )

    async def _increment_rate_limit(self, email: str, client_ip: str) -> None:
        key = _RATE_LIMIT_KEY.format(email=email, ip=client_ip)
        pipe = self._redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, self._settings.LOGIN_LOCKOUT_MINUTES * 60)
        await pipe.execute()

    async def _reset_rate_limit(self, email: str, client_ip: str) -> None:
        key = _RATE_LIMIT_KEY.format(email=email, ip=client_ip)
        await self._redis.delete(key)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def register(
        self,
        email: str,
        full_name: str,
        password: str,
        terms_accepted: bool,
    ) -> tuple[User, str, str]:
        """Create a new account and return (user, access_token, refresh_token)."""
        if not terms_accepted:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "TERMS_NOT_ACCEPTED",
                    "message": "You must accept the terms of service to register.",
                    "details": {},
                },
            )

        normalized = email.lower().strip()
        existing = await self._user_repo.get_by_email(normalized)
        if existing is not None:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "EMAIL_ALREADY_EXISTS",
                    "message": "An account with this email already exists.",
                    "details": {},
                },
            )

        if len(password) < self._settings.PASSWORD_MIN_LENGTH:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "VALIDATION_ERROR",
                    "message": f"Password must be at least {self._settings.PASSWORD_MIN_LENGTH} characters.",
                    "details": {},
                },
            )

        is_valid, error_msg = validate_password_strength(password, self._settings.PASSWORD_MIN_LENGTH)
        if not is_valid:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "PASSWORD_TOO_WEAK",
                    "message": error_msg or "Mật khẩu không đạt yêu cầu bảo mật.",
                    "details": {},
                },
            )

        pw_hash = hash_password(password)

        # Create user + profile + settings in one transaction
        user = await self._user_repo.create(
            email=normalized,
            full_name=full_name,
            password_hash=pw_hash,
        )
        self._session.add(UserProfile(user_id=user.id))
        self._session.add(UserSettings(user_id=user.id))
        await self._session.flush()

        access_token = self._make_access_token(str(user.id))
        refresh_token = await self._make_refresh_token(user.id, remember_me=True)
        return user, access_token, refresh_token

    async def login(
        self,
        email: str,
        password: str,
        remember_me: bool,
        client_ip: str,
    ) -> tuple[str, str]:
        """Authenticate with email/password and return (access_token, refresh_token)."""
        normalized = email.lower().strip()

        await self._check_rate_limit(normalized, client_ip)

        user = await self._user_repo.get_by_email(normalized)
        if user is None or user.password_hash is None or not verify_password(password, user.password_hash):
            await self._increment_rate_limit(normalized, client_ip)
            raise HTTPException(
                status_code=401,
                detail={
                    "code": "INVALID_CREDENTIALS",
                    "message": "Invalid email or password.",
                    "details": {},
                },
            )

        if not user.is_active:
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "ACCOUNT_INACTIVE",
                    "message": "Your account has been deactivated.",
                    "details": {},
                },
            )

        await self._reset_rate_limit(normalized, client_ip)

        access_token = self._make_access_token(str(user.id))
        refresh_token = await self._make_refresh_token(user.id, remember_me=remember_me)
        return access_token, refresh_token

    async def login_google(
        self, id_token: str
    ) -> tuple[str, str, bool]:
        """OAuth login via Google. Returns (access_token, refresh_token, is_new_user)."""
        try:
            google_info = await self._google_verifier.verify(id_token)
        except Exception as exc:
            logger.warning("Google login verification failed: %s", exc)
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INVALID_GOOGLE_TOKEN",
                    "message": "Mã xác thực Google không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
                    "details": {"error": str(exc)},
                },
            ) from exc

        provider_uid = google_info["sub"]
        provider_email = google_info["email"].lower()

        is_new_user = False

        identity = await self._auth_repo.get_identity("google", provider_uid)
        if identity is not None:
            user = await self._user_repo.get_by_id(identity.user_id)
            if user is None or not user.is_active:
                raise HTTPException(
                    status_code=403,
                    detail={
                        "code": "ACCOUNT_INACTIVE",
                        "message": "Your account has been deactivated.",
                        "details": {},
                    },
                )
        else:
            # Try linking by matching email
            user = await self._user_repo.get_by_email(provider_email)
            if user is None:
                # Brand new user via Google
                user = await self._user_repo.create(
                    email=provider_email,
                    full_name=google_info.get("name") or provider_email,
                    password_hash=None,
                )
                self._session.add(UserProfile(user_id=user.id))
                self._session.add(UserSettings(user_id=user.id))
                await self._session.flush()
                is_new_user = True

            # Create identity record (new or linked)
            await self._auth_repo.create_identity(
                user_id=user.id,
                provider="google",
                provider_user_id=provider_uid,
                provider_email=provider_email,
            )

        access_token = self._make_access_token(str(user.id))
        refresh_token = await self._make_refresh_token(user.id, remember_me=True)
        return access_token, refresh_token, is_new_user

    async def refresh_tokens(self, refresh_token_str: str) -> tuple[str, str]:
        """Rotate refresh token. Detects reuse and revokes entire chain on abuse."""
        token_hash = hash_refresh_token(refresh_token_str)
        record = await self._auth_repo.get_refresh_token_by_hash(token_hash)

        if record is None:
            raise HTTPException(
                status_code=401,
                detail={
                    "code": "INVALID_TOKEN",
                    "message": "Refresh token not found.",
                    "details": {},
                },
            )

        if record.revoked:
            # Token reuse detected — revoke entire chain for this user
            await self._auth_repo.revoke_all_user_tokens(record.user_id)
            raise HTTPException(
                status_code=401,
                detail={
                    "code": "TOKEN_REUSE_DETECTED",
                    "message": "Possible token theft detected. All sessions have been revoked.",
                    "details": {},
                },
            )

        now = self._clock.now()
        if record.expires_at.replace(tzinfo=None) < now.replace(tzinfo=None):
            raise HTTPException(
                status_code=401,
                detail={
                    "code": "TOKEN_EXPIRED",
                    "message": "Refresh token has expired. Please log in again.",
                    "details": {},
                },
            )

        # Issue new tokens
        new_access = self._make_access_token(str(record.user_id))
        new_raw_refresh = generate_refresh_token()
        new_hash = hash_refresh_token(new_raw_refresh)

        days = self._settings.REFRESH_TOKEN_REMEMBER_DAYS
        await self._auth_repo.create_refresh_token(
            user_id=record.user_id,
            token_hash=new_hash,
            expires_at=now + timedelta(days=days),
            created_at=now,
        )
        # Revoke old token, record what replaced it
        await self._auth_repo.revoke_refresh_token(token_hash, replaced_by_hash=new_hash)

        return new_access, new_raw_refresh

    async def logout(self, refresh_token_str: str) -> None:
        """Revoke a single refresh token."""
        token_hash = hash_refresh_token(refresh_token_str)
        await self._auth_repo.revoke_refresh_token(token_hash)

    async def forgot_password(self, email: str) -> None:
        """
        Initiate password reset flow.
        Always returns successfully to avoid leaking whether an email is registered (D-18).
        """
        normalized = email.lower().strip()
        user = await self._user_repo.get_by_email(normalized)
        if user is None:
            return  # Silently ignore unknown emails

        raw_token = secrets.token_urlsafe(32)
        token_hash = hash_refresh_token(raw_token)  # SHA-256 reuse is intentional
        now = self._clock.now()
        await self._auth_repo.create_password_reset_token(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=now + timedelta(hours=1),
            created_at=now,
        )

        reset_url = f"http://localhost:4200/reset-password?token={raw_token}"
        await self._email_sender.send_password_reset(
            email=normalized,
            token=raw_token,
            reset_url=reset_url,
        )

    async def reset_password(self, token_str: str, new_password: str) -> None:
        """Validate reset token and update the user's password."""
        token_hash = hash_refresh_token(token_str)
        record = await self._auth_repo.get_password_reset_token(token_hash)

        if record is None:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INVALID_TOKEN",
                    "message": "Invalid or expired password reset token.",
                    "details": {},
                },
            )

        if record.used:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "TOKEN_ALREADY_USED",
                    "message": "This reset token has already been used.",
                    "details": {},
                },
            )

        now = self._clock.now()
        if record.expires_at.replace(tzinfo=None) < now.replace(tzinfo=None):
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "TOKEN_EXPIRED",
                    "message": "This reset token has expired.",
                    "details": {},
                },
            )

        if len(new_password) < self._settings.PASSWORD_MIN_LENGTH:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "VALIDATION_ERROR",
                    "message": f"Password must be at least {self._settings.PASSWORD_MIN_LENGTH} characters.",
                    "details": {},
                },
            )

        is_valid, error_msg = validate_password_strength(new_password, self._settings.PASSWORD_MIN_LENGTH)
        if not is_valid:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "PASSWORD_TOO_WEAK",
                    "message": error_msg or "Mật khẩu không đạt yêu cầu bảo mật.",
                    "details": {},
                },
            )

        pw_hash = hash_password(new_password)
        await self._user_repo.update(record.user_id, password_hash=pw_hash)
        await self._auth_repo.mark_reset_token_used(token_hash)
        # Invalidate all sessions after password change
        await self._auth_repo.revoke_all_user_tokens(record.user_id)
