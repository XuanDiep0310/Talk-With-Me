"""Email sender provider interface and implementations."""

import asyncio
import logging
import smtplib
from email.message import EmailMessage
from typing import Protocol

logger = logging.getLogger(__name__)


class EmailSender(Protocol):
    """Interface for email sending providers."""

    async def send_password_reset(self, email: str, token: str, reset_url: str) -> None: ...


class FakeEmailSender:
    """Dev/test implementation: logs to stdout only, never sends real email."""

    async def send_password_reset(self, email: str, token: str, reset_url: str) -> None:
        logger.info("[FAKE EMAIL] Reset token for %s: %s (url: %s)", email, token, reset_url)
        print(
            f"\n======================================================\n"
            f"📧 [FAKE EMAIL SENDER] Password reset requested\n"
            f"Recipient: {email}\n"
            f"Token:     {token}\n"
            f"Reset URL: {reset_url}\n"
            f"======================================================\n",
            flush=True,
        )


class SmtpEmailSender:
    """Production implementation: sends real emails via SMTP (e.g. Gmail, SendGrid, Amazon SES)."""

    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        from_email: str,
        use_tls: bool = True,
    ) -> None:
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.from_email = from_email or username
        self.use_tls = use_tls

    def _sync_send(self, msg: EmailMessage) -> None:
        if self.use_tls:
            server = smtplib.SMTP(self.host, self.port, timeout=15)
            try:
                server.starttls()
                if self.username and self.password:
                    server.login(self.username, self.password)
                server.send_message(msg)
            finally:
                server.quit()
        else:
            with smtplib.SMTP(self.host, self.port, timeout=15) as server:
                if self.username and self.password:
                    server.login(self.username, self.password)
                server.send_message(msg)

    async def send_password_reset(self, email: str, token: str, reset_url: str) -> None:
        msg = EmailMessage()
        msg["Subject"] = "[TalkWithMe] Đặt lại mật khẩu tài khoản"
        msg["From"] = self.from_email
        msg["To"] = email

        msg.set_content(
            f"Chào bạn,\n\n"
            f"Bạn đã yêu cầu đặt lại mật khẩu trên TalkWithMe.\n"
            f"Vui lòng nhấn vào đường dẫn dưới đây hoặc sao chép vào trình duyệt để đặt lại mật khẩu:\n\n"
            f"{reset_url}\n\n"
            f"Mã token của bạn: {token}\n\n"
            f"Liên kết này sẽ hết hạn trong 1 giờ.\n"
            f"Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.\n\n"
            f"Trân trọng,\nĐội ngũ TalkWithMe"
        )

        try:
            await asyncio.to_thread(self._sync_send, msg)
            logger.info("Successfully sent password reset email to %s", email)
        except Exception as exc:
            logger.error("Failed to send email to %s via SMTP: %s", email, exc)
            raise
