import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ChatCreate(BaseModel):
    recipient_id: uuid.UUID
    supervisor_id: Optional[uuid.UUID] = None
    initial_message: str


class ChatResponse(BaseModel):
    id: uuid.UUID
    initiator_id: uuid.UUID
    recipient_id: uuid.UUID
    supervisor_id: Optional[uuid.UUID] = None
    last_message: Optional[str] = None
    unread_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatMessageCreate(BaseModel):
    content: str


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
