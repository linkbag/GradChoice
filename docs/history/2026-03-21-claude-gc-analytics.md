# Work Log: claude-gc-analytics
## Task: gc-analytics (GradChoice)
## Branch: feat/gc-analytics
---

### [Step 1] Backend analytics schemas
- **Files changed:** backend/app/schemas/analytics.py
- **What:** Extended schemas with PercentileRankings, ScoreTrend, DepartmentStats; expanded SupervisorAnalytics with verified_scores, percentiles, score_trends, school_avg_scores, national_avg_scores; expanded SchoolAnalytics with unrated_supervisors, avg_sub_scores, departments, total_ratings, recent_ratings, school_percentile; updated RankingsResponse to paginated format; added OverviewStats
- **Why:** Original schemas were stubs with no percentile or comparison data
- **Decisions:** Used Optional[float] for all averages to handle empty state gracefully

### [Step 2] Analytics service
- **Files changed:** backend/app/services/analytics.py (NEW)
- **What:** Full implementation of get_supervisor_analytics, get_school_analytics, get_rankings, get_overview using SQLAlchemy + raw SQL text() for window functions
- **Why:** Complex percentile computations require PERCENT_RANK() SQL window functions; not easily expressible with ORM
- **Decisions:** Used MIN_RATINGS_FOR_PERCENTILE=3 threshold; used SQL CTEs for percentile queries; VALID_DIMENSIONS dict to whitelist SQL column expressions and prevent injection

### [Step 3] Analytics API endpoints
- **Files changed:** backend/app/api/analytics.py
- **What:** Implemented all 4 endpoints: /supervisor/{id}, /school/{code}, /rankings (with dimension/filters/pagination), /overview
- **Why:** Replaced 501 stubs with real service calls
- **Decisions:** Added dimension/province/school_code/page/page_size/min_ratings query params to /rankings

### [Step 4] Alembic migration
- **Files changed:** backend/alembic/versions/001_supervisor_rankings_view.py (NEW), backend/alembic/versions/ (dir created)
- **What:** Migration to create supervisor_rankings materialized view with all percentile columns; indexes on supervisor_id, school_code, province
- **Why:** MV enables fast cached ranking queries without re-running window functions every request
- **Decisions:** Service uses inline CTEs instead of MV for now (no refresh mechanism needed in dev); MV is available for production use

### [Step 5] Frontend types + API
- **Files changed:** frontend/src/types/index.ts, frontend/src/services/api.ts
- **What:** Added PercentileRankings, ScoreTrend, DepartmentStats, OverviewStats interfaces; updated SupervisorAnalytics, SchoolAnalytics, RankingsResponse to match backend; added analyticsApi.getOverview(), updated getRankings() with filter params
- **Why:** Frontend types must mirror backend Pydantic schemas

