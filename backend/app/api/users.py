import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.user import UserMe, UserPublicProfile, UserUpdate, ChangePasswordRequest
from app.schemas.rating import RatingResponse
from app.schemas.comment import CommentResponse
from app.utils.auth import get_current_user, verify_password, hash_password

router = APIRouter(prefix="/users", tags=["用户"])


@router.get("/me", response_model=UserMe)
def get_me(current_user=Depends(get_current_user)):
    """获取当前登录用户信息"""
    return current_user


@router.put("/me", response_model=UserMe)
def update_me(
    user_update: UserUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """更新当前用户资料"""
    if user_update.display_name is not None:
        current_user.display_name = user_update.display_name
    if user_update.bio is not None:
        current_user.bio = user_update.bio
    if user_update.email_notifications_enabled is not None:
        current_user.email_notifications_enabled = user_update.email_notifications_enabled

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/change-password")
def change_password(
    body: ChangePasswordRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """修改当前用户密码"""
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="当前密码不正确")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="新密码长度不能少于8位")

    current_user.hashed_password = hash_password(body.new_password)
    db.commit()
    return {"message": "密码修改成功"}


@router.get("/me/ratings", response_model=list[RatingResponse])
def get_my_ratings(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取当前用户的所有评价"""
    from app.models.rating import Rating
    ratings = db.query(Rating).filter(Rating.user_id == current_user.id).all()
    return ratings


@router.get("/me/comments", response_model=list[CommentResponse])
def get_my_comments(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取当前用户的所有评论"""
    from app.models.comment import Comment
    comments = (
        db.query(Comment)
        .filter(Comment.user_id == current_user.id)
        .order_by(Comment.created_at.desc())
        .all()
    )
    return comments


@router.get("/{user_id}/profile", response_model=UserPublicProfile)
def get_user_profile(user_id: uuid.UUID, db: Session = Depends(get_db)):
    """获取用户公开资料（不含邮箱、密码等敏感信息）"""
    from app.models.user import User
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user
