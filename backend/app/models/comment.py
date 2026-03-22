import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Text, UniqueConstraint, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.database import Base


class VoteType(str, enum.Enum):
    up = "up"
    down = "down"


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    supervisor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("supervisors.id", ondelete="CASCADE"), nullable=False, index=True
    )
    parent_comment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("comments.id", ondelete="CASCADE"), nullable=True, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    likes_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    dislikes_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_edited: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    flag_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="comments", foreign_keys=[user_id])  # noqa: F821
    supervisor: Mapped["Supervisor"] = relationship("Supervisor", back_populates="comments")  # noqa: F821
    parent: Mapped["Comment | None"] = relationship("Comment", back_populates="replies", remote_side="Comment.id")
    replies: Mapped[list["Comment"]] = relationship("Comment", back_populates="parent")
    votes: Mapped[list["CommentVote"]] = relationship("CommentVote", back_populates="comment")

    # Transient fields — populated by API layer; not stored in DB
    user_vote = None  # type: ignore[assignment]
    reply_count = 0  # type: ignore[assignment]


class CommentVote(Base):
    __tablename__ = "comment_votes"
    __table_args__ = (
        UniqueConstraint("user_id", "comment_id", name="uq_comment_vote_user_comment"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    comment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("comments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vote_type: Mapped[VoteType] = mapped_column(SAEnum(VoteType), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="comment_votes")  # noqa: F821
    comment: Mapped["Comment"] = relationship("Comment", back_populates="votes")
