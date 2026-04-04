import logging
import random
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

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


def _upsert_verification_code(db: Session, email: str, purpose: VerificationPurpose, code: str) -> VerificationCode:
    """Delete any existing code for this email+purpose, insert a new one, and clean up expired rows."""
    # Delete all existing rows for this email+purpose
    db.query(VerificationCode).filter(
        VerificationCode.email == email,
        VerificationCode.purpose == purpose,
    ).delete()
    # Also clean up expired rows for this email across all purposes
    db.query(VerificationCode).filter(
        VerificationCode.email == email,
        VerificationCode.expires_at < datetime.now(timezone.utc),
    ).delete()
    entry = VerificationCode(
        email=email,
        code=code,
        purpose=purpose,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
        verified=False,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def _get_valid_entry(db: Session, email: str, purpose: VerificationPurpose) -> VerificationCode:
    """Return a non-expired VerificationCode row or raise HTTPException."""
    entry = db.query(VerificationCode).filter(
        VerificationCode.email == email,
        VerificationCode.purpose == purpose,
    ).first()
    if not entry:
        raise HTTPException(status_code=400, detail="请先发送验证码")
    if datetime.now(timezone.utc) > entry.expires_at:
        db.delete(entry)
        db.commit()
        raise HTTPException(status_code=400, detail="验证码已过期，请重新发送")
    return entry


router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/send-signup-verification")
def send_signup_verification(body: SendSignupVerificationRequest, db: Session = Depends(get_db)):
    """发送注册邮箱验证码（本地开发：验证码打印到控制台）"""
    email = body.email.lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="该邮箱已被注册")

    code = f"{random.randint(0, 999999):06d}"
    entry = _upsert_verification_code(db, email, VerificationPurpose.signup, code)

    from app.utils.email import send_verification_email
    if send_verification_email(email, code, purpose="注册"):
        return {"message": "验证码已发送，请查看邮箱"}
    else:
        # SMTP failed — auto-verify
        entry.verified = True
        db.commit()
        logger.warning("SMTP send failed — auto-verifying signup for %s", email)
        return {"message": "邮箱已自动验证（邮件发送失败）"}


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
    entry = db.query(VerificationCode).filter(
        VerificationCode.email == email,
        VerificationCode.purpose == VerificationPurpose.signup,
    ).first()
    is_pre_verified = (
        entry is not None
        and entry.verified
        and datetime.now(timezone.utc) <= entry.expires_at
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

    # Clean up verification entry
    if entry:
        db.delete(entry)
        db.commit()

    # Generate JWT for auto-login
    token = create_access_token(user.id)
    user_data = UserMe.model_validate(user)
    return {**user_data.model_dump(), "access_token": token, "token_type": "bearer"}


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
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
def send_verification(
    body: SendVerificationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """发送学校邮箱验证码（本地开发：验证码打印到控制台）"""
    email = body.school_email.lower()
    if not is_edu_email(email):
        raise HTTPException(status_code=400, detail="仅支持教育邮箱 (.edu*) 或 .org 邮箱")

    code = f"{random.randint(0, 999999):06d}"
    current_user.school_email = email
    current_user.school_email_verified = False
    current_user.verification_code = code
    current_user.verification_code_expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    db.commit()

    from app.utils.email import send_verification_email
    if send_verification_email(email, code, purpose="学校邮箱"):
        return {"message": "验证码已发送，请查看邮箱"}
    else:
        logger.warning("SMTP send failed for school email %s — code: %s", email, code)
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
def send_reset_verification(body: SendSignupVerificationRequest, db: Session = Depends(get_db)):
    """发送密码重置验证码"""
    email = body.email.lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="该邮箱尚未注册，请先注册账号")

    code = f"{random.randint(0, 999999):06d}"
    _upsert_verification_code(db, email, VerificationPurpose.password_reset, code)

    from app.utils.email import send_verification_email
    if send_verification_email(email, code, purpose="密码重置"):
        return {"message": "验证码已发送，请查看邮箱"}
    else:
        logger.warning("SMTP send failed for reset — code for %s: %s", email, code)
        return {"message": "验证码已发送，如未收到请稍后重试"}


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
