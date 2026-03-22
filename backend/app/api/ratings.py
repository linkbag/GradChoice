import uuid
from datetime import datetime, timedelta
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, case, coalesce
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.rating import Rating, RatingVote, VoteType
from app.models.supervisor import Supervisor
from app.models.supervisor_rating_cache import SupervisorRatingCache
from app.schemas.rating import (
    RatingCreate,
    RatingUpdate,
    RatingResponse,
    RatingListResponse,
    RatingVoteCreate,
    SupervisorRatingCacheResponse,
)
from app.services.rating import compute_supervisor_aggregates
from app.utils.auth import get_current_verified_user, get_current_user, get_optional_current_user

router = APIRouter(prefix="/ratings", tags=["评价"])

# Anti-abuse constants
MAX_RATINGS_PER_DAY = 10
MIN_ACCOUNT_AGE_HOURS = 1


def _build_response(
    rating: Rating,
    vote_counts: dict[uuid.UUID, tuple[int, int]],
    user_vote_map: dict[uuid.UUID, VoteType],
) -> RatingResponse:
    """Build a RatingResponse, populating vote counts and display name."""
    upvotes, downvotes = vote_counts.get(rating.id, (0, 0))
    return RatingResponse(
        id=rating.id,
        user_id=rating.user_id,
        supervisor_id=rating.supervisor_id,
        display_name=rating.user.display_name or "匿名用户",
        is_verified_rating=rating.is_verified_rating,
        overall_score=float(rating.overall_score),
        score_academic=float(rating.score_academic) if rating.score_academic is not None else None,
        score_mentoring=float(rating.score_mentoring) if rating.score_mentoring is not None else None,
        score_wellbeing=float(rating.score_wellbeing) if rating.score_wellbeing is not None else None,
        score_stipend=float(rating.score_stipend) if rating.score_stipend is not None else None,
        score_resources=float(rating.score_resources) if rating.score_resources is not None else None,
        score_ethics=float(rating.score_ethics) if rating.score_ethics is not None else None,
        upvotes=upvotes,
        downvotes=downvotes,
        user_vote=user_vote_map.get(rating.id),
        created_at=rating.created_at,
        updated_at=rating.updated_at,
    )


def _batch_vote_data(
    rating_ids: list[uuid.UUID],
    current_user_id: Optional[uuid.UUID],
    db: Session,
) -> tuple[dict[uuid.UUID, tuple[int, int]], dict[uuid.UUID, VoteType]]:
    """Return (vote_counts, user_vote_map) for a list of rating IDs."""
    if not rating_ids:
        return {}, {}

    rows = (
        db.query(
            RatingVote.rating_id,
            func.sum(case((RatingVote.vote_type == VoteType.up, 1), else_=0)).label("ups"),
            func.sum(case((RatingVote.vote_type == VoteType.down, 1), else_=0)).label("downs"),
        )
        .filter(RatingVote.rating_id.in_(rating_ids))
        .group_by(RatingVote.rating_id)
        .all()
    )
    vote_counts: dict[uuid.UUID, tuple[int, int]] = {
        row.rating_id: (int(row.ups), int(row.downs)) for row in rows
    }

    user_vote_map: dict[uuid.UUID, VoteType] = {}
    if current_user_id:
        user_votes = (
            db.query(RatingVote)
            .filter(
                RatingVote.rating_id.in_(rating_ids),
                RatingVote.user_id == current_user_id,
            )
            .all()
        )
        user_vote_map = {v.rating_id: v.vote_type for v in user_votes}

    return vote_counts, user_vote_map


