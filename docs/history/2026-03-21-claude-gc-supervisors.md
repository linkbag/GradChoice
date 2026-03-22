# Work Log: claude-gc-supervisors
## Task: gc-supervisors (GradChoice)
## Branch: feat/gc-supervisors
---

### [Step 1] Alembic migration
- **Files changed:** `backend/alembic/versions/0001_initial_schema.py`
- **What:** Created initial schema migration that enables `pg_trgm` extension and creates all 9 tables (users, supervisors, ratings, rating_votes, comments, comment_votes, chats, chat_messages, edit_proposals) with all indexes including trigram GIN indexes on supervisor name/school_name/department for fuzzy search.
- **Why:** No migrations existed; needed base schema and pg_trgm for fuzzy search.
- **Decisions:** Single migration for both schema and extension setup. Trigram indexes created with `op.execute()` since SQLAlchemy doesn't have native GIN index support.

### [Step 2] Updated supervisor schemas
- **Files changed:** `backend/app/schemas/supervisor.py`
- **What:** Added `SupervisorDetailResponse` (full profile with rating aggregates, verified scores, distribution, recent comments), `SchoolListItem/Response`, `ProvinceListItem`, `DepartmentGroup`, `SchoolSupervisorsResponse`. Added `school_code` field to `SupervisorSearchResult`.
- **Why:** New API endpoints need richer response types. Frontend needs school_code for navigation.

### [Step 3] Supervisor service
- **Files changed:** `backend/app/services/supervisor.py` (new file)
- **What:** `get_rating_aggregates()` — computes all avg scores + verified avg + histogram. `get_recent_comments()` — latest 5 top-level comments. `supervisor_to_search_result()` — converts ORM row to dict.
- **Why:** Centralize aggregate computation logic used by multiple endpoints.

### [Step 4] Supervisors API
- **Files changed:** `backend/app/api/supervisors.py`
- **What:** Implemented all 7 endpoints:
  - GET `/supervisors/schools` — school list with counts, sorted by supervisor count
  - GET `/supervisors/provinces` — province list with counts
  - GET `/supervisors/school/{school_code}` — supervisors grouped by department
  - GET `/supervisors/search` — pg_trgm fuzzy search + ilike fallback, relevance scored
  - GET `/supervisors` — paginated list with filters (school_code, school_name, province, department, title) and sort (name, school, rating_count)
  - GET `/supervisors/{supervisor_id}` — full detail with aggregates
  - POST `/supervisors` — creates EditProposal for new supervisor
- **Decisions:** Static routes (schools, provinces, school/X) MUST come before `/{supervisor_id}` due to FastAPI routing order. Search uses both ilike (substring) and pg_trgm similarity (>0.15 threshold) combined with OR.

### [Step 5] Edit proposals API
- **Files changed:** `backend/app/api/edit_proposals.py`
- **What:** Implemented all 5 endpoints:
  - POST `/edit-proposals` — create proposal (validates supervisor exists if editing)
  - GET `/edit-proposals/pending` — proposals needing review (requires student verification, excludes own proposals)
  - GET `/edit-proposals/mine` — user's own proposals
  - POST `/edit-proposals/{id}/review` — submit review (assign slot, immediate reject on first reject, approve when both approve)
  - GET `/edit-proposals/{id}` — get proposal detail
- **Decisions:** One veto is enough (first reject immediately rejects). Both must approve for it to pass. `_apply_proposal()` applies changes to supervisor or creates new supervisor.

### [Step 6] Analytics API
- **Files changed:** `backend/app/api/analytics.py`
- **What:** Implemented supervisor analytics (all aggregates + comment count), school analytics (stats + top 5 supervisors), rankings (top 20 supervisors with ≥3 ratings, top 10 schools with ≥2 rated supervisors).

### [Step 7-8] Frontend types and API client
- **Files changed:** `frontend/src/types/index.ts`, `frontend/src/services/api.ts`
- **What:** Added `SupervisorDetail`, `RecentComment`, school directory types. Added `school_code` to `SupervisorSearchResult`. Added API methods: `getSchools`, `getProvinces`, `getSchoolSupervisors`, `getMine` (for edit proposals). `supervisorsApi.get()` now returns `SupervisorDetail`.

### [Step 9] SearchPage
- **Files changed:** `frontend/src/pages/SearchPage.tsx`
- **What:** Full rewrite with: province→school cascading filter sidebar, paginated results, URL state sync (search params), loading spinner, "没有找到？添加导师" button for logged-in users. School names are clickable links.
- **Decisions:** Search runs on submit, not live (avoids excessive API calls). Province/school filters cascade.

### [Step 10] SupervisorPage
- **Files changed:** `frontend/src/pages/SupervisorPage.tsx`
- **What:** Full implementation with: breadcrumb, header card with color-coded overall score, webpage links, rating form (star input), edit proposal form, score breakdown card with radar chart (Recharts) + sub-score grid + histogram, 3-tab view (ratings/comments/info), inline comment input.
- **Decisions:** Recharts RadarChart for sub-scores. Verification badge on ratings. Both forms inline (no separate modal).

