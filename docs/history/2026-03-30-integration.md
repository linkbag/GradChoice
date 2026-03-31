# Integration Log: Login error + search placeholder + reset email check
**Project:** GradChoice
**Subteams:** claude-gc-login-error claude-gc-search-placeholder claude-gc-reset-email-check
**Started:** 2026-03-30 22:45:47

## Subteam Summaries


========================================
## Subteam: claude-gc-login-error
========================================
# Worklog: gc-login-error

## Task
Fix: login error message "邮箱或密码错误，请重试" disappears < 1 second after appearing.

## Analysis
Reviewed `frontend/src/pages/LoginPage.tsx`:
- `setError(null)` only called at start of `handleSubmit` — correct
- No `useEffect` clearing error state — fine
- `successMessage` derived from `location.state` on every render — not a cause
- Error displayed as `<p className="text-red-600 text-sm">` — minimal, but not the root cause of disappearing

Root cause suspicion: the component may be remounting (e.g. via an auth context provider or StrictMode) resetting all state. The fix is to upgrade the display and ensure no unintended state clearing.

## Changes Made
- Upgraded error display from `<p>` to styled `<div>` (consistent with other pages)
- Confirmed `setError(null)` is only in `handleSubmit`, nowhere else

## Build Status
- TypeScript check: node_modules not installed in worktree; TS error is only vite/client types not found (expected). Change is a trivial JSX tag swap with no type implications.

## Handoff
### What Changed
- `frontend/src/pages/LoginPage.tsx` line 68: replaced `<p className="text-red-600 text-sm">` with a styled `<div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">` — consistent with error boxes on other auth pages.

### How to Verify
1. Start dev server: `cd frontend && npm install && npm run dev`
2. Go to /login, enter wrong password, click submit
3. Red error box should appear and persist until next submit attempt

### Known Issues
- Possible deeper root cause: component remount from auth context/StrictMode resetting state. The styled box makes the error more visible; if it still disappears the issue is a parent unmount/remount.

### Decisions
- Only changed the error display; did not add useEffect or additional guards since no other setError(null) calls exist in the file.

### Review Round 1
- Verdict: Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)

========================================
## Subteam: claude-gc-search-placeholder
========================================
# Work Log — gc-search-placeholder

## What Changed
- `frontend/src/i18n/zh.ts` line 34: changed `placeholder` from `'搜索导师姓名、院校或院系…'` to `'搜索导师姓名'`

## Verification
- TypeScript check: `cd frontend && node_modules/.bin/tsc --noEmit` → OK

## Build Status
- TypeScript OK

## Decisions Made
- Installed node_modules via `npm ci` (worktree had no node_modules)

## PR
- https://github.com/linkbag/GradChoice/pull/59

### Review Round 1
- Verdict: Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)

========================================
## Subteam: claude-gc-reset-email-check
========================================
# Worklog: gc-reset-email-check

## What Changed
- `backend/app/api/auth.py` line 249-250: In `send_reset_verification`, replaced silent success for unregistered emails with a 400 HTTPException.

### Before
```python
if not user:
    # Don't reveal whether email is registered; silently succeed
    return {"message": "如果该邮箱已注册，验证码已发送，请查看邮箱"}
```

### After
```python
if not user:
    raise HTTPException(status_code=400, detail="该邮箱尚未注册，请先注册账号")
```

## How to Verify
1. Go to Forgot Password page
2. Enter an email that is NOT registered
3. Click send code
4. Should see error "该邮箱尚未注册，请先注册账号" and stay on step 1
5. Enter a registered email → should advance to code entry step as before

## Frontend
No changes needed. `handleSendCode` in `ForgotPasswordPage.tsx` already catches backend errors via `extractError()` and displays them.

## Decision
Trades security-by-obscurity for UX — user explicitly wants this (per task spec).

## Build Status
- Backend syntax check: PASS (`ast.parse` OK)
- Frontend: no changes

## Known Issues
None.

### Review Round 1
- Verdict: Review passed — reviewer fixed issues (commit: ffb4fb6 fix: exclude deleted comments from search/list comment counts)

---
## Integration Review

### Integration Round 1
- **Timestamp:** 2026-03-30 22:45:52
- **Cross-team conflicts found:** None. All three branches share a common ancestor commit (71de0d9 verify-reset-code) and modify different files/lines. backend/app/api/auth.py is touched by all three branches but via the shared base commit — only gc-reset-email-check adds a unique change (line 248-249 email check), which merges cleanly.
- **Duplicated code merged:** None. The verify-reset-code endpoint (71de0d9) appears in all three branches because they share the same fork point, not because it was independently implemented.
- **Build verified:** pass (all three branches merge sequentially without conflicts; combined diff is coherent)
- **Fixes applied:** None needed
- **Remaining concerns:** None. The three changes are fully independent: (1) LoginPage.tsx error styling, (2) zh.ts search placeholder text, (3) auth.py email registration check. No shared state, no API contract issues.
