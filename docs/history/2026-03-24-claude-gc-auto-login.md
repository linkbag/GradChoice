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
