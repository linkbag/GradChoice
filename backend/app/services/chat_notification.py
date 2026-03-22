"""
Chat notification service — sends email alerts on new messages.
Throttle: max 1 email per chat per 10 minutes to avoid spamming.
"""

import smtplib
import logging
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)

# In-memory throttle cache: {chat_id -> last_email_sent_at}
# Acceptable for single-process deployment; replace with Redis for multi-process.
_last_email_sent: dict[str, datetime] = {}

THROTTLE_MINUTES = 10
APP_URL = "https://gradchoice.cn"  # Override via config if needed


def _can_send_email(chat_id: str) -> bool:
    """Return True if enough time has passed since the last notification for this chat."""
    last_sent = _last_email_sent.get(chat_id)
    if last_sent is None:
        return True
    return datetime.utcnow() - last_sent >= timedelta(minutes=THROTTLE_MINUTES)


def _record_sent(chat_id: str) -> None:
    _last_email_sent[chat_id] = datetime.utcnow()


def _send_smtp(to_email: str, subject: str, body_html: str) -> bool:
    """Send an email via SMTP. Returns True on success."""
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.info("SMTP not configured — skipping email to %s", to_email)
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.FROM_EMAIL
        msg["To"] = to_email
        msg.attach(MIMEText(body_html, "html", "utf-8"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD or "")
            server.sendmail(settings.FROM_EMAIL, [to_email], msg.as_string())
        return True
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to_email, e)
        return False


def notify_new_message(
    *,
    chat_id: str,
    recipient_email: str,
    recipient_notifications_enabled: bool,
    supervisor_name: Optional[str] = None,
    chat_url: Optional[str] = None,
) -> None:
    """
    Send a new-message email notification to the chat recipient.

    Args:
        chat_id: UUID string of the chat (used for throttling)
        recipient_email: email address to notify
        recipient_notifications_enabled: from user.email_notifications_enabled
        supervisor_name: optional supervisor name for context
        chat_url: direct link to the chat page (defaults to /inbox)
    """
    if not recipient_notifications_enabled:
        return

    if not _can_send_email(chat_id):
        logger.debug("Throttling notification for chat %s", chat_id)
        return

    if chat_url is None:
        chat_url = f"{APP_URL}/inbox"

    if supervisor_name:
        context_line = f"有用户给您发送了关于【{supervisor_name}】的消息，请登录查看。"
    else:
        context_line = "有用户给您发送了一条私信，请登录查看。"

    subject = "研选 — 您有新消息"
    body_html = f"""
<html>
<body style="font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; color: #333; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #4f46e5; margin-bottom: 8px;">研选 GradChoice</h2>
  <p style="font-size: 16px; margin-bottom: 16px;">您好，</p>
  <p style="font-size: 15px; line-height: 1.6; margin-bottom: 24px;">{context_line}</p>
  <a href="{chat_url}"
     style="display: inline-block; background: #4f46e5; color: white; padding: 10px 24px;
            border-radius: 8px; text-decoration: none; font-size: 15px;">
    查看消息
  </a>
  <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e7eb;" />
  <p style="font-size: 12px; color: #9ca3af;">
    您收到此邮件是因为您在研选平台启用了消息通知。
    如需关闭通知，请登录后在<a href="{APP_URL}/profile" style="color: #6b7280;">个人设置</a>中修改。
  </p>
</body>
</html>
"""

    sent = _send_smtp(recipient_email, subject, body_html)
    if sent:
        _record_sent(chat_id)
