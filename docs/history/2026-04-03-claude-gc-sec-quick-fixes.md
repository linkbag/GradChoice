# Worklog: gc-sec-quick-fixes

## Session: 2026-04-03

### Tasks Completed

#### Task 1: Disable API docs in production
- **File**: `backend/app/main.py`
- **Change**: Added conditional `docs_url`, `redoc_url`, `openapi_url` — all `None` when `settings.DEBUG` is falsy
- **Verify**: In production (DEBUG=False), GET /docs and /redoc return 404

#### Task 2: Fix user profile endpoint
- **File**: `backend/app/api/users.py`
- **Change**: Route changed from `/{user_id}/profile` → `/{user_id}` (already used `response_model=UserPublicProfile`)
- **Note**: `UserPublicProfile` was already imported and applied; this aligns URL with spec

#### Task 3: Cap page_size to le=20
- **Files changed**:
  - `supervisors.py`: `le=200` → `le=20` (school/{code}), `le=100` → `le=20` (search, list)
  - `ratings.py`: `le=100` → `le=20`
  - `comments.py`: `le=100` → `le=20`
  - `analytics.py`: `le=100` → `le=20`
  - `chats.py`: default `50` → `20`, `le=100` → `le=20`
  - `edit_proposals.py`: `le=100` → `le=20`
  - `users.py`: both `/me/ratings` and `/me/comments`: `le=100` → `le=20`

#### Task 4: Sanitize ILIKE wildcards
- **File**: `backend/app/api/supervisors.py` — `search_supervisors`
- **Change**: Added `q_escaped = q.replace("%", "\\%").replace("_", "\\_")` before ILIKE filters
- **Why**: Without escaping, users could submit `%` or `_` to cause unintended SQL wildcard behavior

### Verification
- `python3 -m py_compile` on all 8 modified files → OK
- Import error (`boto3` missing) is pre-existing, unrelated to these changes

### Build Status
- All syntax checks pass
- Full import verification blocked by missing `boto3` in local env (pre-existing)

### Integration Notes
- Frontend may need URL update if it calls `/users/{id}/profile` → now `/users/{id}`
- Clients requesting `page_size > 20` will receive a 422 validation error (FastAPI enforces `le`)
- `settings.DEBUG` must be set to `True` in dev `.env` to access `/docs`

### Decisions
- `chats.py` default was 50 — lowered to 20 to match cap
- Did not change `le` on `/me/ratings` and `/me/comments` in users.py to below 20 since they were 100 (changed to 20 as instructed)

### Review Round 1
- Verdict: Review passed — reviewer fixed issues (commit: 90fd276 fix: update terms page contact email to Webster@gradchoice.org)
