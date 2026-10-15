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

        plain_text = (
            f"Chào bạn,\n\n"
            f"Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản TalkWithMe ({email}).\n"
            f"Vui lòng nhấn vào đường dẫn dưới đây hoặc sao chép vào trình duyệt để đặt lại mật khẩu:\n\n"
            f"{reset_url}\n\n"
            f"Mã token xác thực: {token}\n\n"
            f"Liên kết này chỉ có hiệu lực trong vòng 60 phút.\n"
            f"Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email. Mật khẩu hiện tại của bạn vẫn an toàn.\n\n"
            f"Trân trọng,\nĐội ngũ TalkWithMe"
        )
        msg.set_content(plain_text)

        html_content = f"""<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Đặt lại mật khẩu TalkWithMe</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02); border: 1px solid #e2e8f0;">

          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); padding: 32px 28px; text-align: center;">
              <div style="display: inline-block; width: 52px; height: 52px; line-height: 52px; border-radius: 14px; background-color: rgba(255, 255, 255, 0.2); font-size: 26px; margin-bottom: 10px;">
                🎙️
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
                TalkWithMe
              </h1>
              <p style="margin: 6px 0 0; color: #e0f2fe; font-size: 13px; font-weight: 500;">
                Nền tảng luyện nói tiếng Anh Communication-First
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 28px 24px;">
              <h2 style="margin: 0 0 14px; color: #0f172a; font-size: 18px; font-weight: 700;">
                Yêu cầu đặt lại mật khẩu
              </h2>

              <p style="margin: 0 0 14px; font-size: 14px; color: #334155;">
                Xin chào,
              </p>

              <p style="margin: 0 0 20px; font-size: 14px; color: #334155; line-height: 1.6;">
                Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản TalkWithMe của bạn (<strong style="color: #0369a1;">{email}</strong>). Vui lòng nhấn vào nút bên dưới để tạo mật khẩu mới:
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
                <tr>
                  <td align="center">
                    <a href="{reset_url}" target="_blank" style="display: inline-block; background-color: #0284c7; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 13px 32px; border-radius: 12px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35); text-align: center;">
                      Đặt lại mật khẩu ngay
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Notice Box -->
              <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; border-radius: 8px; padding: 12px 16px; margin: 20px 0 18px;">
                <p style="margin: 0 0 4px; font-size: 13px; color: #475569; font-weight: 600;">
                  ⏱️ Lưu ý quan trọng:
                </p>
                <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                  • Liên kết này chỉ có hiệu lực trong vòng <strong>60 phút</strong> kể từ thời điểm gửi.<br>
                  • Sau khi đổi mật khẩu thành công, liên kết sẽ tự động hết hạn.
                </p>
              </div>

              <!-- Fallback Link -->
              <p style="margin: 18px 0 6px; font-size: 12px; color: #64748b;">
                Nếu nút trên không mở được, bạn có thể sao chép và dán liên kết sau vào trình duyệt:
              </p>
              <div style="background-color: #f1f5f9; border-radius: 8px; padding: 10px 12px; word-break: break-all; font-family: monospace; font-size: 12px; color: #0369a1; border: 1px dashed #cbd5e1;">
                {reset_url}
              </div>

              <!-- Security Advice -->
              <p style="margin: 20px 0 0; font-size: 12px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 16px;">
                🔒 Nếu bạn không yêu cầu đặt lại mật khẩu, xin hãy bỏ qua email này. Tài khoản của bạn vẫn được bảo vệ an toàn tuyệt đối.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 28px; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 12px; color: #94a3b8;">
                © 2026 TalkWithMe. All rights reserved.
              </p>
              <p style="margin: 0; font-size: 11px; color: #cbd5e1;">
                Hệ thống luyện nói tiếng Anh Communication-First
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
        msg.add_alternative(html_content, subtype="html")

        try:
            await asyncio.to_thread(self._sync_send, msg)
            logger.info("Successfully sent password reset email to %s", email)
        except Exception as exc:
            logger.error("Failed to send email to %s via SMTP: %s", email, exc)
            raise
