from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

_CORE_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _CORE_DIR.parent.parent
_ROOT_DIR = _BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_BACKEND_DIR / ".env", _ROOT_DIR / ".env", ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "Talk-With-Me API"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: Literal["development", "staging", "production", "test"] = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # Frontend application URL (used for password reset emails, CORS)
    FRONTEND_URL: str = "http://localhost:4200"

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:4200",
        "http://127.0.0.1:4200",
        "http://localhost:80",
        "http://localhost",
        "https://talkwithmee.vercel.app",
        "https://talkwithmee-dev.vercel.app",
    ]

    # Database (PostgreSQL)
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "talkwithme"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_ECHO: bool = False

    @computed_field  # type: ignore[prop-decorator]
    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # Cache (Redis)
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""
    REDIS_DB: int = 0

    @computed_field  # type: ignore[prop-decorator]
    @property
    def REDIS_URL(self) -> str:
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    # JWT
    JWT_SECRET_KEY: str = "change-me-in-production-use-long-random-string"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    REFRESH_TOKEN_REMEMBER_DAYS: int = 30  # When "remember me" is checked
    REFRESH_TOKEN_NO_REMEMBER_DAYS: int = 1  # When "remember me" is unchecked

    # Auth
    PASSWORD_MIN_LENGTH: int = 6
    LOGIN_MAX_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_MINUTES: int = 15

    # Avatar
    AVATAR_MAX_BYTES: int = 2 * 1024 * 1024  # 2 MB
    AVATAR_ALLOWED_TYPES: list[str] = ["image/jpeg", "image/png", "image/webp"]
    UPLOAD_DIR: str = "uploads"

    # Email (Fake by default for dev)
    EMAIL_PROVIDER: str = "fake"  # "fake" | "smtp"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_TLS: bool = True

    # Google OAuth
    GOOGLE_TOKEN_VERIFIER: str = "fake"  # "fake" | "real"
    GOOGLE_CLIENT_ID: str = ""

    # Storage
    STORAGE_PROVIDER: str = "local"  # "local" | "s3"

    # STT (Speech-to-Text)
    STT_PROVIDER: str = "fake"  # "fake" | "groq" | "deepgram" | "google" | "azure"
    DEEPGRAM_API_KEY: str = ""
    GROQ_API_KEY: str = ""

    # Coach Session & Turn-Taking
    SESSION_RECONNECT_TIMEOUT_SECONDS: int = 60
    TURN_TAKING_SILENCE_MS: int = 1500
    WS_TICKET_EXPIRE_SECONDS: int = 30

    # LLM provider for placement level evaluation and AI Coach
    LLM_PROVIDER: str = "fake"  # "fake" | "openai" | "gemini"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gemini-1.5-flash"

    # Placement Test thresholds
    # Minimum answers required before we attempt level estimation
    PLACEMENT_MIN_ANSWERS: int = 3
    # Minimum total word count across all answers
    PLACEMENT_MIN_WORDS: int = 30
    # Level score thresholds (inclusive lower bound for each level)
    # Score range is 0.0–1.0; A1 is the fallback (< A2_THRESHOLD)
    PLACEMENT_A2_THRESHOLD: float = 0.20
    PLACEMENT_B1_THRESHOLD: float = 0.40
    PLACEMENT_B2_THRESHOLD: float = 0.60
    PLACEMENT_C1_THRESHOLD: float = 0.80


@lru_cache
def get_settings() -> Settings:
    return Settings()
