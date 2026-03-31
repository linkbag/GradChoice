# Work Log — gc-email-auth-fix

## Session: 2026-03-30

### Changes Made

**File:** `backend/app/api/auth.py`

#### BUG 1 FIXED — reset_password NameError (CRITICAL)
- **Before:** `if smtp_configured and body.code != entry["code"]:` — `smtp_configured` was never defined → NameError → 500 on every password reset
- **After:** `if body.code != entry["code"]: raise HTTPException(400, "验证码错误")` — clean, correct check

#### BUG 2 FIXED — Dead verification bypass removed (SECURITY)
- **Removed:** `if False and body.code != entry["code"] and not entry.get("verified"):` — dead code that would have skipped code verification

#### BUG 3 FIXED — Dead `if False:` stubs removed
- `send_signup_verification`: removed `if False:` block (~lines 60-62) that logged "auto-verifying" for dev
- `send_reset_verification`: removed `if False:` block (~lines 266-268) that logged the reset code

#### BUG 4 FIXED — Unused `ses_available = True` removed
- Removed 3 dead assignments: in `send_signup_verification`, `send_reset_verification`, and `reset_password`

### Flows Verified (code review)
1. `/auth/send-signup-verification` → generates code, stores in `_signup_verifications`, sends via SES; falls back to auto-verify if SES fails ✓
2. `/auth/verify-signup-code` → validates expiry + code, marks verified ✓
3. `/auth/register` → checks pre-verified flag, creates user with correct `is_email_verified` ✓
4. `/auth/send-reset-verification` → generates code, sends via SES; silently succeeds for unregistered emails ✓
5. `/auth/reset-password` → validates expiry + code (now correct, no NameError), updates password ✓
6. `/auth/send-verification` + `/auth/verify-school-email` — untouched, clean ✓

### Build Verification
```
SECRET_KEY=test python3 -c "from app.api.auth import router; print('auth routes OK')"
# Output: auth routes OK
```

### Known Issues
- None. All 4 bugs resolved.

### Integration Notes
- No schema changes, no DB migrations needed
- Frontend code unchanged — API contract is identical
- `backend/app/utils/email.py` not touched

### Decisions Made
- Kept SES send-failure fallback auto-verify in signup (as intended for resilience)
- Removed SES send-failure fallback in reset flow (failure returns neutral message, no auto-reset)

### Review Round 1
- Verdict: Review passed — reviewer fixed issues (commit: d2f407d fix: resolve auth NameError + remove dead code in email verification flows)
