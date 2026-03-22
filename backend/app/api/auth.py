from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.user import UserCreate, UserMe, Token
from app.utils.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/register", response_model=UserMe, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """注册新用户"""
    # TODO: implement
    # 1. Check email not already taken
    # 2. Hash password
    # 3. Create user record
    # 4. Send verification email
    raise HTTPException(status_code=501, detail="待实现")


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """用户登录，返回JWT"""
    # TODO: implement
    # 1. Look up user by email (form_data.username)
    # 2. Verify password
    # 3. Return access token
    raise HTTPException(status_code=501, detail="待实现")


@router.post("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    """通过邮件链接验证邮箱"""
    # TODO: implement
    # 1. Decode verification token
    # 2. Mark user.is_email_verified = True
    raise HTTPException(status_code=501, detail="待实现")


@router.post("/verify-student")
def verify_student(
    verification_type: str,
    file: UploadFile = File(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """学生身份认证（.edu.cn邮箱或学生证）"""
    # TODO: implement
    # 1. If verification_type == "email_edu": check email domain
    # 2. If verification_type == "student_id": save uploaded file, queue for review
    raise HTTPException(status_code=501, detail="待实现")


@router.post("/refresh", response_model=Token)
def refresh_token(current_user=Depends(get_current_user)):
    """刷新访问令牌"""
    # TODO: implement
    raise HTTPException(status_code=501, detail="待实现")
