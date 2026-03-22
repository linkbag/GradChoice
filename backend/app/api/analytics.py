import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.analytics import SupervisorAnalytics, SchoolAnalytics, RankingsResponse, OverviewStats
from app.services import analytics as analytics_service
from app.services.analytics import VALID_DIMENSIONS

router = APIRouter(prefix="/analytics", tags=["数据分析"])


@router.get("/supervisor/{supervisor_id}", response_model=SupervisorAnalytics)
def get_supervisor_analytics(supervisor_id: uuid.UUID, db: Session = Depends(get_db)):
    """获取导师综合评分分析（含雷达图数据、百分位排名、评分趋势）"""
    result = analytics_service.get_supervisor_analytics(db, supervisor_id)
    if result is None:
        raise HTTPException(status_code=404, detail="导师不存在")
    return result


@router.get("/school/{school_code}", response_model=SchoolAnalytics)
def get_school_analytics(school_code: str, db: Session = Depends(get_db)):
    """获取院校整体数据（院系对比、活跃度、顶尖导师）"""
    result = analytics_service.get_school_analytics(db, school_code)
    if result is None:
        raise HTTPException(status_code=404, detail="院校不存在")
    return result


@router.get("/rankings", response_model=RankingsResponse)
def get_rankings(
    dimension: str = Query(
        "overall",
        description="排名维度: overall, academic, mentoring, wellbeing, stipend, resources, ethics",
    ),
    school_code: Optional[str] = Query(None, description="按院校筛选"),
    province: Optional[str] = Query(None, description="按省份筛选"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
    min_ratings: int = Query(3, ge=1, description="最低评价数量"),
    db: Session = Depends(get_db),
):
    """获取导师排行榜（支持多维度、筛选、分页）"""
    if dimension not in VALID_DIMENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"无效的排名维度 '{dimension}'，有效值为：{', '.join(VALID_DIMENSIONS)}",
        )
    return analytics_service.get_rankings(
        db,
        dimension=dimension,
        school_code=school_code,
        province=province,
        page=page,
        page_size=page_size,
        min_ratings=min_ratings,
    )


@router.get("/overview", response_model=OverviewStats)
def get_overview(db: Session = Depends(get_db)):
    """获取平台整体统计数据"""
    return analytics_service.get_overview(db)
