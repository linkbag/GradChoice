import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.comment import Comment, CommentVote
from app.models.flag import CommentFlag
from app.schemas.comment import (
    CommentCreate,
    CommentUpdate,
    CommentResponse,
    CommentVoteCreate,
    FlagCreate,
    CommentListResponse,
)
from app.services.comment import (
    DAILY_COMMENT_LIMIT,
    apply_flag,
    build_comment_response,
    can_edit,
    get_daily_comment_count,
    update_vote_counts,
)
from app.utils.auth import get_current_verified_user, get_optional_user

router = APIRouter(prefix="/comments", tags=["评论"])


@router.post("", response_model=CommentResponse, status_code=201)
def create_comment(
    comment_in: CommentCreate,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """发表评论或回复（需登录，每日限20条）"""
    # Rate limit: max 20 per day
    daily_count = get_daily_comment_count(current_user.id, db)
    if daily_count >= DAILY_COMMENT_LIMIT:
        raise HTTPException(status_code=429, detail="您今日发言已达上限（20条），请明日再试")

    # Validate supervisor exists
    from app.models.supervisor import Supervisor  # noqa: PLC0415
    supervisor = db.query(Supervisor).filter(Supervisor.id == comment_in.supervisor_id).first()
    if not supervisor:
        raise HTTPException(status_code=404, detail="导师不存在")

    # Validate parent comment if provided
    if comment_in.parent_comment_id:
        parent = db.query(Comment).filter(Comment.id == comment_in.parent_comment_id).first()
        if not parent or parent.supervisor_id != comment_in.supervisor_id:
            raise HTTPException(status_code=404, detail="父评论不存在")
        # Only allow 2 levels deep: if parent already has a parent, reject
        if parent.parent_comment_id is not None:
            raise HTTPException(status_code=400, detail="最多支持两级嵌套回复")

    comment = Comment(
        user_id=current_user.id,
        supervisor_id=comment_in.supervisor_id,
        parent_comment_id=comment_in.parent_comment_id,
        content=comment_in.content.strip(),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return build_comment_response(comment, current_user.id, db)


@router.get("/supervisor/{supervisor_id}", response_model=CommentListResponse)
def get_supervisor_comments(
    supervisor_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort: Literal["newest", "oldest", "most_liked", "most_discussed"] = Query("newest"),
    current_user=Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """获取导师的顶层评论列表（含嵌套回复，最多两级）"""
    query = (
        db.query(Comment)
        .filter(
            Comment.supervisor_id == supervisor_id,
            Comment.parent_comment_id == None,  # noqa: E711  top-level only
        )
    )

    # Apply sort
    if sort == "newest":
        query = query.order_by(Comment.created_at.desc())
    elif sort == "oldest":
        query = query.order_by(Comment.created_at.asc())
    elif sort == "most_liked":
        query = query.order_by(Comment.likes_count.desc(), Comment.created_at.desc())
    elif sort == "most_discussed":
        query = query.order_by(Comment.dislikes_count.desc(), Comment.created_at.desc())  # proxy for engagement

    total = query.count()
    comments = query.offset((page - 1) * page_size).limit(page_size).all()

    current_user_id = current_user.id if current_user else None
    items = [build_comment_response(c, current_user_id, db) for c in comments]

    return CommentListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{comment_id}", response_model=CommentResponse)
def get_comment(
    comment_id: uuid.UUID,
    current_user=Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """获取单条评论及完整回复线索"""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
    current_user_id = current_user.id if current_user else None
    return build_comment_response(comment, current_user_id, db)


@router.get("/{comment_id}/replies", response_model=list[CommentResponse])
def get_comment_replies(
    comment_id: uuid.UUID,
    current_user=Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """获取评论的所有直接回复"""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
    current_user_id = current_user.id if current_user else None
    replies = (
        db.query(Comment)
        .filter(Comment.parent_comment_id == comment_id)
        .order_by(Comment.created_at.asc())
        .all()
    )
    return [build_comment_response(r, current_user_id, db, depth=1) for r in replies]


@router.put("/{comment_id}", response_model=CommentResponse)
def update_comment(
    comment_id: uuid.UUID,
    update_in: CommentUpdate,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """编辑自己的评论（发布24小时内）"""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能编辑自己的评论")
    if comment.is_deleted:
        raise HTTPException(status_code=400, detail="已删除的评论不能编辑")
    if not can_edit(comment):
        raise HTTPException(status_code=403, detail="只能在发布后24小时内编辑评论")

    comment.content = update_in.content.strip()
    comment.is_edited = True
    db.commit()
    db.refresh(comment)
    return build_comment_response(comment, current_user.id, db)


@router.delete("/{comment_id}", status_code=204)
def delete_comment(
    comment_id: uuid.UUID,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """软删除自己的评论（保留评论结构，内容替换为占位文本）"""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能删除自己的评论")
    if comment.is_deleted:
        raise HTTPException(status_code=400, detail="评论已删除")

    comment.is_deleted = True
    db.commit()


@router.post("/{comment_id}/vote", status_code=204)
def vote_comment(
    comment_id: uuid.UUID,
    vote_in: CommentVoteCreate,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """对评论投票（赞/踩）。再次相同投票则取消。不能给自己投票。"""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
    if comment.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能给自己的评论投票")
    if comment.is_deleted:
        raise HTTPException(status_code=400, detail="已删除的评论不能投票")

    existing = (
        db.query(CommentVote)
        .filter(CommentVote.comment_id == comment_id, CommentVote.user_id == current_user.id)
        .first()
    )

    if existing:
        if existing.vote_type == vote_in.vote_type:
            # Toggle off (same vote type → remove vote)
            db.delete(existing)
        else:
            # Switch vote type
            existing.vote_type = vote_in.vote_type
    else:
        new_vote = CommentVote(
            user_id=current_user.id,
            comment_id=comment_id,
            vote_type=vote_in.vote_type,
        )
        db.add(new_vote)

    db.flush()
    update_vote_counts(comment, db)
    db.commit()


@router.post("/{comment_id}/flag", status_code=204)
def flag_comment(
    comment_id: uuid.UUID,
    flag_in: FlagCreate,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """举报评论。每人每条评论只能举报一次，3人举报后自动隐藏。"""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
    if comment.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能举报自己的评论")

    # Check if already flagged by this user
    existing_flag = (
        db.query(CommentFlag)
        .filter(CommentFlag.comment_id == comment_id, CommentFlag.reporter_id == current_user.id)
        .first()
    )
    if existing_flag:
        raise HTTPException(status_code=400, detail="您已举报过该评论")

    try:
        apply_flag(comment, current_user.id, flag_in.reason, flag_in.detail, db)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="您已举报过该评论")
