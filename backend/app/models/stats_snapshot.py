from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, Text
from app.database import Base


class StatsSnapshot(Base):
    __tablename__ = "stats_snapshots"
    id = Column(Integer, primary_key=True)
    total_supervisors = Column(Integer, nullable=False, default=0)
    total_ratings = Column(Integer, nullable=False, default=0)
    total_users = Column(Integer, nullable=False, default=0)
    rated_supervisors = Column(Integer, nullable=False, default=0)
    recent_ratings_30d = Column(Integer, nullable=False, default=0)
    most_active_schools = Column(Text, nullable=False, default="[]")  # JSON string
    last_refreshed = Column(DateTime, nullable=False, default=datetime.utcnow)
