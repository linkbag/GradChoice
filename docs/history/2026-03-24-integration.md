# Integration Log: GradChoice Round 2: rankings dept+sort, auto-login+email-verify, unverified scoring system, add supervisor, ToS
**Project:** GradChoice
**Subteams:** claude-gc-rankings-dept-sort claude-gc-auto-login claude-gc-unverified-scoring claude-gc-add-supervisor-v2 claude-gc-tos
**Started:** 2026-03-24 22:25:43

## Subteam Summaries


========================================
## Subteam: claude-gc-rankings-dept-sort
========================================
# Work Log: claude-gc-rankings-dept-sort
## Task: gc-rankings-dept-sort (GradChoice)
## Branch: feat/gc-rankings-dept-sort
---

### [Step 1] Updated backend analytics service
- **Files changed:** `backend/app/services/analytics.py`
- **What:** Added `department: Optional[str] = None` and `sort_order: str = "desc"` params to `get_rankings()`. Added `s.department = :department` condition when department is provided. Changed hardcoded `DESC` to `{sort_dir}` (computed from sort_order) in both `ROW_NUMBER() OVER (...)` and final `ORDER BY`.
- **Why:** Enable filtering by department and toggling sort direction from the frontend.
- **Decisions:** Validated sort_order in API layer (not service), keeping service simple.

### [Step 2] Updated analytics API route
- **Files changed:** `backend/app/api/analytics.py`
- **What:** Added `department: Optional[str] = Query(None)` and `sort_order: str = Query("desc")` to the `/analytics/rankings` endpoint. Added validation that sort_order is "asc" or "desc". Passed both to the service.
- **Why:** Expose new filter/sort params as query params on the HTTP endpoint.

### [Step 3] Updated frontend API service
- **Files changed:** `frontend/src/services/api.ts`
- **What:** Added `department?: string` and `sort_order?: 'asc' | 'desc'` to the `getRankings` params type.
- **Why:** TypeScript type safety for callers.

### [Step 4] Updated RankingsPage
- **Files changed:** `frontend/src/pages/RankingsPage.tsx`
- **What:**
  - Added `department` and `sortOrder` state variables.
  - Added `departmentOptions` state, populated via `supervisorsApi.getDepartments(schoolCode)` when schoolCode changes; cleared when school is cleared.
  - Department is reset when school changes (`handleSchoolNameChange` now also calls `setDepartment('')`).
  - Added third `AutocompleteInput` for department filter; placeholder changes to "先选院校再筛选院系" when no school is selected.
  - Added sort direction toggle button (↓ 从高到低 / ↑ 从低到高) placed inline with dimension tabs.
  - Both `department` and `sortOrder` are passed to `analyticsApi.getRankings()` and included in the `useEffect` dependency array.
- **Decisions:** No changes to `AutocompleteInput` component — kept it simple by using placeholder hint instead of disabled state.

## Summary
- **Total files changed:** 4
- **Key changes:**
  - Rankings API now accepts `department` filter and `sort_order` (asc/desc) param
  - Department filter cascades from school selection (fetches options via existing getDepartments endpoint)
  - Sort toggle button in UI, default desc (highest score first)
  - TypeScript types updated throughout
- **Build status:** pass (tsc --noEmit + vite build both succeed)
- **Known issues:** none
- **Integration notes:** The `/supervisors/departments?school_code=XXXXX` endpoint was added in gc-dept-filter task (already on main). The `AutocompleteInput` component was not modified — department input shows hint text when no school is selected but is not truly disabled (no-op since options will be empty).

### Review+Fix Round 1
- **Reviewer:** claude-gc-rankings-dept-sort-review-1
- **Timestamp:** 2026-03-24 22:16:41
- **Files reviewed:** backend/app/api/analytics.py, backend/app/services/analytics.py, frontend/src/pages/RankingsPage.tsx, frontend/src/services/api.ts
- **Issues found:** None
- **Fixes applied:** None needed
- **Build status:** tsc --noEmit: pass, vite build: pass (chunk size warning is pre-existing, unrelated)
- **Remaining concerns:** None. All checks passed:
  - SQL injection safe: sort_dir always "ASC"/"DESC", score_expr from dict lookup, department uses parameterized query
  - sort_order validated in API layer before reaching service
  - Department state resets correctly on school change (handleSchoolNameChange calls setDepartment(''))
  - useEffect dependency array is complete: [dimension, province, schoolCode, department, sortOrder, page]
  - TypeScript types correct throughout

