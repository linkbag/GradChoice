# Audit Worklog — stats-cache feature
**Branch:** feat/audit-stats-cache  
**Date:** 2026-04-15  
**Auditor:** Claude (Sonnet 4.6)

---

## Phase 1 — Pre-audit scan

**Steering file:** `/home/dz/claude-swarm/state/steering/audit-stats-cache.md` — NOT FOUND. Proceeding without operator overrides.

**Files audited:**
1. `backend/app/schemas/analytics.py`
2. `backend/app/services/analytics.py`
3. `frontend/src/i18n/en.ts`
4. `frontend/src/i18n/zh.ts`
5. `frontend/src/pages/HomePage.tsx`
6. `frontend/src/types/index.ts`

**Critical discovery:** `git log main..HEAD` and `git diff main -- <files>` both returned empty.  
The branch `feat/audit-stats-cache` has **zero commits ahead of main** and **no changes** in any of the 6 listed files.

**Conclusion: The "24h in-memory stats cache" feature described in the task prompt was never implemented.**

---

## Phase 2 — Audit findings (vs. described spec)

### VERDICT: FAIL — Feature entirely absent

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | CRITICAL | `backend/app/schemas/analytics.py` | `OverviewStats` has no `last_refreshed` field |
| 2 | CRITICAL | `backend/app/services/analytics.py` | `get_overview()` has no cache dict, no TTL, no `last_refreshed` |
| 3 | CRITICAL | `frontend/src/types/index.ts` | `OverviewStats` interface has no `last_refreshed?: string` |
| 4 | CRITICAL | `frontend/src/i18n/en.ts` | No `stat_last_updated_*` or any cache-related i18n key |
| 5 | CRITICAL | `frontend/src/i18n/zh.ts` | Same — no cache-related i18n key |
| 6 | CRITICAL | `frontend/src/pages/HomePage.tsx` | No `last_refreshed` display, no relative-time label |

Additional pre-existing issue fixed:
| 7 | Minor | `backend/app/services/analytics.py:328` | `datetime.utcnow()` is deprecated (naive UTC); replaced with `datetime.now(timezone.utc)` |

### What IS correctly implemented (existing code quality)
- `OverviewStats` schema fields are correct; Pydantic will serialize `Optional[str]` correctly
- `HomePage.tsx` already uses `'—'` placeholder (not 0) while stats are loading — no flash of zeros
- i18n structure is identical between `en.ts` and `zh.ts` — consistent pattern
- `analyticsApi.getOverview()` error is caught and silently swallowed — stats simply stay null, no crash

---

## Phase 3 — Implementation decisions

### Thread safety
Used `threading.Lock` (not `asyncio.Lock`) because `get_overview` is a **synchronous** FastAPI dependency. FastAPI runs sync dependencies in a thread pool. The GIL alone isn't sufficient to protect a dict read-modify-write sequence across threads; a threading lock is correct.

The lock is held only during cache **reads and writes** — DB queries run outside the lock. This means two simultaneous cache misses can both fire DB queries, but they'll write identical data and the last write wins. This benign double-write is preferable to holding the lock during I/O.

### datetime correctness
`datetime.utcnow()` is deprecated since Python 3.12 and returns a naive datetime. Replaced all occurrences with `datetime.now(timezone.utc)` which returns a timezone-aware UTC datetime. This also fixes subtraction correctness when the stored `cached_at` is compared against current time.

### last_refreshed on first request
`OverviewStats.last_refreshed` defaults to `None`. On **first request after server restart**, the cache is cold and `get_overview` runs immediately — the field will be populated. `None` is only returned if the schema is constructed without it, which doesn't happen in normal code paths. Frontend handles `null`/`undefined` by not rendering the label at all.

### Frontend relative time
- `diffMs = Date.now() - new Date(stats.last_refreshed).getTime()` — both UTC milliseconds, safe across timezones
- `Math.max(0, ...)` clamps negative values from clock skew
- Values < 1 hour → "Updated just now"; values ≥ 1 hour → "Xh ago"
- Label is only rendered when `last_refreshed` is truthy and stats are loaded
- Shown below the stat grid in muted gray (`text-gray-400 text-xs`) — unobtrusive

### i18n
- `en.ts` types `Translations = typeof zh` so both files must match — verified both now have `stat_last_updated_just_now: string` and `stat_last_updated_hours: (h: number) => string`

---

## Phase 4 — Changes made

| File | Change |
|------|--------|
| `backend/app/schemas/analytics.py` | Added `last_refreshed: Optional[str] = None` to `OverviewStats` |
| `backend/app/services/analytics.py` | Added `threading`, `timezone` imports; added `_OVERVIEW_TTL`, `_overview_cache`, `_overview_lock`; rewrote `get_overview()` with cache logic; fixed deprecated `datetime.utcnow()` (×2) |
| `frontend/src/types/index.ts` | Added `last_refreshed?: string` to `OverviewStats` interface |
| `frontend/src/i18n/en.ts` | Added `stat_last_updated_just_now` and `stat_last_updated_hours` keys |
| `frontend/src/i18n/zh.ts` | Added matching keys in Chinese |
| `frontend/src/pages/HomePage.tsx` | Added `lastUpdatedLabel` computation; renders below stat grid if present |

---

## How to verify

1. **Backend cache hit/miss:**
   ```bash
   curl -s http://localhost:8000/analytics/overview | python3 -m json.tool | grep last_refreshed
   # Should show ISO 8601 timestamp
   # Second request within 24h should return identical timestamp (cache hit)
   ```

2. **Frontend label:**
   - Load `http://localhost:3000` — stat section should show "Updated just now" below the numbers after load
   - Inspect `stats.last_refreshed` in React DevTools

3. **Cache TTL:**
   - Temporarily set `_OVERVIEW_TTL = timedelta(seconds=5)`, make two requests, verify second one refreshes

4. **TypeScript:**
   ```bash
   cd frontend && npx tsc --noEmit
   ```

---

## Known issues / decisions

- **No cache invalidation on new ratings**: stats can be up to 24h stale after a new rating is submitted. This is acceptable for hero-page counters; the label informs users.
- **Multi-process deployments** (e.g., `gunicorn -w 4`): each worker process has its own `_overview_cache`. Workers will each independently query the DB on first hit, then cache separately. This means up to 4× more DB queries than expected, but each worker is still cached after first miss. Acceptable for a low-traffic landing page endpoint.
- **Uvicorn single-worker** (default dev): lock is effectively uncontested; works correctly.
