import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.middleware.rate_limit import limiter

from app.config import settings
from app.database import get_db
from app.models.user import User, VerificationType
from app.models.verification_code import VerificationCode, VerificationPurpose
from app.schemas.user import (
    UserCreate, UserMe, Token, RegisterResponse,
    SendVerificationRequest, VerifySchoolEmailRequest,
    SendSignupVerificationRequest, VerifySignupCodeRequest,
    ResetPasswordRequest,
)
from app.utils.auth import (
    hash_password, verify_password, create_access_token,
    get_current_user,
)

logger = logging.getLogger(__name__)


def is_edu_email(email: str) -> bool:
    """Check if email is from an educational (.edu*) or .org domain."""
    e = email.lower()
    parts = e.rsplit("@", 1)
    if len(parts) != 2:
        return False
    domain = parts[1]
    # Match .edu, .edu.xx, .edu.xx.yy, etc. and .org
    return domain.endswith(".edu") or ".edu." in domain or domain.endswith(".org")


CODE_TTL = timedelta(minutes=15)
RESEND_COOLDOWN = timedelta(seconds=60)
MAX_SENDS_PER_DAY = 5
SEND_HISTORY_RETENTION = timedelta(days=7)


def _generate_code() -> str:
    """Return a cryptographically secure 6-digit verification code."""
    return f"{secrets.randbelow(1_000_000):06d}"


def _as_utc(value: datetime) -> datetime:
    """Normalise a DB timestamp to aware UTC (SQLite hands back naive datetimes)."""
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _enforce_send_limits(db: Session, email: str, purpose: VerificationPurpose) -> None:
    """Throttle verification mail per recipient address.

    The IP-based limiter is evadable (rotating proxies, spoofed forwarding headers);
    the recipient address is not, and it is the one thing an abuser mail-bombing a
    stranger and a user who fat-fingered their own address have in common.
    """
    now = datetime.now(timezone.utc)
    last = (
        db.query(VerificationCode)
        .filter(VerificationCode.email == email, VerificationCode.purpose == purpose)
        .order_by(VerificationCode.created_at.desc())
        .first()
    )
    if last is not None:
        elapsed = now - _as_utc(last.created_at)
        if elapsed < RESEND_COOLDOWN:
            wait = int((RESEND_COOLDOWN - elapsed).total_seconds()) + 1
            raise HTTPException(status_code=429, detail=f"发送过于频繁，请在 {wait} 秒后重试")

    recent = (
        db.query(func.count(VerificationCode.id))
        .filter(
            VerificationCode.email == email,
            VerificationCode.purpose == purpose,
            VerificationCode.created_at >= now - timedelta(days=1),
        )
        .scalar()
        or 0
    )
    if recent >= MAX_SENDS_PER_DAY:
        raise HTTPException(status_code=429, detail="该邮箱今日验证码发送次数过多，请稍后再试")


