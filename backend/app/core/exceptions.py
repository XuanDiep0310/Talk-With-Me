from typing import Any

from fastapi import HTTPException, status


class AppException(HTTPException):
    def __init__(
        self,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail: Any = None,
        headers: dict[str, str] | None = None,
    ):
        super().__init__(status_code=status_code, detail=detail, headers=headers)


class ServiceUnavailableException(AppException):
    def __init__(self, detail: str = "Service unavailable"):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=detail,
        )


class ProviderUnavailableError(AppException):
    """Raised when an external AI/Speech provider fails or is unconfigured."""

    def __init__(
        self,
        code: str = "PROVIDER_UNAVAILABLE",
        message: str = "Dịch vụ AI tạm thời không khả dụng. Vui lòng thử lại sau.",
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": code,
                "message": message,
                "details": details or {},
            },
        )
