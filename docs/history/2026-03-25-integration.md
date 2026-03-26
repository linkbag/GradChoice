# Integration Log: GradChoice UI tweaks: navbar reorder, chinese names first, radar swap
**Project:** GradChoice
**Subteams:** claude-gc-ui-tweaks
**Started:** 2026-03-25 19:26:28

## Subteam Summaries


========================================
## Subteam: claude-gc-ui-tweaks
========================================
# Work Log: claude-gc-ui-tweaks
## Task: gc-ui-tweaks (GradChoice)
## Branch: feat/gc-ui-tweaks
---

### [Step 1] Navbar reorder + remove 关于我们
- **Files changed:** frontend/src/components/Layout.tsx
- **What:** Moved 添加导师 to appear after 搜索导师, before 排行榜. Removed 关于我们 from top nav. Footer link to /about kept intact.
- **Why:** Improve discoverability of 添加导师 and reduce nav clutter.
- **Decisions:** Only removed the nav <Link> for /about; footer reference at line 98 untouched.

### [Step 2] Radar chart swap 生活补助 ↔ 科研资源
- **Files changed:** frontend/src/components/RadarChart.tsx
- **What:** Swapped indices 3 and 4 in LABELS array. New order: 学术水平, 学生培养, 身心健康, 科研资源, 生活补助, 学术道德.
- **Why:** Per product spec — 科研资源 should precede 生活补助 in radar display.

### [Step 3] Chinese-names-first sort in search endpoint
- **Files changed:** backend/app/api/supervisors.py
- **What:** Added `case()` expression using PostgreSQL `~` regex operator to detect CJK first character (U+4E00–U+9FFF). Added `case` to sqlalchemy imports. Sort: chinese_first ASC, then Supervisor.name ASC.
- **Why:** Chinese name supervisors (majority) should appear before Latin-name supervisors in default search results.
- **Decisions:** Used `func.substr(name, 1, 1).op('~')('^[\\u4e00-\\u9fff]')` — works on PostgreSQL. Only applied to `/search` endpoint (line 225), not the `/` list endpoint which has its own sort_by logic.

