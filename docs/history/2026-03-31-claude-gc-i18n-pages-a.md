# Worklog: gc-i18n-pages-a — Extract strings from large pages (Group A)

**Branch:** feat/gc-i18n-pages-a
**Date:** 2026-03-31
**Agent:** claude-sonnet-4-6

---

## Session Log

### Start
- Read existing i18n infrastructure: `zh.ts`, `en.ts`, `context.tsx`, `index.ts`
- Read all 4 target pages to inventory all hardcoded Chinese strings
- Planned key structure additions to zh.ts/en.ts

### Approach
- `supervisor.*` — extend with ~50 new keys for all SupervisorPage strings
- `search.*` — extend with ~15 new keys for SearchPage strings
- `rankings.*` — NEW section with ~20 keys for RankingsPage
- `home.*` — extend with ~10 new keys for HomePage strings
- Each page component: replace `import { zh } from '@/i18n/zh'` with `import { useI18n } from '@/i18n'` + `const { t } = useI18n()`
- Module-level arrays using `zh.*` (USER_STATUS_TABS, DIMENSION_TABS) moved inside components

### Files modified
1. `frontend/src/i18n/zh.ts` — full rewrite with all new keys
2. `frontend/src/i18n/en.ts` — full rewrite matching new zh.ts shape
3. `frontend/src/pages/SupervisorPage.tsx` — full rewrite, all Chinese strings extracted
4. `frontend/src/pages/SearchPage.tsx` — full rewrite, all Chinese strings extracted
5. `frontend/src/pages/RankingsPage.tsx` — full rewrite, all Chinese strings extracted
6. `frontend/src/pages/HomePage.tsx` — full rewrite, all Chinese strings extracted

### Key decisions
- Dynamic strings with variables use template replace pattern: `t.supervisor.school_comparison.replace('{school}', ...)`
- Function-typed keys used for truly dynamic values: `t.rankings.page_info(page, totalPages, total)`
- `formatDate` kept with `'zh-CN'` locale (date formatting is a separate concern from string extraction — noted as known limitation)
- `USER_STATUS_TABS` and `DIMENSION_TABS` moved from module scope into component body to access `t` from `useI18n()`
- Sub-components (RatingCard, CommentCard, CombinedCard, PopupStarPicker) each get their own `const { t } = useI18n()` call
- `reply_separator` key added (`：` zh / `: ` en) for the colon in nested replies
- Disclaimer body identical in both supervisor and home pages — added to both sections independently

### Known limitations
- `formatDate` still uses `'zh-CN'` locale hardcoded (toLocaleDateString). Locale-aware date formatting is a follow-up task.
- `quote_prefix`/`quote_suffix` (chat initiation message) extracted but the chat message format may need further i18n work if the chat feature grows.

---

## Handoff

### What changed
- Added ~90 new keys across supervisor, search, rankings (new), home sections in zh.ts/en.ts
- All 4 pages now use `useI18n()` hook instead of directly importing `zh`
- All Chinese strings in these 4 pages are now translatable

### How to verify
1. `cd frontend && npm run build` — should compile with no TypeScript errors
2. Switch locale to English in the app (toggle button in nav) — all 4 pages should render in English
3. Switch back to Chinese — all should render in Chinese
4. Check SupervisorPage: supervisor profile, score popup, comments, edit form, replies all i18n'd
5. Check SearchPage: login gate CTA, search UI, results cards all i18n'd
6. Check RankingsPage: dimension tabs, sort buttons, login gate, pagination all i18n'd
7. Check HomePage: stat labels, attribution section, disclaimer all i18n'd

### Build status
- TypeScript: not verified (no build run in this session — environment constraint)
- Manual inspection: all types should match since en.ts mirrors zh.ts shape

### Integration notes
- Any new page or component that displays text should use `const { t } = useI18n()` from `@/i18n`
- DO NOT import `zh` directly in components — always go through the hook
- For dynamic strings: use `.replace('{key}', value)` pattern for template keys
- For counted strings: function-typed keys handle pluralization (en.ts has proper singular/plural)

### Review Round 1
- Verdict: Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)
