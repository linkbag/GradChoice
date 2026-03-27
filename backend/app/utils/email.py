"""Email sending utility via AWS SES (boto3)."""
import logging
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

SENDER = "研选 GradChoice <verification-noreply@gradchoice.org>"
SES_REGION = "ap-southeast-1"


def _ses_client():
    return boto3.client("ses", region_name=SES_REGION)


def send_verification_email(to_email: str, code: str, purpose: str = "注册") -> bool:
    """Send a verification code email via AWS SES. Returns True on success."""
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
    text = f"您的{purpose}验证码是：{code}（15 分钟内有效）"

    try:
        _ses_client().send_email(
            Source=SENDER,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {
                    "Text": {"Data": text, "Charset": "UTF-8"},
                    "Html": {"Data": html, "Charset": "UTF-8"},
                },
            },
        )
        logger.info("Verification email sent to %s via SES", to_email)
        return True
    except ClientError as e:
        logger.error("SES failed to send email to %s: %s", to_email, e.response["Error"]["Message"])
        return False
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to_email, e)
        return False


def send_notification_email(to_email: str, sender_display_name: str) -> bool:
    """Send a new private message notification email via AWS SES. Returns True on success."""
    subject = "研选 GradChoice — 您收到了一条新私信"
    inbox_url = "https://gradchoice.pages.dev/inbox"
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #0d9488; margin-bottom: 8px;">研选 GradChoice</h2>
        <p style="color: #374151; font-size: 15px;">您在研选 GradChoice 收到了一条新私信</p>
        <div style="background: #f0fdfa; border: 2px solid #0d9488; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <p style="color: #374151; font-size: 14px; margin: 0;">来自：<strong>{sender_display_name}</strong></p>
        </div>
        <a href="{inbox_url}" style="display: inline-block; background: #0d9488; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">查看私信</a>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="color: #9ca3af; font-size: 11px;">如不希望接收此类通知，请前往 <a href="https://gradchoice.pages.dev/profile" style="color: #0d9488;">个人主页</a> 关闭邮件通知。</p>
        <p style="color: #9ca3af; font-size: 11px;">研选 GradChoice — 帮助研究生选择导师</p>
    </div>
    """
    text = f"您在研选 GradChoice 收到了一条来自 {sender_display_name} 的新私信。点击查看：{inbox_url}"

    try:
        _ses_client().send_email(
            Source=SENDER,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {
                    "Text": {"Data": text, "Charset": "UTF-8"},
                    "Html": {"Data": html, "Charset": "UTF-8"},
                },
            },
        )
        logger.info("Notification email sent to %s via SES", to_email)
        return True
    except ClientError as e:
        logger.error("SES failed to send notification to %s: %s", to_email, e.response["Error"]["Message"])
        return False
    except Exception as e:
        logger.error("Failed to send notification email to %s: %s", to_email, e)
        return False
