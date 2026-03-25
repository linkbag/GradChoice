# Work Log: claude-gc-tos
## Task: gc-tos (GradChoice)
## Branch: feat/gc-tos
---

### [Step 1] Created TermsPage.tsx
- **Files changed:** `frontend/src/pages/TermsPage.tsx` (NEW)
- **What:** Full ToS page with 6 sections: 使用规则, 知识产权, 隐私保护, 侵权举报, 免责声明, 协议修改
- **Why:** Required new page at /terms for users to read the agreement
- **Decisions:** Used inline JSX with Tailwind styling consistent with site theme; adapted 研控→研选 GradChoice throughout; contact email set to realmofresearch.contact@gmail.com

### [Step 2] Added /terms route to App.tsx
- **Files changed:** `frontend/src/App.tsx`
- **What:** Imported TermsPage, added `<Route path="terms" element={<TermsPage />} />`
- **Why:** Required to make /terms accessible

### [Step 3] Updated RegisterPage.tsx + api.ts
- **Files changed:** `frontend/src/pages/RegisterPage.tsx`, `frontend/src/services/api.ts`
- **What:** Added `tosAgreed` boolean state, ToS checkbox with link to /terms, validation that blocks submit without agreement; passed `tos_agreed=true` to API
- **Why:** Users must agree to ToS before registering
- **Decisions:** Validation happens before API call (client-side guard); checkbox link opens in new tab

### [Step 4] Updated SupervisorPage.tsx
- **Files changed:** `frontend/src/pages/SupervisorPage.tsx`
- **What:** Added to comment form: (1) char counter 0/4500, (2) 匿名评论 checkbox (UI only—backend not yet supported), (3) ToS agreement checkbox required before submit, (4) three privacy notice lines
- **Why:** Task requirement; guards comment submission with ToS agreement
- **Decisions:** `is_anonymous` is UI-only (backend doesn't have the column yet); character limit enforced client-side; submit button disabled without ToS agreement

### [Step 5] Updated backend: model, schema, auth.py
- **Files changed:** `backend/app/models/user.py`, `backend/app/schemas/user.py`, `backend/app/api/auth.py`
- **What:** Added `tos_agreed_at: DateTime | None` column to User model; added `tos_agreed: bool = False` to UserCreate schema; auth.py sets `tos_agreed_at=now()` when tos_agreed=True
- **Why:** Store timestamp of user's ToS agreement for compliance/audit trail

### [Step 6] Created Alembic migration 0007
- **Files changed:** `backend/alembic/versions/0007_add_tos_agreed_at.py` (NEW)
- **What:** Adds nullable `tos_agreed_at` DateTime column to users table
- **Why:** Required DB schema change to persist ToS agreement timestamp
- **Decisions:** Nullable so existing users aren't broken; revision chain 0006→0007

## Summary
- **Total files changed:** 9 (5 modified + 2 new frontend, 1 new backend migration)
- **Key changes:**
  - New `/terms` page with full Chinese ToS content (研控→研选 GradChoice)
  - Registration requires ToS checkbox agreement
  - Comment submission requires ToS checkbox agreement
  - Comment form has anon checkbox (UI) + 0/4500 char counter + privacy notice
  - Backend stores `tos_agreed_at` timestamp when user registers with agreement
  - Migration 0007 adds `tos_agreed_at` to users table
- **Build status:** tsc --noEmit PASS, vite build PASS, python3 import PASS
- **Known issues:** 匿名评论 checkbox is UI-only—backend has no `is_anonymous` column on comments yet; needs a separate PR to fully implement
- **Integration notes:** Run `alembic upgrade head` after deploy. The `tos_agreed` field in the register request is optional (defaults to False), so existing API clients won't break.

### Review Round 1
- Verdict: Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)