def _upsert_verification_code(db: Session, email: str, purpose: VerificationPurpose, code: str) -> VerificationCode:
    """Invalidate any live code for this email+purpose, then insert a fresh one.

    Superseded rows are expired rather than deleted: `_enforce_send_limits` counts them
    to throttle repeat sends, so no schema change is needed. Rows older than
    SEND_HISTORY_RETENTION are purged to keep the table small.
    """
    now = datetime.now(timezone.utc)
    db.query(VerificationCode).filter(
        VerificationCode.email == email,
        VerificationCode.purpose == purpose,
        VerificationCode.expires_at > now,
    ).update({"expires_at": now, "verified": False}, synchronize_session=False)
    db.query(VerificationCode).filter(
        VerificationCode.email == email,
        VerificationCode.created_at < now - SEND_HISTORY_RETENTION,
    ).delete(synchronize_session=False)

    entry = VerificationCode(
        email=email,
        code=code,
        purpose=purpose,
        expires_at=now + CODE_TTL,
        verified=False,
        created_at=now,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def _get_valid_entry(db: Session, email: str, purpose: VerificationPurpose) -> VerificationCode:
    """Return the most recent non-expired VerificationCode row or raise HTTPException."""
    entry = (
        db.query(VerificationCode)
        .filter(
            VerificationCode.email == email,
            VerificationCode.purpose == purpose,
        )
        .order_by(VerificationCode.created_at.desc())
        .first()
    )
    if not entry:
        raise HTTPException(status_code=400, detail="请先发送验证码")
    if datetime.now(timezone.utc) > _as_utc(entry.expires_at):
        raise HTTPException(status_code=400, detail="验证码已过期，请重新发送")
    return entry


router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/send-signup-verification")
@limiter.limit("5/minute")
def send_signup_verification(request: Request, body: SendSignupVerificationRequest, db: Session = Depends(get_db)):
    """发送注册邮箱验证码"""
    email = body.email.lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="该邮箱已被注册")

    _enforce_send_limits(db, email, VerificationPurpose.signup)

    code = _generate_code()
    entry = _upsert_verification_code(db, email, VerificationPurpose.signup, code)

    from app.utils.email import send_verification_email
    if not send_verification_email(email, code, purpose="注册"):
        # Never fall back to auto-verify: that let anyone register an address they do
        # not control (and that may not even exist). Roll the row back so a failed
        # attempt does not consume the address's send quota, and tell the user the
        # truth so they can correct a mistyped address instead of waiting for mail
        # that will never arrive.
        db.delete(entry)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="验证码发送失败，请确认邮箱地址是否正确，或稍后重试",
        )
    return {"message": "验证码已发送，请查看邮箱"}


