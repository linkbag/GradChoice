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