@router.post("", response_model=RatingResponse, status_code=201)
def create_rating(
    rating_in: RatingCreate,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """提交导师评分（每位导师只能评一次）"""
    # Anti-abuse: minimum account age
    account_age = datetime.utcnow() - current_user.created_at
    if account_age < timedelta(hours=MIN_ACCOUNT_AGE_HOURS):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"账号需注册满{MIN_ACCOUNT_AGE_HOURS}小时后才能提交评价",
        )

    # Anti-abuse: rate limit (max 10 ratings per day)
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_count = (
        db.query(func.count(Rating.id))
        .filter(Rating.user_id == current_user.id, Rating.created_at >= today_start)
        .scalar()
    )
    if today_count >= MAX_RATINGS_PER_DAY:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"每天最多提交{MAX_RATINGS_PER_DAY}条评价",
        )

    # Check supervisor exists
    supervisor = db.query(Supervisor).filter(Supervisor.id == rating_in.supervisor_id).first()
    if not supervisor:
        raise HTTPException(status_code=404, detail="导师不存在")

    # Check for duplicate rating (unique constraint: user + supervisor)
    existing = (
        db.query(Rating)
        .filter(
            Rating.user_id == current_user.id,
            Rating.supervisor_id == rating_in.supervisor_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="您已对该导师评价过，请编辑现有评价",
        )

    rating = Rating(
        user_id=current_user.id,
        supervisor_id=rating_in.supervisor_id,
        is_verified_rating=current_user.is_student_verified,
        overall_score=rating_in.overall_score,
        score_academic=rating_in.score_academic,
        score_mentoring=rating_in.score_mentoring,
        score_wellbeing=rating_in.score_wellbeing,
        score_stipend=rating_in.score_stipend,
        score_resources=rating_in.score_resources,
        score_ethics=rating_in.score_ethics,
    )
    db.add(rating)
    db.commit()
    db.refresh(rating)

    compute_supervisor_aggregates(rating_in.supervisor_id, db)

    return _build_response(rating, {}, {})


@router.get("/mine", response_model=RatingListResponse)
def get_my_ratings(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """获取当前用户提交的所有评价"""
    q = db.query(Rating).filter(Rating.user_id == current_user.id)
    total = q.count()
    ratings = q.order_by(Rating.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    rating_ids = [r.id for r in ratings]
    vote_counts, user_vote_map = _batch_vote_data(rating_ids, current_user.id, db)
    items = [_build_response(r, vote_counts, user_vote_map) for r in ratings]

    return RatingListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/supervisor/{supervisor_id}", response_model=RatingListResponse)
def get_supervisor_ratings(
    supervisor_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort: Literal["newest", "oldest", "highest", "lowest", "most_helpful"] = Query("newest"),
    verified_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user=Depends(get_optional_current_user),
):
    """获取某导师的评分列表（分页、排序、筛选）"""
    q = db.query(Rating).filter(Rating.supervisor_id == supervisor_id)
    if verified_only:
        q = q.filter(Rating.is_verified_rating == True)  # noqa: E712

    total = q.count()

    if sort == "newest":
        q = q.order_by(Rating.created_at.desc())
    elif sort == "oldest":
        q = q.order_by(Rating.created_at.asc())
    elif sort == "highest":
        q = q.order_by(Rating.overall_score.desc())
    elif sort == "lowest":
        q = q.order_by(Rating.overall_score.asc())
    elif sort == "most_helpful":
        upvote_sub = (
            db.query(
                RatingVote.rating_id,
                func.count(RatingVote.id).label("up_count"),
            )
            .filter(RatingVote.vote_type == VoteType.up)
            .group_by(RatingVote.rating_id)
            .subquery()
        )
        q = (
            q.outerjoin(upvote_sub, Rating.id == upvote_sub.c.rating_id)
            .order_by(func.coalesce(upvote_sub.c.up_count, 0).desc())
        )

    ratings = q.offset((page - 1) * page_size).limit(page_size).all()
    rating_ids = [r.id for r in ratings]
    current_user_id = current_user.id if current_user else None
    vote_counts, user_vote_map = _batch_vote_data(rating_ids, current_user_id, db)
    items = [_build_response(r, vote_counts, user_vote_map) for r in ratings]

    return RatingListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/supervisor/{supervisor_id}/summary", response_model=SupervisorRatingCacheResponse)
def get_supervisor_rating_summary(
    supervisor_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """获取某导师的评分摘要（聚合缓存）"""
    cache = (
        db.query(SupervisorRatingCache)
        .filter(SupervisorRatingCache.supervisor_id == supervisor_id)
        .first()
    )
    if cache is None:
        # Return empty summary if no ratings yet
        return SupervisorRatingCacheResponse(
            supervisor_id=supervisor_id,
            all_count=0,
            verified_count=0,
        )
    return cache


@router.put("/{rating_id}", response_model=RatingResponse)
def update_rating(
    rating_id: uuid.UUID,
    rating_update: RatingUpdate,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """修改自己的评价"""
    rating = db.query(Rating).filter(Rating.id == rating_id).first()
    if not rating:
        raise HTTPException(status_code=404, detail="评价不存在")
    if rating.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能修改自己的评价")

    update_data = rating_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rating, field, value)
    rating.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(rating)
    compute_supervisor_aggregates(rating.supervisor_id, db)

    rating_ids = [rating.id]
    vote_counts, user_vote_map = _batch_vote_data(rating_ids, current_user.id, db)
    return _build_response(rating, vote_counts, user_vote_map)


@router.delete("/{rating_id}", status_code=204)
def delete_rating(
    rating_id: uuid.UUID,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """删除自己的评价"""
    rating = db.query(Rating).filter(Rating.id == rating_id).first()
    if not rating:
        raise HTTPException(status_code=404, detail="评价不存在")
    if rating.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能删除自己的评价")

    supervisor_id = rating.supervisor_id
    db.delete(rating)
    db.commit()
    compute_supervisor_aggregates(supervisor_id, db)


@router.post("/{rating_id}/vote", status_code=204)
def vote_rating(
    rating_id: uuid.UUID,
    vote_in: RatingVoteCreate,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """对评价投票（有用/无用）。再次投相同票则取消。"""
    rating = db.query(Rating).filter(Rating.id == rating_id).first()
    if not rating:
        raise HTTPException(status_code=404, detail="评价不存在")
    if rating.user_id == current_user.id:
        raise HTTPException(status_code=403, detail="不能对自己的评价投票")

    existing_vote = (
        db.query(RatingVote)
        .filter(
            RatingVote.rating_id == rating_id,
            RatingVote.user_id == current_user.id,
        )
        .first()
    )

    if existing_vote:
        if existing_vote.vote_type == vote_in.vote_type:
            # Toggle off — remove the vote
            db.delete(existing_vote)
        else:
            # Change vote type
            existing_vote.vote_type = vote_in.vote_type
    else:
        new_vote = RatingVote(
            user_id=current_user.id,
            rating_id=rating_id,
            vote_type=vote_in.vote_type,
        )
        db.add(new_vote)

    db.commit()
