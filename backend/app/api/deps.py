import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.core.providers.email_sender import (
    EmailSender,
    FakeEmailSender,
    SmtpEmailSender,
)
from app.core.providers.google_token_verifier import (
    FakeGoogleTokenVerifier,
    GoogleTokenVerifier,
    RealGoogleTokenVerifier,
)
from app.core.providers.storage_provider import (
    LocalStorageProvider,
    StorageProvider,
)
from app.core.redis import get_redis
from app.core.security import decode_access_token
from app.models.auth import User
from app.repositories.health import HealthRepository
from app.repositories.user import UserRepository
from app.services.auth import AuthService
from app.services.health import HealthService
from app.services.tts import TTSService
from app.services.user import UserService

bearer_scheme = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Core / Health dependencies
# ---------------------------------------------------------------------------


def get_health_repository(
    db_session: AsyncSession = Depends(get_db),
    redis_client: Redis = Depends(get_redis),
) -> HealthRepository:
    return HealthRepository(db_session=db_session, redis_client=redis_client)


def get_health_service(
    repository: HealthRepository = Depends(get_health_repository),
    settings: Settings = Depends(get_settings),
) -> HealthService:
    return HealthService(repository=repository, settings=settings)


def get_tts_service() -> TTSService:
    return TTSService()


# ---------------------------------------------------------------------------
# External Providers
# ---------------------------------------------------------------------------


def get_email_sender(settings: Settings = Depends(get_settings)) -> EmailSender:
    if settings.EMAIL_PROVIDER.lower() == "smtp" and settings.SMTP_HOST:
        pwd = settings.SMTP_PASSWORD.replace(" ", "") if settings.SMTP_PASSWORD else ""
        from_email = (
            settings.SMTP_USER
            if "gmail" in settings.SMTP_HOST.lower()
            else (settings.SMTP_FROM_EMAIL or settings.SMTP_USER)
        )
        return SmtpEmailSender(
            host=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=pwd,
            from_email=from_email,
            use_tls=settings.SMTP_TLS,
        )
    return FakeEmailSender()


def get_google_verifier(settings: Settings = Depends(get_settings)) -> GoogleTokenVerifier:
    if settings.GOOGLE_TOKEN_VERIFIER.lower() in ("google", "real") or settings.GOOGLE_CLIENT_ID:
        return RealGoogleTokenVerifier(client_id=settings.GOOGLE_CLIENT_ID)
    return FakeGoogleTokenVerifier()


def get_storage_provider(
    settings: Settings = Depends(get_settings),
) -> StorageProvider:
    return LocalStorageProvider(upload_dir=settings.UPLOAD_DIR)


# ---------------------------------------------------------------------------
# Auth & User Services
# ---------------------------------------------------------------------------


def get_auth_service(
    session: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
    settings: Settings = Depends(get_settings),
    email_sender: EmailSender = Depends(get_email_sender),
    google_verifier: GoogleTokenVerifier = Depends(get_google_verifier),
) -> AuthService:
    return AuthService(
        session=session,
        redis=redis,
        settings=settings,
        email_sender=email_sender,
        google_verifier=google_verifier,
    )


def get_user_service(
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    storage_provider: StorageProvider = Depends(get_storage_provider),
) -> UserService:
    return UserService(
        session=session,
        settings=settings,
        storage_provider=storage_provider,
    )


# ---------------------------------------------------------------------------
# Current User Dependency
# ---------------------------------------------------------------------------


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "UNAUTHORIZED",
                "message": "Authentication credentials were not provided.",
                "details": {},
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(
            token=credentials.credentials,
            secret=settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )
        user_id_raw = payload.get("sub")
        if not user_id_raw:
            raise ValueError("Token missing subject")
        user_id = uuid.UUID(str(user_id_raw))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_TOKEN",
                "message": "Access token is invalid or expired.",
                "details": {},
            },
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_repo = UserRepository(session)
    user = await user_repo.get_by_id(user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "USER_NOT_FOUND",
                "message": "User not found or account is deactivated.",
                "details": {},
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user
