# Work Log: claude-gc-dept-filter
## Task: gc-dept-filter (GradChoice)
## Branch: feat/gc-dept-filter
---

### [Step 1] Backend: Add /departments endpoint + department filter to search
- **Files changed:** `backend/app/api/supervisors.py`
- **What:** Added `GET /supervisors/departments?school_code=XXXXX` endpoint that returns distinct non-empty department names for a given school_code. Added optional `department: str = None` query param to `search_supervisors()` endpoint (list endpoint already had it at line ~157).
- **Why:** Provide department data to the frontend for cascading filter; enable department filtering in search results.
- **Decisions:** Placed `/departments` route before `/school/{school_code}` to avoid path collision with `/{supervisor_id}` catch-all. Returns empty list when no school_code provided.
- **Issues found:** None.

### [Step 2] Frontend API: getDepartments + department in search()
- **Files changed:** `frontend/src/services/api.ts`
- **What:** Added `getDepartments(school_code)` method to `supervisorsApi`. Added `department?` param to `search()` method signature.
- **Why:** Expose new backend endpoint; allow passing department filter to both list and search calls.
- **Decisions:** `list()` already had `department?` param, only `search()` needed updating.

### [Step 3] Frontend SearchPage: Cascading department filter
- **Files changed:** `frontend/src/pages/SearchPage.tsx`
- **What:** Added `department` state, `departmentOptions` state, `schoolCodeMap` state (maps school_name → school_code). On school change: resets department, fetches departments via `getDepartments(school_code)`. All `fetchData` calls include `dept` param. Added `AutocompleteInput` for department below school filter.
- **Why:** Cascading filter: school selection populates department dropdown; department selection filters results.
- **Decisions:** Used `schoolCodeMap` (Record<string,string>) to look up school_code from school_name without changing existing `schoolOptions: string[]` structure. Department effect depends on `[schoolName, schoolCodeMap]` — schoolCodeMap only changes once on mount so no extra re-renders.

### [Step 4] i18n
- **Files changed:** `frontend/src/i18n/zh.ts`
- **What:** Added `filter_department: '按学院/院系筛选'` to `search` section.

### [Step 5] Verification
- Backend: `SECRET_KEY=test python3 -c "from app.main import app"` → OK
- `./node_modules/.bin/tsc --noEmit` → no errors
- `npm run build` → success (tsc + vite build, 902 modules)

## Summary
- **Total files changed:** 4
- **Key changes:**
  - `backend/app/api/supervisors.py`: New `GET /supervisors/departments` endpoint; added `department` param to `search_supervisors()`
  - `frontend/src/services/api.ts`: `getDepartments()` method; `department?` param in `search()`
  - `frontend/src/pages/SearchPage.tsx`: Cascading department `AutocompleteInput` with `schoolCodeMap` for school→code lookup; `dept` param threaded through all `fetchData` calls
  - `frontend/src/i18n/zh.ts`: `filter_department` label
- **Build status:** pass (tsc + vite build, backend import OK)
- **Known issues:** none
- **Integration notes:** No new migrations needed (queries existing `department` column on `supervisors` table). The `/departments` endpoint is placed after `/school-names` and before `/school/{school_code}` to avoid route conflicts. The frontend department filter is disabled (shows empty dropdown) when no school is selected — by design, matching task spec.

### Review Round 1
- Verdict: Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)
