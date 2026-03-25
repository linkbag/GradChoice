import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.supervisor import Supervisor
from app.models.rating import Rating
from app.schemas.supervisor import SupervisorResponse, SupervisorListResponse, SupervisorSearchResult

router = APIRouter(prefix="/supervisors", tags=["导师"])


@router.get("/schools")
def list_schools(
    province: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """获取所有院校及导师数量（匹配前端 SchoolListResponse）"""
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
def list_provinces(db: Session = Depends(get_db)):
    """获取所有省份（含院校数和导师数）"""
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
def list_school_names(db: Session = Depends(get_db)):
    """获取所有院校名称（去重，用于前端筛选下拉）"""
    rows = db.query(
        Supervisor.school_name,
        Supervisor.school_code,
    ).distinct().order_by(Supervisor.school_name).all()
    return [{"school_name": r.school_name, "school_code": r.school_code} for r in rows]


@router.get("/departments")
def list_departments(
    school_code: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """获取某院校的院系列表（去重，用于前端筛选下拉）"""
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
def list_school_supervisors(
    school_code: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
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

    # Group by department
    dept_map: dict = {}
    for s in supervisors:
        dept = s.department or "其他"
        if dept not in dept_map:
            dept_map[dept] = []
        dept_map[dept].append({
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
        for dept, sups in dept_map.items()
    ]

    return {
        "school_code": school_code,
        "school_name": school_name,
        "province": province,
        "total_count": len(supervisors),
        "departments": departments,
    }


@router.get("/search", response_model=SupervisorListResponse)
def search_supervisors(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    province: Optional[str] = None,
    school_code: Optional[str] = None,
    school_name: Optional[str] = None,
    department: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """搜索导师（按姓名、院校、院系 — ILIKE 模糊搜索）"""
    query = db.query(Supervisor)
    search_filter = or_(
        Supervisor.name.ilike(f"%{q}%"),
        Supervisor.school_name.ilike(f"%{q}%"),
        Supervisor.department.ilike(f"%{q}%"),
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
    items = query.order_by(Supervisor.name).offset((page - 1) * page_size).limit(page_size).all()
    return SupervisorListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("", response_model=SupervisorListResponse)
def list_supervisors(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    school_code: Optional[str] = None,
    school_name: Optional[str] = None,
    province: Optional[str] = None,
    department: Optional[str] = None,
    sort_by: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """获取导师列表（支持分页和过滤）"""
    q = db.query(Supervisor)
    if school_code:
        q = q.filter(Supervisor.school_code == school_code)
    if school_name:
        q = q.filter(Supervisor.school_name == school_name)
    if province:
        q = q.filter(Supervisor.province == province)
    if department:
        q = q.filter(Supervisor.department == department)
    total = q.count()
    if sort_by == "rating":
        q = q.order_by(Supervisor.avg_overall_score.desc().nullslast(), Supervisor.rating_count.desc())
    elif sort_by == "rating_count":
        q = q.order_by(Supervisor.rating_count.desc(), Supervisor.name)
    else:
        q = q.order_by(Supervisor.school_name, Supervisor.name)
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return SupervisorListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{supervisor_id}", response_model=SupervisorResponse)
def get_supervisor(supervisor_id: uuid.UUID, db: Session = Depends(get_db)):
    """获取导师详情"""
    sup = db.query(Supervisor).filter(Supervisor.id == supervisor_id).first()
    if not sup:
        raise HTTPException(status_code=404, detail="导师不存在")
    return sup