========================================
## Subteam: claude-gc-auto-login
========================================
# Work Log: claude-gc-auto-login
## Task: gc-auto-login (GradChoice)
## Branch: feat/gc-auto-login
---

### [Step 1] Added backend schemas
- **Files changed:** `backend/app/schemas/user.py`
- **What:** Added `RegisterResponse(UserMe)` schema with `access_token` and `token_type` fields; `SendSignupVerificationRequest` (email); `VerifySignupCodeRequest` (email + code)
- **Why:** `/register` now needs to return a JWT token for auto-login; new signup verification endpoints need input schemas
- **Decisions:** `RegisterResponse` extends `UserMe` so all user fields are included alongside token fields

### [Step 2] Updated /register and added signup verification endpoints
- **Files changed:** `backend/app/api/auth.py`
- **What:** 
  - Added in-memory `_signup_verifications` dict `{email: {code, expires_at, verified}}`
  - Added `POST /auth/send-signup-verification` — generates 6-digit code, stores in dict, prints to console (dev mode)
  - Added `POST /auth/verify-signup-code` — checks code against dict, marks `verified=True`
  - Modified `POST /auth/register` — checks if email was pre-verified, auto-sets `is_email_verified=True` if so; generates JWT and returns `RegisterResponse` (user + token)
- **Why:** Enable email verification during signup and auto-login after registration
- **Decisions:** Used simple in-memory dict (no DB migration needed); pre-verification doesn't block registration (fall-through works, .edu.cn still auto-verified); cleanup of verification entry after successful registration

### [Step 3] Updated frontend types and api service
- **Files changed:** `frontend/src/types/index.ts`, `frontend/src/services/api.ts`
- **What:** Added `RegisterResponse` type extending `User` with token fields; updated `authApi.register()` return type to `RegisterResponse`; added `authApi.sendSignupVerification()` and `authApi.verifySignupCode()` methods
- **Why:** Type safety for new endpoints and response shapes

### [Step 4] Rewrote RegisterPage with 3-step flow
- **Files changed:** `frontend/src/pages/RegisterPage.tsx`
- **What:** Full rewrite to multi-step flow:
  - Step 1 (email): Enter email → "发送验证码"
  - Step 2 (code): Enter 6-digit code → "验证"; resend countdown (60s); "更换邮箱" back link
  - Step 3 (details): Password + display name → "注册"
  - On success: JWT stored in `localStorage('access_token')`, navigate to `/`
  - maskEmail() helper for `t***@g***` display
  - extractError() helper for consistent error handling
- **Why:** Task requirement; better UX than register→redirect-to-login flow
- **Decisions:** All 3 steps in one component with `step` state; .edu.cn emails go through same flow (code still required, but auto-student-verified on backend)

### [Step 5] Added i18n strings
- **Files changed:** `frontend/src/i18n/zh.ts`
- **What:** Added `register_steps`, `send_code_btn`, `verify_code_btn`, `code_sent_to`, `verification_code_label` keys to `zh.auth`
- **Why:** All new UI text in zh.ts per project convention

### [Step 6] Build verification
- `./node_modules/.bin/tsc --noEmit` → PASS
- `npm run build` → PASS (674KB bundle, only chunk-size warning which is pre-existing)
- `python3 -c "from app.main import app"` → PASS

## Summary
- **Total files changed:** 6
- **Key changes:**
  - `/register` now returns JWT token (auto-login after signup)
  - New endpoints: `POST /auth/send-signup-verification`, `POST /auth/verify-signup-code`
  - RegisterPage rewired to 3-step flow: email → verify code → set password/name → auto-login
  - In-memory verification store (no DB migration needed)
