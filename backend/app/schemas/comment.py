import uuid
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel

# Inline enum to avoid importing from models (prevents circular imports)
VoteType = Literal["up", "down"]


class CommentCreate(BaseModel):
    supervisor_id: uuid.UUID
    parent_comment_id: Optional[uuid.UUID] = None
    content: str


class CommentUpdate(BaseModel):
    content: str


class CommentResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    supervisor_id: uuid.UUID
    parent_comment_id: Optional[uuid.UUID] = None
    content: str
    likes_count: int
    dislikes_count: int
    is_flagged: bool
    user_vote: Optional[VoteType] = None
    reply_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CommentVoteCreate(BaseModel):
    vote_type: VoteType


class CommentListResponse(BaseModel):
    items: list[CommentResponse]
    total: int
    page: int
    page_size: int
