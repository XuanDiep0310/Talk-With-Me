import time
from pathlib import Path
from typing import Protocol

from app.core.config import _BACKEND_DIR


class StorageProvider(Protocol):
    """Interface for binary blob storage (avatars, etc.)."""

    async def save_avatar(self, user_id: str, data: bytes, content_type: str) -> str:
        """Persist avatar data and return its public URL/path."""
        ...


class LocalStorageProvider:
    """Dev/test implementation: saves files to local disk under upload_dir/avatars/."""

    _EXT_MAP: dict[str, str] = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    }

    def __init__(self, upload_dir: str = "uploads") -> None:
        p = Path(upload_dir)
        if not p.is_absolute():
            p = _BACKEND_DIR / p
        self.base = p
        (self.base / "avatars").mkdir(parents=True, exist_ok=True)

    async def save_avatar(self, user_id: str, data: bytes, content_type: str) -> str:
        ext = self._EXT_MAP.get(content_type, "jpg")
        filename = f"{user_id}.{ext}"
        path = self.base / "avatars" / filename
        path.write_bytes(data)
        ts = int(time.time())
        return f"/api/v1/static/avatars/{filename}?t={ts}"
