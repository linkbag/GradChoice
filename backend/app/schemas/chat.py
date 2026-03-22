import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator


class ChatCreate(BaseModel):
    recipient_id: uuid.UUID
    supervisor_id: Optional[uuid.UUID] = None
    initial_message: str

    @field_validator("initial_message")
    @classmethod
    def validate_initial_message(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("消息不能为空")
        if len(v) > 2000:
            raise ValueError("消息不能超过2000个字符")
        return v


class ChatResponse(BaseModel):
    id: uuid.UUID
    initiator_id: uuid.UUID
    recipient_id: uuid.UUID
    supervisor_id: Optional[uuid.UUID] = None
    # Computed fields for list view
    other_user_id: Optional[uuid.UUID] = None
    other_user_display_name: Optional[str] = None
    supervisor_name: Optional[str] = None
    school_name: Optional[str] = None
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatMessageCreate(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("消息不能为空")
        if len(v) > 2000:
            raise ValueError("消息不能超过2000个字符")
        return v


class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    chat_id: uuid.UUID
    sender_id: uuid.UUID
    content: str
    read_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatMessagesResponse(BaseModel):
    items: list[ChatMessageResponse]
    total: int
    page: int
    page_size: int
    has_more: bool = False


class UnreadCountResponse(BaseModel):
    unread_count: int
