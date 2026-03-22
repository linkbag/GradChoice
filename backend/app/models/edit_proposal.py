import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
import enum

from app.database import Base


class ProposalStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class ReviewDecision(str, enum.Enum):
    approve = "approve"
    reject = "reject"


class EditProposal(Base):
    __tablename__ = "edit_proposals"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    supervisor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("supervisors.id", ondelete="CASCADE"), nullable=True, index=True
    )
    proposed_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    proposed_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[ProposalStatus] = mapped_column(
        SAEnum(ProposalStatus), default=ProposalStatus.pending, nullable=False, index=True
    )
    reviewer_1_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewer_1_decision: Mapped[ReviewDecision | None] = mapped_column(
        SAEnum(ReviewDecision), nullable=True
    )
    reviewer_2_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewer_2_decision: Mapped[ReviewDecision | None] = mapped_column(
        SAEnum(ReviewDecision), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    supervisor: Mapped["Supervisor | None"] = relationship("Supervisor", back_populates="edit_proposals")  # noqa: F821
    proposed_by_user: Mapped["User"] = relationship("User", back_populates="edit_proposals", foreign_keys=[proposed_by])  # noqa: F821
