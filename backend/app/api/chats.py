import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, and_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.chat import Chat, ChatMessage
from app.models.user import User
from app.models.supervisor import Supervisor
from app.schemas.chat import (
    ChatCreate,
    ChatResponse,
    ChatMessageCreate,
    ChatMessageResponse,
    ChatMessagesResponse,
    UnreadCountResponse,
)
from app.utils.auth import get_current_verified_user
from app.services.chat_notification import notify_new_message

router = APIRouter(prefix="/chats", tags=["私信"])

# Rate limit: max 60 messages per hour per user
_RATE_LIMIT_MESSAGES = 60
_RATE_LIMIT_WINDOW_MINUTES = 60


def _build_chat_response(chat: Chat, current_user_id: uuid.UUID, db: Session) -> ChatResponse:
    """Build a ChatResponse with computed fields (other user, last message, unread count)."""
    # Determine other user
    if chat.initiator_id == current_user_id:
        other_user_id = chat.recipient_id
    else:
        other_user_id = chat.initiator_id

    other_user = db.query(User).filter(User.id == other_user_id).first()
    other_user_display_name = other_user.display_name if other_user else None

    # Supervisor context
    supervisor_name = None
    school_name = None
    if chat.supervisor_id:
        supervisor = db.query(Supervisor).filter(Supervisor.id == chat.supervisor_id).first()
        if supervisor:
            supervisor_name = supervisor.name
            school_name = supervisor.school_name

    # Last message
    last_msg = (
        db.query(ChatMessage)
        .filter(ChatMessage.chat_id == chat.id)
        .order_by(ChatMessage.created_at.desc())
        .first()
    )
    last_message = last_msg.content[:100] if last_msg else None
    last_message_at = last_msg.created_at if last_msg else None

    # Unread count (messages not sent by current user that are unread)
    unread_count = (
        db.query(func.count(ChatMessage.id))
        .filter(
            ChatMessage.chat_id == chat.id,
            ChatMessage.sender_id != current_user_id,
            ChatMessage.read_at.is_(None),
        )
        .scalar()
        or 0
    )

    return ChatResponse(
        id=chat.id,
        initiator_id=chat.initiator_id,
        recipient_id=chat.recipient_id,
        supervisor_id=chat.supervisor_id,
        other_user_id=other_user_id,
        other_user_display_name=other_user_display_name,
        supervisor_name=supervisor_name,
        school_name=school_name,
        last_message=last_message,
        last_message_at=last_message_at,
        unread_count=unread_count,
        created_at=chat.created_at,
    )


def _check_rate_limit(user_id: uuid.UUID, db: Session) -> None:
    """Raise 429 if user has sent >= 60 messages in the last hour."""
    window_start = datetime.utcnow() - timedelta(minutes=_RATE_LIMIT_WINDOW_MINUTES)
    count = (
        db.query(func.count(ChatMessage.id))
        .filter(
            ChatMessage.sender_id == user_id,
            ChatMessage.created_at >= window_start,
        )
        .scalar()
        or 0
    )
    if count >= _RATE_LIMIT_MESSAGES:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="发送消息过于频繁，请稍后再试",
        )


# ─────────────────────────────────────────────────────────────
# IMPORTANT: /unread-count must come BEFORE /{chat_id} routes
# so FastAPI doesn't try to parse "unread-count" as a UUID.
# ─────────────────────────────────────────────────────────────

@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """获取当前用户的未读消息总数（用于导航栏角标）"""
    # Find all chat IDs where the current user is a participant
    chat_ids = (
        db.query(Chat.id)
        .filter(
            or_(
                Chat.initiator_id == current_user.id,
                Chat.recipient_id == current_user.id,
            )
        )
        .subquery()
    )

    unread_count = (
        db.query(func.count(ChatMessage.id))
        .filter(
            ChatMessage.chat_id.in_(chat_ids),
            ChatMessage.sender_id != current_user.id,
            ChatMessage.read_at.is_(None),
        )
        .scalar()
        or 0
    )

    return UnreadCountResponse(unread_count=unread_count)


@router.post("", response_model=ChatResponse, status_code=201)
def create_chat(
    chat_in: ChatCreate,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """发起私信会话。如果已存在相同两用户+导师的会话，则复用。"""
    # Can't chat with yourself
    if chat_in.recipient_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能给自己发私信",
        )

    # Verify recipient exists
    recipient = db.query(User).filter(User.id == chat_in.recipient_id).first()
    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在",
        )

    # Check for existing chat between these two users (bidirectional) about same supervisor
    existing_chat = (
        db.query(Chat)
        .filter(
            or_(
                and_(
                    Chat.initiator_id == current_user.id,
                    Chat.recipient_id == chat_in.recipient_id,
                ),
                and_(
                    Chat.initiator_id == chat_in.recipient_id,
                    Chat.recipient_id == current_user.id,
                ),
            ),
            Chat.supervisor_id == chat_in.supervisor_id,
        )
        .first()
    )

    if existing_chat:
        # Reuse existing chat — just send the initial message
        chat = existing_chat
    else:
        # Create new chat
        chat = Chat(
            initiator_id=current_user.id,
            recipient_id=chat_in.recipient_id,
            supervisor_id=chat_in.supervisor_id,
        )
        db.add(chat)
        db.flush()  # Get the chat ID before committing

    # Add the initial message
    _check_rate_limit(current_user.id, db)
    message = ChatMessage(
        chat_id=chat.id,
        sender_id=current_user.id,
        content=chat_in.initial_message,
    )
    db.add(message)
    db.commit()
    db.refresh(chat)

    # Send notification to recipient
    supervisor_name = None
    if chat_in.supervisor_id:
        supervisor = db.query(Supervisor).filter(Supervisor.id == chat_in.supervisor_id).first()
        if supervisor:
            supervisor_name = supervisor.name

    notify_new_message(
        chat_id=str(chat.id),
        recipient_email=recipient.email,
        recipient_notifications_enabled=recipient.email_notifications_enabled,
        supervisor_name=supervisor_name,
    )

    return _build_chat_response(chat, current_user.id, db)


