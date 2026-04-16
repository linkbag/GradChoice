from datetime import datetime
from sqlalchemy import DateTime, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class StatsSnapshot(Base):
    __tablename__ = "stats_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    total_supervisors: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_ratings: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_users: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rated_supervisors: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    recent_ratings_30d: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    most_active_schools: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    last_refreshed: Mapped[datetime] = mapped_column(
        DateTime(timezone=False), nullable=False,
        default=lambda: datetime.utcnow(),
    )
