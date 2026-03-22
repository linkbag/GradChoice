import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, select, distinct

from app.database import get_db
from app.models.supervisor import Supervisor
from app.models.rating import Rating
from app.schemas.supervisor import (
    SupervisorDetailResponse,
    SupervisorListResponse,
    SupervisorSearchResult,
    SchoolListResponse,
    SchoolListItem,
    ProvinceListItem,
    SchoolSupervisorsResponse,
    DepartmentGroup,
)
from app.schemas.edit_proposal import EditProposalCreate, EditProposalResponse
from app.utils.auth import get_current_verified_user
from app.services.supervisor import (
    get_rating_aggregates,
    get_recent_comments,
    supervisor_to_search_result,
)

router = APIRouter(prefix="/supervisors", tags=["导师"])

# ─────────────────────────────────────────────────────────────
# Static paths MUST be declared before /{supervisor_id}
# ─────────────────────────────────────────────────────────────


@router.get("/schools", response_model=SchoolListResponse)
def list_schools(
    province: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """列出所有院校及导师数量"""
    # Subquery for rated supervisors per school
    rated_sub = (
        select(
            Supervisor.school_code.label("sc"),
            func.count(distinct(Rating.supervisor_id)).label("rated_cnt"),
            func.avg(Rating.overall_score).label("avg_score"),
        )
        .outerjoin(Rating, Supervisor.id == Rating.supervisor_id)
        .group_by(Supervisor.school_code)
        .subquery()
    )

    q = (
        select(
            Supervisor.school_code,
            Supervisor.school_name,
            Supervisor.province,
            func.count(distinct(Supervisor.id)).label("supervisor_count"),
            rated_sub.c.rated_cnt,
            rated_sub.c.avg_score,
        )
        .outerjoin(rated_sub, Supervisor.school_code == rated_sub.c.sc)
        .group_by(
            Supervisor.school_code,
            Supervisor.school_name,
            Supervisor.province,
            rated_sub.c.rated_cnt,
            rated_sub.c.avg_score,
        )
        .order_by(func.count(distinct(Supervisor.id)).desc())
    )

    if province:
        q = q.where(Supervisor.province == province)

    rows = db.execute(q).all()
    items = [
        SchoolListItem(
            school_code=r.school_code,
            school_name=r.school_name,
            province=r.province,
            supervisor_count=r.supervisor_count,
            rated_supervisor_count=r.rated_cnt or 0,
            avg_overall_score=round(float(r.avg_score), 2) if r.avg_score else None,
        )
        for r in rows
    ]
    return SchoolListResponse(items=items, total=len(items))


@router.get("/provinces", response_model=list[ProvinceListItem])
def list_provinces(db: Session = Depends(get_db)):
    """列出所有省份及院校数量"""
    rows = db.execute(
        select(
            Supervisor.province,
            func.count(distinct(Supervisor.school_code)).label("school_count"),
            func.count(distinct(Supervisor.id)).label("supervisor_count"),
        )
        .group_by(Supervisor.province)
        .order_by(Supervisor.province)
    ).all()

    return [
        ProvinceListItem(
            province=r.province,
            school_count=r.school_count,
            supervisor_count=r.supervisor_count,
        )
        for r in rows
    ]


@router.get("/school/{school_code}", response_model=SchoolSupervisorsResponse)
def get_school_supervisors(
    school_code: str,
    db: Session = Depends(get_db),
):
    """获取某院校的所有导师（按院系分组）"""
    # Rating subquery
    rating_sub = (
        select(
            Rating.supervisor_id.label("supervisor_id"),
            func.avg(Rating.overall_score).label("avg_score"),
            func.count(Rating.id).label("cnt"),
        )
        .group_by(Rating.supervisor_id)
        .subquery()
    )

    rows = (
        db.query(Supervisor, rating_sub.c.avg_score, rating_sub.c.cnt)
        .outerjoin(rating_sub, Supervisor.id == rating_sub.c.supervisor_id)
        .filter(Supervisor.school_code == school_code)
        .order_by(Supervisor.department, Supervisor.name)
        .all()
    )

    if not rows:
        raise HTTPException(status_code=404, detail="院校未找到或暂无导师")

    school_name = rows[0][0].school_name
    province = rows[0][0].province

    # Group by department
    dept_map: dict[str, list] = {}
    for sup, avg_score, cnt in rows:
        result = SupervisorSearchResult(**supervisor_to_search_result(sup, avg_score, cnt))
        dept_map.setdefault(sup.department, []).append(result)

    departments = [
        DepartmentGroup(department=dept, supervisors=sups)
        for dept, sups in sorted(dept_map.items())
    ]

    return SchoolSupervisorsResponse(
        school_code=school_code,
        school_name=school_name,
        province=province,
        total_count=len(rows),
        departments=departments,
    )


@router.get("/search", response_model=SupervisorListResponse)
def search_supervisors(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    province: Optional[str] = None,
    school_code: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """搜索导师（按姓名、院校、院系，支持模糊匹配）"""
    # Rating subquery
    rating_sub = (
        select(
            Rating.supervisor_id.label("supervisor_id"),
            func.avg(Rating.overall_score).label("avg_score"),
            func.count(Rating.id).label("cnt"),
        )
        .group_by(Rating.supervisor_id)
        .subquery()
    )

    # Use pg_trgm similarity for fuzzy matching on name, school_name, department
    sim_name = func.similarity(Supervisor.name, q)
    sim_school = func.similarity(Supervisor.school_name, q)
    sim_dept = func.similarity(Supervisor.department, q)
    relevance = func.greatest(sim_name, sim_school, sim_dept)

    base_q = (
        db.query(Supervisor, rating_sub.c.avg_score, rating_sub.c.cnt, relevance.label("relevance"))
        .outerjoin(rating_sub, Supervisor.id == rating_sub.c.supervisor_id)
        .filter(
            (Supervisor.name.ilike(f"%{q}%"))
            | (Supervisor.school_name.ilike(f"%{q}%"))
            | (Supervisor.department.ilike(f"%{q}%"))
            | (sim_name > 0.15)
            | (sim_school > 0.15)
            | (sim_dept > 0.15)
        )
    )

    if province:
        base_q = base_q.filter(Supervisor.province == province)
    if school_code:
        base_q = base_q.filter(Supervisor.school_code == school_code)

    total = base_q.count()
    rows = (
        base_q.order_by(relevance.desc(), Supervisor.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = [
        SupervisorSearchResult(**supervisor_to_search_result(sup, avg_score, cnt))
        for sup, avg_score, cnt, _ in rows
    ]
    return SupervisorListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("", response_model=SupervisorListResponse)
def list_supervisors(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    school_code: Optional[str] = None,
    school_name: Optional[str] = None,
    province: Optional[str] = None,
    department: Optional[str] = None,
    title: Optional[str] = None,
    sort_by: Optional[str] = Query(None, description="name | school | rating_count"),
    db: Session = Depends(get_db),
):
    """获取导师列表（支持分页和过滤）"""
    # Rating subquery
    rating_sub = (
        select(
            Rating.supervisor_id.label("supervisor_id"),
            func.avg(Rating.overall_score).label("avg_score"),
            func.count(Rating.id).label("cnt"),
        )
        .group_by(Rating.supervisor_id)
        .subquery()
    )

    base_q = (
        db.query(Supervisor, rating_sub.c.avg_score, rating_sub.c.cnt)
        .outerjoin(rating_sub, Supervisor.id == rating_sub.c.supervisor_id)
    )

    if school_code:
        base_q = base_q.filter(Supervisor.school_code == school_code)
    if school_name:
        base_q = base_q.filter(Supervisor.school_name.ilike(f"%{school_name}%"))
    if province:
        base_q = base_q.filter(Supervisor.province == province)
    if department:
        base_q = base_q.filter(Supervisor.department.ilike(f"%{department}%"))
    if title:
        base_q = base_q.filter(Supervisor.title.ilike(f"%{title}%"))

    total = base_q.count()

    if sort_by == "name":
        base_q = base_q.order_by(Supervisor.name)
    elif sort_by == "school":
        base_q = base_q.order_by(Supervisor.school_name, Supervisor.name)
    elif sort_by == "rating_count":
        base_q = base_q.order_by(func.coalesce(rating_sub.c.cnt, 0).desc(), Supervisor.name)
    else:
        base_q = base_q.order_by(Supervisor.school_name, Supervisor.department, Supervisor.name)

    rows = base_q.offset((page - 1) * page_size).limit(page_size).all()

    items = [
        SupervisorSearchResult(**supervisor_to_search_result(sup, avg_score, cnt))
        for sup, avg_score, cnt in rows
    ]
    return SupervisorListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{supervisor_id}", response_model=SupervisorDetailResponse)
def get_supervisor(supervisor_id: uuid.UUID, db: Session = Depends(get_db)):
    """获取导师详情（含评分聚合、评论）"""
    sup = db.query(Supervisor).filter(Supervisor.id == supervisor_id).first()
    if not sup:
        raise HTTPException(status_code=404, detail="导师未找到")

    aggregates = get_rating_aggregates(db, supervisor_id)
    recent = get_recent_comments(db, supervisor_id, limit=5)

    return SupervisorDetailResponse(
        id=sup.id,
        school_code=sup.school_code,
        school_name=sup.school_name,
        province=sup.province,
        name=sup.name,
        department=sup.department,
        title=sup.title,
        affiliated_unit=sup.affiliated_unit,
        webpage_url_1=sup.webpage_url_1,
        webpage_url_2=sup.webpage_url_2,
        webpage_url_3=sup.webpage_url_3,
        created_at=sup.created_at,
        updated_at=sup.updated_at,
        **aggregates,
        recent_comments=[
            {"id": c.id, "content": c.content, "likes_count": c.likes_count, "created_at": c.created_at}
            for c in recent
        ],
    )


@router.post("", response_model=EditProposalResponse, status_code=201)
def propose_new_supervisor(
    proposal: EditProposalCreate,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """提交新增导师申请（需审核）"""
    from app.models.edit_proposal import EditProposal

    ep = EditProposal(
        supervisor_id=None,
        proposed_by=current_user.id,
        proposed_data=proposal.proposed_data,
    )
    db.add(ep)
    db.commit()
    db.refresh(ep)
    return ep
