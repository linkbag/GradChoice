import uuid
from datetime import datetime
from typing import Optional
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


class SupervisorSubmit(BaseModel):
    """User-submitted new supervisor — minimal required fields, rest auto-filled."""
    name: str
    school_name: str
    department: Optional[str] = ""
    school_code: Optional[str] = None
    province: Optional[str] = None
    title: Optional[str] = None
    website_url: Optional[str] = None


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
    comment_count: int = 0
    verified_avg_overall_score: Optional[float] = None
    verified_rating_count: int = 0

    model_config = {"from_attributes": True}


class SupervisorListResponse(BaseModel):
    items: list[SupervisorSearchResult]
    total: int
    page: int
    page_size: int


class SupervisorLimitedResult(BaseModel):
    id: uuid.UUID
    name: str
    school_name: str
    department: Optional[str] = None

    model_config = {"from_attributes": True}


class SupervisorLimitedListResponse(BaseModel):
    items: list[SupervisorLimitedResult]
    total: int
    page: int
    page_size: int
    requires_login: bool = True
