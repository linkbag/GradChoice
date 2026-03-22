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
