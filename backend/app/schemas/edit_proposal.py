import uuid
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel

from app.models.edit_proposal import ProposalStatus, ReviewDecision


class EditProposalCreate(BaseModel):
    supervisor_id: Optional[uuid.UUID] = None  # null = proposing new supervisor
    proposed_data: dict[str, Any]


class ReviewAction(BaseModel):
    decision: ReviewDecision
    comment: Optional[str] = None


class EditProposalResponse(BaseModel):
    id: uuid.UUID
    supervisor_id: Optional[uuid.UUID] = None
    proposed_by: uuid.UUID
    proposed_data: dict[str, Any]
    status: ProposalStatus
    reviewer_1_id: Optional[uuid.UUID] = None
    reviewer_1_decision: Optional[ReviewDecision] = None
    reviewer_2_id: Optional[uuid.UUID] = None
    reviewer_2_decision: Optional[ReviewDecision] = None
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class EditProposalListResponse(BaseModel):
    items: list[EditProposalResponse]
    total: int
    page: int
    page_size: int