### [Step 6] Chart components
- **Files changed:** frontend/src/components/RadarChart.tsx (NEW), frontend/src/components/DistributionChart.tsx (NEW), frontend/src/components/PercentileDisplay.tsx (NEW)
- **What:** RadarChart - Recharts radar with supervisor/school/national overlays; DistributionChart - horizontal bar chart with color-coded star ratings; PercentileDisplay - 2x2 grid with progress bars color-coded green/yellow/red
- **Why:** Visual representation of analytics data per spec
- **Decisions:** Used teal (#0d9488) as primary color; empty state handling for all charts

### [Step 7] New pages
- **Files changed:** frontend/src/pages/SchoolAnalyticsPage.tsx (NEW), frontend/src/pages/RankingsPage.tsx (NEW)
- **What:** SchoolAnalyticsPage at /school/:code/analytics - stats cards, department bar chart, top supervisors list; RankingsPage at /rankings - dimension tabs, province/school filters, paginated table with medal badges
- **Why:** Per spec requirements
- **Decisions:** Responsive design; empty states with emoji; medal colors (gold/silver/bronze) for top 3

### [Step 8] SupervisorPage integration
- **Files changed:** frontend/src/pages/SupervisorPage.tsx
- **What:** Full rewrite - fetches supervisor + analytics in parallel; integrates RadarChart, PercentileDisplay, DistributionChart; shows overall score, sub-scores, comparison to school/national average
- **Why:** Per spec: integrate analytics into supervisor profile page
- **Decisions:** Used Promise.allSettled() so analytics 404 (new supervisors) doesn't break page load; added KEY_TO_SCORE_FIELD helper to avoid TypeScript keyof issues

### [Step 9] Routing + navigation
- **Files changed:** frontend/src/App.tsx, frontend/src/components/Layout.tsx, frontend/src/i18n/zh.ts
- **What:** Added /rankings and /school/:code/analytics routes; added 排行榜 nav link; added rankings key to zh.nav
- **Why:** New pages need routing

## Summary
- **Total files changed:** 14 files (7 new, 7 modified)
- **Key changes:**
  - Full analytics backend: schemas, service with SQL window functions, 4 API endpoints
  - Alembic migration for supervisor_rankings materialized view
  - 3 new chart components: RadarChart (Recharts), DistributionChart, PercentileDisplay
  - 2 new pages: /rankings (sortable multi-dimension leaderboard) and /school/:code/analytics
  - SupervisorPage fully wired to analytics API
- **Build status:** TypeScript not installed in environment; code reviewed manually for type safety
- **Known issues:** node_modules not installed in this environment so tsc verification skipped; noUnusedLocals=true in tsconfig so unused imports were cleaned up manually
- **Integration notes:**
  - Run `alembic upgrade head` to create the materialized view (needs DB connection)
  - The materialized view needs manual REFRESH CONCURRENTLY to stay current; consider adding a scheduled job
  - Service uses inline CTEs for percentiles (no MV dependency) so analytics work even without running the migration
  - All analytics endpoints gracefully return empty/null values when no ratings exist

### Review+Fix Round 1
- **Reviewer:** claude-gc-analytics-review-1
- **Timestamp:** 2026-03-21 18:09:23
- **Files reviewed:**
  - backend/app/schemas/analytics.py
  - backend/app/services/analytics.py (NEW)
  - backend/app/api/analytics.py
  - backend/alembic/versions/001_supervisor_rankings_view.py (NEW)
  - frontend/src/types/index.ts
  - frontend/src/services/api.ts
  - frontend/src/components/RadarChart.tsx (NEW)
  - frontend/src/components/DistributionChart.tsx (NEW)
  - frontend/src/components/PercentileDisplay.tsx (NEW)
  - frontend/src/pages/SchoolAnalyticsPage.tsx (NEW)
  - frontend/src/pages/RankingsPage.tsx (NEW)
  - frontend/src/pages/SupervisorPage.tsx (rewrite)
  - frontend/src/App.tsx
  - frontend/src/components/Layout.tsx
  - frontend/src/i18n/zh.ts
- **Issues found:**
  1. CRITICAL (TypeScript compile error): `SupervisorPage.tsx` used `ScoreBreakdown` type (in `KEY_TO_SCORE_FIELD: Record<string, keyof ScoreBreakdown>` and `scoreForKey(scores: ScoreBreakdown, ...)`) without importing it from `@/types`. Import line only had `Supervisor, SupervisorAnalytics`.
  2. MINOR (API quality): `/analytics/rankings` endpoint accepted any string for `dimension` and silently fell back to "overall" in the service layer. No 422 returned for invalid input — poor DX and hard to debug for API consumers.
- **Fixes applied:**
  1. Added `ScoreBreakdown` to the import in `SupervisorPage.tsx`: `import type { Supervisor, SupervisorAnalytics, ScoreBreakdown } from '@/types'`
  2. Added explicit dimension validation in `analytics.py` API endpoint: imports `VALID_DIMENSIONS` from service and raises `HTTPException(422)` for unrecognized dimension values.
- **Build status:** TypeScript build not run (no node_modules); manual review. Backend not run; logic reviewed manually.
- **Remaining concerns:**
  - The materialized view `supervisor_rankings` (001_supervisor_rankings_view.py) is created but NOT used by the analytics service — the service recomputes all rankings live via window functions. The materialized view is dead code for now. It could be used to speed up the `/rankings` endpoint but this is an optimization opportunity, not a bug.
  - `school_avg_scores` and `national_avg_scores` in `SupervisorAnalytics` have `verified_ratings=0` (pydantic default) since the raw SQL queries don't compute verified counts at school/national level. This is acceptable but worth noting.
  - Score trend `avg_overall` is cast to `float()` directly from `ROUND(AVG(...))::numeric` — safe as the query is grouped so no null values, but implicit trust in SQL result.
