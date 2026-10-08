"""
Global exception handlers and trace-ID middleware for FastAPI.

All error responses follow the unified format:
  {"code": "SNAKE_UPPER", "message": "...", "traceId": "...", "details": {}}
"""

import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


def _error_response(
    status_code: int,
    code: str,
    message: str,
    trace_id: str,
    details: dict[str, object] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "code": code,
            "message": message,
            "traceId": trace_id,
            "details": details or {},
        },
    )


def _get_trace_id(request: Request) -> str:
    return getattr(request.state, "trace_id", str(uuid.uuid4()))


def register_exception_handlers(app: FastAPI) -> None:
    """Register all global exception handlers on the app."""

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        trace_id = _get_trace_id(request)
        return _error_response(
            status_code=422,
            code="VALIDATION_ERROR",
            message="Request validation failed.",
            trace_id=trace_id,
            details={"errors": exc.errors()},
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        trace_id = _get_trace_id(request)
        # Try to extract a structured detail if it was already set
        detail = exc.detail
        details: dict[str, object] = {}
        if isinstance(detail, dict):
            code = str(detail.get("code", "HTTP_ERROR"))
            message = str(detail.get("message", str(exc.detail)))
            details_raw = detail.get("details", {})
            if isinstance(details_raw, dict):
                details = details_raw
        else:
            code = f"HTTP_{exc.status_code}"
            message = str(detail) if detail else "An error occurred."
        return _error_response(
            status_code=exc.status_code,
            code=code,
            message=message,
            trace_id=trace_id,
            details=details,
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, _exc: Exception) -> JSONResponse:
        import logging

        trace_id = _get_trace_id(request)
        logging.getLogger(__name__).exception("Unhandled exception", extra={"traceId": trace_id})
        return _error_response(
            status_code=500,
            code="INTERNAL_SERVER_ERROR",
            message="An unexpected error occurred.",
            trace_id=trace_id,
        )


def register_trace_middleware(app: FastAPI) -> None:
    """Attach X-Trace-Id header to every request/response."""

    @app.middleware("http")
    async def trace_middleware(request: Request, call_next):  # type: ignore[no-untyped-def]
        trace_id = request.headers.get("X-Trace-Id") or str(uuid.uuid4())
        request.state.trace_id = trace_id
        response = await call_next(request)
        response.headers["X-Trace-Id"] = trace_id
        return response
