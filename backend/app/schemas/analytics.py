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


class PercentileRankings(BaseModel):
    dept_percentile: Optional[float] = None
    school_percentile: Optional[float] = None
    province_percentile: Optional[float] = None
    national_percentile: Optional[float] = None


class ScoreTrend(BaseModel):
    month: str  # e.g. "2024-01"
    avg_overall: float
    rating_count: int


class DepartmentStats(BaseModel):
    department: str
    avg_overall: Optional[float] = None
    rating_count: int = 0
    supervisor_count: int = 0


class SupervisorAnalytics(BaseModel):
    supervisor_id: uuid.UUID
    supervisor_name: str
    school_name: str
    department: str
    scores: ScoreBreakdown
    verified_scores: ScoreBreakdown
    score_distribution: dict[str, int] = {}
    comment_count: int = 0
    percentiles: Optional[PercentileRankings] = None
    score_trends: list[ScoreTrend] = []
    school_avg_scores: ScoreBreakdown = ScoreBreakdown()
    national_avg_scores: ScoreBreakdown = ScoreBreakdown()
    avg_first_year_income: Optional[float] = None


class SchoolAnalytics(BaseModel):
    school_code: str
    school_name: str
    province: str
    total_supervisors: int
    rated_supervisors: int
    unrated_supervisors: int = 0
    avg_overall_score: Optional[float] = None
    avg_sub_scores: ScoreBreakdown = ScoreBreakdown()
    departments: list[DepartmentStats] = []
    total_ratings: int = 0
    recent_ratings: int = 0
    school_percentile: Optional[float] = None
    top_supervisors: list[dict] = []


class RankingEntry(BaseModel):
    rank: int
    supervisor_id: uuid.UUID
    supervisor_name: str
    school_name: str
    school_code: str
    department: str
    avg_score: float
    rating_count: int


class RankingsResponse(BaseModel):
    items: list[RankingEntry] = []
    total: int = 0
    page: int = 1
    page_size: int = 20


class OverviewStats(BaseModel):
    total_supervisors: int = 0
    total_ratings: int = 0
    total_users: int = 0
    rated_supervisors: int = 0
    most_active_schools: list[dict] = []
    recent_ratings_30d: int = 0
    last_refreshed: Optional[str] = None  # ISO 8601 UTC string; None on first request
