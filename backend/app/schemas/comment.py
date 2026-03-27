import uuid
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, field_validator

# Inline enum to avoid importing from models (prevents circular imports)
VoteType = Literal["up", "down"]


class CommentCreate(BaseModel):
    supervisor_id: uuid.UUID
    parent_comment_id: Optional[uuid.UUID] = None
    content: str
    # Accept None from clients that omit the field; coerce to False
    is_anonymous: Optional[bool] = False


class CommentUpdate(BaseModel):
    content: str


class CommentAuthorResponse(BaseModel):
    id: uuid.UUID
    display_name: Optional[str] = None
    is_student_verified: bool = False

    model_config = {"from_attributes": True}


class CommentResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    supervisor_id: uuid.UUID
    parent_comment_id: Optional[uuid.UUID] = None
    content: str
    is_verified_comment: bool = False
    is_deleted: bool = False
    is_edited: bool = False
    is_anonymous: bool = False
    likes_count: int
    dislikes_count: int
    is_flagged: bool
    user_vote: Optional[VoteType] = None
    reply_count: int = 0
    author: Optional[CommentAuthorResponse] = None
    replies: list["CommentResponse"] = []
    supervisor_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("is_anonymous", mode="before")
    @classmethod
    def _coerce_none_to_false(cls, v: object) -> bool:
        """Coerce NULL from pre-migration rows to False so serialization never crashes."""
        return False if v is None else v


CommentResponse.model_rebuild()


class CommentVoteCreate(BaseModel):
    vote_type: VoteType


class CommentListResponse(BaseModel):
    items: list[CommentResponse]
    total: int
    page: int
    page_size: int
