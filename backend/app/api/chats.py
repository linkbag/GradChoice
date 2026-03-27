import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.chat import Chat, ChatMessage
from app.schemas.chat import (
    ChatCreate, ChatResponse, ChatMessageCreate, ChatMessageResponse, ChatMessagesResponse
)
from app.utils.auth import get_current_user

router = APIRouter(prefix="/chats", tags=["私信"])

MAX_MESSAGES_PER_CHAT = 2


def _enforce_message_limit(chat_id: uuid.UUID, db: Session) -> None:
    """Keep only the most recent MAX_MESSAGES_PER_CHAT messages in a chat."""
    keep_ids = (
        db.query(ChatMessage.id)
        .filter(ChatMessage.chat_id == chat_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(MAX_MESSAGES_PER_CHAT)
        .subquery()
    )
    db.query(ChatMessage).filter(
        ChatMessage.chat_id == chat_id,
        ChatMessage.id.notin_(keep_ids),
    ).delete(synchronize_session="fetch")


def _chat_response(chat: Chat, user_id: uuid.UUID, db: Session) -> ChatResponse:
    # Get last message and unread count
    last_msg = db.query(ChatMessage).filter(
        ChatMessage.chat_id == chat.id
    ).order_by(ChatMessage.created_at.desc()).first()
    unread = db.query(ChatMessage).filter(
        ChatMessage.chat_id == chat.id,
        ChatMessage.sender_id != user_id,
        ChatMessage.is_read.is_(False),
    ).count()
    chat.last_message = last_msg.content if last_msg else None
    chat.unread_count = unread
    return ChatResponse.model_validate(chat)


@router.get("/unread-count")
def get_unread_count(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """获取未读消息总数"""
    # Get all chats where user is participant
    chat_ids = db.query(Chat.id).filter(
        (Chat.initiator_id == current_user.id) | (Chat.recipient_id == current_user.id)
    ).subquery()
    count = db.query(ChatMessage).filter(
        ChatMessage.chat_id.in_(chat_ids),
        ChatMessage.sender_id != current_user.id,
        ChatMessage.is_read.is_(False),
    ).count()
    return {"unread_count": count}


@router.post("", response_model=ChatResponse, status_code=201)
def create_chat(
    chat_in: ChatCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """发起私信会话"""
    from app.models.user import User
    recipient = db.query(User).filter(User.id == chat_in.recipient_id).first()
    if not recipient:
        raise HTTPException(status_code=404, detail="收件人不存在")
    if chat_in.recipient_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能和自己私信")

    # Check if chat already exists
    existing = db.query(Chat).filter(
        ((Chat.initiator_id == current_user.id) & (Chat.recipient_id == chat_in.recipient_id)) |
        ((Chat.initiator_id == chat_in.recipient_id) & (Chat.recipient_id == current_user.id))
    ).first()

    if existing:
        # Add message to existing chat
        msg = ChatMessage(
            chat_id=existing.id,
            sender_id=current_user.id,
            content=chat_in.initial_message,
        )
        db.add(msg)
        db.flush()
        _enforce_message_limit(existing.id, db)
        db.commit()
        return _chat_response(existing, current_user.id, db)

    chat = Chat(
        initiator_id=current_user.id,
        recipient_id=chat_in.recipient_id,
        supervisor_id=chat_in.supervisor_id,
    )
    db.add(chat)
    db.flush()

    msg = ChatMessage(
        chat_id=chat.id,
        sender_id=current_user.id,
        content=chat_in.initial_message,
    )
    db.add(msg)
    db.flush()
    _enforce_message_limit(chat.id, db)
    db.commit()
    db.refresh(chat)
    return _chat_response(chat, current_user.id, db)


@router.get("", response_model=list[ChatResponse])
def list_chats(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """获取当前用户的所有会话"""
    chats = db.query(Chat).filter(
        (Chat.initiator_id == current_user.id) | (Chat.recipient_id == current_user.id)
    ).order_by(Chat.created_at.desc()).all()
    return [_chat_response(c, current_user.id, db) for c in chats]


@router.get("/{chat_id}/messages", response_model=ChatMessagesResponse)
def get_messages(
    chat_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取会话消息历史"""
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="会话不存在")
    if chat.initiator_id != current_user.id and chat.recipient_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问该会话")

    # Mark messages from other user as read
    db.query(ChatMessage).filter(
        ChatMessage.chat_id == chat_id,
        ChatMessage.sender_id != current_user.id,
        ChatMessage.is_read.is_(False),
    ).update({"is_read": True})
    db.commit()

    q = db.query(ChatMessage).filter(ChatMessage.chat_id == chat_id)
    total = q.count()
    messages = q.order_by(ChatMessage.created_at.asc()).offset((page - 1) * page_size).limit(page_size).all()
    return ChatMessagesResponse(items=messages, total=total, page=page, page_size=page_size)


@router.post("/{chat_id}/messages", response_model=ChatMessageResponse, status_code=201)
def send_message(
    chat_id: uuid.UUID,
    message_in: ChatMessageCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """发送消息"""
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="会话不存在")
    if chat.initiator_id != current_user.id and chat.recipient_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问该会话")

    msg = ChatMessage(
        chat_id=chat_id,
        sender_id=current_user.id,
        content=message_in.content,
    )
    db.add(msg)
    db.flush()
    _enforce_message_limit(chat_id, db)
    db.commit()
    db.refresh(msg)
    return msg
