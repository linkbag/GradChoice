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