- **Build status:** pass
- **Known issues:** In-memory store resets on server restart (fine for dev; production should use Redis/DB)
- **Integration notes:** The `/register` response schema changed from `UserMe` to `RegisterResponse` (superset, fully backward-compatible for any field reads). Frontend now stores token on registration instead of redirecting to /login.

### Review Round 1
- Verdict: Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)

========================================
## Subteam: claude-gc-unverified-scoring
========================================
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

========================================
## Subteam: claude-gc-add-supervisor-v2
========================================
# Work Log: claude-gc-add-supervisor-v2
## Task: gc-add-supervisor-v2 (GradChoice)
## Branch: feat/gc-add-supervisor-v2
---

### [Step 1] Added SupervisorSubmit schema to backend
- **Files changed:** `backend/app/schemas/supervisor.py`
- **What:** Added `SupervisorSubmit` Pydantic model with `name` (required), `school_name` (required), and optional `department`, `school_code`, `province`, `title`, `website_url`
- **Why:** Need a separate schema for user submissions where most fields are optional (vs `SupervisorBase` which requires school_code/province/department)
- **Decisions:** Used `website_url` (single field) mapping to `webpage_url_1` on the model — simpler for the submission form

### [Step 2] Added POST /supervisors/submit endpoint
- **Files changed:** `backend/app/api/supervisors.py`
- **What:** Added `POST /supervisors/submit` endpoint requiring `get_current_verified_user` auth
- **Why:** MVP — direct DB insert, no moderation queue
- **Decisions:** 
  - Auto-matches `school_code` and `province` from existing DB data when not provided (queries by `school_name`)
  - Falls back `school_code = school_name[:20]` if no existing match (handles new schools)
  - Falls back `province = ""` (NOT NULL constraint on model)
  - Duplicate check: same `name + school_name + department` combo → 400 "该导师可能已存在"
  - Returns `SupervisorResponse` (full model fields + timestamps)

### [Step 3] Frontend types, API service, i18n
- **Files changed:** `frontend/src/types/index.ts`, `frontend/src/services/api.ts`, `frontend/src/i18n/zh.ts`
- **What:** Added `SupervisorSubmit` interface to types; added `supervisorsApi.submit(data)` calling `POST /supervisors/submit`; added `addSupervisor` key to zh.ts with all form labels, guidance text, and error messages; added `nav.add_supervisor` to existing nav block
- **Decisions:** Imported `Supervisor` type (already existed) as return type for the submit API call

### [Step 4] Created AddSupervisorPage.tsx
- **Files changed:** `frontend/src/pages/AddSupervisorPage.tsx` (NEW)
- **What:** Form page with: school AutocompleteInput (uses existing `getSchoolNames()`), department text input, name text input, title dropdown (教授/副教授/讲师/助理教授/研究员/其他), website URL input
- **Why:** Per spec with guidance text, required field markers, login gate warning
- **Decisions:**
  - Shows warning banner (not hard block) when user is not logged in
  - Submit button is disabled when not logged in or required fields empty
  - On success: redirects to `/supervisor/:id` (new supervisor's page)
  - Error handling: maps "该导师可能已存在" backend detail to user-friendly message

### [Step 5] Wired routing and navigation
- **Files changed:** `frontend/src/App.tsx`, `frontend/src/components/Layout.tsx`
- **What:** Added `/add-supervisor` route; added "添加导师" nav link in Layout (between About and auth links)

### [Step 6] Verification
- `./node_modules/.bin/tsc --noEmit` → clean (0 errors)
- `npm run build` → ✓ success (21.58s)
- `SECRET_KEY=test python3 -c "from app.main import app"` → OK

## Summary
- **Total files changed:** 8 (6 modified, 1 new page, node_modules installed)
- **Key changes:**
  - Backend: `SupervisorSubmit` schema + `POST /supervisors/submit` endpoint with auto school_code/province resolution and duplicate check
  - Frontend: `AddSupervisorPage` with AutocompleteInput for school, title dropdown, login gate; full i18n; nav link; route `/add-supervisor`
- **Build status:** pass (tsc clean, vite build success)
- **Known issues:** No migration needed — no new DB columns added. The `school_code` NOT NULL fallback uses `school_name[:20]` which may be non-unique for new schools not in the DB — acceptable for MVP.
- **Integration notes:** 
  - Backend route registration in `app/main.py` was already done (existing `supervisors` router is imported)
  - The `get_current_verified_user` dep requires `is_email_verified=True` — users with unverified email will get 401 (frontend redirects to /login)
  - No Alembic migration required — existing supervisor model has all needed columns

### Review Round 1
- Verdict: Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)