@router.get("", response_model=list[ChatResponse])
def list_chats(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """获取当前用户的所有会话，按最近消息时间倒序排列"""
    # Subquery: latest message time per chat
    latest_msg_sq = (
        db.query(
            ChatMessage.chat_id,
            func.max(ChatMessage.created_at).label("last_at"),
        )
        .group_by(ChatMessage.chat_id)
        .subquery()
    )

    chats = (
        db.query(Chat)
        .outerjoin(latest_msg_sq, Chat.id == latest_msg_sq.c.chat_id)
        .filter(
            or_(
                Chat.initiator_id == current_user.id,
                Chat.recipient_id == current_user.id,
            )
        )
        .order_by(latest_msg_sq.c.last_at.desc().nullslast(), Chat.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return [_build_chat_response(chat, current_user.id, db) for chat in chats]


@router.get("/{chat_id}", response_model=ChatResponse)
def get_chat(
    chat_id: uuid.UUID,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """获取会话详情（验证参与者身份）"""
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="会话不存在")

    if chat.initiator_id != current_user.id and chat.recipient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问此会话")

    return _build_chat_response(chat, current_user.id, db)


@router.get("/{chat_id}/messages", response_model=ChatMessagesResponse)
def get_messages(
    chat_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    before_id: Optional[uuid.UUID] = Query(None, description="加载此消息ID之前的更早消息"),
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """获取会话消息历史（最旧在前），并将未读消息标为已读"""
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="会话不存在")

    if chat.initiator_id != current_user.id and chat.recipient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问此会话")

    query = db.query(ChatMessage).filter(ChatMessage.chat_id == chat_id)

    # Cursor-based: load messages before a given message ID
    if before_id is not None:
        anchor = db.query(ChatMessage).filter(ChatMessage.id == before_id).first()
        if anchor:
            query = query.filter(ChatMessage.created_at < anchor.created_at)

    total = query.count()

    messages = (
        query
        .order_by(ChatMessage.created_at.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # Mark messages sent by other user as read
    now = datetime.utcnow()
    unread_ids = [
        msg.id
        for msg in messages
        if msg.sender_id != current_user.id and msg.read_at is None
    ]
    if unread_ids:
        db.query(ChatMessage).filter(
            ChatMessage.id.in_(unread_ids)
        ).update({"read_at": now}, synchronize_session=False)
        db.commit()

    has_more = total > page * page_size

    return ChatMessagesResponse(
        items=[ChatMessageResponse.model_validate(m) for m in messages],
        total=total,
        page=page,
        page_size=page_size,
        has_more=has_more,
    )


@router.post("/{chat_id}/messages", response_model=ChatMessageResponse, status_code=201)
def send_message(
    chat_id: uuid.UUID,
    message_in: ChatMessageCreate,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """发送消息（验证参与者、限流、通知对方）"""
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="会话不存在")

    if chat.initiator_id != current_user.id and chat.recipient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问此会话")

    # Rate limit check
    _check_rate_limit(current_user.id, db)

    message = ChatMessage(
        chat_id=chat_id,
        sender_id=current_user.id,
        content=message_in.content,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    # Determine recipient (the other person)
    other_user_id = (
        chat.recipient_id if chat.initiator_id == current_user.id else chat.initiator_id
    )
    other_user = db.query(User).filter(User.id == other_user_id).first()

    if other_user:
        supervisor_name = None
        if chat.supervisor_id:
            supervisor = db.query(Supervisor).filter(Supervisor.id == chat.supervisor_id).first()
            if supervisor:
                supervisor_name = supervisor.name

        notify_new_message(
            chat_id=str(chat_id),
            recipient_email=other_user.email,
            recipient_notifications_enabled=other_user.email_notifications_enabled,
            supervisor_name=supervisor_name,
        )

    return ChatMessageResponse.model_validate(message)


@router.put("/{chat_id}/read", status_code=200)
def mark_chat_read(
    chat_id: uuid.UUID,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """将该会话中所有未读消息标为已读"""
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="会话不存在")

    if chat.initiator_id != current_user.id and chat.recipient_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问此会话")

    now = datetime.utcnow()
    db.query(ChatMessage).filter(
        ChatMessage.chat_id == chat_id,
        ChatMessage.sender_id != current_user.id,
        ChatMessage.read_at.is_(None),
    ).update({"read_at": now}, synchronize_session=False)
    db.commit()

    return {"ok": True}
