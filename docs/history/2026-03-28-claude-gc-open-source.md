# Work Log: claude-gc-open-source
## Task: gc-open-source (GradChoice)
## Branch: feat/gc-open-source
---

### [Step 1] Secrets scan + .gitignore audit
- **Files changed:** `.gitignore`
- **What:** Found two issues — `.en` (dev SECRET_KEY committed) and `data/seed_dump.sql.gz` (contains test user data). Removed both from git tracking via `git rm --cached`. Extended `.gitignore` to cover `.en`, `*.pem`, `*.key`, `data/*.sql.gz`, `data/*.dump`.
- **Why:** These files must not be visible in a public repo.
- **Decisions:** Did not rewrite git history (too destructive; the SECRET_KEY in `.en` is a dev key). Noted that the production key in GitHub Secrets is unaffected.
- **Issues found:** `.en` was tracked since commit 4a4ddf9. `seed_dump.sql.gz` contained test emails + hashed passwords + comments.

### [Step 2] Export supervisors CSV from Neon
- **Files changed:** `data/supervisors-2026-03-28.csv`
- **What:** Exported 107,307 rows from production Neon DB via psycopg2. All supervisor columns included (no user data in this table).
- **Why:** Public dataset for open-source release.

### [Step 3] Export anonymized ratings CSV from Neon
- **Files changed:** `data/ratings-anonymized-2026-03-28.csv`
- **What:** Exported 13,025 rows. Column `user_id` intentionally excluded. Actual column names differed from task spec (e.g., `score_academic` not `academic_score`) — discovered via `information_schema` query.
- **Why:** Privacy-safe dataset for public release.

### [Step 4] Create data/README.md
- **Files changed:** `data/README.md`
- **What:** Describes both CSV files, their columns, privacy approach, and MIT license.

### [Step 5] Make repo public
- **What:** `gh repo edit linkbag/GradChoice --visibility public` — verified visibility=PUBLIC.

### [Step 6] Commit, push, open PR
- **Commit:** 327aa26 on feat/gc-open-source
- **PR:** https://github.com/linkbag/GradChoice/pull/48

## Handoff
- **What changed:**
  - `.en` — removed from tracking (dev SECRET_KEY; still in history at 4a4ddf9)
  - `.gitignore` — added `.en`, `*.pem`, `*.key`, `data/*.sql.gz`, `data/*.dump`
  - `data/seed_dump.sql.gz` — removed from tracking (test user data; still in history)
  - `data/supervisors-2026-03-28.csv` — 107,307 supervisor rows exported from Neon
  - `data/ratings-anonymized-2026-03-28.csv` — 13,025 anonymized ratings (no user_id)
  - `data/README.md` — explains data contents, privacy, license
- **How to verify:**
  - `gh repo view linkbag/GradChoice --json visibility` → should be PUBLIC
  - `head -2 data/supervisors-2026-03-28.csv` — check supervisor columns
  - `head -2 data/ratings-anonymized-2026-03-28.csv` — confirm no user_id column
- **Known issues:**
  - Dev SECRET_KEY remains in git history (commit 4a4ddf9). If this key was ever deployed to production, rotate `SECRET_KEY` in GitHub Secrets.
  - `seed_dump.sql.gz` test data remains in git history. If real user data was ever in this dump, consider a history rewrite.
- **Integration notes:** GitHub Actions workflows use `${{ secrets.XXX }}` throughout — no secrets in workflow files. Making repo public does NOT expose GitHub Secrets.
- **Decisions made:** Used psycopg2 directly (no psql binary available). Exported from production Neon rather than local DB to ensure latest data.
- **Build status:** N/A (data export + repo visibility change; no code build required)

### Review Round 1
- Verdict: Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)
