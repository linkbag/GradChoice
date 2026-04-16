import uuid
import threading
from typing import Optional
from datetime import datetime, timedelta, timezone
from sqlalchemy import text, func
from sqlalchemy.orm import Session

from app.models.supervisor import Supervisor
from app.models.rating import Rating
from app.models.user import User
from app.models.comment import Comment
from app.schemas.analytics import (
    SupervisorAnalytics,
    SchoolAnalytics,
    RankingsResponse,
    OverviewStats,
    ScoreBreakdown,
    PercentileRankings,
    ScoreTrend,
    RankingEntry,
    DepartmentStats,
)

MIN_RATINGS_FOR_PERCENTILE = 3

# ---------------------------------------------------------------------------
# Overview stats cache — avoids expensive full-table counts on every page load
# TTL: 24 h.  threading.Lock keeps writes safe under multi-threaded ASGI workers.
# ---------------------------------------------------------------------------
_OVERVIEW_TTL = timedelta(hours=24)
_overview_cache: dict = {}          # keys: "data" (OverviewStats), "cached_at" (datetime)
_overview_lock = threading.Lock()

VALID_DIMENSIONS = {
    "overall": "AVG(r.overall_score)",
    "academic": "AVG(r.score_academic)",
    "mentoring": "AVG(r.score_mentoring)",
    "wellbeing": "AVG(r.score_wellbeing)",
    "stipend": "AVG(r.score_stipend)",
    "resources": "AVG(r.score_resources)",
    "ethics": "AVG(r.score_ethics)",
}


def _f(val, digits: int = 2) -> Optional[float]:
    if val is None:
        return None
    return round(float(val), digits)


