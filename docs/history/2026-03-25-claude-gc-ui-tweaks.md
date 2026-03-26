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