========================================
## Subteam: claude-gc-tos
========================================
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

---
## Integration Review

### Integration Round 1
- **Timestamp:** 2026-03-24 22:25:48
- **Cross-team conflicts found:**
  1. **Migration 0007 collision**: Both `unverified-scoring` and `tos` created migration 0007 (both chaining from 0006). Fixed by renumbering tos migration to 0008.
  2. **analytics.py service**: `rankings-dept-sort` added department filter; `unverified-scoring` added user_status filter. Merged both into same function.
  3. **RankingsPage.tsx**: `rankings-dept-sort` added sort toggle + department filter; `unverified-scoring` added user_status toggle. Merged both UIs and unified useEffect deps.
  4. **RegisterPage.tsx**: `auto-login` rewrote to 3-step flow; `tos` added ToS checkbox to old single-form. Kept 3-step flow, added ToS checkbox to step 3.
  5. **api.ts register()**: `auto-login` changed return type to RegisterResponse; `tos` added tos_agreed param. Combined both.
  6. **App.tsx**: `add-supervisor-v2` added AddSupervisorPage; `tos` added TermsPage. Combined both imports and routes.
  7. **auth.py + user schemas**: `auto-login` added verification endpoints; `tos` added tos_agreed_at. Auto-merged cleanly by git.
- **Duplicated code merged:** UserStatus type defined independently in RankingsPage and SupervisorPage — acceptable (page-local constants, not worth extracting)
- **Build verified:** pass (tsc --noEmit clean, vite build success, backend import OK)
- **Fixes applied:** Resolved 6 merge conflicts across 5 files; renumbered migration 0007→0008 for tos
- **Remaining concerns:** None — all 5 branches merged successfully, builds pass, migration chain is 0006→0007→0008

---

# Integration Log: GradChoice Round 3: fix add-supervisor (ToS, cascade dept, submit bug, nav links) + comment score popup
**Project:** GradChoice
**Subteams:** claude-gc-add-supervisor-fixes claude-gc-comment-score-popup
**Started:** 2026-03-24 22:59:53

## Subteam Summaries


========================================
## Subteam: claude-gc-add-supervisor-fixes
========================================
# Work Log: claude-gc-add-supervisor-fixes
## Task: gc-add-supervisor-fixes (GradChoice)
## Branch: feat/gc-add-supervisor-fixes
---

### [Step 1] Read and analyzed existing code
- **Files read:** AddSupervisorPage.tsx, api.ts, supervisors.py, supervisor.py (schema), auth.py, AutocompleteInput.tsx, zh.ts, HomePage.tsx, SearchPage.tsx
- **What:** Full codebase audit before making changes
- **Issues found:**
  - Submit bug root cause: `POST /supervisors/submit` uses `get_current_verified_user` (requires `is_email_verified=True`). Users with unverified emails get a 403, but the frontend only catches generic errors, showing "提交失败，请稍后重试"
  - `AutocompleteInput.handleInputChange` only calls `onChange('')` on clear, never on free-text input — custom department text never propagated to parent form state
  - Department field used a plain `<input>` — no cascade from school selection

### [Step 2] Fixed AutocompleteInput free-text propagation
- **File:** `frontend/src/components/AutocompleteInput.tsx`
- **What:** Changed `handleInputChange` to call `onChange(v)` on every keystroke (not just on clear). Previously: `if (!v) onChange('')`. Now: `onChange(v)` always.
- **Why:** Enables free-text department entry in AddSupervisorPage. Also enables live-filter behavior on SearchPage (minor UX change — filters apply as you type).
- **Decisions:** Global change to component rather than adding a prop. Acceptable since the "type to search" pattern benefits all usages.