def get_supervisor_analytics(
    db: Session, supervisor_id: uuid.UUID, user_status: str = "all"
) -> Optional[SupervisorAnalytics]:
    supervisor = db.query(Supervisor).filter(Supervisor.id == supervisor_id).first()
    if not supervisor:
        return None

    # Build filter based on user_status
    if user_status == "verified":
        status_filter = Rating.is_verified_rating.is_(True)
        sql_status_filter = " AND is_verified_rating = true"
    elif user_status == "unverified":
        status_filter = Rating.is_verified_rating.is_(False)
        sql_status_filter = " AND is_verified_rating = false"
    else:
        status_filter = None
        sql_status_filter = ""

    # Primary ratings aggregates (filtered by user_status)
    base_q = db.query(
        func.avg(Rating.overall_score).label("avg_overall"),
        func.avg(Rating.score_academic).label("avg_academic"),
        func.avg(Rating.score_mentoring).label("avg_mentoring"),
        func.avg(Rating.score_wellbeing).label("avg_wellbeing"),
        func.avg(Rating.score_stipend).label("avg_stipend"),
        func.avg(Rating.score_resources).label("avg_resources"),
        func.avg(Rating.score_ethics).label("avg_ethics"),
        func.count(Rating.id).label("total_ratings"),
        func.count(Rating.id).filter(Rating.is_verified_rating.is_(True)).label("verified_ratings"),
    ).filter(Rating.supervisor_id == supervisor_id)
    if status_filter is not None:
        base_q = base_q.filter(status_filter)
    sq = base_q.one()

    scores = ScoreBreakdown(
        avg_overall=_f(sq.avg_overall),
        avg_academic=_f(sq.avg_academic),
        avg_mentoring=_f(sq.avg_mentoring),
        avg_wellbeing=_f(sq.avg_wellbeing),
        avg_stipend=_f(sq.avg_stipend),
        avg_resources=_f(sq.avg_resources),
        avg_ethics=_f(sq.avg_ethics),
        total_ratings=sq.total_ratings or 0,
        verified_ratings=sq.verified_ratings or 0,
    )

    # Verified-only aggregates (always computed for reference; shown only when user_status="all")
    vq = db.query(
        func.avg(Rating.overall_score).label("avg_overall"),
        func.avg(Rating.score_academic).label("avg_academic"),
        func.avg(Rating.score_mentoring).label("avg_mentoring"),
        func.avg(Rating.score_wellbeing).label("avg_wellbeing"),
        func.avg(Rating.score_stipend).label("avg_stipend"),
        func.avg(Rating.score_resources).label("avg_resources"),
        func.avg(Rating.score_ethics).label("avg_ethics"),
        func.count(Rating.id).label("total_ratings"),
        func.count(Rating.id).filter(Rating.is_verified_rating.is_(True)).label("verified_ratings"),
    ).filter(
        Rating.supervisor_id == supervisor_id,
        Rating.is_verified_rating.is_(True),
    ).one()

    verified_scores = ScoreBreakdown(
        avg_overall=_f(vq.avg_overall),
        avg_academic=_f(vq.avg_academic),
        avg_mentoring=_f(vq.avg_mentoring),
        avg_wellbeing=_f(vq.avg_wellbeing),
        avg_stipend=_f(vq.avg_stipend),
        avg_resources=_f(vq.avg_resources),
        avg_ethics=_f(vq.avg_ethics),
        total_ratings=vq.total_ratings or 0,
        verified_ratings=vq.verified_ratings or 0,
    )

    # Score distribution (1–5 stars), filtered by user_status
    dist_rows = db.execute(
        text(f"""
            SELECT ROUND(overall_score)::int AS star, COUNT(*) AS cnt
            FROM ratings
            WHERE supervisor_id = :sid{sql_status_filter}
            GROUP BY ROUND(overall_score)::int
            ORDER BY star
        """),
        {"sid": str(supervisor_id)},
    ).fetchall()
    score_distribution: dict[str, int] = {str(r.star): r.cnt for r in dist_rows}
    for s in range(1, 6):
        score_distribution.setdefault(str(s), 0)

    # Monthly score trends, filtered by user_status
    trend_rows = db.execute(
        text(f"""
            SELECT
                TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
                ROUND(AVG(overall_score)::numeric, 2) AS avg_overall,
                COUNT(*) AS rating_count
            FROM ratings
            WHERE supervisor_id = :sid{sql_status_filter}
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY DATE_TRUNC('month', created_at)
        """),
        {"sid": str(supervisor_id)},
    ).fetchall()
    score_trends = [
        ScoreTrend(month=r.month, avg_overall=float(r.avg_overall), rating_count=r.rating_count)
        for r in trend_rows
    ]

    # avg_first_year_income — average of non-null values across all ratings (unfiltered by user_status)
    avg_first_year_income_raw = (
        db.query(func.avg(Rating.first_year_income))
        .filter(Rating.supervisor_id == supervisor_id, Rating.first_year_income.isnot(None))
        .scalar()
    )
    avg_first_year_income = _f(avg_first_year_income_raw, 0) if avg_first_year_income_raw is not None else None

    # Comment count
    comment_count = (
        db.query(func.count(Comment.id)).filter(Comment.supervisor_id == supervisor_id).scalar() or 0
    )

    # School average
    saq = db.execute(
        text("""
            SELECT
                AVG(r.overall_score) AS avg_overall,
                AVG(r.score_academic) AS avg_academic,
                AVG(r.score_mentoring) AS avg_mentoring,
                AVG(r.score_wellbeing) AS avg_wellbeing,
                AVG(r.score_stipend) AS avg_stipend,
                AVG(r.score_resources) AS avg_resources,
                AVG(r.score_ethics) AS avg_ethics,
                COUNT(r.id) AS total_ratings
            FROM ratings r
            JOIN supervisors s ON r.supervisor_id = s.id
            WHERE s.school_code = :school_code
        """),
        {"school_code": supervisor.school_code},
    ).one()
    school_avg_scores = ScoreBreakdown(
        avg_overall=_f(saq.avg_overall),
        avg_academic=_f(saq.avg_academic),
        avg_mentoring=_f(saq.avg_mentoring),
        avg_wellbeing=_f(saq.avg_wellbeing),
        avg_stipend=_f(saq.avg_stipend),
        avg_resources=_f(saq.avg_resources),
        avg_ethics=_f(saq.avg_ethics),
        total_ratings=saq.total_ratings or 0,
    )

    # National average
    naq = db.execute(
        text("""
            SELECT
                AVG(overall_score) AS avg_overall,
                AVG(score_academic) AS avg_academic,
                AVG(score_mentoring) AS avg_mentoring,
                AVG(score_wellbeing) AS avg_wellbeing,
                AVG(score_stipend) AS avg_stipend,
                AVG(score_resources) AS avg_resources,
                AVG(score_ethics) AS avg_ethics,
                COUNT(*) AS total_ratings
            FROM ratings
        """)
    ).one()
    national_avg_scores = ScoreBreakdown(
        avg_overall=_f(naq.avg_overall),
        avg_academic=_f(naq.avg_academic),
        avg_mentoring=_f(naq.avg_mentoring),
        avg_wellbeing=_f(naq.avg_wellbeing),
        avg_stipend=_f(naq.avg_stipend),
        avg_resources=_f(naq.avg_resources),
        avg_ethics=_f(naq.avg_ethics),
        total_ratings=naq.total_ratings or 0,
    )

    # Percentile rankings (only if ≥ MIN_RATINGS_FOR_PERCENTILE)
    percentiles = None
    if scores.total_ratings >= MIN_RATINGS_FOR_PERCENTILE:
        pct = db.execute(
            text("""
                WITH all_avgs AS (
                    SELECT
                        s.id,
                        s.school_code,
                        s.province,
                        s.department,
                        AVG(r.overall_score) AS avg_overall
                    FROM supervisors s
                    JOIN ratings r ON r.supervisor_id = s.id
                    GROUP BY s.id, s.school_code, s.province, s.department
                    HAVING COUNT(r.id) >= 1
                ),
                ranked AS (
                    SELECT
                        id,
                        PERCENT_RANK() OVER (
                            PARTITION BY department, school_code ORDER BY avg_overall
                        ) AS dept_percentile,
                        PERCENT_RANK() OVER (
                            PARTITION BY school_code ORDER BY avg_overall
                        ) AS school_percentile,
                        PERCENT_RANK() OVER (
                            PARTITION BY province ORDER BY avg_overall
                        ) AS province_percentile,
                        PERCENT_RANK() OVER (ORDER BY avg_overall) AS national_percentile
                    FROM all_avgs
                )
                SELECT * FROM ranked WHERE id = :sid
            """),
            {"sid": str(supervisor_id)},
        ).fetchone()
        if pct:
            percentiles = PercentileRankings(
                dept_percentile=_f(pct.dept_percentile, 4),
                school_percentile=_f(pct.school_percentile, 4),
                province_percentile=_f(pct.province_percentile, 4),
                national_percentile=_f(pct.national_percentile, 4),
            )

    return SupervisorAnalytics(
        supervisor_id=supervisor_id,
        supervisor_name=supervisor.name,
        school_name=supervisor.school_name,
        department=supervisor.department,
        scores=scores,
        verified_scores=verified_scores,
        score_distribution=score_distribution,
        comment_count=comment_count,
        percentiles=percentiles,
        score_trends=score_trends,
        school_avg_scores=school_avg_scores,
        national_avg_scores=national_avg_scores,
        avg_first_year_income=avg_first_year_income,
    )


