import logging
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request

logger = logging.getLogger(__name__)
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.user import (
    UserCreate, UserMe, Token, RefreshTokenRequest,
    ForgotPasswordRequest, ResetPasswordRequest,
)
from app.utils.auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_refresh_token,
    create_email_token, decode_email_token,
    get_current_user,
)
from app.services.email import send_verification_email, send_password_reset_email
from app.config import settings
from app.rate_limiter import limiter

router = APIRouter(prefix="/auth", tags=["认证"])

# Known Chinese university EDU domains suffix
_EDU_SUFFIXES = (".edu.cn", ".ac.cn")


def _is_edu_email(email: str) -> bool:
    domain = email.lower().split("@")[-1]
    return any(domain.endswith(s) for s in _EDU_SUFFIXES)


@router.post("/register", response_model=UserMe, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, user_in: UserCreate, db: Session = Depends(get_db)):
    """注册新用户"""
    from app.models.user import User

    if len(user_in.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="密码长度不能少于8位",
        )

    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="该邮箱已被注册",
        )

    user = User(
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        display_name=user_in.display_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Send verification email (fire-and-forget; errors are logged not raised)
    try:
        token = create_email_token(
            user.email, "email_verify",
            expire_hours=settings.EMAIL_TOKEN_EXPIRE_HOURS,
        )
        send_verification_email(user.email, token)
    except Exception as exc:
        logger.warning("Failed to send verification email to %s: %s", user.email, exc)

    return user


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """用户登录，返回JWT"""
    from app.models.user import User

    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="邮箱或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    return Token(access_token=access_token, refresh_token=refresh_token)


@router.post("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    """通过邮件链接验证邮箱"""
    from app.models.user import User

    email = decode_email_token(token, "email_verify")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    if user.is_email_verified:
        return {"message": "邮箱已验证"}

    user.is_email_verified = True
    db.commit()
    return {"message": "邮箱验证成功"}


@router.post("/verify-student")
def verify_student(
    request: Request,
    verification_type: str = Form(...),
    file: UploadFile = File(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """学生身份认证（.edu.cn邮箱自动验证 或 上传学生证待审核）"""
    from app.models.user import VerificationType

    if verification_type == "email_edu":
        if not _is_edu_email(current_user.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="您的邮箱不是教育机构邮箱（需以 .edu.cn 或 .ac.cn 结尾）",
            )
        current_user.is_student_verified = True
        current_user.verification_type = VerificationType.email_edu
        db.commit()
        return {"message": "学生身份验证成功（教育邮箱）", "is_student_verified": True}

    elif verification_type == "student_id":
        if file is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="请上传学生证照片",
            )

        # Validate file type (images only)
        allowed_types = {"image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"}
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="只支持上传图片（JPG/PNG/WebP/PDF）",
            )

        # Save with UUID filename — never expose original filename or path
        ext = os.path.splitext(file.filename or "")[-1].lower() or ".jpg"
        safe_filename = f"{uuid.uuid4()}{ext}"
        upload_path = os.path.join(settings.UPLOAD_DIR, "student_ids")
        os.makedirs(upload_path, exist_ok=True)
        file_path = os.path.join(upload_path, safe_filename)

        with open(file_path, "wb") as f:
            content = file.file.read()
            f.write(content)

        current_user.student_id_file_path = file_path
        current_user.verification_type = VerificationType.student_id
        # is_student_verified stays False until reviewed by admin
        db.commit()
        return {"message": "学生证已上传，等待审核（通常1-3个工作日）", "is_student_verified": False}

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的验证类型，请选择 email_edu 或 student_id",
        )


@router.post("/refresh", response_model=Token)
def refresh_token(body: RefreshTokenRequest, db: Session = Depends(get_db)):
    """使用 refresh token 获取新的 access token"""
    from app.models.user import User

    user_id = decode_refresh_token(body.refresh_token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效或已过期的刷新令牌",
        )

    user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    access_token = create_access_token(user.id)
    new_refresh = create_refresh_token(user.id)
    return Token(access_token=access_token, refresh_token=new_refresh)


@router.post("/forgot-password")
@limiter.limit("3/minute")
def forgot_password(request: Request, body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """发送密码重置邮件"""
    from app.models.user import User

    # Always return success to prevent email enumeration
    user = db.query(User).filter(User.email == body.email).first()
    if user:
        try:
            token = create_email_token(
                user.email, "password_reset",
                expire_hours=settings.PASSWORD_RESET_TOKEN_EXPIRE_HOURS,
            )
            send_password_reset_email(user.email, token)
        except Exception:
            pass

    return {"message": "如果该邮箱已注册，您将收到密码重置邮件"}


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    """使用重置令牌设置新密码"""
    from app.models.user import User

    if len(body.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="密码长度不能少于8位",
        )

    email = decode_email_token(body.token, "password_reset")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    user.hashed_password = hash_password(body.new_password)
    db.commit()
    return {"message": "密码重置成功，请重新登录"}
