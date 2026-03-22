# Integration Log: GradChoice Phase 1 - Project scaffold + DB schema
**Project:** GradChoice
**Subteams:** claude-gc-scaffold
**Started:** 2026-03-21 18:07:12

## Subteam Summaries


========================================
## Subteam: claude-gc-scaffold
========================================
# Work Log: claude-gc-scaffold
## Task: gc-scaffold (GradChoice)
## Branch: feat/gc-scaffold
---

### [Step 1] Backend scaffold
- **Files changed:** backend/app/main.py, backend/app/config.py, backend/app/database.py, backend/app/models/{user,supervisor,rating,comment,chat,edit_proposal}.py, backend/app/schemas/{user,supervisor,rating,comment,chat,edit_proposal,analytics}.py, backend/app/api/{auth,users,supervisors,ratings,comments,analytics,chats,edit_proposals}.py, backend/app/utils/auth.py, backend/alembic/env.py, backend/alembic/script.py.mako, backend/alembic.ini, backend/requirements.txt, backend/Dockerfile
- **What:** Full FastAPI backend with SQLAlchemy models, Pydantic schemas, route skeletons
- **Why:** Provides typed contracts for all 6 parallel feature agents to implement against
- **Decisions:** Used UUID PKs everywhere; used SQLAlchemy 2.0 mapped_column style; VoteType enum duplicated in rating.py and comment.py (intentional — separate tables); edit_proposal uses JSONB for proposed_data flexibility
- **Issues found:** None

### [Step 2] Frontend scaffold
- **Files changed:** frontend/src/App.tsx, frontend/src/main.tsx, frontend/src/index.css, frontend/src/components/Layout.tsx, frontend/src/pages/{HomePage,SearchPage,SupervisorPage,LoginPage,RegisterPage,ProfilePage,InboxPage,AboutPage,NotFoundPage}.tsx, frontend/src/services/api.ts, frontend/src/types/index.ts, frontend/src/i18n/zh.ts, frontend/package.json, frontend/tsconfig.json, frontend/vite.config.ts, frontend/tailwind.config.js, frontend/Dockerfile, frontend/nginx.conf
- **What:** Vite+React+TypeScript scaffold with Tailwind, routing, typed API client, i18n, layout
- **Why:** Establishes UI structure for frontend feature agents
- **Decisions:** All UI text in zh.ts i18n file; axios interceptors handle auth token + 401 redirect; Noto Sans SC for Chinese typography

### [Step 3] Docker Compose + config
- **Files changed:** docker-compose.yml, .env.example, .gitignore
- **What:** Full docker-compose with Postgres 16, API, frontend; healthcheck on db
- **Decisions:** Used postgres:16-alpine for smaller image; volume mount backend for live reload in dev

### [Step 4] Seed script
- **Files changed:** backend/seed_tutors.py
- **What:** CSV importer with encoding auto-detection (utf-8/gbk/gb18030), dedup via unique constraint, per-school stats, dry-run mode
- **Decisions:** Handles IntegrityError gracefully for deduplication; supports --dry-run

### [Step 5] README
- **Files changed:** README.md
- **What:** Comprehensive Chinese README with setup, API docs, schema overview, contributing guide

