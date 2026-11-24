"""Encode stable, opaque keyset pagination boundaries."""

import base64
import binascii
import json
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException


def encode_cursor(at: datetime, item_id: uuid.UUID, source: str = "") -> str:
    raw = json.dumps([at.isoformat(), str(item_id), source]).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID, str]:
    try:
        at, item_id, source = json.loads(
            base64.b64decode(cursor + "=" * (-len(cursor) % 4), altchars=b"-_", validate=True)
        )
        if not isinstance(source, str):
            raise ValueError("Invalid source.")
        boundary = datetime.fromisoformat(at)
        return (
            boundary.replace(tzinfo=UTC) if boundary.tzinfo is None else boundary,
            uuid.UUID(item_id),
            source,
        )
    except (ValueError, TypeError, AttributeError, binascii.Error) as exc:
        raise HTTPException(
            422, detail={"code": "INVALID_CURSOR", "message": "Invalid cursor."}
        ) from exc
