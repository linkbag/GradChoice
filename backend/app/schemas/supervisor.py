import uuid
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel


class SupervisorBase(BaseModel):
    school_code: str
    school_name: str
    province: str
    name: str
    department: str
    title: Optional[str] = None
    affiliated_unit: Optional[str] = None
    webpage_url_1: Optional[str] = None
    webpage_url_2: Optional[str] = None
    webpage_url_3: Optional[str] = None


class SupervisorCreate(SupervisorBase):
    pass


class SupervisorUpdate(BaseModel):
    title: Optional[str] = None
    affiliated_unit: Optional[str] = None
    webpage_url_1: Optional[str] = None
    webpage_url_2: Optional[str] = None
    webpage_url_3: Optional[str] = None


class SupervisorResponse(SupervisorBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RecentComment(BaseModel):
    id: uuid.UUID
    content: str
    likes_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class SupervisorDetailResponse(SupervisorBase):
    """Full supervisor profile with aggregated rating data."""
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    # All-ratings aggregates
    avg_overall: Optional[float] = None
    avg_academic: Optional[float] = None
    avg_mentoring: Optional[float] = None
    avg_wellbeing: Optional[float] = None
    avg_stipend: Optional[float] = None
    avg_resources: Optional[float] = None
    avg_ethics: Optional[float] = None
    rating_count: int = 0

    # Verified-only aggregates
    verified_rating_count: int = 0
    verified_avg_overall: Optional[float] = None

    # Distribution: {"1": n, "2": n, ...}
    rating_distribution: dict[str, int] = {}

    # Latest comments (up to 5)
    recent_comments: list[RecentComment] = []

    model_config = {"from_attributes": True}


class SupervisorSearchResult(BaseModel):
    id: uuid.UUID
    school_code: str
    school_name: str
    province: str
    name: str
    department: str
    title: Optional[str] = None
    avg_overall_score: Optional[float] = None
    rating_count: int = 0

    model_config = {"from_attributes": True}


class SupervisorListResponse(BaseModel):
    items: list[SupervisorSearchResult]
    total: int
    page: int
    page_size: int


# --- School / Province directory ---

class SchoolListItem(BaseModel):
    school_code: str
    school_name: str
    province: str
    supervisor_count: int
    rated_supervisor_count: int = 0
    avg_overall_score: Optional[float] = None


class SchoolListResponse(BaseModel):
    items: list[SchoolListItem]
    total: int


class ProvinceListItem(BaseModel):
    province: str
    school_count: int
    supervisor_count: int


class DepartmentGroup(BaseModel):
    department: str
    supervisors: list[SupervisorSearchResult]


class SchoolSupervisorsResponse(BaseModel):
    school_code: str
    school_name: str
    province: str
    total_count: int
    departments: list[DepartmentGroup]