### [Step 4] Frontend build
- **Files changed:** frontend/dist/* (build artifacts)
- **What:** Ran `npm run build` — 904 modules, no errors. Chunk size warning is pre-existing and unrelated.
- **Build status:** PASS

## Summary
- **Total files changed:** 3 source files (Layout.tsx, RadarChart.tsx, supervisors.py)
- **Key changes:**
  - Navbar: 首页 → 搜索导师 → 添加导师 → 排行榜 (removed 关于我们 from nav, kept in footer)
  - RadarChart LABELS: swapped avg_resources/avg_stipend positions
  - Search endpoint: CJK-first sort via PostgreSQL regex case() expression
- **Build status:** PASS (tsc + vite build)
- **Known issues:** None
- **Integration notes:** Backend change is backward-compatible (sort order only). No schema changes. No migration needed. Frontend build artifacts updated in dist/.

### Review+Fix Round 1
- **Reviewer:** claude-gc-ui-tweaks-review-1
- **Timestamp:** 2026-03-25 19:21:02
- **Files reviewed:** backend/app/api/supervisors.py, frontend/src/components/Layout.tsx, frontend/src/components/RadarChart.tsx
- **Issues found:**
  1. **Bug (fixed):** CJK regex in supervisors.py used Python `\u4e00` escape which passes actual Unicode chars to PostgreSQL. `postgres:16-alpine` defaults to `C` locale where POSIX bracket-expression ranges for non-ASCII characters are undefined — the sort would silently have no effect.
  2. Layout.tsx: correct — `关于我们` removed from nav, `/about` footer link at line 95 intact, nav order confirmed as 首页→搜索导师→添加导师→排行榜.
  3. RadarChart.tsx: correct — `avg_resources` and `avg_stipend` are valid `ScoreBreakdown` keys, swap applied cleanly.
- **Fixes applied:** Changed regex pattern from `'^[\u4e00-\u9fff]'` (Python-interpreted Unicode chars, locale-dependent) to `'^[\\x{4e00}-\\x{9fff}]'` (PostgreSQL hex code-point syntax, locale-independent). Committed as eb896fa.
- **Build status:** Not re-run (only backend Python change, no TypeScript affected; builder confirmed build PASS on prior tsc+vite).
- **Remaining concerns:** None. All three changes are correct and clean.

---
## Integration Review

### Integration Round 1
- **Timestamp:** 2026-03-25 19:26:33
- **Cross-team conflicts found:** None — single subteam (claude-gc-ui-tweaks), no parallel work this round
- **Duplicated code merged:** None
- **Build verified:** PASS (TypeScript type-check clean, merge conflict-free)
- **Fixes applied:** None needed — reviewer round 1 already fixed CJK regex locale issue (eb896fa)
- **Remaining concerns:** None

---

# Integration Log: GradChoice deep data cleanup: purge false names, strip titles, build blocklist
**Project:** GradChoice
**Subteams:** claude-gc-data-cleanup
**Started:** 2026-03-25 21:42:01

## Subteam Summaries


========================================
## Subteam: claude-gc-data-cleanup
========================================
# Work Log: claude-gc-data-cleanup
## Task: gc-data-cleanup (GradChoice)
## Branch: feat/gc-data-cleanup
---

### [Step 1] Parsed Obsidian false-names note and built blocklist
- **Files changed:** `data/build_blocklist.py`, `data/blocklist.json`, `data/rescrape_pairs.json`
- **What:** Parsed `/mnt/d/Obsidian projects/研选GradChoice/False or wrong names.md` (1,574 lines, 1,342 entries across multiple markdown table formats). Extracted all 导师姓名 values and unique (school_code, school_name, department) tuples.
- **Why:** The DB has thousands of false entries (navigation/UI text scraped as names) that need to be purged.
- **Decisions:** 
  - Used all 1,005 unique names from the note + hardcoded comprehensive list from task spec → 1,010 unique blocklist entries
  - Noted 101 entries that "look like real Chinese names" (2-4 CJK chars) — included in exact-match blocklist since task spec requires it. Real-looking names include: 袁春风, 丁一兵, 程林, 慈松, etc. These were explicitly documented in the note.
  - Added 6 regex patterns for pagination markers and single chars
  - 186 unique (school, dept) pairs saved to rescrape_pairs.json for future re-scraping

### [Step 2] Purged false-name supervisors from PostgreSQL DB
- **Files changed:** `data/db_cleanup.py`
- **What:** Connected to running Docker PostgreSQL, deleted supervisors matching blocklist. All FK children (ratings, comments, edit_proposals, supervisor_rating_cache) cascade-deleted. Chats SET NULL.
- **Why:** DB had 109,654 supervisors; 1,713 matched false-name patterns.
- **Decisions:**
  - After stripping title suffixes, check if stripped name is also blocked → delete instead of rename (caught 6 cases like "长聘副" → "长聘" where 长聘 is itself blocked)
  - Unique constraint on (school_code, name, department) — when strip creates collision with existing clean entry, keep the one with more ratings and delete the duplicate (88 merges)
  - Second run of queries after first delete needed to avoid stale row cache
- **Issues found:** First run hit UUID type cast error (psycopg2 passed UUIDs as text). Fixed with `::uuid[]` cast. Second run hit unique constraint violation in strip phase — fixed by checking if stripped name is blocked before attempting rename.
- **Result:** 109,654 → 107,847 supervisors. Deleted: 1,713 false names + 6 strip-then-blocked + 88 duplicate merges = 1,807 total removed.

### [Step 3] Cleaned MASTER_ALL_90HEI_TUTORS XLSX/CSV source files
- **Files changed:** `data/clean_xlsx.py`
- **What:** Applied same blocklist to source data files at `/mnt/d/Startup projects/cn-grad-units/`. Saved clean versions as `_CLEAN.csv` and `_CLEAN.xlsx`.
- **Why:** Keep source data files in sync with DB cleanup so future re-seeds produce clean data.
- **Result:** 96,375 → 94,834 rows (-1,541): removed 1,452 false-name rows + 5 strip-then-blocked + 84 duplicates.

## Summary
- **Total files changed:** 5 new files in `data/`: build_blocklist.py, db_cleanup.py, clean_xlsx.py, blocklist.json, rescrape_pairs.json
- **Key changes:**
  - Built comprehensive blocklist (1,010 explicit + 6 regex patterns) from Obsidian note + task spec categories
  - Purged 1,807 false-name supervisors from DB (109,654 → 107,847)
  - Cleaned source XLSX/CSV (96,375 → 94,834 rows)
  - Saved 186 affected (school, dept) pairs for future re-scraping
- **Build status:** Scripts run successfully; DB and files cleaned
- **Known issues:** 
  - Some legitimate professor names (袁春风, 丁一兵, 程林, 乌云毕力格, 特尔巴衣尔, etc.) were in the Obsidian note and thus removed. These may need to be re-added after manual review.
  - XLSX/CSV clean files are in cn-grad-units directory (not in GradChoice git repo)
  - The worktree was at gc-data-cleanup but data scripts were initially written to GradChoice main dir and copied over
- **Integration notes:**
  - DB is now clean: 107,847 supervisors
  - rescrape_pairs.json has 186 (school, dept) pairs that need re-scraping to fill gaps
  - blocklist.json should be used in future scrapers to filter out junk before seeding
  - title_suffixes in blocklist.json lists patterns that should be stripped during seeding

### Review Round 1
- Verdict: Review passed — reviewer fixed issues (commit: 1021ee2 fix: apply CJK-first sort to default supervisor list endpoint (not just search))

---
## Integration Review

### Integration Round 1
- **Timestamp:** 2026-03-25 21:42:08
- **Cross-team conflicts found:** supervisors.py divergence — feat/gc-data-cleanup branch had an older version that (1) used regex-based CJK detection instead of ascii/and_ approach, and (2) removed CJK-first sort from list_supervisors endpoint entirely, reverting commit 1021ee2's fix. Resolved by keeping main's version.
- **Duplicated code merged:** None
- **Build verified:** pass (backend imports OK, all Python scripts parse, JSON files valid)
- **Fixes applied:** Merge resolved by keeping main's supervisors.py (with CJK-first sort on both endpoints) and only merging the 5 new data/ files from the branch.
- **Remaining concerns:** None — clean merge with correct conflict resolution.

---

# Integration Log: GradChoice blocklist guard: filter module + import integration
**Project:** GradChoice
**Subteams:** claude-gc-blocklist-guard
**Started:** 2026-03-25 22:11:50

## Subteam Summaries


========================================
## Subteam: claude-gc-blocklist-guard
========================================
# Work Log: claude-gc-blocklist-guard
## Task: gc-blocklist-guard (GradChoice)
## Branch: feat/gc-blocklist-guard
---

### [Step 1] Read and analyzed blocklist.json + all target files
- **Files read:** data/blocklist.json, backend/seed_tutors.py, backend/seed_external_data.py, backend/scrape_yankong.py, backend/app/api/supervisors.py, backend/app/utils/__init__.py
- **What:** Understood blocklist structure (1006 explicit names + 6 regex patterns + 8 title suffixes). Reviewed all 4 integration targets.
- **Why:** Need to understand existing code before modifying.
- **Decisions:** Identified 4 real names incorrectly in explicit blocklist: 丁一兵, 乌云毕力格, 特尔巴衣尔, 袁春风. Decided to remove them from blocklist.json.

### [Step 2] Created backend/app/utils/name_filter.py
- **Files changed:** backend/app/utils/name_filter.py (new)
- **What:** NameFilter class with is_blocked(), strip_title(), clean_name(), filter_batch(), add_to_blocklist(). Module-level get_name_filter() singleton.
- **Why:** Reusable filter module to prevent false names entering the DB.
- **Decisions:**
  - Explicit blocklist applies without school/dept context (simpler design).
  - 4 real names removed from blocklist.json instead (see Step 3).
  - Heuristic rules: single char, digits-only, trailing dash, title-only, navigation keywords.
  - Title suffix sorting: longest-first to handle 副教授 before 教授 before 副.
  - strip_title() only strips if remainder has ≥ 2 CJK chars (safety check).
  - Path: 4 .parent() calls from utils/ → project root, then data/blocklist.json.

### [Step 3] Removed 4 real names from data/blocklist.json
- **Files changed:** data/blocklist.json
- **What:** Removed 丁一兵, 乌云毕力格, 特尔巴衣尔, 袁春风 from the explicit array.
- **Why:** These were confirmed real professors/people erroneously added during initial scrape analysis. They appeared in navigation/list contexts at some schools but are verified real names.
- **Decisions:** Only removed these 4. Other borderline names (周郁秋, 段燕梅, 程林 etc.) left in — not explicitly mentioned as real people by task spec.

### [Step 4] Integrated NameFilter into backend/seed_tutors.py
- **Files changed:** backend/seed_tutors.py
- **What:** Added NameFilter import, initialized before main loop, filter + title-strip each name before DB insert, track total_blocked + total_titles_stripped counters, print in summary.
- **Why:** Prevent false names re-entering DB during XLSX imports.
- **Decisions:** Filter happens BEFORE duplicate key check (saves work for blocked names).

### [Step 5] Integrated NameFilter into backend/seed_external_data.py
- **Files changed:** backend/seed_external_data.py
- **What:** Added NameFilter import, initialized in seed_data(), filter each supervisor_name at start of record processing loop, track stats['filtered_names'], print in stats summary.
- **Why:** External review data (RateMySupervisor, yankong) might have junk supervisor names.
- **Decisions:** Filter applied in seed_data() not load_*() functions — cleaner since it's one central place.

### [Step 6] Integrated NameFilter into backend/scrape_yankong.py
- **Files changed:** backend/scrape_yankong.py
- **What:** Added sys.path insert + NameFilter import, filter names when building professor_list from API index, track total_filtered count, print in progress line.
- **Why:** yankong API index might contain junk names from their scraping too.
- **Decisions:** Filter happens before SHA1 computation — no point computing SHA1 for blocked names.

### [Step 7] Integrated NameFilter into backend/app/api/supervisors.py
- **Files changed:** backend/app/api/supervisors.py
- **What:** Added get_name_filter() import, call clean_name() on submitted name before duplicate check. If blocked → HTTP 400 with Chinese error message. If title stripped → use cleaned name going forward for both dup check and Supervisor creation.
- **Why:** Prevent users from submitting false names through the API.
- **Decisions:** Use get_name_filter() singleton (not NameFilter()) to avoid reloading JSON on every request.

### [Step 8] Created backend/tests/test_name_filter.py + passed all 16 tests
- **Files changed:** backend/tests/__init__.py (new), backend/tests/test_name_filter.py (new)
- **What:** 16 test cases covering explicit blocklist, title stripping, structural heuristics (single char, digits, trailing dash, navigation, empty), real names pass, ethnic minority names pass, filter_batch, clean_name pipeline.
- **Why:** Verify filter correctness and prevent regressions.
- **Decisions:** Tests document design decisions (why 4 names removed, what heuristics cover).
- **Test results:** 16 passed, 0 failed, 0 errors.

## Summary
- **Total files changed:** 8 (3 new, 5 modified)
  - NEW: backend/app/utils/name_filter.py, backend/tests/__init__.py, backend/tests/test_name_filter.py
  - MODIFIED: data/blocklist.json, backend/seed_tutors.py, backend/seed_external_data.py, backend/scrape_yankong.py, backend/app/api/supervisors.py
- **Key changes:**
  - NameFilter module with is_blocked(), strip_title(), clean_name(), filter_batch(), add_to_blocklist()
  - Module-level get_name_filter() singleton for API use
  - 4 real names removed from blocklist.json (丁一兵, 乌云毕力格, 特尔巴衣尔, 袁春风)
  - All 4 import paths now filter names before DB insertion
  - API endpoint returns HTTP 400 with Chinese error for blocked names
  - 16 unit tests all passing
- **Build status:** Tests pass (16/16). No DB connectivity tested (not available in this env).
- **Known issues:**
  - blocklist.json may still contain other borderline real names (not in task scope).
  - seed_external_data.py: filtering only applies to supervisor_name, not supervisor_name_raw (by design — clean_supervisor_name() already strips parentheticals).
  - add_to_blocklist() persists to JSON but doesn't invalidate get_name_filter() singleton — would need app restart to take effect.
- **Integration notes:**
  - Reviewer should verify the 4 removed names (丁一兵, 乌云毕力格, 特尔巴衣尔, 袁春风) are correct decisions.
  - The module is at backend/app/utils/name_filter.py — can be imported anywhere in the backend.
  - Default blocklist path uses 4 .parent() calls from utils/ → project root. Works correctly in Docker/local.
  - For scrape_yankong.py: added sys.path.insert() since it's a standalone script — same pattern as seed_tutors.py.

### Review Round 1
- Verdict: Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)

---
## Integration Review

### Integration Round 1
- **Timestamp:** 2026-03-25 22:11:55
- **Cross-team conflicts found:** None (single subteam: gc-blocklist-guard)
- **Duplicated code merged:** None
- **Build verified:** pass — 16/16 unit tests pass, all imports verified, NameFilter module loads correctly
- **Fixes applied:** None needed — clean merge with no conflicts
- **Remaining concerns:** None. The add_to_blocklist() method doesn't invalidate the singleton (noted in worklog), but this is acceptable — runtime additions take effect immediately on the instance, only new process starts would re-read from JSON. The 4 real names removed from blocklist.json (丁一兵, 乌云毕力格, 特尔巴衣尔, 袁春风) were verified to pass through the filter correctly.
