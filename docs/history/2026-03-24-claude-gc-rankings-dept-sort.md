# Work Log: claude-gc-rankings-dept-sort
## Task: gc-rankings-dept-sort (GradChoice)
## Branch: feat/gc-rankings-dept-sort
---

### [Step 1] Updated backend analytics service
- **Files changed:** `backend/app/services/analytics.py`
- **What:** Added `department: Optional[str] = None` and `sort_order: str = "desc"` params to `get_rankings()`. Added `s.department = :department` condition when department is provided. Changed hardcoded `DESC` to `{sort_dir}` (computed from sort_order) in both `ROW_NUMBER() OVER (...)` and final `ORDER BY`.
- **Why:** Enable filtering by department and toggling sort direction from the frontend.
- **Decisions:** Validated sort_order in API layer (not service), keeping service simple.

### [Step 2] Updated analytics API route
- **Files changed:** `backend/app/api/analytics.py`
- **What:** Added `department: Optional[str] = Query(None)` and `sort_order: str = Query("desc")` to the `/analytics/rankings` endpoint. Added validation that sort_order is "asc" or "desc". Passed both to the service.
- **Why:** Expose new filter/sort params as query params on the HTTP endpoint.

### [Step 3] Updated frontend API service
- **Files changed:** `frontend/src/services/api.ts`
- **What:** Added `department?: string` and `sort_order?: 'asc' | 'desc'` to the `getRankings` params type.
- **Why:** TypeScript type safety for callers.

### [Step 4] Updated RankingsPage
- **Files changed:** `frontend/src/pages/RankingsPage.tsx`
- **What:**
  - Added `department` and `sortOrder` state variables.
  - Added `departmentOptions` state, populated via `supervisorsApi.getDepartments(schoolCode)` when schoolCode changes; cleared when school is cleared.
  - Department is reset when school changes (`handleSchoolNameChange` now also calls `setDepartment('')`).
  - Added third `AutocompleteInput` for department filter; placeholder changes to "先选院校再筛选院系" when no school is selected.
  - Added sort direction toggle button (↓ 从高到低 / ↑ 从低到高) placed inline with dimension tabs.
  - Both `department` and `sortOrder` are passed to `analyticsApi.getRankings()` and included in the `useEffect` dependency array.
- **Decisions:** No changes to `AutocompleteInput` component — kept it simple by using placeholder hint instead of disabled state.

## Summary
- **Total files changed:** 4
- **Key changes:**
  - Rankings API now accepts `department` filter and `sort_order` (asc/desc) param
  - Department filter cascades from school selection (fetches options via existing getDepartments endpoint)
  - Sort toggle button in UI, default desc (highest score first)
  - TypeScript types updated throughout
- **Build status:** pass (tsc --noEmit + vite build both succeed)
- **Known issues:** none
- **Integration notes:** The `/supervisors/departments?school_code=XXXXX` endpoint was added in gc-dept-filter task (already on main). The `AutocompleteInput` component was not modified — department input shows hint text when no school is selected but is not truly disabled (no-op since options will be empty).

### Review+Fix Round 1
- **Reviewer:** claude-gc-rankings-dept-sort-review-1
- **Timestamp:** 2026-03-24 22:16:41
- **Files reviewed:** backend/app/api/analytics.py, backend/app/services/analytics.py, frontend/src/pages/RankingsPage.tsx, frontend/src/services/api.ts
- **Issues found:** None
- **Fixes applied:** None needed
- **Build status:** tsc --noEmit: pass, vite build: pass (chunk size warning is pre-existing, unrelated)
- **Remaining concerns:** None. All checks passed:
  - SQL injection safe: sort_dir always "ASC"/"DESC", score_expr from dict lookup, department uses parameterized query
  - sort_order validated in API layer before reaching service
  - Department state resets correctly on school change (handleSchoolNameChange calls setDepartment(''))
  - useEffect dependency array is complete: [dimension, province, schoolCode, department, sortOrder, page]
  - TypeScript types correct throughout
