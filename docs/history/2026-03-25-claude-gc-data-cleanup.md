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
