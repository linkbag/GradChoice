import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.edit_proposal import (
    EditProposalCreate, EditProposalResponse, EditProposalListResponse, ReviewAction
)
from app.utils.auth import get_current_verified_user

router = APIRouter(prefix="/edit-proposals", tags=["编辑申请"])


@router.post("", response_model=EditProposalResponse, status_code=201)
def create_edit_proposal(
    proposal_in: EditProposalCreate,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """提交导师信息修改申请"""
    # TODO: implement
    raise HTTPException(status_code=501, detail="待实现")


@router.get("/pending", response_model=EditProposalListResponse)
def get_pending_proposals(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """获取待审核的编辑申请（社区审核者可见）"""
    # TODO: implement — require is_student_verified to review
    raise HTTPException(status_code=501, detail="待实现")


@router.post("/{proposal_id}/review", response_model=EditProposalResponse)
def review_proposal(
    proposal_id: uuid.UUID,
    action: ReviewAction,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """审核编辑申请（需要两位社区成员通过）"""
    # TODO: implement
    # 1. Assign as reviewer_1 or reviewer_2
    # 2. If both approve → apply changes, mark approved
    # 3. If either rejects → mark rejected
    raise HTTPException(status_code=501, detail="待实现")


@router.get("/{proposal_id}", response_model=EditProposalResponse)
def get_proposal(proposal_id: uuid.UUID, db: Session = Depends(get_db)):
    """获取编辑申请详情"""
    # TODO: implement
    raise HTTPException(status_code=501, detail="待实现")
