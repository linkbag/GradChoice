"""Email sending utility via SMTP."""
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.config import settings

logger = logging.getLogger(__name__)


def send_verification_email(to_email: str, code: str, purpose: str = "注册") -> bool:
    """Send a verification code email. Returns True on success."""
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.warning("SMTP not configured — cannot send email to %s", to_email)
        return False

    subject = f"研选 GradChoice — {purpose}验证码"
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #0d9488; margin-bottom: 8px;">研选 GradChoice</h2>
        <p style="color: #374151; font-size: 15px;">您的{purpose}验证码是：</p>
        <div style="background: #f0fdfa; border: 2px solid #0d9488; border-radius: 12px; padding: 24px; text-align: center; margin: 20px 0;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #0d9488;">{code}</span>
        </div>
        <p style="color: #6b7280; font-size: 13px;">验证码 15 分钟内有效，请勿分享给他人。</p>
        <p style="color: #6b7280; font-size: 13px;">如非本人操作，请忽略此邮件。</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="color: #9ca3af; font-size: 11px;">研选 GradChoice — 帮助研究生选择导师</p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"研选 GradChoice <{settings.SMTP_USER}>"
    msg["To"] = to_email
    msg.attach(MIMEText(f"您的{purpose}验证码是：{code}（15 分钟内有效）", "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        port = int(settings.SMTP_PORT)
        if port == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, port, timeout=10)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, port, timeout=10)
            server.starttls()

        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_USER, to_email, msg.as_string())
        server.quit()
        logger.info("Verification email sent to %s", to_email)
        return True
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to_email, e)
        return False