def get_school_analytics(db: Session, school_code: str) -> Optional[SchoolAnalytics]:
    school = db.query(Supervisor).filter(Supervisor.school_code == school_code).first()
    if not school:
        return None

    total_sups = (
        db.query(func.count(Supervisor.id)).filter(Supervisor.school_code == school_code).scalar() or 0
    )
    rated_sups = (
        db.execute(
            text("""
                SELECT COUNT(DISTINCT r.supervisor_id) AS cnt
                FROM ratings r
                JOIN supervisors s ON r.supervisor_id = s.id
                WHERE s.school_code = :school_code
            """),
            {"school_code": school_code},
        ).scalar()
        or 0
    )

    agg = db.execute(
        text("""
            SELECT
                AVG(r.overall_score) AS avg_overall,
                AVG(r.score_academic) AS avg_academic,
                AVG(r.score_mentoring) AS avg_mentoring,
                AVG(r.score_wellbeing) AS avg_wellbeing,
                AVG(r.score_stipend) AS avg_stipend,
                AVG(r.score_resources) AS avg_resources,
                AVG(r.score_ethics) AS avg_ethics,
                COUNT(r.id) AS total_ratings
            FROM ratings r
            JOIN supervisors s ON r.supervisor_id = s.id
            WHERE s.school_code = :school_code
        """),
        {"school_code": school_code},
    ).one()
    avg_sub_scores = ScoreBreakdown(
        avg_overall=_f(agg.avg_overall),
        avg_academic=_f(agg.avg_academic),
        avg_mentoring=_f(agg.avg_mentoring),
        avg_wellbeing=_f(agg.avg_wellbeing),
        avg_stipend=_f(agg.avg_stipend),
        avg_resources=_f(agg.avg_resources),
        avg_ethics=_f(agg.avg_ethics),
        total_ratings=agg.total_ratings or 0,
    )

    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    recent_ratings = (
        db.execute(
            text("""
                SELECT COUNT(r.id) AS cnt
                FROM ratings r
                JOIN supervisors s ON r.supervisor_id = s.id
                WHERE s.school_code = :school_code AND r.created_at >= :cutoff
            """),
            {"school_code": school_code, "cutoff": thirty_days_ago},
        ).scalar()
        or 0
    )

    dept_rows = db.execute(
        text("""
            SELECT
                s.department,
                COUNT(DISTINCT s.id) AS supervisor_count,
                COUNT(r.id) AS rating_count,
                AVG(r.overall_score) AS avg_overall
            FROM supervisors s
            LEFT JOIN ratings r ON r.supervisor_id = s.id
            WHERE s.school_code = :school_code
            GROUP BY s.department
            ORDER BY avg_overall DESC NULLS LAST
        """),
        {"school_code": school_code},
    ).fetchall()
    departments = [
        DepartmentStats(
            department=r.department,
            avg_overall=_f(r.avg_overall),
            rating_count=r.rating_count or 0,
            supervisor_count=r.supervisor_count or 0,
        )
        for r in dept_rows
    ]

    top_rows = db.execute(
        text("""
            SELECT
                s.id::text AS supervisor_id,
                s.name AS supervisor_name,
                s.department,
                ROUND(AVG(r.overall_score)::numeric, 2) AS avg_score,
                COUNT(r.id) AS rating_count
            FROM supervisors s
            JOIN ratings r ON r.supervisor_id = s.id
            WHERE s.school_code = :school_code
            GROUP BY s.id, s.name, s.department
            HAVING COUNT(r.id) >= 1
            ORDER BY AVG(r.overall_score) DESC
            LIMIT 5
        """),
        {"school_code": school_code},
    ).fetchall()
    top_supervisors = [
        {
            "supervisor_id": r.supervisor_id,
            "supervisor_name": r.supervisor_name,
            "department": r.department,
            "avg_score": float(r.avg_score),
            "rating_count": r.rating_count,
        }
        for r in top_rows
    ]

    school_percentile = None
    if agg.avg_overall is not None:
        pct_row = db.execute(
            text("""
                WITH school_avgs AS (
                    SELECT
                        s.school_code,
                        AVG(r.overall_score) AS avg_overall
                    FROM supervisors s
                    JOIN ratings r ON r.supervisor_id = s.id
                    GROUP BY s.school_code
                ),
                ranked AS (
                    SELECT
                        school_code,
                        PERCENT_RANK() OVER (ORDER BY avg_overall) AS pct
                    FROM school_avgs
                )
                SELECT pct FROM ranked WHERE school_code = :school_code
            """),
            {"school_code": school_code},
        ).fetchone()
        if pct_row:
            school_percentile = _f(pct_row.pct, 4)

    return SchoolAnalytics(
        school_code=school_code,
        school_name=school.school_name,
        province=school.province,
        total_supervisors=total_sups,
        rated_supervisors=rated_sups,
        unrated_supervisors=total_sups - rated_sups,
        avg_overall_score=_f(agg.avg_overall),
        avg_sub_scores=avg_sub_scores,
        departments=departments,
        total_ratings=agg.total_ratings or 0,
        recent_ratings=recent_ratings,
        school_percentile=school_percentile,
        top_supervisors=top_supervisors,
    )


