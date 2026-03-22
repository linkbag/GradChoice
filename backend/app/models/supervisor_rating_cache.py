import uuid
from datetime import datetime
from sqlalchemy import Integer, DateTime, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class SupervisorRatingCache(Base):
    __tablename__ = "supervisor_rating_cache"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    supervisor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("supervisors.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    # All-user averages
    all_avg_overall: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    all_avg_academic: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    all_avg_mentoring: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    all_avg_wellbeing: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    all_avg_stipend: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    all_avg_resources: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    all_avg_ethics: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)

    # Verified-user averages
    verified_avg_overall: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    verified_avg_academic: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    verified_avg_mentoring: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    verified_avg_wellbeing: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    verified_avg_stipend: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    verified_avg_resources: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)
    verified_avg_ethics: Mapped[float | None] = mapped_column(Numeric(4, 2), nullable=True)

    # Counts
    all_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    verified_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Score distribution (buckets: 1–5 based on floor(overall_score + 0.5) rounded)
    distribution_1: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    distribution_2: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    distribution_3: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    distribution_4: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    distribution_5: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationship
    supervisor: Mapped["Supervisor"] = relationship(  # noqa: F821
        "Supervisor", back_populates="rating_cache"
    )
