import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.analytics import SupervisorAnalytics, SchoolAnalytics, RankingsResponse

router = APIRouter(prefix="/analytics", tags=["数据分析"])


@router.get("/supervisor/{supervisor_id}", response_model=SupervisorAnalytics)
def get_supervisor_analytics(supervisor_id: uuid.UUID, db: Session = Depends(get_db)):
    """获取导师综合评分分析（含雷达图数据）"""
    # TODO: implement
    # 1. Aggregate scores for supervisor
    # 2. Build score_distribution (histogram)
    raise HTTPException(status_code=501, detail="待实现")


@router.get("/school/{school_code}", response_model=SchoolAnalytics)
def get_school_analytics(school_code: str, db: Session = Depends(get_db)):
    """获取院校整体数据"""
    # TODO: implement
    raise HTTPException(status_code=501, detail="待实现")


@router.get("/rankings", response_model=RankingsResponse)
def get_rankings(db: Session = Depends(get_db)):
    """获取导师和院校排名"""
    # TODO: implement — top-rated supervisors, top-rated schools
    raise HTTPException(status_code=501, detail="待实现")
