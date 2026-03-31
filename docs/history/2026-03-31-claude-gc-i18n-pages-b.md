# Work Log — gc-i18n-pages-b
Agent: claude-gc-i18n-pages-b
Branch: feat/gc-i18n-pages-b
Date: 2026-03-31

## Objective
Extract all hardcoded Chinese strings from 5 pages:
1. LoginPage.tsx
2. RegisterPage.tsx
3. ForgotPasswordPage.tsx
4. ProfilePage.tsx
5. MyReviewsPage.tsx

## Pre-existing i18n Infrastructure
- `frontend/src/i18n/context.tsx` — `useI18n()` hook with `{ t, locale, setLocale }`
- `frontend/src/i18n/zh.ts` — Chinese translations (type source)
- `frontend/src/i18n/en.ts` — English translations (implements `Translations` type)
- Existing namespaces: nav, home, search, supervisor, auth, errors, addSupervisor, footer

## New Keys Added

### auth.* (new keys added to existing section)
- error_login_failed, login_loading, forgot_password
- edu_email_hint, sending, spam_check_hint, verifying
- resend_countdown (fn), resend_code, change_email, password_min_chars
- registering, tos_agreement, tos_link
- error_send_code, error_resend, error_verify_code, error_password_length
- error_tos_required, error_invalid_format, error_invalid_format_full
- error_no_connection, error_register_with_status (fn), error_register
- forgot_password_title, forgot_steps.{email,code,password}
- registered_email_label, six_digit_code_label, next_step
- new_password_label, confirm_password_label, resetting, reset_password_btn
- remembered_password, back_to_login
- error_enter_6_digit, error_code_wrong, error_password_mismatch
- error_reset_password, reset_password_success

### profile.* (new section)
- page_title, loading, login_required, display_name, display_name_placeholder
- saving, save, cancel, not_set, edit, email, email_notifications
- notif_on, notif_off, verification_status, verified_student, unverified
- bio, school_email_section, verified, pending_verification
- enter_code_placeholder, verifying, verify, resend
- school_email_only, code_sent, send_failed, school_email_verified
- verify_failed, code_resent, add_school_email_hint, sending, send_code

### my_reviews.* (new section)
- page_title, unknown_supervisor, edit, delete, deleting, required, optional
- saving, saved, save, cancel, skip_score
- confirm_delete_rating, confirm_delete_comment
- anonymous, edited, verified
- ratings_tab (fn), comments_tab (fn)
- loading, no_ratings, search_to_rate, no_comments, search_to_comment
- prev_page, next_page

## Key Design Decisions
1. `spam_check_hint` lives in `auth.*` and is cross-referenced in ProfilePage as `t.auth.spam_check_hint`
2. `extractError()` in RegisterPage/ForgotPasswordPage: added optional 3rd param `noConnectionMsg?` for the no-connection error; callers pass `t.auth.error_no_connection`
3. Module-level `SCORE_LABELS` in MyReviewsPage was built from `zh` directly — moved inside `RatingCard` component using `useI18n()` hook
4. All sub-components in MyReviewsPage (RatingCard, CommentCard, ScoreInput, Pagination) each call `useI18n()` independently
5. Date locale in RatingCard/CommentCard updated to be dynamic: `locale === 'zh' ? 'zh-CN' : 'en-US'`
6. Pages that previously imported `{ zh }` now import and use `useI18n()`

## Files Modified
- frontend/src/i18n/zh.ts — added ~80 new keys across auth, profile, my_reviews sections
- frontend/src/i18n/en.ts — same structure with English translations
- frontend/src/pages/LoginPage.tsx
- frontend/src/pages/RegisterPage.tsx
- frontend/src/pages/ForgotPasswordPage.tsx
- frontend/src/pages/ProfilePage.tsx
- frontend/src/pages/MyReviewsPage.tsx

## How to Verify
1. `cd frontend && npm run build` — should compile with no TypeScript errors
2. Run dev server, toggle locale (zh/en) via language switcher
3. Check: LoginPage, RegisterPage, ForgotPasswordPage, ProfilePage, MyReviewsPage all switch languages
4. Test error paths: wrong login credentials, short password, TOS not agreed

## Known Issues / Limitations
- `confirm()` dialogs (delete rating/comment) are translated but browser-native; they may still show in the OS language on some systems
- Date locale is updated to be dynamic but uses simple `zh-CN` / `en-US` mapping
- Backend API error messages (returned in `detail` field) are not translated — they remain in Chinese from the server

## Integration Notes
- No changes to other pages (SearchPage, SupervisorPage, etc.)
- No changes to API layer
- TypeScript type safety maintained: `en.ts` implements the `Translations` type derived from `zh.ts`

## Build Status
[x] TypeScript type check passed (no errors)

### Review Round 1
- Verdict: Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)
