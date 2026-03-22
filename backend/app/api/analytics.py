import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, select, distinct

from app.database import get_db
from app.models.supervisor import Supervisor
from app.models.rating import Rating
from app.models.comment import Comment
from app.schemas.analytics import (
    SupervisorAnalytics,
    SchoolAnalytics,
    RankingsResponse,
    ScoreBreakdown,
    RankingEntry,
)
from app.services.supervisor import get_rating_aggregates

router = APIRouter(prefix="/analytics", tags=["数据分析"])


@router.get("/supervisor/{supervisor_id}", response_model=SupervisorAnalytics)
def get_supervisor_analytics(supervisor_id: uuid.UUID, db: Session = Depends(get_db)):
    """获取导师综合评分分析（含雷达图数据）"""
    sup = db.query(Supervisor).filter(Supervisor.id == supervisor_id).first()
    if not sup:
        raise HTTPException(status_code=404, detail="导师未找到")

    agg = get_rating_aggregates(db, supervisor_id)

    comment_count = (
        db.query(func.count(Comment.id))
        .filter(Comment.supervisor_id == supervisor_id, Comment.parent_comment_id == None)  # noqa: E711
        .scalar()
        or 0
    )

    scores = ScoreBreakdown(
        avg_overall=agg["avg_overall"],
        avg_academic=agg["avg_academic"],
        avg_mentoring=agg["avg_mentoring"],
        avg_wellbeing=agg["avg_wellbeing"],
        avg_stipend=agg["avg_stipend"],
        avg_resources=agg["avg_resources"],
        avg_ethics=agg["avg_ethics"],
        total_ratings=agg["rating_count"],
        verified_ratings=agg["verified_rating_count"],
    )

    return SupervisorAnalytics(
        supervisor_id=supervisor_id,
        supervisor_name=sup.name,
        school_name=sup.school_name,
        scores=scores,
        score_distribution=agg["rating_distribution"],
        comment_count=comment_count,
    )


@router.get("/school/{school_code}", response_model=SchoolAnalytics)
def get_school_analytics(school_code: str, db: Session = Depends(get_db)):
    """获取院校整体数据"""
    school_row = (
        db.query(Supervisor.school_name, Supervisor.province)
        .filter(Supervisor.school_code == school_code)
        .first()
    )
    if not school_row:
        raise HTTPException(status_code=404, detail="院校未找到")

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

    top_rows = db.execute(
        select(
            Supervisor.id,
            Supervisor.name,
            Supervisor.department,
            func.avg(Rating.overall_score).label("avg_score"),
            func.count(Rating.id).label("cnt"),
        )
        .join(Rating, Supervisor.id == Rating.supervisor_id)
        .where(Supervisor.school_code == school_code)
        .group_by(Supervisor.id, Supervisor.name, Supervisor.department)
        .having(func.count(Rating.id) >= 1)
        .order_by(func.avg(Rating.overall_score).desc())
        .limit(5)
    ).all()

    top_supervisors = [
        {
            "id": str(r.id),
            "name": r.name,
            "department": r.department,
            "avg_score": round(float(r.avg_score), 2),
            "rating_count": r.cnt,
        }
        for r in top_rows
    ]

    return SchoolAnalytics(
        school_code=school_code,
        school_name=school_row.school_name,
        province=school_row.province,
        total_supervisors=row.total_supervisors or 0,
        rated_supervisors=row.rated_supervisors or 0,
        avg_overall_score=round(float(row.avg_overall), 2) if row.avg_overall else None,
        top_supervisors=top_supervisors,
    )


@router.get("/rankings", response_model=RankingsResponse)
def get_rankings(db: Session = Depends(get_db)):
    """获取导师和院校排名（导师需至少3条评价）"""
    top_sups = db.execute(
        select(
            Supervisor.id,
            Supervisor.name,
            Supervisor.school_name,
            func.avg(Rating.overall_score).label("avg_score"),
            func.count(Rating.id).label("cnt"),
        )
        .join(Rating, Supervisor.id == Rating.supervisor_id)
        .group_by(Supervisor.id, Supervisor.name, Supervisor.school_name)
        .having(func.count(Rating.id) >= 3)
        .order_by(func.avg(Rating.overall_score).desc())
        .limit(20)
    ).all()

    by_overall = [
        RankingEntry(
            rank=i + 1,
            supervisor_id=r.id,
            supervisor_name=r.name,
            school_name=r.school_name,
            avg_score=round(float(r.avg_score), 2),
            rating_count=r.cnt,
        )
        for i, r in enumerate(top_sups)
    ]

    top_schools = db.execute(
        select(
            Supervisor.school_code,
            Supervisor.school_name,
            Supervisor.province,
            func.count(distinct(Supervisor.id)).label("total_supervisors"),
            func.count(distinct(Rating.supervisor_id)).label("rated_supervisors"),
            func.avg(Rating.overall_score).label("avg_overall"),
        )
        .join(Rating, Supervisor.id == Rating.supervisor_id)
        .group_by(Supervisor.school_code, Supervisor.school_name, Supervisor.province)
        .having(func.count(distinct(Rating.supervisor_id)) >= 2)
        .order_by(func.avg(Rating.overall_score).desc())
        .limit(10)
    ).all()

    by_school = [
        SchoolAnalytics(
            school_code=r.school_code,
            school_name=r.school_name,
            province=r.province,
            total_supervisors=r.total_supervisors,
            rated_supervisors=r.rated_supervisors,
            avg_overall_score=round(float(r.avg_overall), 2) if r.avg_overall else None,
        )
        for r in top_schools
    ]

    return RankingsResponse(by_overall=by_overall, by_school=by_school)
