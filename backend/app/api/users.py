import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.user import UserMe, UserPublicProfile, UserUpdate
from app.utils.auth import get_current_user, get_current_verified_user

router = APIRouter(prefix="/users", tags=["用户"])


@router.get("/me", response_model=UserMe)
def get_me(current_user=Depends(get_current_user)):
    """获取当前登录用户信息"""
    # TODO: implement
    raise HTTPException(status_code=501, detail="待实现")


@router.put("/me", response_model=UserMe)
def update_me(
    user_update: UserUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """更新当前用户资料"""
    # TODO: implement
    raise HTTPException(status_code=501, detail="待实现")


@router.get("/{user_id}/profile", response_model=UserPublicProfile)
def get_user_profile(user_id: uuid.UUID, db: Session = Depends(get_db)):
    """获取用户公开资料"""
    # TODO: implement
    raise HTTPException(status_code=501, detail="待实现")
