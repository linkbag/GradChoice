import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, UniqueConstraint, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import enum

from app.database import Base


class VoteType(str, enum.Enum):
    up = "up"
    down = "down"


class Rating(Base):
    __tablename__ = "ratings"
    __table_args__ = (
        UniqueConstraint("user_id", "supervisor_id", name="uq_rating_user_supervisor"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    supervisor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("supervisors.id", ondelete="CASCADE"), nullable=False, index=True
    )
    is_verified_rating: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    overall_score: Mapped[float] = mapped_column(Numeric(3, 2), nullable=False)
    score_academic: Mapped[float | None] = mapped_column(Numeric(3, 2), nullable=True)
    score_mentoring: Mapped[float | None] = mapped_column(Numeric(3, 2), nullable=True)
    score_wellbeing: Mapped[float | None] = mapped_column(Numeric(3, 2), nullable=True)
    score_stipend: Mapped[float | None] = mapped_column(Numeric(3, 2), nullable=True)
    score_resources: Mapped[float | None] = mapped_column(Numeric(3, 2), nullable=True)
    score_ethics: Mapped[float | None] = mapped_column(Numeric(3, 2), nullable=True)
    first_year_income: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Denormalized vote counts — updated by vote endpoint
    upvotes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    downvotes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
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
    user: Mapped["User"] = relationship("User", back_populates="ratings")  # noqa: F821
    supervisor: Mapped["Supervisor"] = relationship("Supervisor", back_populates="ratings")  # noqa: F821
    votes: Mapped[list["RatingVote"]] = relationship("RatingVote", back_populates="rating")

    # Transient field — populated by API layer; not stored in DB
    # Use __allow_unmapped__ style: plain class attr, no Mapped annotation
    user_vote = None  # type: ignore[assignment]


class RatingVote(Base):
    __tablename__ = "rating_votes"
    __table_args__ = (
        UniqueConstraint("user_id", "rating_id", name="uq_rating_vote_user_rating"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rating_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ratings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vote_type: Mapped[VoteType] = mapped_column(SAEnum(VoteType), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="rating_votes")  # noqa: F821
    rating: Mapped["Rating"] = relationship("Rating", back_populates="votes")
