import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator

from app.models.comment import VoteType
from app.models.flag import FlagReason


class CommentCreate(BaseModel):
    supervisor_id: uuid.UUID
    parent_comment_id: Optional[uuid.UUID] = None
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("评论内容不能为空")
        if len(v) > 5000:
            raise ValueError("评论内容不能超过5000字")
        return v


class CommentUpdate(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("评论内容不能为空")
        if len(v) > 5000:
            raise ValueError("评论内容不能超过5000字")
        return v


class CommentAuthor(BaseModel):
    id: uuid.UUID
    display_name: Optional[str] = None
    is_student_verified: bool

    model_config = {"from_attributes": True}


class CommentResponse(BaseModel):
    id: uuid.UUID
    supervisor_id: uuid.UUID
    parent_comment_id: Optional[uuid.UUID] = None
    content: str
    is_deleted: bool = False
    is_edited: bool = False
    likes_count: int
    dislikes_count: int
    is_flagged: bool
    user_vote: Optional[VoteType] = None
    reply_count: int = 0
    author: Optional[CommentAuthor] = None
    replies: list["CommentResponse"] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


CommentResponse.model_rebuild()


class CommentVoteCreate(BaseModel):
    vote_type: VoteType


class FlagCreate(BaseModel):
    reason: FlagReason
    detail: Optional[str] = None


class SortOrder(str):
    newest = "newest"
    oldest = "oldest"
    most_liked = "most_liked"
    most_discussed = "most_discussed"


class CommentListResponse(BaseModel):
    items: list[CommentResponse]
    total: int
    page: int
    page_size: int
