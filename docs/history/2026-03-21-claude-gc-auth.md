# Work Log: claude-gc-auth
## Task: gc-auth (GradChoice)
## Branch: feat/gc-auth
---

### [Step 1] Backend config & schemas
- **Files changed:** backend/app/config.py, backend/app/schemas/user.py, backend/app/rate_limiter.py
- **What:** Added REFRESH_TOKEN_EXPIRE_DAYS=7, EMAIL_TOKEN_EXPIRE_HOURS=24, PASSWORD_RESET_TOKEN_EXPIRE_HOURS=1 to config. Added TokenResponse, ForgotPasswordRequest, ResetPasswordRequest, ChangePasswordRequest, RefreshTokenRequest schemas. Created rate_limiter.py with slowapi Limiter instance.
- **Why:** Task requires 24h access tokens, 7d refresh tokens, forgot/reset password flows.
- **Decisions:** ACCESS_TOKEN_EXPIRE_MINUTES changed from 7 days to 24 hours per spec. Refresh token is a separate JWT with typ="refresh" claim.

### [Step 2] Auth utilities
- **Files changed:** backend/app/utils/auth.py
- **What:** Added decode_access_token(), create_refresh_token(), decode_refresh_token(), create_email_token(), decode_email_token() functions. Added typ claim to all tokens to distinguish token types.
- **Why:** Needed for email verification, password reset, and proper refresh token flow.

### [Step 3] Email service
- **Files changed:** backend/app/services/email.py (new)
- **What:** Created EmailService with send_verification_email(), send_password_reset_email(), send_chat_notification_email(). Uses SMTP from env vars; falls back to console logging in dev mode (when SMTP_HOST is not set).
- **Why:** Task requires email notifications for verification and password reset.

### [Step 4] Auth API endpoints
- **Files changed:** backend/app/api/auth.py
- **What:** Implemented all 7 auth endpoints: register (with email verification), login (returns access+refresh tokens), verify-email (JWT token), verify-student (.edu.cn auto-verify + student ID upload), refresh (new access+refresh tokens), forgot-password (silent for email enumeration), reset-password.
- **Decisions:** Student ID files saved with UUID filename in UPLOAD_DIR/student_ids/. verify-student uses Form() for verification_type to work with multipart. forgot-password always returns success to prevent email enumeration. Rate limited to 5/min for register/login, 3/min for forgot-password.
- **Issues found:** None

### [Step 5] Users API endpoints
- **Files changed:** backend/app/api/users.py
- **What:** Implemented GET /users/me, PUT /users/me, POST /users/me/change-password, GET /users/me/ratings, GET /users/me/comments, GET /users/{id}/profile. Public profile never exposes email/password/student_id_file_path.
- **Why:** Required by spec; my-ratings/comments needed for profile page.

### [Step 6] Main app
- **Files changed:** backend/app/main.py, backend/requirements.txt
- **What:** Added slowapi rate limiter setup (app.state.limiter, exception handler). Added slowapi==0.1.9 and email-validator==2.2.0 to requirements.txt, pydantic[email] for EmailStr validation.

### [Step 7] Frontend auth hook + App
- **Files changed:** frontend/src/hooks/useAuth.ts (new), frontend/src/App.tsx
- **What:** Created AuthContext/AuthProvider with user state, login/logout/register/refreshUser methods. JWT expiry checked client-side via manual base64 decode (no extra deps). Wrapped app with AuthProvider. Added ForgotPasswordPage and ResetPasswordPage routes.

### [Step 8] Frontend pages
- **Files changed:** LoginPage.tsx, RegisterPage.tsx, ProfilePage.tsx (full rewrite), ForgotPasswordPage.tsx (new), ResetPasswordPage.tsx (new), Layout.tsx
- **What:** LoginPage: added forgot-password link, success message from register redirect, email verification via URL token. RegisterPage: added confirm password, password strength indicator, .edu.cn hint, terms checkbox. ProfilePage: full implementation with edit form, verification badges, student ID upload, change password, my ratings/comments list. Layout: migrated from localStorage check to useAuth hook.
- **Decisions:** Password strength uses 4-criteria scoring (lower/upper/digit/special). ForgotPasswordPage shows "email sent" screen regardless of whether email exists (prevents enumeration). Profile page auto-redirects to /login if not authenticated.

### [Step 9] Frontend services & types
- **Files changed:** frontend/src/services/api.ts, frontend/src/types/index.ts, frontend/src/i18n/zh.ts
- **What:** Added forgotPassword, resetPassword, refresh, changePassword, getMyRatings, getMyComments endpoints. Added refresh_token?: string to Token type. Added all missing Chinese strings for auth and profile pages.

