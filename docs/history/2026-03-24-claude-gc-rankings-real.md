# Work Log: claude-gc-rankings-real
## Task: gc-rankings-real (GradChoice)
## Branch: feat/gc-rankings-real
---

### [Step 1] Change min_ratings default from 3 → 1 in backend service
- **Files changed:** backend/app/services/analytics.py
- **What:** `get_rankings()` function signature — `min_ratings: int = 3` → `min_ratings: int = 1`
- **Why:** Most supervisors have exactly 1 rating (legacy import); requiring 3 excluded almost everyone
- **Decisions:** Only default changed; HAVING clause kept as-is, callers can still override

### [Step 2] Change min_ratings default from 3 → 1 in API endpoint
- **Files changed:** backend/app/api/analytics.py
- **What:** `Query(3, ge=1, ...)` → `Query(1, ge=1, ...)` for `min_ratings` param (line ~43)
- **Why:** API default must match service default so bare GET /rankings works correctly
- **Decisions:** `ge=1` kept (0 would be meaningless — a supervisor with no ratings can't be ranked)

### [Step 3] Change min_ratings from 3 → 1 in frontend getRankings call + UI text
- **Files changed:** frontend/src/pages/RankingsPage.tsx
- **What:** `min_ratings: 3` → `min_ratings: 1` in analyticsApi.getRankings call; also updated subtitle text from "至少 3 条评价" → "至少 1 条评价"
- **Why:** Frontend was hard-coding 3, overriding any backend default
- **Decisions:** UI text updated for consistency with new behaviour

### [Step 4] Verification
- **Backend:** `SECRET_KEY=test python3 -c "from app.main import app"` → OK
- **Frontend:** `npx tsc --noEmit` → TSC_PASS (after npm install, node_modules was absent in worktree)
- **Issues found:** node_modules not present in worktree (expected — gitignored); installed transiently for check only

## Summary
- **Total files changed:** 3
- **Key changes:**
  - `backend/app/services/analytics.py`: `get_rankings()` default `min_ratings` 3 → 1
  - `backend/app/api/analytics.py`: FastAPI Query default `min_ratings` 3 → 1
  - `frontend/src/pages/RankingsPage.tsx`: hard-coded `min_ratings: 3` → `1`; subtitle text updated
- **Build status:** Backend import OK; TypeScript TSC pass
- **Known issues:** None
- **Integration notes:** Pure default-value change — no schema/migration changes needed. The SQL HAVING clause already supports any value ≥ 1. With 13,165 ratings across ~13,164 supervisors the rankings list will now show ~13,000+ supervisors instead of a near-empty list. Reviewer: no DB migration needed, no API contract breakage (default only).

### Review Round 1
- Verdict: Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)
