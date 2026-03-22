import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.comment import CommentCreate, CommentUpdate, CommentResponse, CommentVoteCreate, CommentListResponse
from app.utils.auth import get_current_verified_user

router = APIRouter(prefix="/comments", tags=["评论"])


@router.post("", response_model=CommentResponse, status_code=201)
def create_comment(
    comment_in: CommentCreate,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """发表评论或回复"""
    # TODO: implement
    raise HTTPException(status_code=501, detail="待实现")


@router.get("/supervisor/{supervisor_id}", response_model=CommentListResponse)
def get_supervisor_comments(
    supervisor_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """获取导师的所有评论（顶层）"""
    # TODO: implement — return only top-level comments, include reply_count
    raise HTTPException(status_code=501, detail="待实现")


@router.put("/{comment_id}", response_model=CommentResponse)
def update_comment(
    comment_id: uuid.UUID,
    comment_update: CommentUpdate,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """修改自己的评论"""
    # TODO: implement — only owner can update
    raise HTTPException(status_code=501, detail="待实现")


@router.delete("/{comment_id}", status_code=204)
def delete_comment(
    comment_id: uuid.UUID,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """删除自己的评论"""
    # TODO: implement — only owner can delete
    raise HTTPException(status_code=501, detail="待实现")


@router.get("/{comment_id}/replies", response_model=list[CommentResponse])
def get_comment_replies(
    comment_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """获取评论的回复"""
    # TODO: implement
    raise HTTPException(status_code=501, detail="待实现")


@router.post("/{comment_id}/vote", status_code=204)
def vote_comment(
    comment_id: uuid.UUID,
    vote_in: CommentVoteCreate,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """对评论投票（赞/踩）"""
    # TODO: implement — upsert vote, update denormalized counts
    raise HTTPException(status_code=501, detail="待实现")


@router.post("/{comment_id}/flag", status_code=204)
def flag_comment(
    comment_id: uuid.UUID,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """举报评论"""
    # TODO: implement
    raise HTTPException(status_code=501, detail="待实现")