def get_rankings(
    db: Session,
    dimension: str = "overall",
    school_code: Optional[str] = None,
    province: Optional[str] = None,
    department: Optional[str] = None,
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 20,
    min_ratings: int = 1,
    user_status: str = "all",
) -> RankingsResponse:
    score_expr = VALID_DIMENSIONS.get(dimension, VALID_DIMENSIONS["overall"])
    sort_dir = "ASC" if sort_order == "asc" else "DESC"

    conditions: list[str] = []
    params: dict = {"min_ratings": min_ratings}
    if school_code:
        conditions.append("s.school_code = :school_code")
        params["school_code"] = school_code
    if province:
        conditions.append("s.province = :province")
        params["province"] = province
    if department:
        conditions.append("s.department = :department")
        params["department"] = department
    if user_status == "verified":
        conditions.append("r.is_verified_rating = true")
    elif user_status == "unverified":
        conditions.append("r.is_verified_rating = false")

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    count_sql = f"""
        SELECT COUNT(*) FROM (
            SELECT s.id
            FROM supervisors s
            JOIN ratings r ON r.supervisor_id = s.id
            {where_clause}
            GROUP BY s.id
            HAVING COUNT(r.id) >= :min_ratings
        ) AS sub
    """
    total = db.execute(text(count_sql), params).scalar() or 0

    params["offset"] = (page - 1) * page_size
    params["limit"] = page_size

    data_sql = f"""
        SELECT
            ROW_NUMBER() OVER (ORDER BY {score_expr} {sort_dir} NULLS LAST) AS rank,
            s.id::text AS supervisor_id,
            s.name AS supervisor_name,
            s.school_name,
            s.school_code,
            s.department,
            ROUND(({score_expr})::numeric, 2) AS avg_score,
            COUNT(r.id) AS rating_count
        FROM supervisors s
        JOIN ratings r ON r.supervisor_id = s.id
        {where_clause}
        GROUP BY s.id, s.name, s.school_name, s.school_code, s.department
        HAVING COUNT(r.id) >= :min_ratings
        ORDER BY {score_expr} {sort_dir} NULLS LAST
        LIMIT :limit OFFSET :offset
    """
    rows = db.execute(text(data_sql), params).fetchall()

    items = [
        RankingEntry(
            rank=r.rank,
            supervisor_id=uuid.UUID(r.supervisor_id),
            supervisor_name=r.supervisor_name,
            school_name=r.school_name,
            school_code=r.school_code,
            department=r.department,
            avg_score=float(r.avg_score),
            rating_count=r.rating_count,
        )
        for r in rows
    ]

    return RankingsResponse(items=items, total=total, page=page, page_size=page_size)


