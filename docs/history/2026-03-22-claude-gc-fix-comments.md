# Work Log: claude-gc-fix-comments
## Task: gc-fix-comments (GradChoice)
## Branch: feat/gc-fix-comments
---

### Review Round 1
- Verdict: Review passed — reviewer fixed issues (commit: bf216f2 docs: auto-update ESR + persist worklog for claude-gc-fix-search)

### [Step 1] Investigated comment system 404 root causes
- **Files changed:** none (analysis only)
- **What:** Read backend/app/api/comments.py, backend/app/api/users.py, frontend/src/pages/SupervisorPage.tsx, frontend/src/services/api.ts, frontend/src/types/index.ts
- **Why:** Needed to understand what endpoints exist vs what the frontend calls
- **Issues found:**
  1. Frontend `commentsApi.get(id)` calls `GET /comments/{id}` — this endpoint does NOT exist in backend → 404
  2. Frontend `usersApi.getMyComments()` calls `GET /users/me/comments` — this endpoint does NOT exist in backend → 404
  3. SupervisorPage has NO comment creation form — users can't write comments
  4. "讨论区" section was gated on `commentsTotal > 0` — new supervisors could never get first comment
  5. Vote 👍/👎 buttons were display-only `<span>` elements — clicking did nothing
  6. No reply UI — users couldn't reply to comments

### [Step 2] Added GET /comments/{comment_id} to backend
- **Files changed:** backend/app/api/comments.py
- **What:** Added a new `GET /{comment_id}` route between the existing `GET /supervisor/{supervisor_id}` (line 81) and `PUT /{comment_id}` routes. Route order ensures no conflict — `/supervisor/` prefix takes priority over wildcard UUID.
- **Why:** `commentsApi.get(id)` in api.ts calls this URL. Without the endpoint, any call returned 404.
- **Decisions:** Used existing `_build_response()` helper to include computed fields (author, reply_count, user_vote, replies). Returns 404 if comment is deleted or doesn't exist.

### [Step 3] Added GET /users/me/comments to backend
- **Files changed:** backend/app/api/users.py
- **What:** Added `GET /me/comments` route with pagination (page/page_size params). Returns `CommentListResponse` with full `_build_response()` computed fields.
- **Why:** `usersApi.getMyComments()` in api.ts calls `/users/me/comments` — endpoint was missing → 404.
- **Decisions:** Used lazy imports inside function body (`from app.api.comments import _build_response`) to avoid circular import risk. Route placed BEFORE `/{user_id}/profile` to prevent "me" being interpreted as a user UUID.

### [Step 4] Rewrote SupervisorPage with full comment flow
- **Files changed:** frontend/src/pages/SupervisorPage.tsx
- **What:** Major frontend update:
  1. Added `refreshComments()` callback (useCallback) for DRY comment list refresh
  2. Added comment creation form: textarea + submit button, always shown; login gate if not authenticated (shows "登录后参与讨论" prompt)
  3. "讨论区" section now always visible (was hidden when commentsTotal=0)
  4. Made vote buttons (👍/👎) interactive: click calls `commentsApi.vote()`, highlights active vote, redirects to login if not authenticated
  5. Added reply flow: "回复" button per comment → shows inline reply form anchored to that comment. Cancel button dismisses it. Submit calls `commentsApi.create()` with `parent_comment_id`.
  6. `CommentCard` now accepts `isLoggedIn`, `onVote`, `onReply` props
  7. Shows `（已编辑）` badge on edited comments
- **Why:** Without a creation form, users had no UI path to write comments even though the backend supported it. Votes and replies were visible but non-functional.
- **Decisions:** Optimistic-style refresh (re-fetch after mutate) rather than local state mutation — simpler and always consistent with server. Vote button highlighting uses `comment.user_vote` from API response.

## Summary
- **Total files changed:** 3
- **Key changes:**
  - `backend/app/api/comments.py`: Added `GET /{comment_id}` endpoint — fixes 404 for `commentsApi.get()`
  - `backend/app/api/users.py`: Added `GET /me/comments` endpoint with pagination — fixes 404 for `usersApi.getMyComments()`
  - `frontend/src/pages/SupervisorPage.tsx`: Full comment flow — creation form, vote buttons, inline reply, login gate
- **Build status:** Python syntax OK (ast.parse); TS couldn't run (no node_modules in worktree) but type logic verified manually — no issues found
- **Known issues:** None
- **Integration notes:**
  - Route order in `comments.py` is important: `GET /supervisor/{supervisor_id}` must remain before `GET /{comment_id}` to avoid ambiguity — it already is.
  - Route order in `users.py` is important: `GET /me/comments` must remain before `GET /{user_id}/profile` — it already is.
  - `_build_response()` is imported lazily inside the function body in `users.py` to avoid any circular import risk.
  - No DB migrations needed — all changes are API layer only.
  - PR: https://github.com/linkbag/GradChoice/pull/10

### Review+Fix Round 1
- **Reviewer:** claude-gc-fix-comments-review-1
- **Timestamp:** 2026-03-22 14:46:29
- **Files reviewed:** backend/app/api/comments.py, backend/app/api/users.py, frontend/src/pages/SupervisorPage.tsx, frontend/src/types/index.ts, frontend/src/services/api.ts, backend/app/schemas/comment.py, backend/app/models/comment.py
- **Issues found:** None
- **Fixes applied:** None needed
- **Build status:** Python syntax OK (ast.parse on both changed files). Backend imports clean (SECRET_KEY=xxx). Route registration verified via Python reflection — GET /comments/{comment_id} and GET /users/me/comments both present and correctly ordered. TypeScript: main repo tsc --noEmit exits 0 (worktree lacks vite symlink but all changed files are identical). All Comment type fields used in SupervisorPage (is_edited, user_vote, likes_count, dislikes_count, reply_count, author, replies) exist in types/index.ts. commentsApi.vote(id, type) signature matches api.ts exactly.
- **Remaining concerns:** None — implementation is clean. Pre-existing N+1 lazy-load on comment.user (unchanged by this PR, consistent with existing get_supervisor_comments behavior).
