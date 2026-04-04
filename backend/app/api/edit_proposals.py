import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.edit_proposal import EditProposal, ProposalStatus, ReviewDecision
from app.models.supervisor import Supervisor
from app.schemas.edit_proposal import (
    EditProposalCreate, EditProposalResponse, EditProposalListResponse, ReviewAction
)
from app.utils.auth import get_current_user, get_current_verified_user

router = APIRouter(prefix="/edit-proposals", tags=["编辑申请"])

# Fields allowed to be updated via edit proposal
_UPDATABLE_SUPERVISOR_FIELDS = {
    "name", "department", "title", "affiliated_unit",
    "webpage_url_1", "webpage_url_2", "webpage_url_3",
    "school_code", "school_name", "province",
}

# Fields required when proposing a brand-new supervisor
_REQUIRED_NEW_SUPERVISOR_FIELDS = {"name", "school_code", "school_name", "province", "department"}


@router.post("", response_model=EditProposalResponse, status_code=201)
def create_edit_proposal(
    proposal_in: EditProposalCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """提交导师信息修改（立即生效，自动记录历史）"""
    if not proposal_in.proposed_data:
        raise HTTPException(status_code=422, detail="proposed_data 不能为空")

    # Validate allowed fields
    unknown = set(proposal_in.proposed_data.keys()) - _UPDATABLE_SUPERVISOR_FIELDS
    if unknown:
        raise HTTPException(status_code=422, detail=f"不允许修改的字段: {', '.join(sorted(unknown))}")

    if proposal_in.supervisor_id is not None:
        supervisor = db.get(Supervisor, proposal_in.supervisor_id)
        if supervisor is None:
            raise HTTPException(status_code=404, detail="导师不存在")

        # Snapshot current data before applying changes
        previous_data = {
            field: getattr(supervisor, field, None)
            for field in proposal_in.proposed_data
            if field in _UPDATABLE_SUPERVISOR_FIELDS
        }

        # Apply changes immediately
        for field, value in proposal_in.proposed_data.items():
            if field in _UPDATABLE_SUPERVISOR_FIELDS:
                setattr(supervisor, field, value)
        db.add(supervisor)
    else:
        # New supervisor proposal — validate required fields
        missing = _REQUIRED_NEW_SUPERVISOR_FIELDS - set(proposal_in.proposed_data.keys())
        if missing:
            raise HTTPException(
                status_code=422,
                detail=f"新增导师缺少必填字段: {', '.join(sorted(missing))}",
            )
        data = {k: v for k, v in proposal_in.proposed_data.items() if k in _UPDATABLE_SUPERVISOR_FIELDS}
        supervisor = Supervisor(**data)
        db.add(supervisor)
        previous_data = {}

    now = datetime.now(timezone.utc)
    proposal = EditProposal(
        supervisor_id=proposal_in.supervisor_id,
        proposed_by=current_user.id,
        proposed_data=proposal_in.proposed_data,
        previous_data=previous_data,
        status=ProposalStatus.approved,
        resolved_at=now,
    )
    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    return proposal


@router.get("/supervisor/{supervisor_id}/history")
def get_edit_history(
    supervisor_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=20),
    db: Session = Depends(get_db),
):
    """获取导师信息编辑历史（公开）"""
    from app.models.user import User

    base_q = db.query(EditProposal).filter(
        EditProposal.supervisor_id == supervisor_id,
        EditProposal.status == ProposalStatus.approved,
    )
    total = base_q.count()
    items = (
        base_q
        .order_by(EditProposal.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    result = []
    for item in items:
        editor = db.get(User, item.proposed_by)
        result.append({
            "id": str(item.id),
            "editor_name": editor.display_name if editor and editor.display_name else "匿名用户",
            "editor_id": str(item.proposed_by),
            "proposed_data": item.proposed_data,
            "previous_data": item.previous_data,
            "created_at": item.created_at.isoformat(),
        })

    return {"items": result, "total": total, "page": page, "page_size": page_size}


@router.get("/pending", response_model=EditProposalListResponse)
def get_pending_proposals(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=20),
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """获取待审核的编辑申请（保留兼容，实际不会有待审核项）"""
    if not current_user.is_student_verified:
        raise HTTPException(status_code=403, detail="需要学生认证才能审核申请")

    base_q = (
        db.query(EditProposal)
        .filter(EditProposal.status == ProposalStatus.pending)
        .filter(EditProposal.proposed_by != current_user.id)
        .filter(
            (EditProposal.reviewer_1_id == None) |  # noqa: E711
            (EditProposal.reviewer_1_id != current_user.id)
        )
    )
    total = base_q.count()
    items = (
        base_q
        .order_by(EditProposal.created_at.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return EditProposalListResponse(items=items, total=total, page=page, page_size=page_size)


@router.post("/{proposal_id}/review", response_model=EditProposalResponse)
def review_proposal(
    proposal_id: uuid.UUID,
    action: ReviewAction,
    current_user=Depends(get_current_verified_user),
    db: Session = Depends(get_db),
):
    """审核编辑申请（保留兼容，实际不会有待审核项）"""
    if not current_user.is_student_verified:
        raise HTTPException(status_code=403, detail="需要学生认证才能审核申请")

    proposal = db.get(EditProposal, proposal_id)
    if proposal is None:
        raise HTTPException(status_code=404, detail="申请不存在")
    if proposal.status != ProposalStatus.pending:
        raise HTTPException(status_code=409, detail="该申请已完成审核")
    if proposal.proposed_by == current_user.id:
        raise HTTPException(status_code=403, detail="不能审核自己提交的申请")
    if proposal.reviewer_1_id == current_user.id or proposal.reviewer_2_id == current_user.id:
        raise HTTPException(status_code=409, detail="已审核过该申请")

    decision = ReviewDecision(action.decision)

    if proposal.reviewer_1_id is None:
        proposal.reviewer_1_id = current_user.id
        proposal.reviewer_1_decision = decision
    elif proposal.reviewer_2_id is None:
        proposal.reviewer_2_id = current_user.id
        proposal.reviewer_2_decision = decision
    else:
        raise HTTPException(status_code=409, detail="该申请已有两位审核者")

    now = datetime.now(timezone.utc)
    if decision == ReviewDecision.reject:
        proposal.status = ProposalStatus.rejected
        proposal.resolved_at = now
    elif (
        proposal.reviewer_1_decision == ReviewDecision.approve
        and proposal.reviewer_2_decision == ReviewDecision.approve
    ):
        proposal.status = ProposalStatus.approved
        proposal.resolved_at = now

    db.add(proposal)
    db.commit()
    db.refresh(proposal)
    return proposal


@router.get("/{proposal_id}", response_model=EditProposalResponse)
def get_proposal(proposal_id: uuid.UUID, db: Session = Depends(get_db)):
    """获取编辑申请详情"""
    proposal = db.get(EditProposal, proposal_id)
    if proposal is None:
        raise HTTPException(status_code=404, detail="申请不存在")
    return proposal
