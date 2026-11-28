from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import model_validator
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
    DATABASE_URL: str = ""
    POSTGRES_URL: str = ""
    DATABASE_URI: str = ""
    DB_URL: str = ""

    # Cache (Redis)
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""
    REDIS_DB: int = 0
    REDIS_URL: str = ""
    REDIS_URI: str = ""
    UPSTASH_REDIS_URL: str = ""

    @model_validator(mode="after")
    def _assemble_database_and_redis_urls(self) -> "Settings":
        raw_db_url = self.DATABASE_URL or self.POSTGRES_URL or self.DATABASE_URI or self.DB_URL
        if not raw_db_url:
            from urllib.parse import quote_plus

            enc_pass = quote_plus(self.POSTGRES_PASSWORD) if self.POSTGRES_PASSWORD else ""
            self.DATABASE_URL = (
                f"postgresql+asyncpg://{self.POSTGRES_USER}:{enc_pass}"
                f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            )
        else:
            url = raw_db_url.strip().strip("'").strip('"')
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+asyncpg://", 1)
            elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

            # Safely handle unencoded special characters in password (especially @, #, $, etc.)
            try:
                if "://" in url and "@" in url:
                    scheme, rest = url.split("://", 1)
                    # The host is always after the LAST '@'
                    auth_part, host_part = rest.rsplit("@", 1)
                    if ":" in auth_part:
                        user_part, pass_part = auth_part.split(":", 1)
                        from urllib.parse import quote_plus, unquote_plus

                        raw_pass = unquote_plus(pass_part)
                        encoded_pass = quote_plus(raw_pass)
                        url = f"{scheme}://{user_part}:{encoded_pass}@{host_part}"
            except Exception:
                pass

            self.DATABASE_URL = url

        raw_redis_url = self.REDIS_URL or self.REDIS_URI or self.UPSTASH_REDIS_URL
        if not raw_redis_url:
            if self.REDIS_PASSWORD:
                self.REDIS_URL = f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
            else:
                self.REDIS_URL = f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        else:
            self.REDIS_URL = raw_redis_url.strip().strip("'").strip('"')
        return self

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

    # Email
    EMAIL_PROVIDER: str = "smtp"  # "smtp" (fake only via test overrides)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_TLS: bool = True

    # Google OAuth
    GOOGLE_TOKEN_VERIFIER: str = "real"
    GOOGLE_CLIENT_ID: str = ""

    # Storage
    STORAGE_PROVIDER: str = "local"  # "local" | "s3"

    # Azure AI Speech (Unified STT + Pronunciation Assessment)
    SPEECH_ASSESSMENT_PROVIDER: str = "azure_sdk"  # "azure_sdk" | "azure_rest"
    AZURE_SPEECH_KEY: str = ""
    AZURE_SPEECH_REGION: str = ""
    AZURE_SPEECH_LANGUAGE: str = "en-US"

    # Text-to-Speech
    TTS_PROVIDER: str = "azure"

    # Coach Session & Turn-Taking
    SESSION_RECONNECT_TIMEOUT_SECONDS: int = 60
    TURN_TAKING_SILENCE_MS: int = 1300
    WS_TICKET_EXPIRE_SECONDS: int = 30

    # LLM provider (gemini | groq | cerebras | openrouter | openai | openai_compatible)
    LLM_PROVIDER: str = "gemini"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gemini-2.5-flash"
    LLM_BASE_URL: str = ""
    LLM_FALLBACK_PROVIDER: str = ""
    LLM_FALLBACK_API_KEY: str = ""
    LLM_FALLBACK_MODEL: str = ""
    LLM_FALLBACK_BASE_URL: str = ""

    # Placement Test thresholds
    PLACEMENT_MIN_STAGE1_PROMPTS: int = 2
    PLACEMENT_MIN_ANSWERS: int = 2
    PLACEMENT_MIN_WORDS: int = 25
    PLACEMENT_A2_THRESHOLD: float = 0.25
    PLACEMENT_B1_THRESHOLD: float = 0.45
    PLACEMENT_B2_THRESHOLD: float = 0.65
    PLACEMENT_C1_THRESHOLD: float = 0.82

    # Scoring Engine v2.0.0 & Longitudinal CEFR Model
    SCORING_FORMULA_VERSION: str = "2.0.0"
    CEFR_MODEL_VERSION: str = "cefr-est-1.0.0"
    SCORING_MIN_USER_WORDS: int = 5
    SCORING_MIN_USER_TURNS: int = 1
    SCORING_MIN_SPOKEN_SECONDS: float = 4.0
    CONTINUITY_TARGET_RATIO: float = 0.85
    PAUSE_THRESHOLD_MS: int = 1500
    PAUSE_PENALTY_PER_MIN: float = 12.0
    FILLER_PENALTY_PER_100: float = 8.0
    MTLD_FACTOR_THRESHOLD: float = 0.72
    MTLD_TARGET_BENCHMARK: float = 50.0
    MTLD_MIN_WORDS: int = 10
    SPEED_GRACE_PERIOD_SECONDS: float = 2.0
    SPEED_PENALTY_PER_SECOND: float = 12.0
    ARQ_MODE: str = (
        "eager"  # "eager" (in-process background task for tests/dev) | "arq" (redis queue)
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
