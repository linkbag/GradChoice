import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.comment import Comment, CommentVote, VoteType
from app.schemas.comment import (
    CommentCreate, CommentUpdate, CommentResponse, CommentAuthorResponse, CommentVoteCreate, CommentListResponse
)
from app.utils.auth import get_current_verified_user, get_optional_current_user

router = APIRouter(prefix="/comments", tags=["评论"])


def _build_response(comment: Comment, user_id: uuid.UUID | None, db: Session, include_replies: bool = True) -> CommentResponse:
    vote = None
    if user_id:
        v = db.query(CommentVote).filter(
            CommentVote.comment_id == comment.id,
            CommentVote.user_id == user_id,
        ).first()
        vote = v.vote_type if v else None
    reply_count = db.query(func.count(Comment.id)).filter(
        Comment.parent_comment_id == comment.id,
        Comment.is_deleted.is_(False),
    ).scalar() or 0

    author = None
    if comment.user:
        author = CommentAuthorResponse(
            id=comment.user.id,
            display_name=comment.user.display_name,
            is_student_verified=comment.user.is_student_verified,
        )

    replies = []
    if include_replies and reply_count > 0:
        raw_replies = db.query(Comment).filter(
            Comment.parent_comment_id == comment.id,
            Comment.is_deleted.is_(False),
        ).order_by(Comment.created_at.asc()).limit(10).all()
        replies = [_build_response(r, user_id, db, include_replies=False) for r in raw_replies]

    data = CommentResponse.model_validate(comment)
    data.user_vote = vote
    data.reply_count = reply_count
    data.author = author
    data.replies = replies
    return data


@router.post("", response_model=CommentResponse, status_code=201)
def create_comment(
    comment_in: CommentCreate,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """发表评论或回复"""
    from app.models.supervisor import Supervisor
    sup = db.query(Supervisor).filter(Supervisor.id == comment_in.supervisor_id).first()
    if not sup:
        raise HTTPException(status_code=404, detail="导师不存在")
    if comment_in.parent_comment_id:
        parent = db.query(Comment).filter(Comment.id == comment_in.parent_comment_id).first()
        if not parent:
            raise HTTPException(status_code=404, detail="父评论不存在")

    comment = Comment(
        user_id=current_user.id,
        supervisor_id=comment_in.supervisor_id,
        parent_comment_id=comment_in.parent_comment_id,
        content=comment_in.content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _build_response(comment, current_user.id, db)


@router.get("/supervisor/{supervisor_id}", response_model=CommentListResponse)
def get_supervisor_comments(
    supervisor_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_optional_current_user),
):
    """获取导师的顶层评论"""
    q = db.query(Comment).filter(
        Comment.supervisor_id == supervisor_id,
        Comment.parent_comment_id.is_(None),
        Comment.is_deleted.is_(False),
    )
    total = q.count()
    comments = q.order_by(Comment.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    user_id = current_user.id if current_user else None
    items = [_build_response(c, user_id, db) for c in comments]
    return CommentListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{comment_id}", response_model=CommentResponse)
def get_comment(
    comment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_optional_current_user),
):
    """获取单条评论"""
    comment = db.query(Comment).filter(
        Comment.id == comment_id,
        Comment.is_deleted.is_(False),
    ).first()
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
    user_id = current_user.id if current_user else None
    return _build_response(comment, user_id, db)


@router.put("/{comment_id}", response_model=CommentResponse)
def update_comment(
    comment_id: uuid.UUID,
    comment_update: CommentUpdate,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """修改自己的评论"""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权修改他人评论")
    comment.content = comment_update.content
    comment.is_edited = True
    db.commit()
    db.refresh(comment)
    return _build_response(comment, current_user.id, db)


@router.delete("/{comment_id}", status_code=204)
def delete_comment(
    comment_id: uuid.UUID,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """软删除自己的评论"""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权删除他人评论")
    comment.is_deleted = True
    comment.content = "[已删除]"
    db.commit()


@router.get("/{comment_id}/replies", response_model=list[CommentResponse])
def get_comment_replies(
    comment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_optional_current_user),
):
    """获取评论的回复"""
    replies = db.query(Comment).filter(
        Comment.parent_comment_id == comment_id,
        Comment.is_deleted.is_(False),
    ).order_by(Comment.created_at.asc()).all()
    user_id = current_user.id if current_user else None
    return [_build_response(r, user_id, db) for r in replies]


@router.post("/{comment_id}/vote", status_code=204)
def vote_comment(
    comment_id: uuid.UUID,
    vote_in: CommentVoteCreate,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """对评论投票（赞/踩）"""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")

    existing = db.query(CommentVote).filter(
        CommentVote.user_id == current_user.id,
        CommentVote.comment_id == comment_id,
    ).first()

    if existing:
        if existing.vote_type == vote_in.vote_type:
            # Same vote type: toggle off (cancel the vote)
            if existing.vote_type == VoteType.up:
                comment.likes_count = max(0, comment.likes_count - 1)
            else:
                comment.dislikes_count = max(0, comment.dislikes_count - 1)
            db.delete(existing)
        else:
            # Switch vote direction
            if existing.vote_type == VoteType.up:
                comment.likes_count = max(0, comment.likes_count - 1)
            else:
                comment.dislikes_count = max(0, comment.dislikes_count - 1)
            existing.vote_type = vote_in.vote_type
            if vote_in.vote_type == VoteType.up:
                comment.likes_count = (comment.likes_count or 0) + 1
            else:
                comment.dislikes_count = (comment.dislikes_count or 0) + 1
    else:
        db.add(CommentVote(
            user_id=current_user.id,
            comment_id=comment_id,
            vote_type=vote_in.vote_type,
        ))
        if vote_in.vote_type == VoteType.up:
            comment.likes_count = (comment.likes_count or 0) + 1
        else:
            comment.dislikes_count = (comment.dislikes_count or 0) + 1

    db.commit()


@router.post("/{comment_id}/flag", status_code=204)
def flag_comment(
    comment_id: uuid.UUID,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """举报评论"""
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
    # Use raw SQL to insert flag (comment_flags.reporter_id, comment_flags uses enum)
    from sqlalchemy import text
    try:
        db.execute(text(
            "INSERT INTO comment_flags (id, comment_id, reporter_id, reason) "
            "VALUES (gen_random_uuid(), :cid, :uid, '其他') "
            "ON CONFLICT (reporter_id, comment_id) DO NOTHING"
        ), {"cid": str(comment_id), "uid": str(current_user.id)})
        comment.is_flagged = True
        comment.flag_count = (comment.flag_count or 0) + 1
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="举报失败")