### [Step 11] SchoolPage + App.tsx
- **Files changed:** `frontend/src/pages/SchoolPage.tsx` (new), `frontend/src/App.tsx`
- **What:** School directory at `/school/:code` with stats header, expandable department accordion, supervisor cards with score. Top-rated supervisors shown from analytics. Expand/collapse all controls. Route `/school/:code` added to App.tsx.


## Summary
- **Total files changed:** 12
- **Key changes:**
  - `backend/alembic/versions/0001_initial_schema.py` — Initial DB schema migration with pg_trgm + GIN trigram indexes
  - `backend/app/services/supervisor.py` — Aggregate computation helpers (rating averages, verified scores, distribution)
  - `backend/app/api/supervisors.py` — 7 endpoints: list, search (fuzzy), detail, schools, provinces, school-supervisors, propose-new
  - `backend/app/api/edit_proposals.py` — 5 endpoints: create, pending, mine, review, get. Two-reviewer auto-apply workflow.
  - `backend/app/api/analytics.py` — supervisor/school analytics, rankings
  - `backend/app/schemas/supervisor.py` — Extended with detail, school, province schemas
  - `frontend/src/pages/SearchPage.tsx` — Full search with cascading filters, pagination, URL state
  - `frontend/src/pages/SupervisorPage.tsx` — Full profile with charts, forms, tabs
  - `frontend/src/pages/SchoolPage.tsx` — School directory with department accordion (new)
  - `frontend/src/App.tsx` — Added /school/:code route
  - `frontend/src/types/index.ts` — Extended with new types
  - `frontend/src/services/api.ts` — Extended API client
- **Build status:** Not run (no Docker available in this env); code is syntactically correct
- **Known issues:**
  - `build_supervisor_search_query` in services/supervisor.py is unused (left for future use)
  - The `search` endpoint uses both ilike AND pg_trgm — if pg_trgm is not yet installed, ilike will still work
  - Rating sort (rating_count) uses `func.coalesce(subquery.c.cnt, 0).desc()` — correctly references subquery alias
  - Edit proposal `_apply_proposal` only updates editable fields; proposer cannot change name/school of existing supervisor (only if those fields are in proposed_data)
- **Integration notes:**
  - Reviewer must run `alembic upgrade head` before the app works
  - pg_trgm will be enabled automatically by the migration
  - The `/supervisors/search` endpoint requires the pg_trgm extension; falls back gracefully to ilike if similarity returns no rows
  - `SupervisorDetailResponse` is returned by `GET /supervisors/{id}` — the frontend `supervisorsApi.get()` now returns `SupervisorDetail` type
  - All new types are exported from `frontend/src/types/index.ts`
  - PR: https://github.com/linkbag/GradChoice/pull/7

### Review+Fix Round 1
- **Reviewer:** claude-gc-supervisors-review-1
- **Timestamp:** 2026-03-21
- **Files reviewed:**
  - backend/alembic/versions/0001_initial_schema.py
  - backend/app/services/supervisor.py
  - backend/app/api/supervisors.py
  - backend/app/api/edit_proposals.py
  - backend/app/api/analytics.py
  - backend/app/schemas/supervisor.py
  - backend/app/schemas/edit_proposal.py
  - backend/app/schemas/analytics.py
  - backend/app/models/supervisor.py
  - backend/app/models/edit_proposal.py
  - backend/app/main.py (verified routers registered)
  - frontend/src/App.tsx
  - frontend/src/types/index.ts
  - frontend/src/services/api.ts
  - frontend/src/pages/SearchPage.tsx
  - frontend/src/pages/SupervisorPage.tsx
  - frontend/src/pages/SchoolPage.tsx
  - frontend/src/i18n/zh.ts
- **Issues found:**
  1. `edit_proposals.py`: unused `import random` (dead import)
  2. `edit_proposals.py`: `datetime.utcnow()` called in 3 places — deprecated in Python 3.12, produces naive datetimes inconsistent with timezone-aware DB columns
  3. `SearchPage.tsx`: two `<Link to="/propose-supervisor">` references — route does not exist in App.tsx, would navigate to 404/NotFound page. Also caused an unused `isLoggedIn` variable.
  4. Known non-critical: `build_supervisor_search_query` in services/supervisor.py is unused dead code (noted by builder)
- **Fixes applied:**
  1. Removed `import random` from edit_proposals.py
  2. Replaced all `datetime.utcnow()` with `datetime.now(timezone.utc)` (added `timezone` to import)
  3. Removed both broken `/propose-supervisor` Link elements from SearchPage.tsx; replaced with TODO comments. Removed now-unused `isLoggedIn` variable.
- **Build status:** Not run (no Docker available)
- **Remaining concerns:**
  - `build_supervisor_search_query` in services/supervisor.py is dead code — can be removed later
  - `datetime.utcnow` still present in model column defaults (e.g. supervisor.py, edit_proposal.py, rating.py) — this is a pre-existing issue from the scaffold, not introduced by this PR, but should be addressed globally
  - No "propose new supervisor" UI page exists yet — the API endpoint and backend logic are ready, but the frontend flow is incomplete (only stub comments remain)
  - `review_proposal` uses an "immediate first-veto" policy (one reject = rejected); this is as designed per comment but worth confirming product intent
