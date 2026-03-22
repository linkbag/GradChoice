import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Supervisor(Base):
    __tablename__ = "supervisors"
    __table_args__ = (
        UniqueConstraint("school_code", "name", "department", name="uq_supervisor_school_name_dept"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    school_code: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    school_name: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    province: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    department: Mapped[str] = mapped_column(String(300), nullable=False)
    title: Mapped[str | None] = mapped_column(String(100), nullable=True)
    affiliated_unit: Mapped[str | None] = mapped_column(String(300), nullable=True)
    webpage_url_1: Mapped[str | None] = mapped_column(String(500), nullable=True)
    webpage_url_2: Mapped[str | None] = mapped_column(String(500), nullable=True)
    webpage_url_3: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relationships
    ratings: Mapped[list["Rating"]] = relationship("Rating", back_populates="supervisor")  # noqa: F821
    comments: Mapped[list["Comment"]] = relationship("Comment", back_populates="supervisor")  # noqa: F821
    chats: Mapped[list["Chat"]] = relationship("Chat", back_populates="supervisor")  # noqa: F821
    edit_proposals: Mapped[list["EditProposal"]] = relationship("EditProposal", back_populates="supervisor")  # noqa: F821