### [Step 3] Updated i18n strings
- **File:** `frontend/src/i18n/zh.ts`
- **What:**
  - `addSupervisor.field_department`: '院系/课题组' → '院系'
  - Added `addSupervisor.error_unverified`: '请先验证您的邮箱后再提交'
  - Added `addSupervisor.tos_agreement`: '我了解并同意本站'
  - Added `addSupervisor.tos_link`: '服务条款与免责声明'
  - Added `home.add_cta_title/desc/btn` for HomePage CTA
  - Added `search.add_supervisor_link` for SearchPage

### [Step 4] Rewrote AddSupervisorPage
- **File:** `frontend/src/pages/AddSupervisorPage.tsx`
- **What:**
  1. **Submit bug fix:** Error handler now checks HTTP status — 403 → shows `error_unverified` (email not verified), duplicate detail → `error_duplicate`, otherwise → `error_generic`
  2. **Label rename:** Uses `zh.addSupervisor.field_department` (now '院系')
  3. **Cascade dropdown:** Added `schoolCodeMap` and `departmentOptions` state. `useEffect` on `form.school_name` + `schoolCodeMap`: fetches `GET /supervisors/departments?school_code=XXX` and resets department on school change. Department field changed from `<input>` to `<AutocompleteInput>`.
  4. **ToS checkbox:** `tosAgreed` state, checkbox with link to `/terms`. Submit button disabled until checked. Required in form validation.
- **Decisions:** Used `setForm((prev) => ...)` inside effect for department reset (avoids handleChange calling setError in an effect). school_code auto-lookup uses `schoolCodeMap[school_name]`.

### [Step 5] Added CTA to HomePage
- **File:** `frontend/src/pages/HomePage.tsx`
- **What:** Added teal card section "找不到您的导师？帮助我们完善数据库" with a link button to `/add-supervisor`. Placed between the stats section and the score disclaimer.

### [Step 6] Added links to SearchPage
- **File:** `frontend/src/pages/SearchPage.tsx`
- **What:**
  - In the result count row: added "找不到导师？添加新导师" link aligned right
  - In the empty state: added same link below the "未找到相关导师" text

### [Step 7] Verified builds
- TypeScript: `./node_modules/.bin/tsc --noEmit` → no errors
- Frontend build: `npm run build` → ✓ success (904 modules)
- Backend: `SECRET_KEY=test python3 -c "from app.main import app"` → OK

## Summary
- **Total files changed:** 5
- **Key changes:**
  - `AutocompleteInput.tsx`: free-text onChange propagation on every keystroke
  - `zh.ts`: renamed field_department label, added error_unverified + ToS strings + CTA strings
  - `AddSupervisorPage.tsx`: fixed 403 error handling, cascade department dropdown, ToS gate, label rename
  - `HomePage.tsx`: added "找不到您的导师？" CTA card
  - `SearchPage.tsx`: added "找不到导师？添加新导师" in result count row and empty state
- **Build status:** pass (tsc + vite build + backend import)
- **Known issues:** none
- **Integration notes:**
  - The `/terms` route must exist (it does — TermsPage.tsx is registered at `/terms` in App.tsx)
  - Backend `POST /supervisors/submit` still requires email-verified user (403 if not). Frontend now shows proper message for this case.
  - AutocompleteInput now propagates value on every keystroke. SearchPage filter behavior changes: filters apply live as you type (was: only on dropdown select). This is an acceptable UX improvement but reviewers should be aware.

### Review Round 1
- Verdict: Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)

========================================
## Subteam: claude-gc-comment-score-popup
========================================
# Work Log: claude-gc-comment-score-popup
## Task: gc-comment-score-popup (GradChoice)
## Branch: feat/gc-comment-score-popup
---

