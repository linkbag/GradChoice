import logging
import traceback
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import and_, case, func, or_
from sqlalchemy.orm import Session
from app.middleware.rate_limit import limiter

logger = logging.getLogger(__name__)

from app.database import get_db
from app.models.supervisor import Supervisor
from app.models.rating import Rating
from app.models.comment import Comment
from app.schemas.supervisor import (
    SupervisorResponse, SupervisorListResponse, SupervisorSearchResult, SupervisorSubmit,
    SupervisorLimitedResult, SupervisorLimitedListResponse,
)
from app.utils.auth import get_current_user, get_optional_current_user
from app.utils.caching import set_public_cache, set_private_cache
from app.utils.name_filter import get_name_filter

router = APIRouter(prefix="/supervisors", tags=["导师"])


@router.post("/submit", response_model=SupervisorResponse, status_code=201)
def submit_supervisor(
    data: SupervisorSubmit,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """用户提交新导师（直接入库，无审核队列）"""
    try:
        # Auto-match school_code and province from existing data
        school_code = data.school_code
        province = data.province
        if not school_code or not province:
            existing = (
                db.query(Supervisor.school_code, Supervisor.province)
                .filter(Supervisor.school_name == data.school_name)
                .first()
            )
            if existing:
                if not school_code:
                    school_code = existing.school_code
                if not province:
                    province = existing.province

        # Fallback defaults for NOT NULL columns
        if not school_code:
            school_code = data.school_name[:20]
        if not province:
            province = ""

        dept = data.department or ""

        # Filter name through blocklist before any DB operations
        cleaned_name, reason = get_name_filter().clean_name(data.name)
        if cleaned_name is None:
            raise HTTPException(
                status_code=400,
                detail=f"名称 '{data.name}' 被系统过滤: {reason}",
            )
        # Use cleaned name (title suffix stripped if applicable) going forward
        supervisor_name = cleaned_name

        # Duplicate check: same name + school_name + department
        dup = db.query(Supervisor).filter(
            Supervisor.name == supervisor_name,
            Supervisor.school_name == data.school_name,
            Supervisor.department == dept,
        ).first()
        if dup:
            raise HTTPException(status_code=400, detail="该导师可能已存在")

        supervisor = Supervisor(
            name=supervisor_name,
            school_name=data.school_name,
            school_code=school_code,
            province=province,
            department=dept,
            title=data.title,
            webpage_url_1=data.website_url,
        )
        db.add(supervisor)
        db.commit()
        db.refresh(supervisor)
        return supervisor
    except HTTPException:
        raise
    except Exception as e:
        logger.error("submit_supervisor error:\n%s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"导师提交失败: {type(e).__name__}: {e}")


@router.get("/schools")
def list_schools(
    response: Response,
    province: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """获取所有院校及导师数量（匹配前端 SchoolListResponse）"""
    set_public_cache(response, 3600)  # 1h: schools list rarely changes
    q = db.query(
        Supervisor.school_code,
        Supervisor.school_name,
        Supervisor.province,
        func.count(Supervisor.id).label("supervisor_count"),
        func.count(Supervisor.id).filter(Supervisor.rating_count > 0).label("rated_supervisor_count"),
        func.avg(Supervisor.avg_overall_score).label("avg_overall_score"),
    ).group_by(Supervisor.school_code, Supervisor.school_name, Supervisor.province)
    if province:
        q = q.filter(Supervisor.province == province)
    rows = q.order_by(func.count(Supervisor.id).desc()).all()
    items = [
        {
            "school_code": r.school_code,
            "school_name": r.school_name,
            "province": r.province,
            "supervisor_count": r.supervisor_count,
            "rated_supervisor_count": r.rated_supervisor_count,
            "avg_overall_score": float(r.avg_overall_score) if r.avg_overall_score else None,
        }
        for r in rows
    ]
    return {"items": items, "total": len(items)}


@router.get("/provinces")
def list_provinces(response: Response, db: Session = Depends(get_db)):
    """获取所有省份（含院校数和导师数）"""
    set_public_cache(response, 21600)  # 6h: province list essentially static
    rows = db.query(
        Supervisor.province,
        func.count(Supervisor.school_code.distinct()).label("school_count"),
        func.count(Supervisor.id).label("supervisor_count"),
    ).group_by(Supervisor.province).order_by(Supervisor.province).all()
    return [
        {"province": r.province, "school_count": r.school_count, "supervisor_count": r.supervisor_count}
        for r in rows
    ]


@router.get("/school-names")
def list_school_names(response: Response, db: Session = Depends(get_db)):
    """获取所有院校名称（去重，用于前端筛选下拉）"""
    set_public_cache(response, 21600)  # 6h: school list rarely changes
    rows = db.query(
        Supervisor.school_name,
        Supervisor.school_code,
    ).distinct().order_by(Supervisor.school_name).all()
    return [{"school_name": r.school_name, "school_code": r.school_code} for r in rows]


@router.get("/departments")
def list_departments(
    response: Response,
    school_code: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """获取某院校的院系列表（去重，用于前端筛选下拉）"""
    set_public_cache(response, 3600)  # 1h: departments rarely added
    if not school_code:
        return []
    rows = (
        db.query(Supervisor.department)
        .filter(
            Supervisor.school_code == school_code,
            Supervisor.department.isnot(None),
            Supervisor.department != "",
        )
        .distinct()
        .order_by(Supervisor.department)
        .all()
    )
    return [{"department": r.department} for r in rows]


@router.get("/school/{school_code}")
@limiter.limit("30/minute")
def list_school_supervisors(
    request: Request,
    school_code: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=20),
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """获取某院校的导师列表（按院系分组）"""
    supervisors = db.query(Supervisor).filter(
        Supervisor.school_code == school_code
    ).order_by(Supervisor.department, Supervisor.name).all()

    if not supervisors:
        raise HTTPException(status_code=404, detail="院校不存在")

    school_name = supervisors[0].school_name
    province = supervisors[0].province
    total_count = len(supervisors)

    if not current_user:
        # Unauthenticated: first 5 supervisors, limited fields only
        limited = supervisors[:5]
        dept_map: dict = {}
        for s in limited:
            dept = s.department or "其他"
            if dept not in dept_map:
                dept_map[dept] = []
            dept_map[dept].append({
                "id": str(s.id),
                "name": s.name,
                "school_name": s.school_name,
                "department": s.department,
            })
        departments = [
            {"department": dept, "supervisors": sups}
            for dept, sups in dept_map.items()
        ]
        return {
            "school_code": school_code,
            "school_name": school_name,
            "province": province,
            "total_count": total_count,
            "departments": departments,
            "requires_login": True,
        }

    # Authenticated: full data
    dept_map_full: dict = {}
    for s in supervisors:
        dept = s.department or "其他"
        if dept not in dept_map_full:
            dept_map_full[dept] = []
        dept_map_full[dept].append({
            "id": str(s.id),
            "school_code": s.school_code,
            "school_name": s.school_name,
            "province": s.province,
            "name": s.name,
            "department": s.department,
            "title": s.title,
            "avg_overall_score": s.avg_overall_score,
            "rating_count": s.rating_count,
        })

    departments = [
        {"department": dept, "supervisors": sups}
        for dept, sups in dept_map_full.items()
    ]

    return {
        "school_code": school_code,
        "school_name": school_name,
        "province": province,
        "total_count": total_count,
        "departments": departments,
    }


@router.get("/search")
@limiter.limit("30/minute")
def search_supervisors(
    request: Request,
    q: str = Query(..., min_length=1, description="搜索关键词"),
    province: Optional[str] = None,
    school_code: Optional[str] = None,
    school_name: Optional[str] = None,
    department: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=20),
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """搜索导师（按姓名、院校、院系 — ILIKE 模糊搜索）"""
    q_escaped = q.replace("%", "\\%").replace("_", "\\_")
    is_verified = current_user and current_user.is_student_verified
    if not current_user:
        effective_page_size = min(page_size, 5)
    elif is_verified:
        effective_page_size = min(page_size, 50)
    else:
        effective_page_size = min(page_size, 20)

    comment_count_subq = (
        db.query(func.count(Comment.id))
        .filter(Comment.supervisor_id == Supervisor.id, Comment.parent_comment_id.is_(None), Comment.is_deleted.is_(False))
        .correlate(Supervisor)
        .scalar_subquery()
    )
    query = db.query(Supervisor, comment_count_subq.label("comment_count"))
    search_filter = or_(
        Supervisor.name.ilike(f"%{q_escaped}%"),
        Supervisor.school_name.ilike(f"%{q_escaped}%"),
        Supervisor.department.ilike(f"%{q_escaped}%"),
    )
    query = query.filter(search_filter)
    if province:
        query = query.filter(Supervisor.province == province)
    if school_code:
        query = query.filter(Supervisor.school_code == school_code)
    if school_name:
        query = query.filter(Supervisor.school_name == school_name)
    if department:
        query = query.filter(Supervisor.department == department)
    total = query.count()
    first_char_code = func.ascii(func.substr(Supervisor.name, 1, 1))
    is_cjk = and_(first_char_code >= 0x4E00, first_char_code <= 0x9FFF)
    chinese_first = case((is_cjk, 0), else_=1)
    rows = query.order_by(chinese_first, Supervisor.name).offset((page - 1) * effective_page_size).limit(effective_page_size).all()

    if not current_user:
        limited_items = [
            SupervisorLimitedResult(
                id=sup.id,
                name=sup.name,
                school_name=sup.school_name,
                department=sup.department,
                avg_overall_score=sup.avg_overall_score,
                rating_count=sup.rating_count or 0,
                comment_count=cc or 0,
            )
            for sup, cc in rows
        ]
        return SupervisorLimitedListResponse(
            items=limited_items, total=total, page=page, page_size=effective_page_size, requires_login=True
        )

    items = []
    for sup, cc in rows:
        result = SupervisorSearchResult(
            id=sup.id,
            school_code=sup.school_code,
            school_name=sup.school_name,
            province=sup.province,
            name=sup.name,
            department=sup.department,
            title=sup.title,
            avg_overall_score=sup.avg_overall_score,
            rating_count=sup.rating_count or 0,
            comment_count=cc or 0,
            verified_avg_overall_score=sup.verified_avg_overall_score,
            verified_rating_count=sup.verified_rating_count or 0,
        )
        items.append(result)
    return SupervisorListResponse(items=items, total=total, page=page, page_size=effective_page_size)


@router.get("")
@limiter.limit("30/minute")
def list_supervisors(
    request: Request,
    response: Response,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=20),
    school_code: Optional[str] = None,
    school_name: Optional[str] = None,
    province: Optional[str] = None,
    department: Optional[str] = None,
    sort_by: Optional[str] = None,
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """获取导师列表（支持分页和过滤）"""
    # Anonymous responses are identical for everyone and dominate traffic — cache
    # them at the edge. Logged-in responses depend on user verification tier so
    # they must stay private.
    if current_user is None:
        set_public_cache(response, 300)  # 5 min
    else:
        set_private_cache(response)
    is_verified = current_user and current_user.is_student_verified
    if not current_user:
        effective_page_size = min(page_size, 5)
    elif is_verified:
        effective_page_size = min(page_size, 50)
    else:
        effective_page_size = min(page_size, 20)

    comment_count_subq = (
        db.query(func.count(Comment.id))
        .filter(Comment.supervisor_id == Supervisor.id, Comment.parent_comment_id.is_(None), Comment.is_deleted.is_(False))
        .correlate(Supervisor)
        .scalar_subquery()
    )
    q = db.query(Supervisor, comment_count_subq.label("comment_count"))
    if school_code:
        q = q.filter(Supervisor.school_code == school_code)
    if school_name:
        q = q.filter(Supervisor.school_name == school_name)
    if province:
        q = q.filter(Supervisor.province == province)
    if department:
        q = q.filter(Supervisor.department == department)
    total = db.query(func.count(Supervisor.id)).filter(
        *([Supervisor.school_code == school_code] if school_code else []),
        *([Supervisor.school_name == school_name] if school_name else []),
        *([Supervisor.province == province] if province else []),
        *([Supervisor.department == department] if department else []),
    ).scalar()
    if sort_by == "rating":
        q = q.order_by(Supervisor.avg_overall_score.desc().nullslast(), Supervisor.rating_count.desc())
    elif sort_by == "rating_count":
        q = q.order_by(Supervisor.rating_count.desc(), Supervisor.name)
    else:
        first_char_code = func.ascii(func.substr(Supervisor.name, 1, 1))
        is_cjk = and_(first_char_code >= 0x4E00, first_char_code <= 0x9FFF)
        chinese_first = case((is_cjk, 0), else_=1)
        q = q.order_by(chinese_first, Supervisor.school_name, Supervisor.name)
    rows = q.offset((page - 1) * effective_page_size).limit(effective_page_size).all()

    if not current_user:
        limited_items = [
            SupervisorLimitedResult(
                id=sup.id,
                name=sup.name,
                school_name=sup.school_name,
                department=sup.department,
                avg_overall_score=sup.avg_overall_score,
                rating_count=sup.rating_count or 0,
                comment_count=cc or 0,
            )
            for sup, cc in rows
        ]
        return SupervisorLimitedListResponse(
            items=limited_items, total=total, page=page, page_size=effective_page_size, requires_login=True
        )

    items = []
    for sup, cc in rows:
        result = SupervisorSearchResult(
            id=sup.id,
            school_code=sup.school_code,
            school_name=sup.school_name,
            province=sup.province,
            name=sup.name,
            department=sup.department,
            title=sup.title,
            avg_overall_score=sup.avg_overall_score,
            rating_count=sup.rating_count or 0,
            comment_count=cc or 0,
            verified_avg_overall_score=sup.verified_avg_overall_score,
            verified_rating_count=sup.verified_rating_count or 0,
        )
        items.append(result)
    return SupervisorListResponse(items=items, total=total, page=page, page_size=effective_page_size)


@router.get("/{supervisor_id}")
@limiter.limit("60/minute")
def get_supervisor(
    request: Request,
    response: Response,
    supervisor_id: uuid.UUID,
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """获取导师详情"""
    sup = db.query(Supervisor).filter(Supervisor.id == supervisor_id).first()
    if not sup:
        raise HTTPException(status_code=404, detail="导师不存在")
    if current_user is None:
        set_public_cache(response, 300)  # 5 min: anon detail page is identical for all
    else:
        set_private_cache(response)
    if not current_user:
        return SupervisorLimitedResult(
            id=sup.id,
            name=sup.name,
            school_name=sup.school_name,
            department=sup.department,
            avg_overall_score=sup.avg_overall_score,
            rating_count=sup.rating_count or 0,
        )
    return SupervisorResponse.model_validate(sup)
