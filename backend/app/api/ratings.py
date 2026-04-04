import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.rating import Rating, RatingVote, VoteType
from app.models.supervisor import Supervisor
from app.schemas.rating import RatingCreate, RatingUpdate, RatingResponse, RatingListResponse, RatingVoteCreate
from app.utils.auth import get_current_user, get_current_verified_user, get_optional_current_user

router = APIRouter(prefix="/ratings", tags=["评价"])


def _to_response(rating: Rating, user_id: uuid.UUID | None, db: Session) -> RatingResponse:
    """Build RatingResponse with user_vote and display_name."""
    vote = None
    if user_id:
        v = db.query(RatingVote).filter(
            RatingVote.rating_id == rating.id,
            RatingVote.user_id == user_id,
        ).first()
        vote = v.vote_type if v else None
    display_name = None
    if rating.user:
        display_name = rating.user.display_name
    r = RatingResponse.model_validate(rating)
    r.user_vote = vote
    r.display_name = display_name
    return r


def _refresh_supervisor_cache(db: Session, sup: Supervisor, supervisor_id: uuid.UUID) -> None:
    """Recompute and store all-user and verified-only score caches on the supervisor row."""
    all_stats = db.query(
        func.avg(Rating.overall_score).label("avg"),
        func.count(Rating.id).label("cnt"),
    ).filter(Rating.supervisor_id == supervisor_id).one()

    verified_stats = db.query(
        func.avg(Rating.overall_score).label("avg"),
        func.count(Rating.id).label("cnt"),
    ).filter(
        Rating.supervisor_id == supervisor_id,
        Rating.is_verified_rating.is_(True),
    ).one()

    sup.avg_overall_score = float(all_stats.avg) if all_stats.avg is not None else None
    sup.rating_count = all_stats.cnt or 0
    sup.verified_avg_overall_score = float(verified_stats.avg) if verified_stats.avg is not None else None
    sup.verified_rating_count = verified_stats.cnt or 0


@router.post("", response_model=RatingResponse, status_code=201)
def create_rating(
    rating_in: RatingCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """提交导师评分（每位导师只能评一次，无需邮箱认证）"""
    sup = db.query(Supervisor).filter(Supervisor.id == rating_in.supervisor_id).first()
    if not sup:
        raise HTTPException(status_code=404, detail="导师不存在")

    existing = db.query(Rating).filter(
        Rating.user_id == current_user.id,
        Rating.supervisor_id == rating_in.supervisor_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="您已评价过该导师")

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
    db.flush()

    _refresh_supervisor_cache(db, sup, rating_in.supervisor_id)

    db.commit()
    db.refresh(rating)
    return _to_response(rating, current_user.id, db)


@router.get("/supervisor/{supervisor_id}", response_model=RatingListResponse)
def get_supervisor_ratings(
    supervisor_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user=Depends(get_optional_current_user),
):
    """获取某导师的所有评分（分页）"""
    q = db.query(Rating).filter(Rating.supervisor_id == supervisor_id)
    total = q.count()
    ratings = q.order_by(Rating.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    user_id = current_user.id if current_user else None
    items = [_to_response(r, user_id, db) for r in ratings]
    return RatingListResponse(items=items, total=total, page=page, page_size=page_size)


@router.put("/{rating_id}", response_model=RatingResponse)
def update_rating(
    rating_id: uuid.UUID,
    rating_update: RatingUpdate,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """修改自己的评分"""
    rating = db.query(Rating).filter(Rating.id == rating_id).first()
    if not rating:
        raise HTTPException(status_code=404, detail="评分不存在")
    if rating.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权修改他人的评分")

    for field, val in rating_update.model_dump(exclude_none=True).items():
        setattr(rating, field, val)
    db.flush()

    sup = db.query(Supervisor).filter(Supervisor.id == rating.supervisor_id).first()
    if sup:
        _refresh_supervisor_cache(db, sup, rating.supervisor_id)

    db.commit()
    db.refresh(rating)
    return _to_response(rating, current_user.id, db)


@router.delete("/{rating_id}", status_code=204)
def delete_rating(
    rating_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """删除自己的评分"""
    rating = db.query(Rating).filter(Rating.id == rating_id).first()
    if not rating:
        raise HTTPException(status_code=404, detail="评分不存在")
    if rating.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权删除他人的评分")

    supervisor_id = rating.supervisor_id
    db.delete(rating)
    db.flush()

    sup = db.query(Supervisor).filter(Supervisor.id == supervisor_id).first()
    if sup:
        _refresh_supervisor_cache(db, sup, supervisor_id)

    db.commit()


@router.post("/{rating_id}/vote", status_code=204)
def vote_rating(
    rating_id: uuid.UUID,
    vote_in: RatingVoteCreate,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """对评分投票（有用/无用）"""
    rating = db.query(Rating).filter(Rating.id == rating_id).first()
    if not rating:
        raise HTTPException(status_code=404, detail="评分不存在")
    if rating.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能对自己的评分投票")

    existing_vote = db.query(RatingVote).filter(
        RatingVote.user_id == current_user.id,
        RatingVote.rating_id == rating_id,
    ).first()

    if existing_vote:
        old_type = existing_vote.vote_type
        if old_type == VoteType.up:
            rating.upvotes = max(0, rating.upvotes - 1)
        else:
            rating.downvotes = max(0, rating.downvotes - 1)
        existing_vote.vote_type = vote_in.vote_type
    else:
        existing_vote = RatingVote(
            user_id=current_user.id,
            rating_id=rating_id,
            vote_type=vote_in.vote_type,
        )
        db.add(existing_vote)

    if vote_in.vote_type == VoteType.up:
        rating.upvotes = (rating.upvotes or 0) + 1
    else:
        rating.downvotes = (rating.downvotes or 0) + 1

    db.commit()
