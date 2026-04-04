import uuid
from datetime import datetime
from typing import Any, Literal, Optional
from pydantic import BaseModel

# Inline enums to avoid importing from models (prevents circular imports)
ProposalStatus = Literal["pending", "approved", "rejected"]
ReviewDecision = Literal["approve", "reject"]


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
    previous_data: Optional[dict[str, Any]] = None
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
