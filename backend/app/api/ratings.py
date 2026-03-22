import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.rating import RatingCreate, RatingUpdate, RatingResponse, RatingVoteCreate
from app.utils.auth import get_current_verified_user

router = APIRouter(prefix="/ratings", tags=["评价"])


@router.post("", response_model=RatingResponse, status_code=201)
def create_rating(
    rating_in: RatingCreate,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """提交导师评分（每位导师只能评一次）"""
    # TODO: implement
    # 1. Check for existing rating (unique constraint user+supervisor)
    # 2. Create rating with is_verified_rating = current_user.is_student_verified
    raise HTTPException(status_code=501, detail="待实现")


@router.get("/supervisor/{supervisor_id}", response_model=list[RatingResponse])
def get_supervisor_ratings(
    supervisor_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=None,
):
    """获取某导师的所有评分"""
    # TODO: implement
    raise HTTPException(status_code=501, detail="待实现")


@router.put("/{rating_id}", response_model=RatingResponse)
def update_rating(
    rating_id: uuid.UUID,
    rating_update: RatingUpdate,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """修改自己的评分"""
    # TODO: implement — only owner can update
    raise HTTPException(status_code=501, detail="待实现")


@router.delete("/{rating_id}", status_code=204)
def delete_rating(
    rating_id: uuid.UUID,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """删除自己的评分"""
    # TODO: implement — only owner can delete
    raise HTTPException(status_code=501, detail="待实现")


@router.post("/{rating_id}/vote", status_code=204)
def vote_rating(
    rating_id: uuid.UUID,
    vote_in: RatingVoteCreate,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """对评分投票（有用/无用）"""
    # TODO: implement — upsert vote, cannot vote on own rating
    raise HTTPException(status_code=501, detail="待实现")