@router.post("/verify-signup-code")
def verify_signup_code(body: VerifySignupCodeRequest, db: Session = Depends(get_db)):
    """验证注册邮箱验证码"""
    email = body.email.lower()
    entry = _get_valid_entry(db, email, VerificationPurpose.signup)
    if body.code != entry.code:
        raise HTTPException(status_code=400, detail="验证码错误")

    entry.verified = True
    db.commit()
    return {"message": "邮箱验证成功"}


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """注册新用户，返回用户信息及 JWT 令牌"""
    email = user_in.email.lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="该邮箱已被注册")

    # Check if email was pre-verified via signup verification flow
    entry = (
        db.query(VerificationCode)
        .filter(
            VerificationCode.email == email,
            VerificationCode.purpose == VerificationPurpose.signup,
        )
        .order_by(VerificationCode.created_at.desc())
        .first()
    )
    is_pre_verified = (
        entry is not None
        and entry.verified
        and datetime.now(timezone.utc) <= _as_utc(entry.expires_at)
    )

    is_edu = is_edu_email(user_in.email)
    user = User(
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        display_name=user_in.display_name,
        bio=user_in.bio,
        is_email_verified=is_edu or is_pre_verified,
        is_student_verified=is_edu,
        verification_type=VerificationType.email_edu if is_edu else VerificationType.none,
        tos_agreed_at=datetime.now(timezone.utc) if user_in.tos_agreed else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Clean up verification rows for this address
    if entry:
        db.query(VerificationCode).filter(
            VerificationCode.email == email,
            VerificationCode.purpose == VerificationPurpose.signup,
        ).delete(synchronize_session=False)
        db.commit()

    # Generate JWT for auto-login
    token = create_access_token(user.id)
    user_data = UserMe.model_validate(user)
    return {**user_data.model_dump(), "access_token": token, "token_type": "bearer"}


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """用户登录，返回JWT"""
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="邮箱或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(user.id)
    return {"access_token": token, "token_type": "bearer"}


@router.post("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    """通过令牌验证邮箱"""
    from jose import JWTError, jwt
    from app.config import settings
    import uuid
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=400, detail="无效的验证链接")
    user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    user.is_email_verified = True
    db.commit()
    return {"message": "邮箱验证成功"}


@router.post("/verify-student")
def verify_student(
    verification_type: str = "email_edu",
    file: UploadFile = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """学生身份认证"""
    if verification_type == "email_edu":
        if not is_edu_email(current_user.email):
            raise HTTPException(status_code=400, detail="只有教育邮箱 (.edu*) 或 .org 邮箱可以通过邮箱认证")
        current_user.is_student_verified = True
        current_user.is_email_verified = True
        current_user.verification_type = VerificationType.email_edu
        db.commit()
        return {"message": "学生身份认证成功"}
    raise HTTPException(status_code=400, detail="不支持的认证方式")


@router.post("/refresh", response_model=Token)
def refresh_token(current_user: User = Depends(get_current_user)):
    """刷新访问令牌"""
    return {"access_token": create_access_token(current_user.id), "token_type": "bearer"}


@router.get("/me", response_model=UserMe)
def get_me(current_user: User = Depends(get_current_user)):
    """获取当前用户信息"""
    return current_user


@router.post("/send-verification")
@limiter.limit("5/minute")
def send_verification(
    request: Request,
    body: SendVerificationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """发送学校邮箱验证码"""
    email = body.school_email.lower()
    if not is_edu_email(email):
        raise HTTPException(status_code=400, detail="仅支持教育邮箱 (.edu*) 或 .org 邮箱")

    code = _generate_code()
    current_user.school_email = email
    current_user.school_email_verified = False
    current_user.verification_code = code
    current_user.verification_code_expires_at = datetime.now(timezone.utc) + CODE_TTL
    db.commit()

    from app.utils.email import send_verification_email
    if send_verification_email(email, code, purpose="学校邮箱"):
        return {"message": "验证码已发送，请查看邮箱"}
    logger.warning("Verification email send failed for school email %s", email)
    return {"message": "验证码发送失败，请稍后重试"}


@router.post("/verify-school-email")
def verify_school_email(
    body: VerifySchoolEmailRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """验证学校邮箱验证码"""
    if not current_user.verification_code or not current_user.verification_code_expires_at:
        raise HTTPException(status_code=400, detail="请先发送验证码")

    if datetime.now(timezone.utc) > current_user.verification_code_expires_at:
        raise HTTPException(status_code=400, detail="验证码已过期，请重新发送")

    if body.code != current_user.verification_code:
        raise HTTPException(status_code=400, detail="验证码错误")

    current_user.school_email_verified = True
    current_user.is_student_verified = True
    current_user.verification_type = VerificationType.email_edu
    current_user.verification_code = None
    current_user.verification_code_expires_at = None
    db.commit()
    db.refresh(current_user)

    return {"message": "学校邮箱验证成功"}


@router.post("/send-reset-verification")
@limiter.limit("5/minute")
def send_reset_verification(request: Request, body: SendSignupVerificationRequest, db: Session = Depends(get_db)):
    """发送密码重置验证码"""
    email = body.email.lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="该邮箱尚未注册，请先注册账号")

    _enforce_send_limits(db, email, VerificationPurpose.password_reset)

    code = _generate_code()
    entry = _upsert_verification_code(db, email, VerificationPurpose.password_reset, code)

    from app.utils.email import send_verification_email
    if not send_verification_email(email, code, purpose="密码重置"):
        db.delete(entry)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="验证码发送失败，请确认邮箱地址是否正确，或稍后重试",
        )
    return {"message": "验证码已发送，请查看邮箱"}


@router.post("/verify-reset-code")
def verify_reset_code(body: VerifySignupCodeRequest, db: Session = Depends(get_db)):
    """验证密码重置验证码"""
    email = body.email.lower()
    entry = _get_valid_entry(db, email, VerificationPurpose.password_reset)
    if body.code != entry.code:
        raise HTTPException(status_code=400, detail="验证码错误")

    entry.verified = True
    db.commit()
    return {"message": "验证码正确"}


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    """重置密码（使用邮箱验证码）"""
    email = body.email.lower()
    entry = _get_valid_entry(db, email, VerificationPurpose.password_reset)

    if body.code != entry.code:
        raise HTTPException(status_code=400, detail="验证码错误")

    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="密码长度至少为 8 个字符")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    user.hashed_password = hash_password(body.new_password)
    db.delete(entry)
    db.commit()
    return {"message": "密码重置成功"}
