import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.chat import (
    ChatCreate, ChatResponse, ChatMessageCreate, ChatMessageResponse, ChatMessagesResponse
)
from app.utils.auth import get_current_verified_user

router = APIRouter(prefix="/chats", tags=["私信"])


@router.post("", response_model=ChatResponse, status_code=201)
def create_chat(
    chat_in: ChatCreate,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """发起私信会话"""
    # TODO: implement
    # 1. Check if chat between these users already exists (for this supervisor context)
    # 2. Create chat + first message
    raise HTTPException(status_code=501, detail="待实现")


@router.get("", response_model=list[ChatResponse])
def list_chats(current_user=Depends(get_current_verified_user), db: Session = Depends(get_db)):
    """获取当前用户的所有会话"""
    # TODO: implement — return chats where user is initiator or recipient
    raise HTTPException(status_code=501, detail="待实现")


@router.get("/{chat_id}/messages", response_model=ChatMessagesResponse)
def get_messages(
    chat_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """获取会话消息历史"""
    # TODO: implement — verify user is participant, mark messages as read
    raise HTTPException(status_code=501, detail="待实现")


@router.post("/{chat_id}/messages", response_model=ChatMessageResponse, status_code=201)
def send_message(
    chat_id: uuid.UUID,
    message_in: ChatMessageCreate,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """发送消息"""
    # TODO: implement — verify user is participant, encrypt content
    raise HTTPException(status_code=501, detail="待实现")
