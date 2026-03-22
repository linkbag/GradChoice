"""Rating aggregation service.

Computes and caches aggregate score statistics for a supervisor after
any rating is created, updated, or deleted.
"""
import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.rating import Rating
from app.models.supervisor_rating_cache import SupervisorRatingCache


def _avg(values: list) -> float | None:
    """Return the mean of non-None values, or None if no values."""
    filtered = [float(v) for v in values if v is not None]
    if not filtered:
        return None
    return round(sum(filtered) / len(filtered), 2)


def _distribution(ratings: list[Rating]) -> dict[int, int]:
    """Count ratings by rounded overall score bucket (1–5)."""
    dist = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for r in ratings:
        # Round to nearest integer for bucketing (handles .5 increments)
        bucket = int(round(float(r.overall_score)))
        if 1 <= bucket <= 5:
            dist[bucket] += 1
    return dist


def compute_supervisor_aggregates(supervisor_id: uuid.UUID, db: Session) -> None:
    """Recompute and upsert cached aggregate statistics for a supervisor.

    Called after every rating insert, update, or delete.
    """
    all_ratings: list[Rating] = (
        db.query(Rating).filter(Rating.supervisor_id == supervisor_id).all()
    )
    verified: list[Rating] = [r for r in all_ratings if r.is_verified_rating]

    dist = _distribution(all_ratings)

    cache = (
        db.query(SupervisorRatingCache)
        .filter(SupervisorRatingCache.supervisor_id == supervisor_id)
        .first()
    )
    if cache is None:
        cache = SupervisorRatingCache(supervisor_id=supervisor_id)
        db.add(cache)

    # All-user averages
    cache.all_avg_overall = _avg([r.overall_score for r in all_ratings])
    cache.all_avg_academic = _avg([r.score_academic for r in all_ratings])
    cache.all_avg_mentoring = _avg([r.score_mentoring for r in all_ratings])
    cache.all_avg_wellbeing = _avg([r.score_wellbeing for r in all_ratings])
    cache.all_avg_stipend = _avg([r.score_stipend for r in all_ratings])
    cache.all_avg_resources = _avg([r.score_resources for r in all_ratings])
    cache.all_avg_ethics = _avg([r.score_ethics for r in all_ratings])

    # Verified-user averages
    cache.verified_avg_overall = _avg([r.overall_score for r in verified])
    cache.verified_avg_academic = _avg([r.score_academic for r in verified])
    cache.verified_avg_mentoring = _avg([r.score_mentoring for r in verified])
    cache.verified_avg_wellbeing = _avg([r.score_wellbeing for r in verified])
    cache.verified_avg_stipend = _avg([r.score_stipend for r in verified])
    cache.verified_avg_resources = _avg([r.score_resources for r in verified])
    cache.verified_avg_ethics = _avg([r.score_ethics for r in verified])

    # Counts
    cache.all_count = len(all_ratings)
    cache.verified_count = len(verified)

    # Distribution
    cache.distribution_1 = dist[1]
    cache.distribution_2 = dist[2]
    cache.distribution_3 = dist[3]
    cache.distribution_4 = dist[4]
    cache.distribution_5 = dist[5]

    cache.updated_at = datetime.utcnow()
    db.commit()
