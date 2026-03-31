# Work Log — gc-i18n-core

## What Changed

### New Files
- `frontend/src/i18n/en.ts` — Full English translations matching all ~120 keys from zh.ts
- `frontend/src/i18n/context.tsx` — React context + provider with `useI18n()` hook (locale persisted to localStorage)
- `frontend/src/i18n/index.ts` — Barrel re-export of all i18n modules and types

### Modified Files
- `frontend/src/i18n/zh.ts` — Added `nav.brand`, `nav.brand_sub`, `footer.tagline`, `footer.about` keys; renamed `ZhKeys` → `Translations` type export
- `frontend/src/App.tsx` — Wrapped app with `<I18nProvider>`
- `frontend/src/components/Layout.tsx` — Replaced all `zh.*` references with `t.*` from `useI18n()` hook; added globe toggle button (desktop: SVG globe icon + label in nav bar; mobile: text label button left of hamburger)

## How to Verify
1. `cd frontend && npm install && npx tsc --noEmit` — should pass with 0 errors
2. `npx vite build` — should succeed
3. Run dev server, check:
   - Default language is Chinese (zh)
   - Click globe/language toggle → switches to English
   - Refresh page → locale persists (stored in localStorage key `locale`)
   - All nav links, footer text, logo update with locale
4. Other pages (HomePage, SearchPage, etc.) still use `zh` directly — they will be converted by other agents

## Known Issues
- Other pages still import `zh` directly and are NOT converted — this is intentional per task spec
- The chunk size warning (>500kB) is pre-existing, not caused by i18n changes

## Integration Notes
- Other page agents should use `useI18n()` hook and reference `t.*` instead of importing `zh` directly
- New translation keys should be added to BOTH `zh.ts` and `en.ts`
- The `Translations` type ensures type safety — `en.ts` is typed as `Translations` so missing keys cause compile errors
- Functions like `search.result_count` and `supervisor.rating_count` are typed via the `Translations` type inference

## Decisions Made
- `t` is the full translation object (not a function) — components use `t.nav.home` style access
- Default locale is `'zh'` with fallback if localStorage is unavailable
- Brand name: zh shows "研选 GradChoice", en shows just "GradChoice" (brand_sub is empty string, conditionally rendered)
- Globe toggle: desktop uses SVG globe icon + locale label; mobile uses compact text-only button to save space
- Type renamed from `ZhKeys` to `Translations` for clarity

## Build Status
- TypeScript: PASS (0 errors)
- Vite build: PASS (20s, 734kB JS bundle)

### Review Round 1
- Verdict: Review passed — reviewer fixed issues (commit: 12942d8 fix: update hero stat to 400+ 覆盖院校 (includes international HEIs))
