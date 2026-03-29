# Integration Log: GradChoice UX + Open Source
**Project:** GradChoice
**Subteams:** claude-gc-rankings-blur claude-gc-search-teaser claude-gc-open-source
**Started:** 2026-03-28 22:18:52

## Subteam Summaries


========================================
## Subteam: claude-gc-rankings-blur
========================================
# Work Log: claude-gc-rankings-blur
## Task: gc-rankings-blur (GradChoice)
## Branch: feat/gc-rankings-blur
---

### [Step 1] Read existing files
- **Files changed:** none
- **What:** Read RankingsPage.tsx and SearchPage.tsx to understand existing patterns
- **Why:** Need to match SearchPage login gate styling and understand RankingsPage structure
- **Decisions:** Use same `isLoggedIn = !!localStorage.getItem('access_token')` pattern as SearchPage

### [Step 2] Implement blur overlay in RankingsPage.tsx
- **Files changed:** frontend/src/pages/RankingsPage.tsx
- **What:** Added isLoggedIn check; extracted shared `renderRow` helper; split table rendering into logged-in (full) vs guest (first 5 + blur section); greyed out filters; hid pagination for guests
- **Why:** Requirements spec
- **Decisions:** Used `backdrop-filter: blur(8px)` on overlay div (not filter on rows) per spec; extracted `renderRow` helper to avoid duplicating row JSX; `FREE_ROWS = 5` constant for clarity
- **Issues found:** None

### [Step 3] Build verification
- **Files changed:** none
- **What:** `npm install` + `tsc --noEmit` + `vite build` — all passed
- **Why:** Confirm no TypeScript or bundler errors

### [Step 4] Commit + Push + PR
- **Files changed:** none
- **What:** Committed, pushed feat/gc-rankings-blur, opened PR #46
- **Why:** Deliverable requirement

## Handoff
- **What changed:** `frontend/src/pages/RankingsPage.tsx` — added blur overlay + login gate for non-logged-in users on the rankings page
- **How to verify:** Open /rankings while logged out → first 5 rows visible, rest blurred with CTA card; log in → full table + filters + pagination work normally
- **Known issues:** None
- **Integration notes:** No API changes, no other files touched. The `brand-600`/`brand-50`/`brand-700` Tailwind classes used in CTA buttons are already defined in tailwind.config.js (same as SearchPage)
- **Decisions made:** Rendered rows 6+ as non-clickable divs (not Links) inside blur container so the blur overlay correctly sits on top; used `pointer-events-none select-none` on that container
- **Build status:** PASS — `tsc --noEmit` clean + `vite build` success

### Review Round 1
- Verdict: Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)

========================================
## Subteam: claude-gc-search-teaser
========================================
# Work Log: claude-gc-search-teaser
## Task: gc-search-teaser (GradChoice)
## Branch: feat/gc-search-teaser
---

### [Step 1] Read SearchPage.tsx and backend supervisors router
- **Files changed:** none (read-only)
- **What:** Examined existing SearchPage to understand fetchData, result rendering, and login gate; checked backend list_supervisors for auth requirements
- **Why:** Need to understand current structure before modifying
- **Decisions:** Backend /supervisors endpoint has no auth dependency — no backend changes needed
- **Issues found:** node_modules not installed in worktree — symlinked from main repo

### [Step 2] Rewrote SearchPage.tsx with teaser approach
- **Files changed:** frontend/src/pages/SearchPage.tsx
- **What:** Extracted SupervisorCard component; added teaserResults/teaserLoading state; fetch 5 supervisors on mount for guests; replaced login gate with 5 visible cards + blur overlay + CTA; disabled search/filters for guests
- **Why:** Requirements: teaser UX, not full gate
- **Decisions:** Used opacity-50 (was opacity-40 before) to match task spec; used inline style for backdrop-filter since Tailwind doesn't include it by default
- **Issues found:** None

### Decision: No backend changes needed
- **Choice:** Call existing GET /supervisors?page_size=5 without auth
- **Why:** list_supervisors has no Depends(get_current_user) — already public
- **Alternatives considered:** Adding a dedicated public preview endpoint, or hardcoding preview data
- **Impact:** Clean, minimal change

## Handoff
- **What changed:** `frontend/src/pages/SearchPage.tsx` — extracted SupervisorCard, added teaser fetch for non-logged-in users, replaced full login gate with 5-result teaser + blur CTA section, disabled search/filters for guests
- **How to verify:** Visit /search logged out → see 5 real supervisor cards + blur overlay + CTA; log in → full search works normally
- **Known issues:** None
- **Integration notes:** No API changes; no new routes; no schema changes
- **Decisions made:** No backend changes needed (list endpoint is already public)
- **Build status:** PASS — `vite build` ✓ 906 modules

### Review Round 1
- Verdict: Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)

========================================
## Subteam: claude-gc-open-source
========================================
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

---
## Integration Review

### Integration Round 1
- **Timestamp:** 2026-03-28 22:18:57
- **Cross-team conflicts found:** None — the three branches touch completely separate code files (RankingsPage.tsx, SearchPage.tsx, data/ files). Only docs/ESR.md overlaps but that's trivially resolvable.
- **Duplicated code merged:** None — both SearchPage and RankingsPage independently implement blur overlays with consistent patterns (same localStorage check, same backdropFilter approach, same CTA button styling with brand-600/brand-700 classes). This is appropriate since they're in separate page components.
- **Build verified:** PASS — `tsc --noEmit` clean on main
- **Fixes applied:** None needed
- **Remaining concerns:** The open-source branch has a known issue: dev SECRET_KEY in `.en` file remains in git history (commit 4a4ddf9). If this key was ever used in production, it should be rotated. The `seed_dump.sql.gz` also remains in history. Neither is a blocker for integration but should be addressed before public release if not already handled.