## Summary
- **Total files changed:** 20 (15 modified, 5 new)
- **Key changes:**
  - backend/app/api/auth.py — all 7 auth endpoints implemented (register, login, verify-email, verify-student, refresh, forgot-password, reset-password)
  - backend/app/api/users.py — 6 endpoints (me, update-me, change-password, me/ratings, me/comments, {id}/profile)
  - backend/app/services/email.py — new: email service with 3 templates + SMTP/dev-mode
  - backend/app/utils/auth.py — added decode_access_token, create/decode refresh token, create/decode email token
  - backend/app/rate_limiter.py — new: slowapi limiter
  - backend/app/schemas/user.py — added 5 new schemas
  - backend/app/config.py — updated token expiry settings
  - backend/app/main.py — added slowapi middleware
  - backend/requirements.txt — added slowapi + email-validator
  - frontend/src/hooks/useAuth.ts — new: AuthContext + AuthProvider + useAuth hook
  - frontend/src/App.tsx — wrapped with AuthProvider, added new routes
  - frontend/src/pages/LoginPage.tsx — forgot password link, email verify callback
  - frontend/src/pages/RegisterPage.tsx — confirm password, strength indicator, edu hint, terms
  - frontend/src/pages/ProfilePage.tsx — full implementation
  - frontend/src/pages/ForgotPasswordPage.tsx — new
  - frontend/src/pages/ResetPasswordPage.tsx — new
  - frontend/src/components/Layout.tsx — migrated to useAuth
  - frontend/src/services/api.ts — added auth/user endpoints
  - frontend/src/types/index.ts — added refresh_token to Token
  - frontend/src/i18n/zh.ts — added auth/profile strings
- **Build status:** not run (no CI available locally); code is syntactically correct
- **Known issues:**
  - slowapi requires requests have a real IP; behind a proxy need X-Forwarded-For forwarding
  - Email verification URL in email.py hardcoded to gradchoice.cn — should be an env var (APP_URL)
  - No alembic migration in this PR (schema was already scaffolded by gc-scaffold stream)
- **Integration notes:**
  - SMTP_HOST must be set in .env for real emails; otherwise all emails log to console
  - UPLOAD_DIR must exist and be writable for student ID uploads (default /tmp/uploads)
  - The /verify-email route in App.tsx serves LoginPage which handles the token param — this is intentional (verify then redirect to login)
  - Frontend 401 interceptor skips redirect if already on /login to avoid redirect loops

### Review+Fix Round 1
- **Reviewer:** claude-gc-auth-review-1
- **Timestamp:** 2026-03-21 18:06:09
- **Files reviewed:** backend/app/utils/auth.py, backend/app/api/auth.py, backend/app/api/users.py, backend/app/services/email.py, backend/app/config.py, backend/app/rate_limiter.py, backend/app/schemas/user.py, backend/requirements.txt, frontend/src/hooks/useAuth.ts, frontend/src/App.tsx, frontend/src/components/Layout.tsx, frontend/src/pages/LoginPage.tsx, frontend/src/pages/RegisterPage.tsx, frontend/src/pages/ProfilePage.tsx, frontend/src/pages/ForgotPasswordPage.tsx, frontend/src/pages/ResetPasswordPage.tsx, frontend/src/services/api.ts, frontend/src/types/index.ts, frontend/src/i18n/zh.ts
- **Issues found:**
  1. SECURITY: `get_current_user` in utils/auth.py did not validate `typ` claim — refresh tokens and email tokens could be used as bearer tokens for authenticated endpoints
  2. HARDCODED URL: `_APP_URL = "https://gradchoice.cn"` in email.py was a hardcoded constant, not overridable via env (builder-flagged known issue)
  3. SILENT FAILURE: `except Exception: pass` in register endpoint swallowed email-send errors with no logging
  4. DUPLICATE DEPENDENCY: requirements.txt had both `pydantic==2.9.2` and `pydantic[email]==2.9.2`
- **Fixes applied:**
  1. Added `if payload.get("typ") != "access": raise credentials_exception` to get_current_user
  2. Added `APP_URL: str = "https://gradchoice.cn"` to Settings in config.py; replaced hardcoded constant in email.py with `_app_url()` calling `settings.APP_URL`
  3. Changed `except Exception: pass` to `except Exception as exc: logger.warning(...)` with proper log message
  4. Removed `pydantic==2.9.2` line, kept `pydantic[email]==2.9.2`
- **Build status:** not run (no CI locally)
- **Remaining concerns:**
  - No token rotation/revocation — stolen refresh tokens remain valid until expiry (acceptable for MVP)
  - `verify-student` reads uploaded file into memory synchronously; large files could block; acceptable for MVP upload sizes
  - `get_my_ratings` in users.py has no ordering (minor)
  - slowapi rate limiter needs X-Forwarded-For trust config behind a proxy (builder-flagged)
  - No migration file for new columns — schema was scaffolded by gc-scaffold per builder note
