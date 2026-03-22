import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.supervisor import SupervisorResponse, SupervisorListResponse, SupervisorCreate
from app.schemas.edit_proposal import EditProposalCreate, EditProposalResponse
from app.utils.auth import get_current_verified_user

router = APIRouter(prefix="/supervisors", tags=["导师"])


@router.get("", response_model=SupervisorListResponse)
def list_supervisors(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    school_code: Optional[str] = None,
    province: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """获取导师列表（支持分页和过滤）"""
    # TODO: implement
    raise HTTPException(status_code=501, detail="待实现")


@router.get("/search", response_model=SupervisorListResponse)
def search_supervisors(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    province: Optional[str] = None,
    school_code: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """搜索导师（按姓名、院校、院系）"""
    # TODO: implement
    # Full-text search on name, school_name, department
    raise HTTPException(status_code=501, detail="待实现")


@router.get("/{supervisor_id}", response_model=SupervisorResponse)
def get_supervisor(supervisor_id: uuid.UUID, db: Session = Depends(get_db)):
    """获取导师详情"""
    # TODO: implement
    raise HTTPException(status_code=501, detail="待实现")


@router.post("", response_model=EditProposalResponse, status_code=201)
def propose_new_supervisor(
    proposal: EditProposalCreate,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """提交新增导师申请（需审核）"""
    # TODO: implement — creates an EditProposal with supervisor_id=None
    raise HTTPException(status_code=501, detail="待实现")
