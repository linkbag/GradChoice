"""
Supervisor service — aggregate computations and query helpers.
"""
import uuid
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, case, select, distinct

from app.models.supervisor import Supervisor
from app.models.rating import Rating
from app.models.comment import Comment


def get_rating_aggregates(db: Session, supervisor_id: uuid.UUID) -> dict:
    """
    Return avg scores, counts, and rating distribution for a supervisor.
    Computed fresh from DB; callers should cache if needed.
    """
    row = db.execute(
        select(
            func.count(Rating.id).label("total"),
            func.sum(case((Rating.is_verified_rating == True, 1), else_=0)).label("verified"),  # noqa: E712
            func.avg(Rating.overall_score).label("avg_overall"),
            func.avg(Rating.score_academic).label("avg_academic"),
            func.avg(Rating.score_mentoring).label("avg_mentoring"),
            func.avg(Rating.score_wellbeing).label("avg_wellbeing"),
            func.avg(Rating.score_stipend).label("avg_stipend"),
            func.avg(Rating.score_resources).label("avg_resources"),
            func.avg(Rating.score_ethics).label("avg_ethics"),
        ).where(Rating.supervisor_id == supervisor_id)
    ).first()

    # Verified avg overall
    verified_row = db.execute(
        select(func.avg(Rating.overall_score).label("verified_avg")).where(
            Rating.supervisor_id == supervisor_id,
            Rating.is_verified_rating == True,  # noqa: E712
        )
    ).first()

    # Distribution histogram
    dist_rows = db.execute(
        select(
            func.floor(Rating.overall_score).label("bucket"),
            func.count(Rating.id).label("cnt"),
        )
        .where(Rating.supervisor_id == supervisor_id)
        .group_by(func.floor(Rating.overall_score))
    ).all()

    distribution: dict[str, int] = {}
    for r in dist_rows:
        distribution[str(int(r.bucket))] = r.cnt

    def _round(v) -> Optional[float]:
        return round(float(v), 2) if v is not None else None

    return {
        "rating_count": row.total or 0,
        "verified_rating_count": row.verified or 0,
        "avg_overall": _round(row.avg_overall),
        "avg_academic": _round(row.avg_academic),
        "avg_mentoring": _round(row.avg_mentoring),
        "avg_wellbeing": _round(row.avg_wellbeing),
        "avg_stipend": _round(row.avg_stipend),
        "avg_resources": _round(row.avg_resources),
        "avg_ethics": _round(row.avg_ethics),
        "verified_avg_overall": _round(verified_row.verified_avg) if verified_row else None,
        "rating_distribution": distribution,
    }


def get_recent_comments(db: Session, supervisor_id: uuid.UUID, limit: int = 5) -> list:
    """Return the most recent top-level comments for a supervisor."""
    return (
        db.query(Comment)
        .filter(Comment.supervisor_id == supervisor_id, Comment.parent_comment_id == None)  # noqa: E711
        .order_by(Comment.created_at.desc())
        .limit(limit)
        .all()
    )


def build_supervisor_search_query(
    db: Session,
    school_code: Optional[str] = None,
    school_name: Optional[str] = None,
    province: Optional[str] = None,
    department: Optional[str] = None,
    title: Optional[str] = None,
):
    """
    Build a base query for supervisors with optional filters, annotated with
    avg_overall_score and rating_count via subquery.
    """
    # Subquery: avg + count per supervisor
    rating_sub = (
        select(
            Rating.supervisor_id.label("supervisor_id"),
            func.avg(Rating.overall_score).label("avg_score"),
            func.count(Rating.id).label("cnt"),
        )
        .group_by(Rating.supervisor_id)
        .subquery()
    )

    q = db.query(
        Supervisor,
        rating_sub.c.avg_score,
        rating_sub.c.cnt,
    ).outerjoin(rating_sub, Supervisor.id == rating_sub.c.supervisor_id)

    if school_code:
        q = q.filter(Supervisor.school_code == school_code)
    if school_name:
        q = q.filter(Supervisor.school_name.ilike(f"%{school_name}%"))
    if province:
        q = q.filter(Supervisor.province == province)
    if department:
        q = q.filter(Supervisor.department.ilike(f"%{department}%"))
    if title:
        q = q.filter(Supervisor.title.ilike(f"%{title}%"))

    return q


def supervisor_to_search_result(sup: Supervisor, avg_score, cnt) -> dict:
    """Convert a Supervisor ORM row + aggregates to a dict matching SupervisorSearchResult."""
    return {
        "id": sup.id,
        "school_code": sup.school_code,
        "school_name": sup.school_name,
        "province": sup.province,
        "name": sup.name,
        "department": sup.department,
        "title": sup.title,
        "avg_overall_score": round(float(avg_score), 2) if avg_score is not None else None,
        "rating_count": cnt or 0,
    }


def get_school_stats(db: Session, school_code: str) -> dict:
    """Return aggregate stats for a single school."""
    row = db.execute(
        select(
            func.count(distinct(Supervisor.id)).label("total_supervisors"),
            func.count(distinct(Rating.supervisor_id)).label("rated_supervisors"),
            func.avg(Rating.overall_score).label("avg_overall"),
        )
        .select_from(Supervisor)
        .outerjoin(Rating, Supervisor.id == Rating.supervisor_id)
        .where(Supervisor.school_code == school_code)
    ).first()

    return {
        "total_supervisors": row.total_supervisors or 0,
        "rated_supervisors": row.rated_supervisors or 0,
        "avg_overall_score": round(float(row.avg_overall), 2) if row.avg_overall else None,
    }