### Review+Fix Round 1
- **Reviewer:** claude-gc-scaffold-review-1
- **Timestamp:** 2026-03-21 17:51:45
- **Files reviewed:**
  - backend/app/main.py, backend/app/config.py, backend/app/database.py, backend/app/utils/auth.py
  - backend/app/models/{user,supervisor,rating,comment,chat,edit_proposal}.py + __init__.py
  - backend/app/schemas/{user,supervisor,rating,comment,chat,edit_proposal,analytics}.py
  - backend/app/api/{auth,users,supervisors,ratings,comments,analytics,chats,edit_proposals}.py
  - backend/requirements.txt, backend/Dockerfile, backend/alembic/env.py, backend/alembic.ini, backend/seed_tutors.py
  - frontend/src/types/index.ts, frontend/src/services/api.ts, frontend/src/App.tsx
  - frontend/src/components/Layout.tsx, frontend/src/pages/*.tsx
  - frontend/package.json, frontend/vite.config.ts, frontend/tsconfig.json, frontend/tailwind.config.js, frontend/nginx.conf
  - docker-compose.yml, .env.example

- **Issues found:**
  1. Hardcoded weak SECRET_KEY default in config.py — silently used in production if env var absent
  2. datetime.utcnow() deprecated in auth.py and all model files
  3. DateTime columns without timezone=True — naive datetime storage
  4. Missing avg_overall_score and rating_count columns on Supervisor model (referenced by SupervisorSearchResult schema)
  5. Missing upvotes and downvotes columns on Rating model (referenced by RatingResponse schema)
  6. Missing transient attributes on models: user_vote (Rating, Comment), reply_count (Comment), last_message, unread_count (Chat) — pydantic from_attributes serialization would fail
  7. Circular imports: schemas importing enums from models (user, rating, comment, edit_proposal schemas)
  8. Unused SupervisorCreate import in api/supervisors.py
  9. Unused get_current_verified_user import in api/users.py
  10. Missing email-validator package (required by pydantic EmailStr)
  11. --reload flag in production Dockerfile CMD
  12. Weak SECRET_KEY fallback in docker-compose.yml
  13. Missing @types/node in frontend devDependencies (vite.config.ts uses path import)

- **Fixes applied:**
  1. Removed SECRET_KEY default — startup fails cleanly if env var not set
  2. Replaced datetime.utcnow() with datetime.now(timezone.utc) everywhere
  3. Changed all DateTime columns to DateTime(timezone=True)
  4. Added avg_overall_score and rating_count to Supervisor model
  5. Added upvotes and downvotes to Rating model
  6. Added transient class-level attributes to Rating, Comment, Chat models
  7. Replaced model enum imports in schemas with inline Literal type aliases
  8. Removed unused SupervisorCreate import from api/supervisors.py
  9. Removed unused get_current_verified_user import from api/users.py
  10. Added email-validator==2.2.0 to requirements.txt
  11. Removed --reload from Dockerfile CMD
  12. Removed :-changeme default from docker-compose SECRET_KEY
  13. Added @types/node to frontend package.json devDependencies
  14. Updated .env.example to mark SECRET_KEY as required

- **Build status:** Not tested (no Docker available in this environment)

- **Remaining concerns:**
  1. All API routes are 501 stubs — feature agents must implement
  2. No Alembic migration files exist — must run `alembic revision --autogenerate` before first run
  3. docker-compose has no prod variant — dev compose always mounts source volume
  4. nginx.conf does not set X-Forwarded-Proto — HTTPS-aware features may not work behind proxy
  5. pandas in requirements.txt is only used by seed_tutors.py — consider a separate requirements-seed.txt
  6. Frontend pages are UI stubs — feature agents must wire up API calls

---

## Summary
- **Total files changed:** 45+
- **Key changes:** Full monorepo scaffold — FastAPI backend (8 models, 8 schema files, 8 API route files, JWT utils), React frontend (9 pages, typed API client, i18n), Docker Compose, seed script, README
- **Build status:** Not tested (requires Docker/npm install), but structure is complete and imports are consistent
- **Known issues:** 
  - All API endpoints return 501 (TODO stubs) — intentional, ready for feature agents
  - Frontend pages are stubs — intentional
  - No Alembic initial migration generated yet (requires running alembic revision --autogenerate against live DB)
- **Integration notes for next agents:**
  - Models are in backend/app/models/, import from there
  - Pydantic schemas in backend/app/schemas/ — use these for request/response types
  - Auth utilities in backend/app/utils/auth.py — get_current_user, get_current_verified_user dependencies
  - Frontend types in frontend/src/types/index.ts — keep in sync with backend schemas
  - API client in frontend/src/services/api.ts — add new calls here
  - i18n text in frontend/src/i18n/zh.ts — add new strings here, never hardcode Chinese in components

---
## Integration Review

### Integration Round 1
- **Timestamp:** 2026-03-21 18:07:18
- **Cross-team conflicts found:** None (single-subteam scaffold)
- **Duplicated code merged:** None
- **Build verified:** Not tested (no Docker available in environment)
- **Fixes applied:**
  1. `backend/app/schemas/chat.py` — Added missing `is_read: bool = False` field to `ChatMessageResponse` (model `ChatMessage` had the column; schema omitted it)
  2. `frontend/src/types/index.ts` — Added `is_read: boolean` to `ChatMessage` interface to align with backend schema fix
  3. `backend/app/api/comments.py` — Imported `CommentUpdate` (was defined in schema, never imported); added stub `PUT /{comment_id}` and `DELETE /{comment_id}` endpoints (schema existed, routes were missing entirely)
- **Remaining concerns:**
  - All endpoints are stubs (501 Not Implemented) — expected at this scaffold stage, but business logic implementation is outstanding for all routes
  - `CommentUpdate` endpoint for updating a comment was missing from the API (only CREATE was wired); now added as stub
  - `editProposalsApi` in frontend calls `/edit-proposals/*` but backend router prefix is also `/edit-proposals` — consistent, no issue
  - No authentication guards on `GET /ratings/supervisor/{id}` (current_user=None hardcoded) — intentional design choice to allow unauthenticated reads, but worth revisiting

---

# Integration Log: GradChoice Phase 1 — 6 feature streams (auth, supervisors, ratings, comments, analytics, chat)
**Project:** GradChoice
**Subteams:** claude-gc-auth claude-gc-supervisors claude-gc-ratings claude-gc-comments claude-gc-analytics claude-gc-chat
**Started:** 2026-03-21 18:19:55

## Subteam Summaries


========================================
## Subteam: claude-gc-auth
========================================
# Work Log: claude-gc-auth
## Task: gc-auth (GradChoice)
## Branch: feat/gc-auth
---

### [Step 1] Backend config & schemas
- **Files changed:** backend/app/config.py, backend/app/schemas/user.py, backend/app/rate_limiter.py
- **What:** Added REFRESH_TOKEN_EXPIRE_DAYS=7, EMAIL_TOKEN_EXPIRE_HOURS=24, PASSWORD_RESET_TOKEN_EXPIRE_HOURS=1 to config. Added TokenResponse, ForgotPasswordRequest, ResetPasswordRequest, ChangePasswordRequest, RefreshTokenRequest schemas. Created rate_limiter.py with slowapi Limiter instance.
- **Why:** Task requires 24h access tokens, 7d refresh tokens, forgot/reset password flows.
- **Decisions:** ACCESS_TOKEN_EXPIRE_MINUTES changed from 7 days to 24 hours per spec. Refresh token is a separate JWT with typ="refresh" claim.

### [Step 2] Auth utilities
- **Files changed:** backend/app/utils/auth.py
- **What:** Added decode_access_token(), create_refresh_token(), decode_refresh_token(), create_email_token(), decode_email_token() functions. Added typ claim to all tokens to distinguish token types.
- **Why:** Needed for email verification, password reset, and proper refresh token flow.

### [Step 3] Email service
- **Files changed:** backend/app/services/email.py (new)
- **What:** Created EmailService with send_verification_email(), send_password_reset_email(), send_chat_notification_email(). Uses SMTP from env vars; falls back to console logging in dev mode (when SMTP_HOST is not set).
- **Why:** Task requires email notifications for verification and password reset.

### [Step 4] Auth API endpoints
- **Files changed:** backend/app/api/auth.py
- **What:** Implemented all 7 auth endpoints: register (with email verification), login (returns access+refresh tokens), verify-email (JWT token), verify-student (.edu.cn auto-verify + student ID upload), refresh (new access+refresh tokens), forgot-password (silent for email enumeration), reset-password.
- **Decisions:** Student ID files saved with UUID filename in UPLOAD_DIR/student_ids/. verify-student uses Form() for verification_type to work with multipart. forgot-password always returns success to prevent email enumeration. Rate limited to 5/min for register/login, 3/min for forgot-password.
- **Issues found:** None

### [Step 5] Users API endpoints
- **Files changed:** backend/app/api/users.py
- **What:** Implemented GET /users/me, PUT /users/me, POST /users/me/change-password, GET /users/me/ratings, GET /users/me/comments, GET /users/{id}/profile. Public profile never exposes email/password/student_id_file_path.
- **Why:** Required by spec; my-ratings/comments needed for profile page.

### [Step 6] Main app
- **Files changed:** backend/app/main.py, backend/requirements.txt
- **What:** Added slowapi rate limiter setup (app.state.limiter, exception handler). Added slowapi==0.1.9 and email-validator==2.2.0 to requirements.txt, pydantic[email] for EmailStr validation.

### [Step 7] Frontend auth hook + App
- **Files changed:** frontend/src/hooks/useAuth.ts (new), frontend/src/App.tsx
- **What:** Created AuthContext/AuthProvider with user state, login/logout/register/refreshUser methods. JWT expiry checked client-side via manual base64 decode (no extra deps). Wrapped app with AuthProvider. Added ForgotPasswordPage and ResetPasswordPage routes.

### [Step 8] Frontend pages
- **Files changed:** LoginPage.tsx, RegisterPage.tsx, ProfilePage.tsx (full rewrite), ForgotPasswordPage.tsx (new), ResetPasswordPage.tsx (new), Layout.tsx
- **What:** LoginPage: added forgot-password link, success message from register redirect, email verification via URL token. RegisterPage: added confirm password, password strength indicator, .edu.cn hint, terms checkbox. ProfilePage: full implementation with edit form, verification badges, student ID upload, change password, my ratings/comments list. Layout: migrated from localStorage check to useAuth hook.
- **Decisions:** Password strength uses 4-criteria scoring (lower/upper/digit/special). ForgotPasswordPage shows "email sent" screen regardless of whether email exists (prevents enumeration). Profile page auto-redirects to /login if not authenticated.

### [Step 9] Frontend services & types
- **Files changed:** frontend/src/services/api.ts, frontend/src/types/index.ts, frontend/src/i18n/zh.ts
- **What:** Added forgotPassword, resetPassword, refresh, changePassword, getMyRatings, getMyComments endpoints. Added refresh_token?: string to Token type. Added all missing Chinese strings for auth and profile pages.

## Summary
- **Total files changed:** 20 (15 modified, 5 new)
- **Key changes:**
  - backend/app/api/auth.py — all 7 auth endpoints implemented (register, login, verify-email, verify-student, refresh, forgot-password, reset-password)
  - backend/app/api/users.py — 6 endpoints (me, update-me, change-password, me/ratings, me/comments, {id}/profile)
  - backend/app/services/email.py — new: email service with 3 templates + SMTP/dev-mode
  - backend/app/utils/auth.py — added decode_access_token, create/decode refresh token, create/decode email token
  - backend/app/rate_limiter.py — new: slowapi limiter
  - backend/app/schemas/user.py — added 5 new schemas
  - backend/app/config.py — updated token expiry settings
  - backend/app/main.py — added slowapi middleware
  - backend/requirements.txt — added slowapi + email-validator
  - frontend/src/hooks/useAuth.ts — new: AuthContext + AuthProvider + useAuth hook
  - frontend/src/App.tsx — wrapped with AuthProvider, added new routes
  - frontend/src/pages/LoginPage.tsx — forgot password link, email verify callback
  - frontend/src/pages/RegisterPage.tsx — confirm password, strength indicator, edu hint, terms
  - frontend/src/pages/ProfilePage.tsx — full implementation
  - frontend/src/pages/ForgotPasswordPage.tsx — new
  - frontend/src/pages/ResetPasswordPage.tsx — new
  - frontend/src/components/Layout.tsx — migrated to useAuth
  - frontend/src/services/api.ts — added auth/user endpoints
  - frontend/src/types/index.ts — added refresh_token to Token
  - frontend/src/i18n/zh.ts — added auth/profile strings
- **Build status:** not run (no CI available locally); code is syntactically correct
- **Known issues:**
  - slowapi requires requests have a real IP; behind a proxy need X-Forwarded-For forwarding
  - Email verification URL in email.py hardcoded to gradchoice.cn — should be an env var (APP_URL)
  - No alembic migration in this PR (schema was already scaffolded by gc-scaffold stream)
- **Integration notes:**
  - SMTP_HOST must be set in .env for real emails; otherwise all emails log to console
  - UPLOAD_DIR must exist and be writable for student ID uploads (default /tmp/uploads)
  - The /verify-email route in App.tsx serves LoginPage which handles the token param — this is intentional (verify then redirect to login)
  - Frontend 401 interceptor skips redirect if already on /login to avoid redirect loops

### Review+Fix Round 1
- **Reviewer:** claude-gc-auth-review-1
- **Timestamp:** 2026-03-21 18:06:09
- **Files reviewed:** backend/app/utils/auth.py, backend/app/api/auth.py, backend/app/api/users.py, backend/app/services/email.py, backend/app/config.py, backend/app/rate_limiter.py, backend/app/schemas/user.py, backend/requirements.txt, frontend/src/hooks/useAuth.ts, frontend/src/App.tsx, frontend/src/components/Layout.tsx, frontend/src/pages/LoginPage.tsx, frontend/src/pages/RegisterPage.tsx, frontend/src/pages/ProfilePage.tsx, frontend/src/pages/ForgotPasswordPage.tsx, frontend/src/pages/ResetPasswordPage.tsx, frontend/src/services/api.ts, frontend/src/types/index.ts, frontend/src/i18n/zh.ts
- **Issues found:**
  1. SECURITY: `get_current_user` in utils/auth.py did not validate `typ` claim — refresh tokens and email tokens could be used as bearer tokens for authenticated endpoints
  2. HARDCODED URL: `_APP_URL = "https://gradchoice.cn"` in email.py was a hardcoded constant, not overridable via env (builder-flagged known issue)
  3. SILENT FAILURE: `except Exception: pass` in register endpoint swallowed email-send errors with no logging
  4. DUPLICATE DEPENDENCY: requirements.txt had both `pydantic==2.9.2` and `pydantic[email]==2.9.2`
- **Fixes applied:**
  1. Added `if payload.get("typ") != "access": raise credentials_exception` to get_current_user
  2. Added `APP_URL: str = "https://gradchoice.cn"` to Settings in config.py; replaced hardcoded constant in email.py with `_app_url()` calling `settings.APP_URL`
  3. Changed `except Exception: pass` to `except Exception as exc: logger.warning(...)` with proper log message
  4. Removed `pydantic==2.9.2` line, kept `pydantic[email]==2.9.2`
- **Build status:** not run (no CI locally)
- **Remaining concerns:**
  - No token rotation/revocation — stolen refresh tokens remain valid until expiry (acceptable for MVP)
  - `verify-student` reads uploaded file into memory synchronously; large files could block; acceptable for MVP upload sizes
  - `get_my_ratings` in users.py has no ordering (minor)
  - slowapi rate limiter needs X-Forwarded-For trust config behind a proxy (builder-flagged)
  - No migration file for new columns — schema was scaffolded by gc-scaffold per builder note

========================================
## Subteam: claude-gc-supervisors
========================================
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

========================================
## Subteam: claude-gc-ratings
========================================
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

========================================
## Subteam: claude-gc-comments
========================================
# Work Log: claude-gc-comments
## Task: gc-comments (GradChoice)
## Branch: feat/gc-comments
---

### [Step 1] Backend: Comment model updated
- **Files changed:** backend/app/models/comment.py
- **What:** Added is_deleted, is_edited, flag_count fields to Comment model; added flags relationship
- **Why:** Needed for soft-delete (thread integrity), edit tracking, and auto-moderation via flag count
- **Decisions:** flag_count denormalized like likes_count for fast threshold queries

### [Step 2] Backend: CommentFlag model created
- **Files changed:** backend/app/models/flag.py (new), backend/app/models/__init__.py
- **What:** New CommentFlag model with FlagReason enum (虚假信息/恶意攻击/垃圾信息/隐私泄露/其他), unique constraint per reporter+comment
- **Why:** Separate flags table for audit trail; UniqueConstraint prevents duplicate flagging

### [Step 3] Backend: Comment schemas updated
- **Files changed:** backend/app/schemas/comment.py
- **What:** Added CommentAuthor, FlagCreate schemas; added is_deleted, is_edited, author, replies to CommentResponse; content validation (5000 char limit, strip whitespace)
- **Why:** Needed for proper API contract with auth and threading info; pydantic validators enforce length limits

### [Step 4] Backend: Comment service created
- **Files changed:** backend/app/services/comment.py (new)
- **What:** Business logic: daily rate limit check, build_comment_response (recursive, max 2 levels), update_vote_counts, apply_flag with auto-moderation, can_edit check
- **Why:** Separate service layer for testability and reuse across endpoints

### [Step 5] Backend: Comments API fully implemented
- **Files changed:** backend/app/api/comments.py, backend/app/utils/auth.py
- **What:** All 7 endpoints implemented: POST /comments, GET /supervisor/{id}, GET /{id}, GET /{id}/replies, PUT /{id}, DELETE /{id}, POST /{id}/vote, POST /{id}/flag
- **Why:** Full feature set per spec
- **Decisions:** GET endpoints use optional auth (get_optional_user) so unauthenticated users can read; write endpoints require get_current_verified_user; sort via Literal type; reply depth limited to 2 levels in create endpoint

### [Step 6] Frontend: Types and API client updated
- **Files changed:** frontend/src/types/index.ts, frontend/src/services/api.ts
- **What:** Added FlagReason, CommentAuthor types; updated Comment type with is_deleted/is_edited/author/replies; added commentsApi.update, commentsApi.delete, updated commentsApi.flag, commentsApi.getBySupervisor now takes sort param
- **Why:** Stay in sync with backend schema changes

### [Step 7] Frontend: CommentForm component created
- **Files changed:** frontend/src/components/CommentForm.tsx (new)
- **What:** Textarea with 5000-char count, loading state, reply-mode with "@用户名" context, "匿名发表" label, error display
- **Why:** Per spec requirements; reusable for both top-level and reply posting

### [Step 8] Frontend: CommentCard component created
- **Files changed:** frontend/src/components/CommentCard.tsx (new)
- **What:** Anonymous author display, verified badge, relative timestamps (中文), like/dislike with optimistic updates, reply button + inline form, edit button (own + 24h window check), delete with confirmation, flag button, FlagModal integration, "(已编辑)" indicator, "(该评论已删除)" placeholder, recursive rendering for replies
- **Why:** Per spec; self-contained component with all interaction logic

### [Step 9] Frontend: CommentList component created
- **Files changed:** frontend/src/components/CommentList.tsx (new)
- **What:** Sort controls (最新/最早/最热/最多讨论), paginated list with load-more, empty state, total count, CommentForm for new comments, state management for add/update/delete/reply
- **Why:** Main orchestration component per spec

### [Step 10] Frontend: FlagModal component created
- **Files changed:** frontend/src/components/FlagModal.tsx (new)
- **What:** Reason radio buttons (5 options), optional detail textarea, submit/cancel, success state
- **Why:** Per spec

### [Step 11] Frontend: SupervisorPage updated
- **Files changed:** frontend/src/pages/SupervisorPage.tsx
- **What:** Added actual supervisor data fetching, current user fetching, loading skeleton, 404 state, CommentList integration replacing static placeholder
- **Why:** Page was fully static before; now renders real supervisor data and comments

## Summary
- **Total files changed:** 14 (8 modified, 6 new)
- **Key changes:**
  - Full comment CRUD with threading (max 2 levels), voting, soft-delete, and flagging
  - Auto-moderation: comments auto-hidden after 3 unique flags
  - Rate limiting: 20 comments per user per day (DB query, no Redis needed)
  - Edit window: 24h enforced server-side and client-side
  - Optional auth on read endpoints so public can read without logging in
  - 4 new React components: CommentForm, CommentCard, CommentList, FlagModal
  - SupervisorPage now fetches real data and renders CommentList
- **Build status:** Not built (no CI in dev environment)
- **Known issues:**
  - The 401 interceptor in api.ts redirects to /login on ANY 401 — this will fire if unauthenticated user tries to call optional-auth GET endpoints that forward a bad token (edge case)
  - "most_discussed" sort uses dislikes_count as proxy for engagement; a proper reply_count sort would need a subquery
  - No Alembic migration generated — new columns (is_deleted, is_edited, flag_count) and the comment_flags table need a DB migration for production deployment
- **Integration notes:**
  - The next agent (reviewer/integrator) should run `alembic revision --autogenerate -m "add_comment_flags"` and `alembic upgrade head` to apply schema changes
  - Comment GET endpoints are public (no auth required); POST/PUT/DELETE/vote/flag require email-verified auth
  - FlagReason enum values are Chinese strings — ensure Alembic migration handles UTF-8 enum labels correctly in PostgreSQL

### Review+Fix Round 1
- **Reviewer:** claude-gc-comments-review-1
- **Timestamp:** 2026-03-21 18:07:19
- **Files reviewed:**
  - backend/app/api/comments.py
  - backend/app/models/comment.py
  - backend/app/models/flag.py
  - backend/app/schemas/comment.py
  - backend/app/services/comment.py
  - backend/app/utils/auth.py
  - frontend/src/components/CommentCard.tsx
  - frontend/src/components/CommentForm.tsx
  - frontend/src/components/CommentList.tsx
  - frontend/src/components/FlagModal.tsx
  - frontend/src/pages/SupervisorPage.tsx
  - frontend/src/services/api.ts
  - frontend/src/types/index.ts
- **Issues found:**
  1. **BUG (backend):** `remote_side="Comment.id"` string form is invalid with `mapped_column`-based SQLAlchemy ORM — causes AmbiguousForeignKeysError at startup. Must be `remote_side=[id]`.
  2. **BUG (backend):** `build_comment_response` in comment service only sanitized content for `is_deleted` but not `is_flagged`. Auto-hidden comments (flag_count >= 3) still returned full content and author info.
  3. **BUG (frontend):** `SupervisorPage` called `usersApi.getMe()` to probe auth status; if the stored token is expired the backend returns 401, the interceptor blindly redirects to `/login` even on a public page. Fixed by adding `skipAuthRedirect` config option and a `getMeOptional()` variant.
  4. **BUG (frontend):** `editContent` state in `CommentCard` was initialized from `comment.content` at mount and not synced. After a successful edit, re-opening the edit form showed the pre-edit content (stale closure). Fixed with `useEffect` syncing when not editing.
  5. **BUG (frontend):** `CommentCard` action guards (edit/reply/flagModal) only checked `is_deleted`, not `is_flagged`. Owner could still click "编辑" on a flagged comment; non-owner could still reply to a flagged comment via the form.
  6. **DEAD CODE (backend):** `SortOrder(str)` class in `schemas/comment.py` was a plain `str` subclass with class attributes — not an enum, never used anywhere (endpoint uses `Literal` directly). Removed.
  7. **MISSING (backend):** No Alembic migration for new columns (`is_deleted`, `is_edited`, `flag_count` on `comments`) and new `comment_flags` table. Created `alembic/versions/0001_add_comment_flags_and_moderation_columns.py`.
- **Fixes applied:**
  1. `backend/app/models/comment.py`: `remote_side="Comment.id"` → `remote_side=[id]`
  2. `backend/app/services/comment.py`: sanitize content+author for `is_flagged` comments
  3. `backend/app/schemas/comment.py`: removed dead `SortOrder` class
  4. `backend/alembic/versions/0001_...py`: created migration with upgrade/downgrade
  5. `frontend/src/services/api.ts`: add `skipAuthRedirect` axios config extension + `getMeOptional()`
  6. `frontend/src/pages/SupervisorPage.tsx`: use `getMeOptional()` instead of `getMe()`
  7. `frontend/src/components/CommentCard.tsx`: add `isHidden` guard, sync `editContent` via `useEffect`, use `isHidden` for reply form guard
- **Build status:** Not built (no CI in dev environment)
- **Remaining concerns:**
  - `most_discussed` sort still uses `dislikes_count` as proxy for engagement (known, flagged by builder)
  - Alembic migration assumes PostgreSQL `gen_random_uuid()` function; requires `pgcrypto` extension or PG 13+
  - No tests written for any of the new endpoints or service functions

========================================
## Subteam: claude-gc-analytics
========================================
# Work Log: claude-gc-analytics
## Task: gc-analytics (GradChoice)
## Branch: feat/gc-analytics
---

### [Step 1] Backend analytics schemas
- **Files changed:** backend/app/schemas/analytics.py
- **What:** Extended schemas with PercentileRankings, ScoreTrend, DepartmentStats; expanded SupervisorAnalytics with verified_scores, percentiles, score_trends, school_avg_scores, national_avg_scores; expanded SchoolAnalytics with unrated_supervisors, avg_sub_scores, departments, total_ratings, recent_ratings, school_percentile; updated RankingsResponse to paginated format; added OverviewStats
- **Why:** Original schemas were stubs with no percentile or comparison data
- **Decisions:** Used Optional[float] for all averages to handle empty state gracefully

### [Step 2] Analytics service
- **Files changed:** backend/app/services/analytics.py (NEW)
- **What:** Full implementation of get_supervisor_analytics, get_school_analytics, get_rankings, get_overview using SQLAlchemy + raw SQL text() for window functions
- **Why:** Complex percentile computations require PERCENT_RANK() SQL window functions; not easily expressible with ORM
- **Decisions:** Used MIN_RATINGS_FOR_PERCENTILE=3 threshold; used SQL CTEs for percentile queries; VALID_DIMENSIONS dict to whitelist SQL column expressions and prevent injection

### [Step 3] Analytics API endpoints
- **Files changed:** backend/app/api/analytics.py
- **What:** Implemented all 4 endpoints: /supervisor/{id}, /school/{code}, /rankings (with dimension/filters/pagination), /overview
- **Why:** Replaced 501 stubs with real service calls
- **Decisions:** Added dimension/province/school_code/page/page_size/min_ratings query params to /rankings

### [Step 4] Alembic migration
- **Files changed:** backend/alembic/versions/001_supervisor_rankings_view.py (NEW), backend/alembic/versions/ (dir created)
- **What:** Migration to create supervisor_rankings materialized view with all percentile columns; indexes on supervisor_id, school_code, province
- **Why:** MV enables fast cached ranking queries without re-running window functions every request
- **Decisions:** Service uses inline CTEs instead of MV for now (no refresh mechanism needed in dev); MV is available for production use

### [Step 5] Frontend types + API
- **Files changed:** frontend/src/types/index.ts, frontend/src/services/api.ts
- **What:** Added PercentileRankings, ScoreTrend, DepartmentStats, OverviewStats interfaces; updated SupervisorAnalytics, SchoolAnalytics, RankingsResponse to match backend; added analyticsApi.getOverview(), updated getRankings() with filter params
- **Why:** Frontend types must mirror backend Pydantic schemas

### [Step 6] Chart components
- **Files changed:** frontend/src/components/RadarChart.tsx (NEW), frontend/src/components/DistributionChart.tsx (NEW), frontend/src/components/PercentileDisplay.tsx (NEW)
- **What:** RadarChart - Recharts radar with supervisor/school/national overlays; DistributionChart - horizontal bar chart with color-coded star ratings; PercentileDisplay - 2x2 grid with progress bars color-coded green/yellow/red
- **Why:** Visual representation of analytics data per spec
- **Decisions:** Used teal (#0d9488) as primary color; empty state handling for all charts

### [Step 7] New pages
- **Files changed:** frontend/src/pages/SchoolAnalyticsPage.tsx (NEW), frontend/src/pages/RankingsPage.tsx (NEW)
- **What:** SchoolAnalyticsPage at /school/:code/analytics - stats cards, department bar chart, top supervisors list; RankingsPage at /rankings - dimension tabs, province/school filters, paginated table with medal badges
- **Why:** Per spec requirements
- **Decisions:** Responsive design; empty states with emoji; medal colors (gold/silver/bronze) for top 3

### [Step 8] SupervisorPage integration
- **Files changed:** frontend/src/pages/SupervisorPage.tsx
- **What:** Full rewrite - fetches supervisor + analytics in parallel; integrates RadarChart, PercentileDisplay, DistributionChart; shows overall score, sub-scores, comparison to school/national average
- **Why:** Per spec: integrate analytics into supervisor profile page
- **Decisions:** Used Promise.allSettled() so analytics 404 (new supervisors) doesn't break page load; added KEY_TO_SCORE_FIELD helper to avoid TypeScript keyof issues

### [Step 9] Routing + navigation
- **Files changed:** frontend/src/App.tsx, frontend/src/components/Layout.tsx, frontend/src/i18n/zh.ts
- **What:** Added /rankings and /school/:code/analytics routes; added 排行榜 nav link; added rankings key to zh.nav
- **Why:** New pages need routing

## Summary
- **Total files changed:** 14 files (7 new, 7 modified)
- **Key changes:**
  - Full analytics backend: schemas, service with SQL window functions, 4 API endpoints
  - Alembic migration for supervisor_rankings materialized view
  - 3 new chart components: RadarChart (Recharts), DistributionChart, PercentileDisplay
  - 2 new pages: /rankings (sortable multi-dimension leaderboard) and /school/:code/analytics
  - SupervisorPage fully wired to analytics API
- **Build status:** TypeScript not installed in environment; code reviewed manually for type safety
- **Known issues:** node_modules not installed in this environment so tsc verification skipped; noUnusedLocals=true in tsconfig so unused imports were cleaned up manually
- **Integration notes:**
  - Run `alembic upgrade head` to create the materialized view (needs DB connection)
  - The materialized view needs manual REFRESH CONCURRENTLY to stay current; consider adding a scheduled job
  - Service uses inline CTEs for percentiles (no MV dependency) so analytics work even without running the migration
  - All analytics endpoints gracefully return empty/null values when no ratings exist

### Review+Fix Round 1
- **Reviewer:** claude-gc-analytics-review-1
- **Timestamp:** 2026-03-21 18:09:23
- **Files reviewed:**
  - backend/app/schemas/analytics.py
  - backend/app/services/analytics.py (NEW)
  - backend/app/api/analytics.py
  - backend/alembic/versions/001_supervisor_rankings_view.py (NEW)
  - frontend/src/types/index.ts
  - frontend/src/services/api.ts
  - frontend/src/components/RadarChart.tsx (NEW)
  - frontend/src/components/DistributionChart.tsx (NEW)
  - frontend/src/components/PercentileDisplay.tsx (NEW)
  - frontend/src/pages/SchoolAnalyticsPage.tsx (NEW)
  - frontend/src/pages/RankingsPage.tsx (NEW)
  - frontend/src/pages/SupervisorPage.tsx (rewrite)
  - frontend/src/App.tsx
  - frontend/src/components/Layout.tsx
  - frontend/src/i18n/zh.ts
- **Issues found:**
  1. CRITICAL (TypeScript compile error): `SupervisorPage.tsx` used `ScoreBreakdown` type (in `KEY_TO_SCORE_FIELD: Record<string, keyof ScoreBreakdown>` and `scoreForKey(scores: ScoreBreakdown, ...)`) without importing it from `@/types`. Import line only had `Supervisor, SupervisorAnalytics`.
  2. MINOR (API quality): `/analytics/rankings` endpoint accepted any string for `dimension` and silently fell back to "overall" in the service layer. No 422 returned for invalid input — poor DX and hard to debug for API consumers.
- **Fixes applied:**
  1. Added `ScoreBreakdown` to the import in `SupervisorPage.tsx`: `import type { Supervisor, SupervisorAnalytics, ScoreBreakdown } from '@/types'`
  2. Added explicit dimension validation in `analytics.py` API endpoint: imports `VALID_DIMENSIONS` from service and raises `HTTPException(422)` for unrecognized dimension values.
- **Build status:** TypeScript build not run (no node_modules); manual review. Backend not run; logic reviewed manually.
- **Remaining concerns:**
  - The materialized view `supervisor_rankings` (001_supervisor_rankings_view.py) is created but NOT used by the analytics service — the service recomputes all rankings live via window functions. The materialized view is dead code for now. It could be used to speed up the `/rankings` endpoint but this is an optimization opportunity, not a bug.
  - `school_avg_scores` and `national_avg_scores` in `SupervisorAnalytics` have `verified_ratings=0` (pydantic default) since the raw SQL queries don't compute verified counts at school/national level. This is acceptable but worth noting.
  - Score trend `avg_overall` is cast to `float()` directly from `ROUND(AVG(...))::numeric` — safe as the query is grouped so no null values, but implicit trust in SQL result.

========================================
## Subteam: claude-gc-chat
========================================
# Work Log: claude-gc-chat
## Task: gc-chat (GradChoice)
## Branch: feat/gc-chat
---

### [Step 1] Backend: Updated chat schemas
- **Files changed:** backend/app/schemas/chat.py
- **What:** Extended ChatResponse with computed fields (other_user_id, other_user_display_name, supervisor_name, school_name, last_message_at). Added validation for ChatCreate/ChatMessageCreate (2000 char limit, trim whitespace). Added ChatMessagesResponse.has_more, UnreadCountResponse.
- **Why:** List view needs other user's name and supervisor context. Frontend needs has_more for infinite scroll.
- **Decisions:** Computed fields populated at query time (not stored), keeping schema clean.

### [Step 2] Backend: Implemented all chat API endpoints
- **Files changed:** backend/app/api/chats.py
- **What:** Implemented all 7 endpoints — POST /chats, GET /chats, GET /chats/{id}, GET /chats/{id}/messages, POST /chats/{id}/messages, PUT /chats/{id}/read, GET /chats/unread-count.
- **Why:** All were 501 stubs before.
- **Decisions:**
  - GET /chats/unread-count placed BEFORE /{chat_id} routes to avoid FastAPI routing conflict (FastAPI would try to parse "unread-count" as UUID).
  - Bidirectional chat dedup: checks (A→B, supervisor) AND (B→A, supervisor) so same two users don't create duplicate chats.
  - Rate limit: counts messages in last 60 min, raises 429 if >= 60.
  - Cursor-based pagination via before_id param on messages endpoint.
  - Messages sorted ASC (oldest first) for chat display order.
  - Mark as read: updates read_at on all unread messages from other user when fetching messages.
  - Helper _build_chat_response() computes all derived fields in one place.

### [Step 3] Backend: Created chat notification service
- **Files changed:** backend/app/services/chat_notification.py (new)
- **What:** Email notification service with 10-min throttling per chat.
- **Why:** Avoids spamming users with one email per message.
- **Decisions:**
  - In-memory throttle dict (acceptable for single-process; replace with Redis for multi-process).
  - Respects user.email_notifications_enabled.
  - Graceful degradation if SMTP not configured (logs and returns).
  - HTML email in Chinese with supervisor context.

### [Step 4] Frontend: Updated types and API client
- **Files changed:** frontend/src/types/index.ts, frontend/src/services/api.ts
- **What:** Added new Chat fields, ChatMessagesResponse, UnreadCountResponse types. Added chatsApi.get, chatsApi.markRead, chatsApi.getUnreadCount, before_id param to getMessages.
- **Decisions:** Kept backward compatible with existing consumers.

### [Step 5] Frontend: Implemented InboxPage.tsx
- **Files changed:** frontend/src/pages/InboxPage.tsx
- **What:** Two-panel layout — chat list (left) + chat room (right). Chat list shows other user name, supervisor context, last message, unread badge, relative timestamps. Filter input to search by user name or supervisor. URL-based state via ?chat=<id> query param.
- **Decisions:** URL query param for active chat so it's shareable/bookmarkable. Relative time formatting in Chinese.

### [Step 6] Frontend: Created ChatRoom.tsx component
- **Files changed:** frontend/src/components/ChatRoom.tsx (new)
- **What:** Message bubbles (right=own, left=other), time separators every 60 min, character counter, send on Enter, shift+enter for newline, "load older messages" button (cursor-based), auto-scroll to bottom on load/send, marks chat as read on open.
- **Decisions:** Parsed current user ID from JWT payload (sub field) to determine message ownership. Handles error states gracefully.

### [Step 7] Frontend: Added unread badge to Layout.tsx
- **Files changed:** frontend/src/components/Layout.tsx
- **What:** Polls /chats/unread-count every 60 seconds when logged in, shows red badge on 私信 nav link.
- **Decisions:** 60s polling (WebSocket is stretch goal per spec). Shows 99+ if count exceeds 99.

### [Step 8] Frontend: Added contact button to SupervisorPage.tsx
- **Files changed:** frontend/src/pages/SupervisorPage.tsx
- **What:** Added ContactModal component and handleContactClick/handleChatSent handlers. Modal shows privacy notice, textarea, redirects to /inbox?chat=<id> on success. Redirects to /login if not authenticated.
- **Decisions:** Comment cards with "联系该用户" button are left as a code comment with instructions since comments API is not yet implemented. The modal and handlers are fully wired.

### [Step 9] Frontend: Added notification toggle to ProfilePage.tsx
- **Files changed:** frontend/src/pages/ProfilePage.tsx
- **What:** Toggle switch for email_notifications_enabled with optimistic UI, "已保存" flash on success. Calls usersApi.updateMe.
- **Decisions:** Simple toggle button styled as switch. Shows brief "已保存" confirmation.

## Summary
- **Total files changed:** 10 (7 modified, 3 new)
- **Key changes:**
  - backend/app/schemas/chat.py — Extended ChatResponse, new UnreadCountResponse
  - backend/app/api/chats.py — All 7 endpoints implemented (was all 501 stubs)
  - backend/app/services/chat_notification.py — New email notification service with throttling
  - frontend/src/types/index.ts — New Chat fields, ChatMessagesResponse, UnreadCountResponse
  - frontend/src/services/api.ts — New API methods for chats
  - frontend/src/pages/InboxPage.tsx — Full inbox UI with search, chat list, integrated ChatRoom
  - frontend/src/components/ChatRoom.tsx — New full-featured chat room component
  - frontend/src/components/Layout.tsx — Unread count badge with 60s polling
  - frontend/src/pages/SupervisorPage.tsx — ContactModal + handlers for initiating chats
  - frontend/src/pages/ProfilePage.tsx — Email notification toggle
- **Build status:** Not tested (no running Docker environment available in this session)
- **Known issues:**
  - In-memory throttle in chat_notification.py resets on process restart — fine for dev/single-process, use Redis for production
  - SupervisorPage comment cards with "联系该用户" button are not wired to real data yet (comments API is a TODO for a future stream)
  - Layout.tsx useEffect has isLoggedIn as a dependency; if user logs in without page reload, badge won't start polling (acceptable for current SPA design)
- **Integration notes:**
  - DB migration may be needed if indexes on (chat_id, created_at) and (chat_id, sender_id, read_at) haven't been created. The model definitions support this but Alembic migrations aren't in this codebase yet.
  - The /chats/unread-count route MUST remain before /{chat_id} routes in chats.py router or FastAPI will fail to parse the literal string as UUID.
  - SMTP must be configured in .env for email notifications to actually send.

### Review+Fix Round 1
- **Reviewer:** claude-gc-chat-review-1
- **Timestamp:** 2026-03-21
- **Files reviewed:**
  - backend/app/api/chats.py
  - backend/app/schemas/chat.py
  - backend/app/services/chat_notification.py
  - frontend/src/components/ChatRoom.tsx
  - frontend/src/pages/InboxPage.tsx
  - frontend/src/components/Layout.tsx
  - frontend/src/pages/SupervisorPage.tsx
  - frontend/src/pages/ProfilePage.tsx
  - frontend/src/services/api.ts
  - frontend/src/types/index.ts
- **Issues found:**
  1. CRITICAL — `get_messages` returned oldest N messages (ORDER BY created_at ASC, OFFSET 0, LIMIT N). Opening a chat with >50 messages showed ancient history instead of recent messages. The `has_more` flag was also wrong: `total > page * page_size` should be `total > page_size` since cursor-based pagination never uses page offset.
  2. MINOR — `formatGroupDate` in ChatRoom.tsx used `now.getDate() - 1` to detect "yesterday". On the 1st of a month, this evaluates to 0 which never matches any valid `getDate()`, so month-boundary dates (e.g. March 1 checking Feb 28) never showed "昨天".
- **Fixes applied:**
  1. `get_messages`: Changed to `ORDER BY created_at DESC LIMIT page_size` then `list(reversed(...))` to return newest N messages in ASC display order. Fixed `has_more = total > page_size`.
  2. `formatGroupDate`: Replaced with epoch-based day diff using `new Date(year, month, date)` truncation to avoid month/year boundary issues.
- **Build status:** Not run (no Docker environment)
- **Remaining concerns:**
  - `_build_chat_response` issues N+1 queries per chat (4 queries per chat: other_user, supervisor, last_msg, unread_count). Acceptable for MVP but should be batched for scale.
  - In-memory throttle in chat_notification.py resets on restart (already noted by builder).
  - DB indexes on (chat_id, created_at) and (chat_id, sender_id, read_at) should be confirmed in Alembic migrations.

---
## Integration Review

### Integration Round 1
- **Timestamp:** 2026-03-21 18:20:00
- **Cross-team conflicts found:**
  1. REGRESSION: ChatMessage.is_read removed by gc-analytics merge (efa131e) overwriting prior integration fix (b607010)
  2. DUPLICATE optional auth: gc-ratings adds `get_optional_current_user` (raw Request injection), gc-comments adds `get_optional_user` (OAuth2 auto_error=False) — different names and implementations in same file
  3. ALEMBIC MULTIPLE HEADS: gc-supervisors (0001_initial_schema, down_revision=None), gc-ratings (001_initial_schema, down_revision=None), gc-comments (0001_add_comment_flags, down_revision=None), gc-analytics (001_supervisor_rankings_view, down_revision=None) — all 4 claim to be root migrations; `alembic upgrade head` would fail with multiple-heads error
  4. types/index.ts: 6 branches added/modified different interfaces; main only had analytics additions; remaining 5 branches' additions would cause merge conflicts and broken TypeScript compilation across each other
  5. services/api.ts: similar multi-branch divergence — 6 different api.ts versions with incompatible additions and signature changes (e.g. commentsApi.flag had 1 param on main, gc-comments requires 3; chatsApi.getMessages returned PaginatedResponse<ChatMessage> on main, gc-chat expects ChatMessagesResponse with has_more)
- **Duplicated code merged:**
  - get_optional_current_user / get_optional_user unified: one implementation (OAuth2 optional scheme), both names exported as aliases
- **Build verified:** not run (no Docker/CI in env); code reviewed manually for type consistency
- **Fixes applied:**
  1. Restored ChatMessage.is_read: boolean to frontend/src/types/index.ts
  2. Added oauth2_scheme_optional + get_optional_current_user (idiomatic OAuth2 approach) + get_optional_user alias to backend/app/utils/auth.py
  3. Created 0001_initial_schema.py: canonical initial migration combining gc-supervisors (all 9 tables + pg_trgm GIN indexes) and gc-ratings (supervisor_rating_cache table, upvotes/downvotes on ratings); all DateTime columns timezone-aware
  4. Created 0002_add_comment_flags.py: comment moderation columns + comment_flags table, down_revision=0001
  5. Updated 001_supervisor_rankings_view.py: revision 001→0003, down_revision=None→0002; completes the linear chain
  6. Forward-merged all type additions from all 6 branches into types/index.ts: SupervisorDetail, SupervisorSearchResult.school_code, school directory types, RatingListResponse, SupervisorRatingCache, FlagReason, CommentAuthor, Comment fields (is_deleted/is_edited/author/replies), Chat computed fields, ChatMessagesResponse, UnreadCountResponse, Token.refresh_token?
  7. Forward-merged all api.ts additions from all 6 branches: skipAuthRedirect opt-out, getMeOptional, new auth endpoints, supervisor school methods, ratings summary/mine, comments get/update/delete/flag(with reason), chats get/markRead/getUnreadCount, editProposalsApi.getMine; corrected return types
- **Remaining concerns:**
  - BRANCH MERGE REQUIRED: feat/gc-supervisors must drop its 0001_initial_schema.py and update references before merging to main
  - BRANCH MERGE REQUIRED: feat/gc-ratings must drop its 001_initial_schema.py and update the supervisor_rating_cache model migration reference before merging
  - BRANCH MERGE REQUIRED: feat/gc-comments must drop its 0001_add_comment_flags_and_moderation_columns.py (superseded by 0002_add_comment_flags.py on main)
  - SupervisorPage.tsx: 5 branches (ratings, comments, analytics, chat, supervisors) each wrote incompatible versions; main has analytics version (166 lines); when other branches merge, heavy manual reconciliation needed to combine RatingForm/RatingCard, CommentList, ContactModal, and supervisor detail card
  - get_current_user in auth.py still does NOT validate typ claim (auth review round 1 added this but auth branch not merged to main yet)
  - No tests exist for any of the new endpoints or service functions
