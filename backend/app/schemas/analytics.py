import uuid
from typing import Optional
from pydantic import BaseModel


class ScoreBreakdown(BaseModel):
    avg_overall: Optional[float] = None
    avg_academic: Optional[float] = None
    avg_mentoring: Optional[float] = None
    avg_wellbeing: Optional[float] = None
    avg_stipend: Optional[float] = None
    avg_resources: Optional[float] = None
    avg_ethics: Optional[float] = None
    total_ratings: int = 0
    verified_ratings: int = 0


class SupervisorAnalytics(BaseModel):
    supervisor_id: uuid.UUID
    supervisor_name: str
    school_name: str
    scores: ScoreBreakdown
    score_distribution: dict[str, int] = {}  # e.g. {"5": 10, "4": 5, ...}
    comment_count: int = 0


class SchoolAnalytics(BaseModel):
    school_code: str
    school_name: str
    province: str
    total_supervisors: int
    rated_supervisors: int
    avg_overall_score: Optional[float] = None
    top_supervisors: list[dict] = []


class RankingEntry(BaseModel):
    rank: int
    supervisor_id: uuid.UUID
    supervisor_name: str
    school_name: str
    avg_score: float
    rating_count: int


class RankingsResponse(BaseModel):
    by_overall: list[RankingEntry] = []
    by_school: list[SchoolAnalytics] = []
