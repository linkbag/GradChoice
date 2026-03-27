import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserMe, UserPublicProfile, UserUpdate
from app.schemas.comment import CommentListResponse
from app.schemas.rating import RatingListResponse
from app.utils.auth import get_current_user

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
    for field, value in user_update.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.patch("/me/notifications", response_model=UserMe)
def update_notifications(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """切换当前用户的邮件通知开关"""
    current_user.email_notifications_enabled = not current_user.email_notifications_enabled
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/me/ratings", response_model=RatingListResponse)
def get_my_ratings(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取当前用户提交的评分列表"""
    from app.models.rating import Rating
    from app.models.supervisor import Supervisor
    from app.api.ratings import _to_response

    q = db.query(Rating).filter(Rating.user_id == current_user.id)
    total = q.count()
    ratings = q.order_by(Rating.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    supervisor_ids = list({r.supervisor_id for r in ratings})
    sup_map = (
        {s.id: s.name for s in db.query(Supervisor).filter(Supervisor.id.in_(supervisor_ids)).all()}
        if supervisor_ids else {}
    )

    items = []
    for r in ratings:
        resp = _to_response(r, current_user.id, db)
        resp.supervisor_name = sup_map.get(r.supervisor_id)
        items.append(resp)

    return RatingListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/me/comments", response_model=CommentListResponse)
def get_my_comments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取当前用户的评论列表"""
    from app.models.comment import Comment
    from app.models.supervisor import Supervisor
    from app.api.comments import _build_response

    q = db.query(Comment).options(joinedload(Comment.user)).filter(
        Comment.user_id == current_user.id,
        Comment.is_deleted.is_(False),
    )
    total = q.count()
    items_raw = q.order_by(Comment.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    supervisor_ids = list({c.supervisor_id for c in items_raw})
    sup_map = (
        {s.id: s.name for s in db.query(Supervisor).filter(Supervisor.id.in_(supervisor_ids)).all()}
        if supervisor_ids else {}
    )

    items = [
        _build_response(c, current_user.id, db, supervisor_name=sup_map.get(c.supervisor_id))
        for c in items_raw
    ]
    return CommentListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{user_id}/profile", response_model=UserPublicProfile)
def get_user_profile(user_id: uuid.UUID, db: Session = Depends(get_db)):
    """获取用户公开资料"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user
