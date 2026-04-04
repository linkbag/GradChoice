# Work Log: Wikipedia-Style Instant Edits Backend
Date: 2026-04-03
Branch: feat/gc-wiki-edits-backend

## Changes Made

### 1. Migration: `backend/alembic/versions/0012_add_previous_data_to_edit_proposals.py`
- Revision: 0012, down_revision: 0011
- Adds `previous_data JSONB` column to `edit_proposals` table via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`

### 2. Model: `backend/app/models/edit_proposal.py`
- Added `previous_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)`

### 3. Schema: `backend/app/schemas/edit_proposal.py`
- Added `previous_data: Optional[dict[str, Any]] = None` to `EditProposalResponse`

### 4. API: `backend/app/api/edit_proposals.py`
- `create_edit_proposal`: Changed from `get_current_verified_user` → `get_current_user` (any logged-in user can edit)
- Create endpoint now: snapshots current supervisor data into `previous_data`, applies changes immediately, saves record with `status=approved, resolved_at=now`
- New supervisor proposals: validates required fields before creating
- Added `GET /edit-proposals/supervisor/{supervisor_id}/history` endpoint (public, paginated)
- Kept `/pending` and `/{id}/review` endpoints for backward compatibility (no-ops since all edits auto-approve)
- Removed `_apply_proposal` helper (no longer needed)

## How to Verify
```bash
# Import check
cd backend && SECRET_KEY=test python3 -c "from app.api.edit_proposals import router; print('OK')"

# Run migration
cd backend && SECRET_KEY=xxx python3 -m alembic upgrade head

# Test edit endpoint
POST /edit-proposals  (requires JWT auth)
{"supervisor_id": "<uuid>", "proposed_data": {"title": "教授"}}
→ Returns proposal with status=approved, previous_data={"title": "副教授"}, resolved_at set

# Test history endpoint
GET /edit-proposals/supervisor/<uuid>/history
→ Returns {"items": [...], "total": N, "page": 1, "page_size": 20}
```

## Decisions Made
- Any logged-in user (not just verified) can edit — lower friction matches Wikipedia model
- New supervisor creation via edit proposals now validates required fields upfront (returns 422)
- History endpoint is public (no auth) — transparent edit log
- `_apply_proposal` helper removed since old 2-reviewer flow is retired

## Known Issues / Integration Notes
- `boto3` not installed in local dev environment — `from app.main import app` fails locally; use Docker for full testing
- Existing pending proposals in DB (if any) will remain in `pending` state forever — could clean up manually
- Migration uses `IF NOT EXISTS` so it's safe to run multiple times

## Build Status
- `from app.api.edit_proposals import router` → OK
- `EditProposal.__table__.columns.keys()` includes `previous_data` → OK
- Migration chain: 0001 → 0002 → 0003 → 0004 → 0005 → 0006 → 0007 → 0008 → 0009 → 0010 → 0011 → **0012**

### Review Round 1
- Verdict: Review passed — reviewer fixed issues (commit: 8f94f52 fix: show scores in limited results for unauthenticated users (signup incentive))
