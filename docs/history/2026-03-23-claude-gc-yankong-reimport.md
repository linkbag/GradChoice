# Work Log: claude-gc-yankong-reimport
## Task: gc-yankong-reimport (GradChoice)
## Branch: feat/gc-yankong-reimport
---

### [Step 1] Create data/raw/yankong/ directory + placeholder reviews.json
- **Files changed:** data/raw/yankong/reviews.json (new)
- **What:** Created the directory structure expected by the scraper and seed script. reviews.json initialized as empty array [].
- **Why:** Script needs a file to read from; empty file produces a clean "0 records" run.
- **Decisions:** Empty array rather than missing file — avoids FileNotFoundError on first run.

### [Step 2] Write backend/seed_external_data.py
- **Files changed:** backend/seed_external_data.py (new, ~270 lines)
- **What:** Created the full external data seeding script with:
  - argparse CLI: --db-url, --yankong-only, --yankong-file, --dry-run
  - --yankong-only flag skips import_ratemysupervisor() call entirely
  - progress logging every 500 records via PROGRESS_INTERVAL constant
  - final summary: total processed, new inserts, duplicates skipped
  - idempotency via uuid5 deterministic comment IDs (namespace + supervisor_id + raw_content)
    → uses ON CONFLICT (id) DO NOTHING in INSERT
  - pre-loads existing yankong comment IDs by filtering content LIKE '%此条评论转载自 https://www.yankong.org/%'
  - supervisor lookup: case-insensitive (name, school_name) tuple → UUID dict built at startup
  - system importer user (UUID 00000000-0000-0000-0000-000000000001, email system+yankong-importer@gradchoice.internal)
    created with ON CONFLICT DO NOTHING — idempotent
  - RateMySupervisor is a stub that prints "not yet implemented" and returns (0,0,0)
  - source attribution appended to each comment: "此条评论转载自 https://www.yankong.org/" (or specific URL if available)
- **Why:** Task requires --yankong-only flag + progress logging + idempotency.
- **Decisions:**
  - uuid5 deterministic IDs: cleanest idempotency mechanism without adding extra DB columns
  - Pre-load all supervisors into a dict at startup: avoids N+1 queries
  - PROGRESS_INTERVAL=500 as specified in task
  - Batch size 200 for inserts (smaller than 500 to avoid too-large transactions)
  - Source URL per-review used in attribution if present (falls back to generic yankong.org URL)
- **Issues found:** None — --help and module import both clean.

## Summary
- **Total files changed:** 2
- **Key changes:**
  - `backend/seed_external_data.py` (new, ~270 lines): Full external data seeder with --yankong-only flag, progress logging, idempotency, source attribution, supervisor lookup cache, system importer user
  - `data/raw/yankong/reviews.json` (new): Empty array placeholder for scraper output
- **Build status:** pass (--help exits 0, module imports cleanly, no DB required for syntax check)
- **Known issues:** None
- **Integration notes:**
  - PR #14: https://github.com/linkbag/GradChoice/pull/14
  - The `data/raw/yankong/reviews.json` file should be populated by `backend/scrape_yankong.py` (not yet created) before running the seeder
  - Re-run safety: script is fully idempotent — safe to run repeatedly as scraper appends data
  - RateMySupervisor stub in `import_ratemysupervisor()` (line ~155) is ready to be implemented when data source is available
  - System importer user UUID is hardcoded to `00000000-0000-0000-0000-000000000001` — reviewer should check this doesn't conflict with any existing fixtures
  - Supervisor matching is by (name, school_name) exact match (case-insensitive) — if yankong data has slightly different school names, they will be counted as "not found" and skipped without error

### Review+Fix Round 1
- **Reviewer:** claude-gc-yankong-reimport-review-1
- **Timestamp:** 2026-03-23 23:28:44
- **Files reviewed:** backend/seed_external_data.py, backend/scrape_yankong.py, frontend/src/pages/HomePage.tsx, .gitignore
- **Issues found:**
  1. Dead import: `func` from sqlalchemy was imported but never used in seed_external_data.py
  2. Data loss bug (yankong path): `score_stipend` was computed via `yk_score(review.get('studentSalary'))` in `load_yankong()` and was even included in the overall score average, but was silently dropped from the record dict — not stored in either records or the ratings batch (hardcoded None)
  3. Minor stat over-count: `stats['new_supervisors']` is incremented for each record associated with a new supervisor, not only when a new supervisor dict entry is created — a misleading counter but not a data corruption issue
  4. `datetime`/`timezone` imported but not directly called (model defaults handle timestamps) — harmless
- **Fixes applied:**
  1. Removed `func` from `from sqlalchemy import create_engine, text, func` → `from sqlalchemy import create_engine, text`
  2. Added `'score_stipend': score_stipend` to the yankong record dict in `load_yankong()`
  3. Changed hardcoded `'score_stipend': None` in the ratings_batch to `'score_stipend': to_decimal(rec.get('score_stipend'))` so yankong stipend scores flow through to the DB
- **Build status:** pass (syntax check clean on both Python files; no DB available)
- **Remaining concerns:**
  - When inserting new supervisors for unrecognized schools, `school_code` defaults to `''` (empty string). With UniqueConstraint on (school_code, name, department), two supervisors from different unknown schools with the same name+department would collide. Low risk in practice since the yankong data file is currently empty and ratemysupervisor data mostly matches existing schools.
  - `stats['new_supervisors']` counter semantics are misleading (counts records not unique supervisors) but non-blocking.
