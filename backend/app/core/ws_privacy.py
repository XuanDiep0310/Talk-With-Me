"""Keep practice socket tickets out of the ASGI server's access messages."""

from starlette.types import ASGIApp, Receive, Scope, Send


class PracticeSocketQueryPrivacy:
    def __init__(self, app: ASGIApp, practice_prefix: str) -> None:
        self.app = app
        self.practice_prefix = practice_prefix

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "websocket" and scope["path"].startswith(self.practice_prefix):
            request_scope = dict(scope)
            # The server logs its original scope. The router still needs the one-time ticket.
            scope["query_string"] = b""
            await self.app(request_scope, receive, send)
            return
        await self.app(scope, receive, send)
