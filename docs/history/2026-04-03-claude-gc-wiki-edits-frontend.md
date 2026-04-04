# Work Log — gc-wiki-edits-frontend

**Branch:** feat/gc-wiki-edits-frontend
**Date:** 2026-04-03
**PR:** https://github.com/linkbag/GradChoice/pull/71

## Changes Made

### New Files
- `frontend/src/components/EditHistoryPanel.tsx` — Collapsible edit history panel

### Modified Files
- `frontend/src/types/index.ts` — Added `EditHistoryItem` and `EditHistoryResponse` interfaces
- `frontend/src/services/api.ts` — Added `editProposalsApi.editHistory()` + imported new types
- `frontend/src/i18n/zh.ts` — Added: edit_info, edit_hint_instant, edit_field_name/dept, edit_info_submit, edit_saved, edit_login_prompt, edit_history, edit_history_system
- `frontend/src/i18n/en.ts` — Same keys in English
- `frontend/src/pages/SupervisorPage.tsx` — Integrated EditHistoryPanel, updated edit form

## Key Decisions
- Used `refreshKey` prop pattern to trigger EditHistoryPanel re-fetch after edits
- Edit button always visible; non-logged-in users get redirected to /login
- Relative time implemented inline (no date library dependency)
- Field label mapping bilingual (zh/en) inside EditHistoryPanel
- Success message changed from `edit_success` to `edit_saved` (instant UX)
- After save: refreshes supervisor data via `supervisorsApi.get(id)`

## Build Status
- `tsc --noEmit`: ✅ no errors
- `vite build`: ✅ passed (26s, 780KB bundle)

## How to Verify
1. Open supervisor detail page → "编辑信息" button in discussion header
2. Not logged in → redirects to /login
3. Logged in → inline form with 7 fields (name, dept, title, unit, 3 URLs)
4. Submit → "修改已保存", panel count badge increments
5. Expand "📝 信息编辑历史" → diff entries with relative timestamps
6. System-imported entry → shows "系统初始数据"

## Integration Notes
- Backend endpoint: `GET /edit-proposals/supervisor/{supervisor_id}/history`
- Response type: `{ items: EditHistoryItem[], total, page, page_size }`
- `previous_data: null` = system initial record
- `skipAuthRedirect: true` on history endpoint (public-readable)

### Review Round 1
- Verdict: Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)
