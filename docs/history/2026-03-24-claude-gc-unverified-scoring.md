# Work Log: claude-gc-unverified-scoring
## Task: gc-unverified-scoring (GradChoice)
## Branch: feat/gc-unverified-scoring
---

### [Step 1] Backend model + schema + migration for is_verified_comment
- **Files changed:** `backend/app/models/comment.py`, `backend/app/schemas/comment.py`, `backend/alembic/versions/0007_add_is_verified_comment.py`
- **What:** Added `is_verified_comment: bool` column to `comments` table (default false). Added field to `CommentResponse` schema. Created migration 0007 chaining from 0006.
- **Why:** Need to snapshot the user's verification status at comment-creation time, so it doesn't change if the user later gets verified/unverified.
- **Decisions:** Used `is_student_verified` (not `is_email_verified`) as the source — this matches the existing pattern for `is_verified_rating` on ratings.

### [Step 2] comments.py — open to unverified users
- **Files changed:** `backend/app/api/comments.py`
- **What:** Changed `create_comment` and `vote_comment` from `get_current_verified_user` to `get_current_user`. Set `is_verified_comment=current_user.is_student_verified` on new comments.
- **Why:** Task requirement: any logged-in user can comment/vote. Verification status is stored per-comment for display.
- **Decisions:** Kept `flag` and `update`/`delete` on `get_current_verified_user` (flagging/editing require verified user still).
  - Actually update/delete were already `get_current_verified_user` — left them as-is since the task didn't ask to change them. Flagging also left as verified only.

### [Step 3] Analytics service + API — user_status filter
- **Files changed:** `backend/app/services/analytics.py`, `backend/app/api/analytics.py`
- **What:** Added `user_status: str = "all"` param to `get_rankings()` and `get_supervisor_analytics()`. Added WHERE conditions for `is_verified_rating = true/false`. Applied filter to score distribution and trends SQL. Added `user_status` query param to both API endpoints.
- **Why:** Allows frontend to filter rankings and supervisor charts by verification status of raters.
- **Decisions:** School/national average comparisons are NOT filtered (they remain "all users") since they serve as baseline comparisons. The `verified_scores` field in the analytics response is always computed as verified-only (not affected by user_status) — it's used by the frontend only when user_status === 'all'.

### [Step 4] Frontend types, api.ts, i18n
- **Files changed:** `frontend/src/types/index.ts`, `frontend/src/services/api.ts`, `frontend/src/i18n/zh.ts`
- **What:** Added `is_verified_comment: boolean` to `Comment` interface. Updated `analyticsApi.getSupervisor` and `getRankings` to accept `user_status` param. Added i18n keys: `unverified_badge`, `user_status_all`, `user_status_verified`, `user_status_unverified`. Changed `verified_badge` from '认证学生' to '已认证学生'.
- **Decisions:** Used strict literal union `'all' | 'verified' | 'unverified'` for type safety.

### [Step 5] SupervisorPage — verification badges + analytics toggle
- **Files changed:** `frontend/src/pages/SupervisorPage.tsx`
- **What:** 
  - Added `UserStatus` type + `USER_STATUS_TABS` constant
  - Added `analyticsUserStatus` state + `analyticsLoading` state
  - Added second `useEffect` to re-fetch analytics when `analyticsUserStatus` changes
  - Updated `CommentCard` to show ✅ 已认证学生 (teal) or 未认证 (gray) badge based on `comment.is_verified_comment`
  - Added same badge to replies in CommentCard
  - Added 3-way toggle UI above the score disclaimer in the analytics section
  - Only show secondary verified score bubble when `analyticsUserStatus === 'all'`
  - Removed 403-specific vote error message (just shows generic retry message)
- **Decisions:** Re-fetch on toggle (not client-side switch) so distribution/trends/percentiles also update.

### [Step 6] RankingsPage — 3-way user_status toggle
- **Files changed:** `frontend/src/pages/RankingsPage.tsx`
- **What:** Added `UserStatus` type + `USER_STATUS_TABS` constant. Added `userStatus` state. Added `handleUserStatusChange`. Added toggle UI between dimension tabs and filters. Passed `user_status` to `getRankings` API call. Added `userStatus` to the `useEffect` deps array.
- **Decisions:** Used darker toggle style (bg-gray-800) to visually distinguish from dimension tabs.

## Summary
- **Total files changed:** 11
- **Key changes:**
  - Unverified users can now comment and vote (any logged-in user)
  - Comments tagged with `is_verified_comment` at creation time (snapshot of user.is_student_verified)
  - CommentCard shows ✅ 已认证学生 (teal) or 未认证 (gray) for all comments including replies
  - 3-way user_status filter (全部用户 | 已认证 | 未认证) on both RankingsPage and SupervisorPage analytics
  - Rankings and supervisor analytics re-fetch with filter applied to SQL queries
  - New DB migration 0007 for `is_verified_comment` column
- **Build status:** TypeScript check ✓, frontend build ✓, backend import ✓
- **Known issues:** None
- **Integration notes:**
  - Run migration: `cd backend && SECRET_KEY=xxx python3 -m alembic upgrade head` (adds `is_verified_comment` to comments)
  - Existing comments will have `is_verified_comment = false` after migration (server_default)
  - The `update_comment` and `delete_comment` endpoints still require `get_current_verified_user` (not changed by this task)
  - `flag_comment` also still requires verified user
  - `get_current_verified_user` import kept in comments.py (still used by update/delete/flag)

### Review Round 1
- Verdict: Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)
