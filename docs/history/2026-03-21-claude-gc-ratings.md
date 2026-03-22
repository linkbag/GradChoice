# Work Log: claude-gc-ratings
## Task: gc-ratings (GradChoice)
## Branch: feat/gc-ratings
---

### [Step 1] Created SupervisorRatingCache model
- **Files changed:** backend/app/models/supervisor_rating_cache.py, backend/app/models/supervisor.py, backend/app/models/__init__.py
- **What:** New SQLAlchemy model for caching aggregate rating stats per supervisor (all/verified averages, counts, score distribution)
- **Why:** Fast reads for supervisor score summary without recomputing from ratings table on every request
- **Decisions:** Used Numeric(4,2) for averages (need room for values like 10.00 — actually max is 5.00 but Numeric(4,2) gives extra safety)

### [Step 2] Created Alembic migration 001_initial_schema.py
- **Files changed:** backend/alembic/versions/001_initial_schema.py
- **What:** Complete schema migration creating all 10 tables with proper FK constraints, indexes, and enum types
- **Why:** No prior migrations existed; needed to capture the full initial schema including new supervisor_rating_cache table
- **Decisions:** Used create_type=False + manual type creation to avoid duplicate enum creation errors

### [Step 3] Created rating aggregation service
- **Files changed:** backend/app/services/rating.py
- **What:** compute_supervisor_aggregates() function that upserts the cache table after any rating mutation
- **Why:** Decouples aggregate computation from API layer, ensures cache is always fresh
- **Decisions:** Python-side computation (simple, avoids complex SQL); rounds to 2 decimals

### [Step 4] Updated rating schemas
- **Files changed:** backend/app/schemas/rating.py
- **What:** Added half-star increment validation (0.5 increments only), display_name field on RatingResponse, RatingListResponse (paginated), SupervisorRatingCacheResponse
- **Why:** Task requirement for 0.5 increments; display_name needed for anonymous display; paginated list response for list endpoint

### [Step 5] Implemented all rating API endpoints
- **Files changed:** backend/app/api/ratings.py, backend/app/utils/auth.py
- **What:** 7 endpoints: POST /ratings, GET /ratings/mine, GET /ratings/supervisor/{id}, GET /ratings/supervisor/{id}/summary, PUT /ratings/{id}, DELETE /ratings/{id}, POST /ratings/{id}/vote
- **Why:** Core feature
- **Decisions:** Batch vote query to avoid N+1; added get_optional_current_user() for public endpoints that benefit from auth context
- **Anti-abuse:** Min account age 1hr, max 10 ratings/day, half-star validation

### [Step 6] Updated frontend types and API client
- **Files changed:** frontend/src/types/index.ts, frontend/src/services/api.ts
- **What:** Added display_name to Rating type, new RatingListResponse type, SupervisorRatingCache type; updated ratingsApi with new endpoints (getSummary, getMine) and updated getBySupervisor to return RatingListResponse

### [Step 7] Created RatingForm component
- **Files changed:** frontend/src/components/RatingForm.tsx
- **What:** Modal form with half-star star selector, 6 optional sub-score selectors, confirmation dialog, edit mode support, verified badge
- **Why:** Main rating input UI; all labels in Chinese

### [Step 8] Created RatingCard component
- **Files changed:** frontend/src/components/RatingCard.tsx
- **What:** Display card for a single rating; shows overall + sub-scores, verified badge, relative time, upvote/downvote buttons with optimistic updates, edit/delete controls for owner
- **Why:** Rating list item UI

### [Step 9] Created RatingSummary component
- **Files changed:** frontend/src/components/RatingSummary.tsx
- **What:** Aggregate score display; toggle between all/verified averages, score distribution bar chart, sub-score breakdown
- **Why:** Summary view at top of supervisor page

### [Step 10] Updated SupervisorPage
- **Files changed:** frontend/src/pages/SupervisorPage.tsx
- **What:** Full integration — supervisor info, RatingSummary, RatingCard list with sort/filter/pagination, RatingForm modal
- **Why:** Wires all components together on the supervisor detail page

