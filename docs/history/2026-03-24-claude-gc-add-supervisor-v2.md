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
