# Integration Log: Security hardening batch - disable docs, auth gate, rate limiting
**Project:** GradChoice
**Subteams:** claude-gc-sec-quick-fixes claude-gc-sec-auth-gate claude-gc-sec-rate-limit
**Started:** 2026-04-03 21:56:53

## Subteam Summaries


========================================
## Subteam: claude-gc-sec-quick-fixes
========================================
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

========================================
## Subteam: claude-gc-sec-auth-gate
========================================
# Worklog: gc-sec-auth-gate

**Branch:** feat/gc-sec-auth-gate
**Date:** 2026-04-03
**Task:** Add tiered authentication gate for read endpoints

## Status: COMPLETE

## Changes Made

### `backend/app/schemas/supervisor.py`
- Added `SupervisorLimitedResult` (id, name, school_name, department only)
- Added `SupervisorLimitedListResponse` (items, total, page, page_size, requires_login=True)

### `backend/app/api/supervisors.py`
- Imported `get_optional_current_user` and new limited schemas
- `GET /supervisors/search`: Tiered page_size (5/20/50), limited fields for unauth
- `GET /supervisors` (list): Same tiered logic
- `GET /supervisors/{id}`: Returns `SupervisorLimitedResult` for unauth, full `SupervisorResponse` for auth
- `GET /supervisors/school/{code}`: First 5 supervisors with limited fields for unauth; full data for auth
- Kept open (no auth): /schools, /provinces, /school-names, /departments, /submit

### `backend/app/api/ratings.py`
- `GET /ratings/supervisor/{id}`: Unauth capped at 3 results; user_id replaced with UUID(int=0)

### `backend/app/api/comments.py`
- `GET /comments/supervisor/{id}`: Unauth capped at 3 results

### `backend/app/api/analytics.py`
- Imported `get_optional_current_user`
- All 4 endpoints (supervisor analytics, school analytics, rankings, overview): 403 for unauth with "请登录查看详细数据"

## Auth Tiers Implemented
| Tier | Max results | Fields |
|------|-------------|--------|
| Unauthenticated | 5 (supervisors), 3 (ratings/comments) | Limited (id, name, school_name, dept) |
| Authenticated (any) | 20 (supervisors), full | Full |
| Authenticated + .edu verified | 50 (supervisors), full | Full |

## Verification
- `python3 -c "from app.schemas.supervisor import SupervisorLimitedResult; print('OK')"` → OK
- All modified API modules import cleanly (supervisors, ratings, comments, analytics)
- boto3 missing in local dev env is pre-existing, unrelated to these changes

## Known Issues
- None. Existing authenticated user flows are unchanged (write endpoints untouched).

## Decisions Made
- Used `uuid.UUID(int=0)` as anonymous user_id placeholder in ratings (consistent with comments.py pattern)
- Removed `response_model=` from supervisor search/list/detail since they now return different types based on auth; FastAPI serializes Pydantic models correctly without it
- Analytics `/overview` also gated (spec said "all endpoints")

## Build Status
- All modified modules import cleanly ✓
- boto3 import error in local env is pre-existing (not our changes) ✓

### Review Round 1
- Verdict: Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)

========================================
## Subteam: claude-gc-sec-rate-limit
========================================
# Work Log: gc-sec-rate-limit

## Session: 2026-04-03

### What Changed

1. **`backend/requirements.txt`** — Added `slowapi==0.1.9`
2. **`backend/requirements-lambda.txt`** — Added `slowapi==0.1.9`
3. **`backend/app/middleware/__init__.py`** — Created (empty, makes middleware a package)
4. **`backend/app/middleware/rate_limit.py`** — Created Limiter with `get_real_ip` (reads X-Forwarded-For for Lambda/CloudFront), default 200/minute
5. **`backend/app/main.py`** — Added SlowAPIMiddleware, limiter state, and RateLimitExceeded handler
6. **`backend/app/api/supervisors.py`** — Added `request: Request` param + `@limiter.limit()` to 4 endpoints
7. **`backend/app/api/auth.py`** — Added `request: Request` param + `@limiter.limit()` to 3 endpoints

### Rate Limits Applied

| Endpoint | Limit |
|---|---|
| `GET /supervisors/search` | 30/minute |
| `GET /supervisors` (list) | 30/minute |
| `GET /supervisors/{id}` | 60/minute |
| `GET /supervisors/school/{code}` | 30/minute |
| `POST /auth/send-signup-verification` | 5/minute |
| `POST /auth/send-reset-verification` | 5/minute |
| `POST /auth/login` | 10/minute |
| All other routes | 200/minute (default) |

### How to Verify

```bash
# Verify slowapi imports (no venv needed)
python3 -c "from slowapi import Limiter, _rate_limit_exceeded_handler; print('OK')"

# Full app import (requires SECRET_KEY + boto3)
cd backend && SECRET_KEY=xxx python3 -c "from app.main import app; print('OK')"

# Test rate limiting (hit /auth/login 11 times in 1 minute, 11th should return 429)
for i in $(seq 1 11); do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8000/auth/login -d "username=x&password=y"; done
```

### Known Issues / Notes

- slowapi uses in-memory storage by default → each Lambda container rate-limits independently. Acceptable without Redis for this scale.
- Pre-existing: `boto3` not in system Python, so local `python3 -c "from app.main import app"` fails unless inside Docker. Unrelated to this change.
- X-Forwarded-For parsing strips the first IP (client IP) from comma-separated chain — correct for AWS ALB/CloudFront.

### Decisions Made

- Used `get_real_ip()` instead of default `get_remote_address` to correctly handle Lambda's proxy headers
- `request: Request` added as first positional param (required by slowapi decorator)
- Did not rate-limit `/supervisors/schools`, `/supervisors/provinces`, `/supervisors/school-names`, `/supervisors/departments` — these are low-frequency dropdown/list endpoints covered by the default 200/minute

### Build Status

All code changes syntactically valid. slowapi imports confirmed working. App import blocked only by missing boto3 in system Python (pre-existing, unrelated).

### Review Round 1
- Verdict: Review passed — reviewer fixed issues (commit: 6913dcb docs: auto-update ESR + persist worklog for claude-gc-sec-quick-fixes)

---
## Integration Review

### Integration Round 1
- **Timestamp:** 2026-04-03 21:57:01
- **Cross-team conflicts found:** 2 merge conflicts in `backend/app/api/supervisors.py` — (1) quick-fixes `le=20` vs auth-gate `le=200` + `current_user` param on school/{code} and search endpoints; (2) rate-limit `@limiter.limit()` + `response_model` vs auth-gate removing `response_model` (returns different types by auth tier)
- **Duplicated code merged:** None — each subteam's changes were complementary (page_size caps, auth tiering, rate limiting)
- **Build verified:** pass — all 12 modified Python files compile cleanly
- **Fixes applied:** Resolved all merge conflicts in supervisors.py: kept `le=20` (quick-fixes) + `current_user` param (auth-gate) + `@limiter.limit()` decorator (rate-limit) + `request: Request` param (rate-limit); dropped `response_model=` on endpoints that return different types based on auth state; ensured `q_escaped` ILIKE sanitization (quick-fixes) coexists with tiered page_size logic (auth-gate)
- **Remaining concerns:** `main.py` `settings.DEBUG` must be configured in prod env. Frontend may need to handle `requires_login: true` responses and new 403s from analytics. In-memory rate limiting (slowapi default) means per-Lambda-container limits, acceptable at current scale.