## Summary
- **Total files changed:** 15
- **Key changes:**
  - Backend: SupervisorRatingCache model + migration, aggregation service, full ratings API (7 endpoints), optional auth helper, updated schemas with half-star validation
  - Frontend: RatingForm, RatingCard, RatingSummary components + SupervisorPage integration
- **Build status:** Not verified (no DB available in this env)
- **Known issues:**
  - auth.py `get_optional_current_user` currently uses Request injection — works but is not the standard OAuth2PasswordBearer pattern
  - `get_supervisor_ratings` has a quirk: count is calculated before sort, which is correct, but the `most_helpful` sort uses an outerjoin that could affect count if not careful (it doesn't — count is computed before the join is applied)
  - SVG gradient IDs in RatingForm/RatingCard use inline IDs that may collide if many star selectors are on screen simultaneously — low risk for current usage
- **Integration notes:**
  - Next agent should implement `GET /supervisors/{id}` and auth endpoints to make the full flow testable
  - The `/ratings/supervisor/{id}/summary` endpoint is new (not in original spec) — frontend uses it to power RatingSummary
  - All score validation enforces 0.5 increments server-side; client also enforces via half-star UI
  - Alembic migration 001 creates ALL tables from scratch; run `alembic upgrade head` from backend/ directory

### Review+Fix Round 1
- **Reviewer:** claude-gc-ratings-review-1
- **Timestamp:** 2026-03-21 18:11:15
- **Files reviewed:**
  - backend/app/models/supervisor_rating_cache.py (new)
  - backend/app/models/supervisor.py (updated)
  - backend/app/models/chat.py (inspected for regressions)
  - backend/app/models/__init__.py
  - backend/alembic/versions/001_initial_schema.py
  - backend/app/services/rating.py
  - backend/app/schemas/rating.py
  - backend/app/api/ratings.py
  - backend/app/utils/auth.py
  - frontend/src/types/index.ts
  - frontend/src/services/api.ts
  - frontend/src/components/RatingForm.tsx
  - frontend/src/components/RatingCard.tsx
  - frontend/src/components/RatingSummary.tsx
  - frontend/src/pages/SupervisorPage.tsx
- **Issues found:**
  1. datetime.utcnow() used in supervisor_rating_cache.py, supervisor.py, chat.py, services/rating.py, api/ratings.py, auth.py — violates project-wide timezone-aware datetime convention
  2. DateTime columns in supervisor.py and supervisor_rating_cache.py missing timezone=True flag
  3. Alembic migration 001 missing upvotes and downvotes columns that are present in the Rating model
  4. ChatMessage.is_read field dropped from worktree frontend/src/types/index.ts — regression of integration review 1 fix
  5. SVG linearGradient IDs collide across multiple StarSelector instances (RatingForm.tsx uses grad-1 through grad-5 globally); same issue in RatingCard.tsx StarDisplay
- **Fixes applied:**
  1. Replaced datetime.utcnow() with datetime.now(timezone.utc) in all 6 files; added timezone import where missing
  2. Added timezone=True to DateTime columns in supervisor.py and supervisor_rating_cache.py
  3. Added upvotes and downvotes Integer columns (server_default="0") to ratings table in migration
  4. Restored is_read: boolean field to ChatMessage interface in types/index.ts
  5. Added useId() hook to StarSelector (RatingForm) and StarDisplay (RatingCard); scoped gradient IDs to uid per instance
- **Build status:** Not verified (no build tool available in env)
- **Remaining concerns:**
  - get_optional_current_user() uses Request injection rather than OAuth2PasswordBearer — works but OpenAPI docs won't show the lock icon on GET /ratings/supervisor/{id}. Low-severity cosmetic issue.
  - most_helpful sort uses outerjoin on a subquery — if the same rating appears in multiple vote rows this can produce duplicates; current implementation uses a subquery with group_by which is correct, but integrator should test with paginated results.
  - The denormalized upvotes/downvotes fields on Rating model are never updated (all vote data is computed live from rating_votes table). These columns exist in the DB but are always 0. Consider removing them in a follow-up or wiring them up; for now the API correctly computes counts live so there is no data correctness bug.
  - VoteType imported from models in schemas/rating.py — minor coupling, not a circular import. Could be refactored to Literal["up","down"] like other schemas.
