from datetime import UTC, datetime

from pydantic import BaseModel, Field


class ServiceHealthResponse(BaseModel):
    service: str = Field(..., description="Service name")
    status: str = Field(..., description="Status: 'ok', 'healthy', or 'unhealthy'")
    latency_ms: float | None = Field(None, description="Response latency in milliseconds")
    details: str | None = Field(None, description="Additional context or error message")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="UTC Timestamp"
    )


class AppHealthResponse(BaseModel):
    app_name: str
    version: str
    environment: str
    status: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