def get_overview(db: Session) -> OverviewStats:
    """Return cached overview stats; refreshes after _OVERVIEW_TTL (24 h)."""
    with _overview_lock:
        cached_at: Optional[datetime] = _overview_cache.get("cached_at")
        if cached_at is not None:
            if datetime.now(timezone.utc) - cached_at < _OVERVIEW_TTL:
                return _overview_cache["data"]

    # Cache miss — run DB queries outside the lock to avoid blocking other threads.
    total_supervisors = db.query(func.count(Supervisor.id)).scalar() or 0
    total_ratings = db.query(func.count(Rating.id)).scalar() or 0
    total_users = db.query(func.count(User.id)).scalar() or 0
    rated_supervisors = db.query(func.count(func.distinct(Rating.supervisor_id))).scalar() or 0

    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    recent_ratings = (
        db.query(func.count(Rating.id)).filter(Rating.created_at >= thirty_days_ago).scalar() or 0
    )

    school_rows = db.execute(
        text("""
            SELECT
                s.school_name,
                s.school_code,
                COUNT(r.id) AS rating_count
            FROM supervisors s
            JOIN ratings r ON r.supervisor_id = s.id
            GROUP BY s.school_name, s.school_code
            ORDER BY rating_count DESC
            LIMIT 5
        """)
    ).fetchall()
    most_active_schools = [
        {"school_name": r.school_name, "school_code": r.school_code, "rating_count": r.rating_count}
        for r in school_rows
    ]

    refreshed_at = datetime.now(timezone.utc)
    result = OverviewStats(
        total_supervisors=total_supervisors,
        total_ratings=total_ratings,
        total_users=total_users,
        rated_supervisors=rated_supervisors,
        most_active_schools=most_active_schools,
        recent_ratings_30d=recent_ratings,
        last_refreshed=refreshed_at.isoformat(),
    )

    with _overview_lock:
        _overview_cache["data"] = result
        _overview_cache["cached_at"] = refreshed_at

    return result
