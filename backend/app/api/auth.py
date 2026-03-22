from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, VerificationType
from app.schemas.user import UserCreate, UserMe, Token
from app.utils.auth import (
    hash_password, verify_password, create_access_token,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/register", response_model=UserMe, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """注册新用户"""
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="该邮箱已被注册")

    # Auto-verify .edu.cn emails as student-verified
    is_edu = user_in.email.endswith(".edu.cn")
    user = User(
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        display_name=user_in.display_name,
        bio=user_in.bio,
        is_email_verified=is_edu,
        is_student_verified=is_edu,
        verification_type=VerificationType.email_edu if is_edu else VerificationType.none,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


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
        if not current_user.email.endswith(".edu.cn"):
            raise HTTPException(status_code=400, detail="只有 .edu.cn 邮箱可以通过邮箱认证")
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
