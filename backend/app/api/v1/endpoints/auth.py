"""
Authentication endpoints: register, login, google login, token refresh, logout, password reset.
"""

from fastapi import APIRouter, Depends, Request, status

from app.api.deps import get_auth_service
from app.core.config import Settings, get_settings
from app.models.schemas import (
    ForgotPasswordRequest,
    GoogleLoginRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
async def register(
    body: RegisterRequest,
    auth_service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    _user, access_token, refresh_token = await auth_service.register(
        email=body.email,
        full_name=body.full_name,
        password=body.password,
        terms_accepted=body.terms_accepted,
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Login with email and password",
)
async def login(
    body: LoginRequest,
    request: Request,
    auth_service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    client_ip = request.client.host if request.client else "unknown"
    access_token, refresh_token = await auth_service.login(
        email=body.email,
        password=body.password,
        remember_me=body.remember_me,
        client_ip=client_ip,
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post(
    "/google",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate via Google ID token",
)
async def login_google(
    body: GoogleLoginRequest,
    auth_service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    access_token, refresh_token, _is_new = await auth_service.login_google(
        id_token=body.id_token
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Rotate refresh token and issue new access token",
)
async def refresh(
    body: RefreshRequest,
    auth_service: AuthService = Depends(get_auth_service),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    new_access, new_refresh = await auth_service.refresh_tokens(body.refresh_token)
    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Revoke refresh token and log out",
)
async def logout(
    body: LogoutRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> dict[str, str]:
    await auth_service.logout(body.refresh_token)
    return {"message": "Logged out successfully"}


@router.post(
    "/forgot-password",
    status_code=status.HTTP_200_OK,
    summary="Request a password reset link (always returns 200)",
)
async def forgot_password(
    body: ForgotPasswordRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> dict[str, str]:
    await auth_service.forgot_password(body.email)
    return {
        "message": "If the email is registered, a password reset link has been sent."
    }


@router.post(
    "/reset-password",
    status_code=status.HTTP_200_OK,
    summary="Reset password using token",
)
async def reset_password(
    body: ResetPasswordRequest,
    auth_service: AuthService = Depends(get_auth_service),
) -> dict[str, str]:
    await auth_service.reset_password(body.token, body.new_password)
    return {"message": "Password has been reset successfully."}
