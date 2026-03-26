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
