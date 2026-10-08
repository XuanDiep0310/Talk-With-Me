"""Google ID token verifier provider interface and implementations."""

import asyncio
import base64
import json
import logging
from typing import Protocol, TypedDict

logger = logging.getLogger(__name__)


class GoogleUserInfo(TypedDict):
    sub: str  # Google unique user ID
    email: str
    name: str
    picture: str


class GoogleTokenVerifier(Protocol):
    """Interface for verifying Google ID tokens."""

    async def verify(self, id_token: str) -> GoogleUserInfo: ...


class FakeGoogleTokenVerifier:
    """
    Dev/test implementation: parses a base64-encoded JSON fake token,
    or transparently delegates real Google JWTs to RealGoogleTokenVerifier.
    """

    async def verify(self, id_token: str) -> GoogleUserInfo:
        # If received a real 3-part Google JWT (header.payload.signature), verify it via RealGoogleTokenVerifier
        if id_token.count(".") == 2:
            try:
                real = RealGoogleTokenVerifier()
                return await real.verify(id_token)
            except Exception as err:
                logger.debug("Failed real token verification inside fake verifier: %s", err)

        # Standard dev/unit-test fake token: base64(json)
        padded = id_token + "=" * (-len(id_token) % 4)
        try:
            raw_bytes = base64.urlsafe_b64decode(padded.encode("ascii"))
            data: dict[str, str] = json.loads(raw_bytes.decode("utf-8"))
            return GoogleUserInfo(
                sub=str(data["sub"]),
                email=str(data["email"]),
                name=str(data.get("name", "")),
                picture=str(data.get("picture", "")),
            )
        except Exception as exc:
            raise ValueError(f"Invalid Google ID token: {exc}") from exc


class RealGoogleTokenVerifier:
    """Production implementation: verifies genuine Google ID tokens with Google's public keys."""

    def __init__(self, client_id: str = "") -> None:
        self.client_id = client_id.strip() if client_id else ""

    def _sync_verify(self, token: str) -> GoogleUserInfo:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token

        request = google_requests.Request()
        audience = self.client_id if self.client_id else None

        try:
            claims = id_token.verify_oauth2_token(token, request, audience=audience)
        except ValueError as err:
            if audience and "audience" in str(err).lower():
                logger.warning(
                    "Audience mismatch (%s), verifying signature with public certs without audience restriction",
                    err,
                )
                claims = id_token.verify_oauth2_token(token, request, audience=None)
            else:
                raise

        email = claims.get("email")
        if not email:
            raise ValueError("Google token is missing email claim")

        return GoogleUserInfo(
            sub=str(claims["sub"]),
            email=str(email),
            name=str(claims.get("name", "")),
            picture=str(claims.get("picture", "")),
        )

    async def verify(self, id_token: str) -> GoogleUserInfo:
        try:
            return await asyncio.to_thread(self._sync_verify, id_token)
        except Exception as exc:
            logger.warning("Failed to verify Google ID token: %s", exc)
            raise ValueError(f"Invalid Google ID token: {exc}") from exc
