# Work Log: claude-gc-score-disclaimer
## Task: gc-score-disclaimer (GradChoice)
## Branch: feat/gc-score-disclaimer
---

### [Step 1] Added i18n strings to zh.ts
- **Files changed:** `frontend/src/i18n/zh.ts`
- **What:** Added `zh.home.score_disclaimer_title`, `zh.home.score_disclaimer_body`, and `zh.supervisor.score_disclaimer` keys
- **Why:** Centralise all UI text in the i18n file; both pages reference these keys
- **Decisions:** Two keys for home (title + body) since the banner is larger; one flat string for supervisor since it's a compact inline notice

### [Step 2] Added info banner to HomePage.tsx
- **Files changed:** `frontend/src/pages/HomePage.tsx`
- **What:** Inserted a `<section>` with a sky-blue info card between the Stats section and the Attribution section
- **Why:** Users viewing platform stats or attribution should immediately understand the mixed data provenance
- **Decisions:** Used `bg-sky-50 border-sky-200` (not teal) to distinguish from interactive teal CTAs; placed above attribution since attribution explains the same context

### [Step 3] Added compact inline notice to SupervisorPage.tsx
- **Files changed:** `frontend/src/pages/SupervisorPage.tsx`
- **What:** Inserted a small `ℹ` info bar (`bg-sky-50 border-sky-100 rounded-lg text-xs`) inside the "评分概览" card, above the hasScores conditional
- **Why:** Always visible regardless of whether the supervisor has scores, so users see the disclaimer even on the empty-state view
- **Decisions:** Kept it xs text and muted sky colour so it's informational, not alarming

### [Step 4] Verified build
- **tsc --noEmit:** ✅ 0 errors
- **npm run build:** ✅ 902 modules, built in 38.75s

## Summary
- **Total files changed:** 3
- **Key changes:**
  - `zh.ts`: +3 new i18n keys under `home` and `supervisor` namespaces
  - `HomePage.tsx`: info banner between Stats and Attribution, sky-blue styling
  - `SupervisorPage.tsx`: compact `ℹ` inline notice in 评分概览 card
- **Build status:** pass (tsc + vite build)
- **Known issues:** none
- **Integration notes:** Pure frontend change, no backend or DB touches. No new dependencies. The `sky-*` Tailwind classes are already present in the project's Tailwind config (standard palette). The disclaimer is always rendered (not conditional on data), which is intentional.

### Review Round 1
- Verdict: Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)
