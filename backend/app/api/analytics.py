import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.analytics import SupervisorAnalytics, SchoolAnalytics, RankingsResponse, OverviewStats
from app.services import analytics as analytics_service
from app.services.analytics import VALID_DIMENSIONS
from app.utils.auth import get_optional_current_user

router = APIRouter(prefix="/analytics", tags=["数据分析"])

_UNAUTH_MSG = "请登录查看详细数据"


@router.get("/supervisor/{supervisor_id}", response_model=SupervisorAnalytics)
def get_supervisor_analytics(
    supervisor_id: uuid.UUID,
    user_status: str = Query("all", description="用户筛选: all | verified | unverified"),
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """获取导师综合评分分析（含雷达图数据、百分位排名、评分趋势）"""
    if not current_user:
        raise HTTPException(status_code=403, detail=_UNAUTH_MSG)
    result = analytics_service.get_supervisor_analytics(db, supervisor_id, user_status=user_status)
    if result is None:
        raise HTTPException(status_code=404, detail="导师不存在")
    return result


@router.get("/school/{school_code}", response_model=SchoolAnalytics)
def get_school_analytics(
    school_code: str,
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """获取院校整体数据（院系对比、活跃度、顶尖导师）"""
    if not current_user:
        raise HTTPException(status_code=403, detail=_UNAUTH_MSG)
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
    department: Optional[str] = Query(None, description="按院系筛选"),
    sort_order: str = Query("desc", description="排序方向: asc 或 desc"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
    min_ratings: int = Query(1, ge=1, description="最低评价数量"),
    user_status: str = Query("all", description="用户筛选: all | verified | unverified"),
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """获取导师排行榜（支持多维度、筛选、分页）"""
    if not current_user:
        raise HTTPException(status_code=403, detail=_UNAUTH_MSG)
    if dimension not in VALID_DIMENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"无效的排名维度 '{dimension}'，有效值为：{', '.join(VALID_DIMENSIONS)}",
        )
    if sort_order not in ("asc", "desc"):
        raise HTTPException(status_code=422, detail="sort_order 必须为 'asc' 或 'desc'")
    return analytics_service.get_rankings(
        db,
        dimension=dimension,
        school_code=school_code,
        province=province,
        department=department,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
        min_ratings=min_ratings,
        user_status=user_status,
    )


@router.get("/overview", response_model=OverviewStats)
def get_overview(
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """获取平台整体统计数据"""
    if not current_user:
        raise HTTPException(status_code=403, detail=_UNAUTH_MSG)
    return analytics_service.get_overview(db)
