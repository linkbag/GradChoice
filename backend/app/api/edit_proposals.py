import uuid
import random
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.edit_proposal import EditProposal, ProposalStatus, ReviewDecision
from app.models.supervisor import Supervisor
from app.models.user import User
from app.schemas.edit_proposal import (
    EditProposalCreate,
    EditProposalResponse,
    EditProposalListResponse,
    ReviewAction,
)
from app.utils.auth import get_current_verified_user

router = APIRouter(prefix="/edit-proposals", tags=["编辑申请"])


def _apply_proposal(db: Session, proposal: EditProposal) -> None:
    """Apply approved proposal data to the supervisor record (or create new)."""
    data = proposal.proposed_data

    if proposal.supervisor_id is None:
        # New supervisor proposal
        sup = Supervisor(
            school_code=data.get("school_code", ""),
            school_name=data.get("school_name", ""),
            province=data.get("province", ""),
            name=data.get("name", ""),
            department=data.get("department", ""),
            title=data.get("title"),
            affiliated_unit=data.get("affiliated_unit"),
            webpage_url_1=data.get("webpage_url_1"),
            webpage_url_2=data.get("webpage_url_2"),
            webpage_url_3=data.get("webpage_url_3"),
        )
        db.add(sup)
    else:
        sup = db.query(Supervisor).filter(Supervisor.id == proposal.supervisor_id).first()
        if sup:
            editable_fields = [
                "title", "affiliated_unit",
                "webpage_url_1", "webpage_url_2", "webpage_url_3",
                "department", "name", "school_name", "province",
            ]
            for field in editable_fields:
                if field in data:
                    setattr(sup, field, data[field])


@router.post("", response_model=EditProposalResponse, status_code=201)
def create_edit_proposal(
    proposal_in: EditProposalCreate,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """提交导师信息修改申请"""
    # Validate supervisor exists if modifying an existing one
    if proposal_in.supervisor_id is not None:
        sup = db.query(Supervisor).filter(Supervisor.id == proposal_in.supervisor_id).first()
        if not sup:
            raise HTTPException(status_code=404, detail="导师未找到")

    ep = EditProposal(
        supervisor_id=proposal_in.supervisor_id,
        proposed_by=current_user.id,
        proposed_data=proposal_in.proposed_data,
    )
    db.add(ep)
    db.commit()
    db.refresh(ep)
    return ep


@router.get("/pending", response_model=EditProposalListResponse)
def get_pending_proposals(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """获取待审核的编辑申请（需学生认证）"""
    if not current_user.is_student_verified:
        raise HTTPException(status_code=403, detail="需要完成学生认证才能参与审核")

    base_q = (
        db.query(EditProposal)
        .filter(
            EditProposal.status == ProposalStatus.pending,
            EditProposal.proposed_by != current_user.id,
            # Not already assigned as reviewer
            (EditProposal.reviewer_1_id == None) | (EditProposal.reviewer_1_id != current_user.id),  # noqa: E711
            (EditProposal.reviewer_2_id == None) | (EditProposal.reviewer_2_id != current_user.id),  # noqa: E711
        )
        .order_by(EditProposal.created_at.asc())
    )

    total = base_q.count()
    items = base_q.offset((page - 1) * page_size).limit(page_size).all()

    return EditProposalListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/mine", response_model=EditProposalListResponse)
def get_my_proposals(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """获取当前用户提交的编辑申请"""
    base_q = (
        db.query(EditProposal)
        .filter(EditProposal.proposed_by == current_user.id)
        .order_by(EditProposal.created_at.desc())
    )
    total = base_q.count()
    items = base_q.offset((page - 1) * page_size).limit(page_size).all()
    return EditProposalListResponse(items=items, total=total, page=page, page_size=page_size)


@router.post("/{proposal_id}/review", response_model=EditProposalResponse)
def review_proposal(
    proposal_id: uuid.UUID,
    action: ReviewAction,
    current_user: User = Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """审核编辑申请（需两位社区成员通过后自动生效）"""
    if not current_user.is_student_verified:
        raise HTTPException(status_code=403, detail="需要完成学生认证才能参与审核")

    ep = db.query(EditProposal).filter(EditProposal.id == proposal_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="申请未找到")
    if ep.status != ProposalStatus.pending:
        raise HTTPException(status_code=400, detail="该申请已处理")
    if ep.proposed_by == current_user.id:
        raise HTTPException(status_code=400, detail="不能审核自己提交的申请")
    if ep.reviewer_1_id == current_user.id or ep.reviewer_2_id == current_user.id:
        raise HTTPException(status_code=400, detail="您已提交过审核意见")

    # Assign to reviewer_1 or reviewer_2 slot
    if ep.reviewer_1_id is None:
        ep.reviewer_1_id = current_user.id
        ep.reviewer_1_decision = action.decision
    elif ep.reviewer_2_id is None:
        ep.reviewer_2_id = current_user.id
        ep.reviewer_2_decision = action.decision
    else:
        raise HTTPException(status_code=400, detail="审核者名额已满")

    # Evaluate outcome when we have two decisions
    d1 = ep.reviewer_1_decision
    d2 = ep.reviewer_2_decision

    if d1 is not None and d2 is not None:
        if d1 == ReviewDecision.approve and d2 == ReviewDecision.approve:
            ep.status = ProposalStatus.approved
            ep.resolved_at = datetime.utcnow()
            _apply_proposal(db, ep)
        else:
            ep.status = ProposalStatus.rejected
            ep.resolved_at = datetime.utcnow()
    elif action.decision == ReviewDecision.reject:
        # Immediate rejection on first reject (one veto is enough)
        ep.status = ProposalStatus.rejected
        ep.resolved_at = datetime.utcnow()

    db.commit()
    db.refresh(ep)
    return ep


@router.get("/{proposal_id}", response_model=EditProposalResponse)
def get_proposal(
    proposal_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """获取编辑申请详情"""
    ep = db.query(EditProposal).filter(EditProposal.id == proposal_id).first()
    if not ep:
        raise HTTPException(status_code=404, detail="申请未找到")
    return ep
