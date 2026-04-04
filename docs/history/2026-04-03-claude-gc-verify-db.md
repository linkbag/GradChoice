# Work Log: gc-verify-db (move verification codes to DB)

## Session: 2026-04-03

### Task
Move signup and password reset verification codes from in-memory Python dicts to a `verification_codes` DB table, so Lambda multi-container deployments work correctly.

### Steps
1. Create `app/models/verification_code.py`
2. Update `app/models/__init__.py`
3. Create migration `0011_add_verification_codes_table.py`
4. Refactor `app/api/auth.py`

### Changes Made
- [x] Created `backend/app/models/verification_code.py` — VerificationCode model with email, code, purpose enum (signup|password_reset), expires_at, verified, created_at
- [x] Updated `backend/app/models/__init__.py` — exports VerificationCode and VerificationPurpose
- [x] Created `backend/alembic/versions/0011_add_verification_codes_table.py` — creates table + two indexes
- [x] Refactored `backend/app/api/auth.py` — replaced _signup_verifications dict with DB queries

### Key Decisions
- `_upsert_verification_code()` helper: deletes existing rows for same email+purpose, inserts new row, and cleans up any other expired rows for that email (housekeeping)
- `_get_valid_entry()` helper: queries for non-expired row, auto-deletes if expired
- `reset-password` now deletes the verification_codes row AFTER the password update (not before, to ensure atomicity)
- `verify-signup-code` and `verify-reset-code` now need `db` param (they previously only used in-memory)
- Migration uses DO $$ BEGIN ... EXCEPTION duplicate_object END $$ to safely create the enum type

### How to Verify
1. `cd backend && alembic upgrade head` — should apply 0011
2. Test the full signup flow across two uvicorn processes (verify Lambda safety)
3. Test the password reset flow

### Build Status
- All 4 modified/created Python files pass `ast.parse()` syntax check
- `from app.main import app` fails locally only due to missing `boto3` (pre-existing, unrelated to this change)

### PR
- https://github.com/linkbag/GradChoice/pull/66

### Review Round 1
- Verdict: Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)
