"""
WebSocket connection manager for session-level push notifications.
Allows background jobs (such as feedback generation) to push notifications
(e.g., feedback.ready) to actively connected clients.
"""

import logging
import uuid
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class SessionConnectionManager:
    """Manages active WebSocket connections grouped by session_id."""

    def __init__(self) -> None:
        self._connections: dict[uuid.UUID, set[WebSocket]] = {}

    def register(self, session_id: uuid.UUID, websocket: WebSocket) -> None:
        """Register an active WebSocket for a session."""
        if session_id not in self._connections:
            self._connections[session_id] = set()
        self._connections[session_id].add(websocket)

    def unregister(self, session_id: uuid.UUID, websocket: WebSocket) -> None:
        """Unregister a disconnected WebSocket."""
        if session_id in self._connections:
            self._connections[session_id].discard(websocket)
            if not self._connections[session_id]:
                del self._connections[session_id]

    async def notify_session(self, session_id: uuid.UUID, message: dict[str, Any]) -> None:
        """Send a JSON notification to all active WebSockets for this session."""
        websockets = list(self._connections.get(session_id, []))
        for ws in websockets:
            try:
                await ws.send_json(message)
            except Exception as exc:
                logger.debug("Failed to push message to session %s: %s", session_id, exc)


session_ws_manager = SessionConnectionManager()
