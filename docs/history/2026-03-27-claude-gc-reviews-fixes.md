# Work Log: claude-gc-reviews-fixes
## Task: gc-reviews-fixes (gc-reviews-fixes)
## Branch: fix/gc-reviews-fixes
---

### [Step 1] BUG 1 — Fixed save button stuck at '保存中'
- **Files changed:** frontend/src/pages/MyReviewsPage.tsx
- **What:** Added `saved` state to both `RatingCard` and `CommentCard`. In `saveEdit()`, track success with a local bool. On success: set `setSaved(true)` and use `setTimeout(1500ms)` to flip `setSaved(false)` + `setEditing(false)`. Button now shows '✓ 已保存' during the 1.5s window, then closes. Cancel button is disabled while saving or in saved state. `onUpdated()` callback was already being called on success.
- **Why:** `setSaving(false)` was called in `finally` block while `setEditing(false)` was called in try-block on success — the form closed instantly with no visual feedback.
- **Decisions:** Used a local `success` bool rather than wrapping the finally logic in catch detection, as that pattern is cleaner.

### [Step 2] BUG 2 — Fixed delete causing forced logout
- **Files changed:** frontend/src/services/api.ts, backend/app/api/comments.py, backend/app/api/ratings.py
- **What (frontend):** Added `skipAuthRedirect: true` to `ratingsApi.delete()` and `commentsApi.delete()`. Without this, any 401 from the delete endpoint triggered the global axios interceptor to remove the token and redirect to /login.
- **What (backend):** Changed both `delete_comment` (comments.py:207) and `delete_rating` (ratings.py:138) to use `get_current_user` instead of `get_current_verified_user`. Previously, unverified users (valid JWT, but `is_email_verified=False`) got a 401 which then caused the forced logout.
- **Why:** `get_current_verified_user` enforces `is_email_verified=True`. A user who can see their reviews (they submitted them) should be able to delete them with just a valid login session.
- **Issues found:** The delete endpoints already correctly soft-delete comments (is_deleted=True) and hard-delete ratings with supervisor cache refresh — no logic issues found.

## Summary
- **Total files changed:** 4
- **Key changes:**
  - `frontend/src/pages/MyReviewsPage.tsx` — added `saved` state + 1500ms timeout in both `RatingCard.saveEdit()` and `CommentCard.saveEdit()`; button shows `✓ 已保存` on success before closing
  - `frontend/src/services/api.ts` — added `skipAuthRedirect: true` to `ratingsApi.delete` and `commentsApi.delete`
  - `backend/app/api/comments.py` — `delete_comment` changed from `get_current_verified_user` → `get_current_user`
  - `backend/app/api/ratings.py` — `delete_rating` changed from `get_current_verified_user` → `get_current_user`
- **Build status:** not run (no build step required for these changes)
- **Known issues:** none
- **Integration notes:** Backend change is safe — `get_current_user` still requires a valid JWT, it just doesn't enforce email_verified. Users who can see the 我的评价 page are already authenticated. Delete operations require ownership check (403 if not owner) so access control is preserved.
- **PR:** https://github.com/linkbag/GradChoice/pull/38

### Review Round 1
- Verdict: Review passed — reviewer fixed issues (commit: 27cb918 fix: 我的评价 — save shows 已保存 + delete no longer forces logout)
