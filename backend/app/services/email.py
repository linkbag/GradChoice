import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)

def _app_url() -> str:
    """Return APP_URL from settings so it can be overridden via env."""
    return settings.APP_URL


def _send_email(to: str, subject: str, html_body: str) -> None:
    """Send an HTML email. In dev mode (no SMTP_HOST), logs to console instead."""
    if not settings.SMTP_HOST:
        logger.info(
            "\n" + "=" * 60 + "\n"
            f"[DEV EMAIL]\n"
            f"To: {to}\n"
            f"Subject: {subject}\n"
            f"Body:\n{html_body}\n" + "=" * 60
        )
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.FROM_EMAIL
    msg["To"] = to
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.FROM_EMAIL, to, msg.as_string())
    except Exception as exc:
        logger.error(f"Failed to send email to {to}: {exc}")


def send_verification_email(to: str, token: str) -> None:
    verify_url = f"{_app_url()}/verify-email?token={token}"
    subject = "【研选 GradChoice】验证您的邮箱"
    body = f"""
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333">
  <h2 style="color:#4f46e5">验证您的邮箱</h2>
  <p>欢迎加入研选 GradChoice！请点击下方按钮验证您的邮箱地址：</p>
  <p style="margin:24px 0">
    <a href="{verify_url}"
       style="background:#4f46e5;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600">
      验证邮箱
    </a>
  </p>
  <p style="color:#666;font-size:14px">
    如果按钮无法点击，请复制以下链接到浏览器地址栏：<br/>
    <a href="{verify_url}" style="color:#4f46e5">{verify_url}</a>
  </p>
  <p style="color:#666;font-size:14px">链接有效期为 24 小时。如果您没有注册研选账号，请忽略此邮件。</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#999;font-size:12px">研选 GradChoice — 中立 · 公开 · 免费 · 开源</p>
</div>
"""
    _send_email(to, subject, body)


def send_password_reset_email(to: str, token: str) -> None:
    reset_url = f"{_app_url()}/reset-password?token={token}"
    subject = "【研选 GradChoice】重置您的密码"
    body = f"""
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333">
  <h2 style="color:#4f46e5">重置您的密码</h2>
  <p>我们收到了重置您账号密码的请求。请点击下方按钮设置新密码：</p>
  <p style="margin:24px 0">
    <a href="{reset_url}"
       style="background:#4f46e5;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600">
      重置密码
    </a>
  </p>
  <p style="color:#666;font-size:14px">
    如果按钮无法点击，请复制以下链接到浏览器地址栏：<br/>
    <a href="{reset_url}" style="color:#4f46e5">{reset_url}</a>
  </p>
  <p style="color:#666;font-size:14px">链接有效期为 <strong>1 小时</strong>。如果您没有请求重置密码，请忽略此邮件，您的账号不会受到任何影响。</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#999;font-size:12px">研选 GradChoice — 中立 · 公开 · 免费 · 开源</p>
</div>
"""
    _send_email(to, subject, body)


def send_chat_notification_email(to: str, sender_name: str, message_preview: str) -> None:
    inbox_url = f"{_app_url()}/inbox"
    preview = message_preview[:200] + ("…" if len(message_preview) > 200 else "")
    subject = f"【研选 GradChoice】您收到了来自 {sender_name} 的新消息"
    body = f"""
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#333">
  <h2 style="color:#4f46e5">您有新消息</h2>
  <p><strong>{sender_name}</strong> 给您发来了一条消息：</p>
  <blockquote style="background:#f5f5f5;padding:12px 16px;border-left:4px solid #4f46e5;margin:16px 0;border-radius:0 4px 4px 0">
    {preview}
  </blockquote>
  <p style="margin:24px 0">
    <a href="{inbox_url}"
       style="background:#4f46e5;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600">
      查看消息
    </a>
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#999;font-size:12px">
    如需关闭邮件通知，请前往
    <a href="{_app_url()}/profile" style="color:#4f46e5">个人设置</a>
    关闭邮件通知选项。
  </p>
</div>
"""
    _send_email(to, subject, body)
