import uuid
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, field_validator

from app.models.rating import VoteType

# Valid half-star increments: 1.0, 1.5, 2.0, ... 5.0
_VALID_SCORES = {round(x * 0.5, 1) for x in range(2, 11)}


def _validate_score(v):
    if v is None:
        return v
    v = float(v)
    if v not in _VALID_SCORES:
        raise ValueError("评分必须为0.5的倍数（1.0–5.0）")
    return v


class RatingCreate(BaseModel):
    supervisor_id: uuid.UUID
    overall_score: float
    score_academic: Optional[float] = None
    score_mentoring: Optional[float] = None
    score_wellbeing: Optional[float] = None
    score_stipend: Optional[float] = None
    score_resources: Optional[float] = None
    score_ethics: Optional[float] = None

    @field_validator(
        "overall_score",
        "score_academic",
        "score_mentoring",
        "score_wellbeing",
        "score_stipend",
        "score_resources",
        "score_ethics",
        mode="before",
    )
    @classmethod
    def validate_score(cls, v):
        return _validate_score(v)


class RatingUpdate(BaseModel):
    overall_score: Optional[float] = None
    score_academic: Optional[float] = None
    score_mentoring: Optional[float] = None
    score_wellbeing: Optional[float] = None
    score_stipend: Optional[float] = None
    score_resources: Optional[float] = None
    score_ethics: Optional[float] = None

    @field_validator(
        "overall_score",
        "score_academic",
        "score_mentoring",
        "score_wellbeing",
        "score_stipend",
        "score_resources",
        "score_ethics",
        mode="before",
    )
    @classmethod
    def validate_score(cls, v):
        return _validate_score(v)


class RatingResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    supervisor_id: uuid.UUID
    display_name: str  # "匿名用户" or user's display_name
    is_verified_rating: bool
    overall_score: float
    score_academic: Optional[float] = None
    score_mentoring: Optional[float] = None
    score_wellbeing: Optional[float] = None
    score_stipend: Optional[float] = None
    score_resources: Optional[float] = None
    score_ethics: Optional[float] = None
    upvotes: int = 0
    downvotes: int = 0
    user_vote: Optional[VoteType] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RatingListResponse(BaseModel):
    items: list[RatingResponse]
    total: int
    page: int
    page_size: int


class RatingVoteCreate(BaseModel):
    vote_type: VoteType


class SupervisorRatingCacheResponse(BaseModel):
    supervisor_id: uuid.UUID
    all_avg_overall: Optional[float] = None
    all_avg_academic: Optional[float] = None
    all_avg_mentoring: Optional[float] = None
    all_avg_wellbeing: Optional[float] = None
    all_avg_stipend: Optional[float] = None
    all_avg_resources: Optional[float] = None
    all_avg_ethics: Optional[float] = None
    verified_avg_overall: Optional[float] = None
    verified_avg_academic: Optional[float] = None
    verified_avg_mentoring: Optional[float] = None
    verified_avg_wellbeing: Optional[float] = None
    verified_avg_stipend: Optional[float] = None
    verified_avg_resources: Optional[float] = None
    verified_avg_ethics: Optional[float] = None
    all_count: int = 0
    verified_count: int = 0
    distribution_1: int = 0
    distribution_2: int = 0
    distribution_3: int = 0
    distribution_4: int = 0
    distribution_5: int = 0
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
