# Work Log — gc-i18n-components

Session start: 2026-03-31
Branch: feat/gc-i18n-components

## Task
Extract all hardcoded Chinese strings from 7 files (4 components + 3 pages) into the i18n system.

## Files Modified
- frontend/src/i18n/zh.ts — added: components.*, not_found.*, comment_flags.*, public_profile.*
- frontend/src/i18n/en.ts — same new sections with English translations
- frontend/src/components/RadarChart.tsx
- frontend/src/components/AutocompleteInput.tsx
- frontend/src/components/PercentileDisplay.tsx
- frontend/src/components/DistributionChart.tsx
- frontend/src/pages/NotFoundPage.tsx
- frontend/src/pages/CommentFlagsPage.tsx
- frontend/src/pages/PublicProfilePage.tsx

## Progress
- [ ] zh.ts / en.ts updated
- [ ] RadarChart.tsx
- [ ] AutocompleteInput.tsx
- [ ] PercentileDisplay.tsx
- [ ] DistributionChart.tsx
- [ ] NotFoundPage.tsx
- [ ] CommentFlagsPage.tsx
- [ ] PublicProfilePage.tsx
- [ ] Committed and pushed

## Key Decisions
- RadarChart: Changed internal data keys from Chinese strings ('该导师', '校均值') to stable English keys ('supervisor', 'school_avg'); localized display names come from t.components.radar.*
- LABELS/STAR_LABELS/items arrays moved inside components to access `t`
- formatDate in PublicProfilePage now accepts locale param for proper date locale
- DistributionChart STAR_LABELS built inside component from t keys

## New Translation Keys Added
### components.radar.*
  no_data, this_supervisor, school_avg, income(fn), income_no_data
  dim_{academic,mentoring,wellbeing,resources,stipend,ethics}_{label,desc}

### components.autocomplete.*
  narrow_down

### components.percentile.*
  dept_rank, dept_rank_sub, school_rank, school_rank_sub,
  province_rank, province_rank_sub, national_rank, national_rank_sub,
  beats(fn), insufficient

### components.distribution.*
  no_data, total(fn), star_1..star_5

### not_found.*
  message, back_home

### comment_flags.*
  title, under_construction

### public_profile.*
  loading, user_not_found, load_error, breadcrumb_home, breadcrumb_profile,
  anonymous, verified_student, unverified, joined(fn), send_message,
  message_placeholder, cancel, sending, send, bio_label, no_bio, send_error

---
## Handoff

### What changed
- `frontend/src/i18n/zh.ts` — 72 new keys in 4 new top-level sections
- `frontend/src/i18n/en.ts` — same structure, English translations
- All 4 components + 3 pages use `useI18n()` and `t.*` for every string

### How to verify
1. Toggle ZH↔EN via navbar locale switcher
2. Supervisor profile page: RadarChart axis labels, dimension descriptions, income line, percentile ranks, star distribution all switch
3. Search page: autocomplete "type more to narrow results" hint switches
4. Visit /nonexistent route: 404 message and button switch
5. Visit /users/:id: all badge text, breadcrumbs, send-message form, bio section switch

### Build status
- No node_modules in worktree — TypeScript check not run locally
- Commit: 39bdba2
- PR: https://github.com/linkbag/GradChoice/pull/62

### Known issues / notes
- None. All files clean.

### Review Round 1
- Verdict: Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)
