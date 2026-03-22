import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Text, UniqueConstraint, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.database import Base


class FlagReason(str, enum.Enum):
    false_info = "虚假信息"
    attack = "恶意攻击"
    spam = "垃圾信息"
    privacy = "隐私泄露"
    other = "其他"


class CommentFlag(Base):
    __tablename__ = "comment_flags"
    __table_args__ = (
        UniqueConstraint("reporter_id", "comment_id", name="uq_comment_flag_reporter_comment"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    comment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("comments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reporter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reason: Mapped[FlagReason] = mapped_column(SAEnum(FlagReason), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    comment: Mapped["Comment"] = relationship("Comment", back_populates="flags")  # noqa: F821
    reporter: Mapped["User"] = relationship("User")  # noqa: F821