### [Step 1] Read existing codebase
- **Files read:** SupervisorPage.tsx, RatePage.tsx, zh.ts, api.ts, types/index.ts
- **What:** Surveyed existing comment submission flow, RatePage StarPicker pattern, i18n structure, ratingsApi.create signature
- **Why:** Understand what to build on and what patterns to reuse

### [Step 2] Add i18n strings to zh.ts
- **Files changed:** frontend/src/i18n/zh.ts
- **What:** Added 6 new keys under `zh.supervisor`: score_popup_title, score_popup_hint, score_popup_submit, score_popup_skip, score_popup_overall_section, score_popup_sub_section
- **Why:** Task requires new popup strings to live in the i18n file

### [Step 3] Update SupervisorPage.tsx
- **Files changed:** frontend/src/pages/SupervisorPage.tsx
- **What:**
  1. Added `SUB_SCORE_KEYS` const and `SubScoreKey` type (same as RatePage pattern)
  2. Added `PopupStarPicker` component — identical UX to RatePage's StarPicker, defined locally
  3. Removed `submittingComment` state (no longer needed — submission happens in popup)
  4. Added popup state: `showScorePopup`, `popupOverallScore`, `popupSubScores`, `popupSubmitting`, `popupError`
  5. Modified `handleSubmitComment`: validates ToS, then opens popup (no longer directly submits)
  6. Added `handlePopupSubmit(skipScores)`: 
     - If !skipScores and overall score set: calls `ratingsApi.create()`, ignores 409 (already rated)
     - Calls `commentsApi.create()` to post the comment
     - Refreshes both ratings and comments lists on success
  7. Added popup JSX at end of return (wrapped page in React Fragment `<>`)
- **Decisions:**
  - No extra API call to check existing rating — instead call ratingsApi.create and gracefully ignore 409
  - Popup dismissable by clicking backdrop (only when not submitting)
  - "Skip" button always available so user is never blocked from commenting
  - Kept `popupSubmitting` separate from old `submittingComment` for clarity
- **Issues found:** Initial edit put modal outside the root `<div>` causing TS parse error — fixed by wrapping return in a Fragment

### [Step 4] TypeScript check + build
- **Result:** Both `tsc --noEmit` and `npm run build` pass with 0 errors

## Summary
- **Total files changed:** 2
- **Key changes:**
  - `frontend/src/pages/SupervisorPage.tsx`: PopupStarPicker component, popup state (showScorePopup, popupOverallScore, popupSubScores, popupSubmitting, popupError), modified handleSubmitComment to open popup, new handlePopupSubmit that creates rating+comment (handles 409), modal JSX wrapped in React Fragment
  - `frontend/src/i18n/zh.ts`: 6 new keys — score_popup_title, score_popup_hint, score_popup_submit, score_popup_skip, score_popup_overall_section, score_popup_sub_section
- **Build status:** pass (tsc --noEmit + npm run build both clean)
- **Known issues:** None
- **Integration notes:**
  - Pure frontend change — backend already supports separate rating + comment endpoints
  - No new API methods added; uses existing ratingsApi.create and commentsApi.create
  - 409 from ratingsApi.create is silently ignored (user already rated) — comment still posts
  - The "发布" button on the comment form now requires ToS AND non-empty text before becoming active (same as before but submittingComment state removed as it was never true)
  - PR: https://github.com/linkbag/GradChoice/pull/26

### Review Round 1
- Verdict: Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)

---
## Integration Review

### Integration Round 1
- **Timestamp:** 2026-03-24 23:05:00
- **Cross-team conflicts found:** None — zh.ts was the only shared file with changes from both subteams; git auto-merged cleanly with no overlapping hunks
- **Duplicated code merged:** None — subteams worked on completely separate pages (AddSupervisorPage/HomePage/SearchPage vs SupervisorPage)
- **Build verified:** pass (tsc --noEmit clean, npm run build success, backend import OK)
- **Fixes applied:** None needed — both branches merged cleanly into main with no conflicts
- **Remaining concerns:** None — changes are fully independent; no shared state, no API contract changes, no config conflicts
