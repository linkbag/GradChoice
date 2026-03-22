import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, Text, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.database import Base


class VerificationType(str, enum.Enum):
    none = "none"
    email_edu = "email_edu"
    student_id = "student_id"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_student_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verification_type: Mapped[VerificationType] = mapped_column(
        SAEnum(VerificationType), default=VerificationType.none, nullable=False
    )
    student_id_file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    email_notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    ratings: Mapped[list["Rating"]] = relationship("Rating", back_populates="user")  # noqa: F821
    rating_votes: Mapped[list["RatingVote"]] = relationship("RatingVote", back_populates="user")  # noqa: F821
    comments: Mapped[list["Comment"]] = relationship("Comment", back_populates="user", foreign_keys="Comment.user_id")  # noqa: F821
    comment_votes: Mapped[list["CommentVote"]] = relationship("CommentVote", back_populates="user")  # noqa: F821
    initiated_chats: Mapped[list["Chat"]] = relationship("Chat", back_populates="initiator", foreign_keys="Chat.initiator_id")  # noqa: F821
    received_chats: Mapped[list["Chat"]] = relationship("Chat", back_populates="recipient", foreign_keys="Chat.recipient_id")  # noqa: F821
    chat_messages: Mapped[list["ChatMessage"]] = relationship("ChatMessage", back_populates="sender")  # noqa: F821
    edit_proposals: Mapped[list["EditProposal"]] = relationship("EditProposal", back_populates="proposed_by_user", foreign_keys="EditProposal.proposed_by")  # noqa: F821
