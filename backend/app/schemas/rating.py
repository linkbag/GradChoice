import uuid
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, field_validator

# Inline enum to avoid importing from models (prevents circular imports)
VoteType = Literal["up", "down"]


class RatingCreate(BaseModel):
    supervisor_id: uuid.UUID
    overall_score: float
    score_academic: Optional[float] = None
    score_mentoring: Optional[float] = None
    score_wellbeing: Optional[float] = None
    score_stipend: Optional[float] = None
    score_resources: Optional[float] = None
    score_ethics: Optional[float] = None

    @field_validator("overall_score", "score_academic", "score_mentoring",
                     "score_wellbeing", "score_stipend", "score_resources", "score_ethics",
                     mode="before")
    @classmethod
    def validate_score(cls, v):
        if v is not None and not (1.0 <= v <= 5.0):
            raise ValueError("评分必须在1到5之间")
        return v


class RatingUpdate(BaseModel):
    overall_score: Optional[float] = None
    score_academic: Optional[float] = None
    score_mentoring: Optional[float] = None
    score_wellbeing: Optional[float] = None
    score_stipend: Optional[float] = None
    score_resources: Optional[float] = None
    score_ethics: Optional[float] = None


class RatingResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    supervisor_id: uuid.UUID
    display_name: Optional[str] = None
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
