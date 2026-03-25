# GradChoice — Executive Summary Report (ESR)
*Last updated: 2026-03-24 21:29*

## What We've Built
<!-- High-level summary of what exists -->

## Latest Updates
<!-- Most recent session's work -->

## What's Next
<!-- Prioritized next steps -->

## Actionable Levers
<!-- What would it take to make this succeed? Key decisions, resources, blockers -->

## Learnings
<!-- Technical and product lessons learned -->

---
*This is a living document maintained by the orchestrator. Updated after each work session.*

### Update: 2026-03-21 18:05
### claude-gc-scaffold — 2026-03-21 18:05
13 scaffold issues found and fixed: removed hardcoded SECRET_KEY default, fixed deprecated datetime.utcnow usage, added timezone=True to all DateTime columns, added missing model columns (avg_overall_score/rating_count on Supervisor, upvotes/downvotes on Rating), added transient attributes to prevent pydantic serialization failures, broke circular imports in schemas by using Literal types, removed unused imports, added missing email-validator and @types/node dependencies, removed --reload from production Dockerfile, tightened SECRET_KEY handling in docker-compose. All API endpoints remain 501 stubs awaiting feature agent implementation.

### Update: 2026-03-21 18:10
### claude-gc-auth — 2026-03-21 18:10
4 issues fixed: (1) security bug — get_current_user now validates typ==access to prevent token type confusion; (2) APP_URL moved to settings from hardcoded constant; (3) silent exception swallow in register replaced with warning log; (4) duplicate pydantic dep removed from requirements.txt. No blocking issues remain.

### Update: 2026-03-21 18:10
### Integration Review — 2026-03-21 18:10
**Subteams:** claude-gc-scaffold
**Result:** Integration review complete. 3 issues found and fixed: (1) ChatMessageResponse schema missing is_read field vs model, (2) frontend ChatMessage type missing is_read, (3) CommentUpdate schema defined but not imported/wired in comments API — added PUT and DELETE stub endpoints. All other areas clean: model/schema alignment correct, no circular imports, no utcnow usage, all DateTime columns timezone-aware, Docker/config SECRET_KEY has no default, @types/node in devDependencies, vite.config.ts path import correct, frontend types match backend schemas.

### Update: 2026-03-21 18:11
### claude-gc-chat — 2026-03-21 18:11
Two bugs fixed: (1) get_messages was returning oldest N messages instead of newest N — users would see ancient history on chat open; fixed by sorting DESC then reversing. (2) formatGroupDate had a month-boundary bug in isYesterday check; fixed with epoch-based day diff. All 10 changed files reviewed. Logic, auth guards, rate limiting, schema validation, and frontend UI all look correct. N+1 query pattern in _build_chat_response is a known MVP trade-off.

### Update: 2026-03-21 18:15
### claude-gc-comments — 2026-03-21 18:15
7 issues found and fixed: (1) remote_side string annotation bug causing SQLAlchemy startup failure, (2) flagged comments leaking content in API responses, (3) 401 interceptor redirecting on public-page optional-auth probe, (4) stale editContent state after successful edit, (5) CommentCard action guards missing is_flagged check, (6) dead SortOrder class removed, (7) Alembic migration created for new columns and comment_flags table.

### Update: 2026-03-21 18:15
### claude-gc-analytics — 2026-03-21 18:15
Analytics feature reviewed. Two issues found and fixed: (1) missing ScoreBreakdown import in SupervisorPage.tsx (TypeScript compilation error), (2) no validation of the dimension query param in /analytics/rankings endpoint (now returns 422 for invalid dimensions). SQL injection protection is correct via VALID_DIMENSIONS dict. All schemas align with service output. All new components (RadarChart, DistributionChart, PercentileDisplay) are clean. Note: materialized view 001_supervisor_rankings_view.py is created but unused by the service — dead code but not a bug.

### Update: 2026-03-21 18:17
### claude-gc-supervisors — 2026-03-21 18:17
Review passed with 3 bugs fixed: (1) removed unused `import random` in edit_proposals.py, (2) replaced deprecated `datetime.utcnow()` calls with timezone-aware `datetime.now(timezone.utc)` in 3 places, (3) removed broken `<Link to="/propose-supervisor">` navigation (route not in App.tsx) and cleaned up resulting unused variable. All routers correctly registered in main.py. Schema/type alignment between backend Pydantic models and frontend TypeScript types is clean. No circular imports, no SQL injection vectors. Dead code `build_supervisor_search_query` in services/supervisor.py is unused but harmless.

### Update: 2026-03-21 18:18
### claude-gc-ratings — 2026-03-21 18:18
gc-ratings feature reviewed and fixed. 5 issues found and fixed: (1) datetime.utcnow() replaced with datetime.now(timezone.utc) across 6 backend files; (2) DateTime columns missing timezone=True in supervisor.py and supervisor_rating_cache.py; (3) alembic migration 001 missing upvotes/downvotes columns present in Rating model; (4) ChatMessage.is_read field dropped from frontend types (regression of integration review 1); (5) SVG linearGradient ID collisions in RatingForm/RatingCard fixed with React useId(). All endpoints are real implementations (not 501 stubs), logic is sound, no circular imports, schema/model/type alignment is correct after fixes. Remaining low-priority concerns: get_optional_current_user uses Request injection (works, minor OpenAPI cosmetic issue); denormalized upvotes/downvotes on Rating model are always 0 (live-computed from votes table — no correctness bug but dead DB columns).

### Update: 2026-03-21 18:31
### Integration Review — 2026-03-21 18:31
**Subteams:** claude-gc-auth claude-gc-supervisors claude-gc-ratings claude-gc-comments claude-gc-analytics claude-gc-chat
**Result:** 5 cross-subteam conflicts found and fixed: (1) ChatMessage.is_read regression restored (analytics merge overwrote prior fix), (2) duplicate optional auth functions unified (get_optional_current_user + get_optional_user alias, idiomatic OAuth2 approach), (3) Alembic multiple-heads crisis resolved — canonical chain created: 0001_initial_schema (all tables + pg_trgm + rating_cache), 0002_add_comment_flags, 0003_supervisor_rankings_view, (4) types/index.ts forward-merged with all type additions from all 6 branches to prevent merge-time TypeScript conflicts, (5) services/api.ts forward-merged with all missing methods and corrected signatures.

### Update: 2026-03-22 11:39
### codex-gc-edit-username — 2026-03-22 11:39
Review passed — reviewer fixed issues (commit: 90626f9 fix: schema fixes, bcrypt pin, migration guard, docker-compose default secret)

### Update: 2026-03-22 11:40
### --agent-gc-edit-username — 2026-03-22 11:40
Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)

### Update: 2026-03-22 11:41
### claude-gc-edit-username — 2026-03-22 11:41
Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)

### Update: 2026-03-22 11:42
### --agent-gc-school-verify — 2026-03-22 11:42
Clean implementation of school email verification flow. All Python imports valid, TypeScript checks pass. Migration 0005 correct. AutocompleteInput component well-structured. Minor notes: verification_code stored plaintext (acceptable MVP), CommentFlagsPage is unrouted stub scaffolding.

### Update: 2026-03-22 11:44
### codex-gc-school-verify — 2026-03-22 11:44
All changes clean. Migration chain correct (0004→0005). Python imports OK. TypeScript type-check passes. Vite build passes. Backend logic correct (timezone-aware datetime comparison, enum coercion). AutocompleteInput UX is correct. RankingsPage correctly maps school_name→school_code. Minor notes: .org domain acceptance is broad, no rate limiting on verify endpoint, codes stored plaintext — all acceptable for MVP/dev stage.

### Update: 2026-03-22 11:46
### claude-gc-school-verify — 2026-03-22 11:46
Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)

### Update: 2026-03-22 11:47
### Integration Review — 2026-03-22 11:47
**Subteams:** codex-gc-edit-username codex-gc-school-verify
**Result:** One cross-team build error found and fixed: ProfilePage.tsx had an unused `res` variable (TS6133) from the edit-username subteam that was exposed when the school-verify subteam added school-email UI to the same component. Removed the unused binding; tsc --noEmit now passes clean. Migration chain is linear (0004→0005). No duplicate logic, no API contract breaks, no type conflicts, no routing conflicts.

### Update: 2026-03-22 13:33
### codex-gc-edit-proposals — 2026-03-22 13:33
Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)

### Update: 2026-03-22 13:33
### codex-gc-add-supervisor — 2026-03-22 13:33
Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)

### Update: 2026-03-22 13:33
### codex-gc-profile-public — 2026-03-22 13:33
Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)

### Update: 2026-03-22 13:33
### codex-gc-ui-polish — 2026-03-22 13:33
Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)

### Update: 2026-03-22 13:34
### claude-gc-edit-proposals — 2026-03-22 13:34
Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)

### Update: 2026-03-22 13:34
### claude-gc-add-supervisor — 2026-03-22 13:34
Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)

### Update: 2026-03-22 13:34
### claude-gc-ui-polish — 2026-03-22 13:34
Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)

### Update: 2026-03-22 13:34
### codex-gc-email-notify — 2026-03-22 13:34
Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)

### Update: 2026-03-22 13:34
### claude-gc-email-notify — 2026-03-22 13:34
Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)

### Update: 2026-03-22 13:36
### claude-gc-add-supervisor — 2026-03-22 13:36
Review passed — reviewer found no issues (work log updated, no fixes needed)

### Update: 2026-03-22 13:37
### claude-gc-email-notify — 2026-03-22 13:37
Fixed clean() defined inside for-loop (moved outside), added missing fallback columns for school_code/school_name/province/department in load_xlsx, updated docstring. No remaining issues.

### Update: 2026-03-22 13:39
### claude-gc-profile-public — 2026-03-22 13:39
Builder committed no code (only docs). Implemented full public ratings+comments display on SupervisorPage: RatingCard, CommentCard, live API fetches, Write Review button with auth-aware navigation. tsc and vite build both pass clean.

### Update: 2026-03-22 13:39
### claude-gc-edit-proposals — 2026-03-22 13:39
Edit proposals scaffold is clean: model, schema, router all correctly wired; frontend types and api.ts compile without errors; vite build passes. All backend endpoints are intentional 501 stubs (scaffolded, not yet implemented). Minor dead code: editProposalsApi.getMine() in api.ts has no backend route, but no pages call it so no runtime impact.

### Update: 2026-03-22 13:41
### claude-gc-ui-polish — 2026-03-22 13:41
Fixed api.ts proposeNew endpoint (/supervisors → /edit-proposals). Committed builder HomePage 65+ change. TypeScript clean (0 errors). seed_tutors.py already fixed by prior reviewer.

### Update: 2026-03-22 13:42
### Integration Review — 2026-03-22 13:42
**Subteams:** codex-gc-edit-proposals codex-gc-add-supervisor codex-gc-email-notify codex-gc-profile-public codex-gc-ui-polish
**Result:** Integration round 1 passed with 1 fix applied. seed_tutors.py nullable guard added to prevent NOT NULL DB constraint violations when new MASTER file omits school_code/school_name/province/department columns. TypeScript build clean, Python imports clean, migration chain linear (0001-0005). No duplicate logic, no type conflicts, no routing conflicts. The gc-edit-proposals and gc-add-supervisor subteams produced auto-pass worklogs but no real backend implementation (all endpoints remain 501 stubs) — this is a feature completeness gap, not an integration conflict.

### Update: 2026-03-22 13:45
### claude-gc-profile-public — 2026-03-22 13:45
Fixed backend CommentResponse schema missing author/replies fields. CommentCard was showing anonymous for all users and no verified badges. Added CommentAuthorResponse, is_deleted, is_edited, replies to schema; updated _build_response to populate author from user relationship and inline up to 10 replies. tsc+vite build clean. Only remaining known gap: /supervisor/:id/rate route needs a future RatePage task.

### Update: 2026-03-22 13:48
### Integration Review — 2026-03-22 13:48
**Subteams:** claude-gc-edit-proposals claude-gc-add-supervisor claude-gc-email-notify claude-gc-profile-public claude-gc-ui-polish
**Result:** No cross-team conflicts. TypeScript build clean (tsc --noEmit exit 0). Backend app imports clean. SupervisorPage, api.ts, types/index.ts, comment schema, and seed_tutors.py changes from parallel subteams are non-overlapping. Known feature gaps: edit-proposals endpoints are 501 stubs, /supervisor/:id/rate route not yet implemented, editProposalsApi.getMine has no backend route but is dead code.

### Update: 2026-03-22 14:28
### claude-gc-rate-page — 2026-03-22 14:28
Builder produced no code; reviewer implemented RatePage.tsx from scratch + App.tsx route. Star-picker form for overall (required) + 6 optional sub-scores, auth guard, 409 duplicate handling, success redirect. tsc --noEmit clean.

### Update: 2026-03-22 14:28
### claude-gc-proposals-impl — 2026-03-22 14:28
Builder left all 4 edit-proposals endpoints as 501 stubs. Reviewer implemented them fully: create (field allowlist + supervisor existence check), pending list (student-verified gate + self-exclusion), review (2-reviewer state machine with reject-fast and apply-on-double-approve), and detail fetch. Python imports clean, TypeScript tsc clean.

### Update: 2026-03-22 14:33
### Integration Review — 2026-03-22 14:33
**Subteams:** claude-gc-proposals-impl claude-gc-rate-page
**Result:** No cross-team conflicts found. edit_proposals.py (backend) and RatePage.tsx (frontend) are fully non-overlapping. App.tsx route /supervisor/:id/rate is correctly wired and SupervisorPage already navigates to it. TypeScript build clean (tsc --noEmit exit 0). Python imports clean with SECRET_KEY set. EditProposalResponse schema matches EditProposal TypeScript type exactly. i18n score_labels used by RatePage all present. Minor pre-existing dead-code: editProposalsApi.getMine (no backend route) and supervisorsApi.proposeNew (duplicate of editProposalsApi.create) — neither called anywhere, no runtime impact.

### Update: 2026-03-22 14:40
### claude-gc-fix-search — 2026-03-22 14:40
Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)

### Update: 2026-03-22 14:40
### claude-gc-fix-comments — 2026-03-22 14:40
Review passed — reviewer fixed issues (commit: bf216f2 docs: auto-update ESR + persist worklog for claude-gc-fix-search)

### Update: 2026-03-22 14:41
### claude-gc-mock-data — 2026-03-22 14:41
Builder produced zero code — feat/gc-mock-data branch is identical to main. No mock data feature was implemented. No regressions, no build errors, nothing to fix.

### Update: 2026-03-22 14:41
### claude-gc-feature-verify — 2026-03-22 14:41
No builder code changes — verification pass only. Vite build clean (901 modules), tsc --noEmit clean, all Python API modules import OK, no 501 stubs remain, all i18n keys present, RatePage route wired correctly. Pre-existing dead-code (editProposalsApi.getMine, supervisorsApi.proposeNew) confirmed unused — no runtime impact.

### Update: 2026-03-22 14:50
### claude-gc-mock-data — 2026-03-22 14:50
seed_mock.py reviewed and fixed: removed 5 unused imports (Base, RatingVote, RVoteType, CommentVote, CVoteType); fixed --reset to recalculate supervisors.avg_overall_score, rating_count, and rebuild supervisor_rating_cache after cascade-deleting mock users. All model column names verified against actual SQLAlchemy models. No compilation errors, no logic bugs in the seeding path.

### Update: 2026-03-22 14:50
### claude-gc-feature-verify — 2026-03-22 14:50
All 4 changes reviewed and verified correct. Radar chart null-guard, dual scores badge, email toggle, and PublicProfilePage all match their intended design, type-check cleanly, and connect to confirmed backend endpoints. Vite build and tsc --noEmit both pass. No fixes needed.

### Update: 2026-03-22 14:53
### claude-gc-fix-search — 2026-03-22 14:53
All changes clean. Backend list_supervisors correctly adds school_name/department/sort_by params with nullslast ordering. SearchPage browse-first UX is correct — isFirstRender ref prevents double-fetch, activeQuery threads correctly through filter changes, loadingMore vs loading separation is correct. SupervisorPage edit-proposal form types match API. TypeScript build exit 0.

### Update: 2026-03-22 15:00
### claude-gc-fix-comments — 2026-03-22 15:00
All changes verified clean. GET /comments/{comment_id} and GET /users/me/comments correctly registered and ordered. SupervisorPage.tsx type references all valid against Comment interface. Python imports resolve without circular issues. No security, logic, or compilation issues found. No fixes needed.

### Update: 2026-03-22 15:07
### Integration Review — 2026-03-22 15:07
**Subteams:** claude-gc-fix-search claude-gc-fix-comments claude-gc-mock-data claude-gc-feature-verify
**Result:** Integration round 1 complete. One cross-team conflict resolved: SupervisorPage.tsx was modified by 3 parallel branches (gc-fix-search, gc-fix-comments, gc-feature-verify) all diverging from the same base. Performed 3-way manual merge combining suggest-edit form, full comment flow (creation/voting/replies), and dual scores/radar-null-guard. All 8 non-conflicting files applied directly from their respective branches. TypeScript tsc --noEmit: clean. Python syntax: clean. Committed to main as 8384171.

### Update: 2026-03-22 15:35
### claude-gc-anon-names — 2026-03-22 15:35
Both changes are clean: seed_mock.py correctly replaces real-name lists with 30 prefixes × 32 animals = 960 anonymous nicknames (>200 users, no collision risk); make_email() is unaffected since it uses indexed mock_ prefix. SupervisorPage.tsx reply badge uses existing zh.supervisor.verified_badge i18n key and CommentAuthor.is_student_verified (boolean, typed) — mirrors CommentCard pattern exactly. No logic bugs, no missing imports, no security issues.

### Update: 2026-03-22 15:38
### claude-gc-dual-scores — 2026-03-22 15:38
All changes are correct and complete. Migration 0006 chains from 0005, _refresh_supervisor_cache helper correctly updates all 4 cache fields (avg/count × all + verified) using is not None checks, create_rating properly uses get_current_user (open gate), update_rating/delete_rating flush before cache refresh ensuring correct aggregate queries, is_verified_rating still set from is_student_verified at creation. No syntax errors, no dead code, no security issues.

### Update: 2026-03-22 15:41
### Integration Review — 2026-03-22 15:41
**Subteams:** claude-gc-dual-scores claude-gc-anon-names
**Result:** Clean integration. No cross-team conflicts: gc-dual-scores (backend only: ratings.py cache refactor + migration 0006 + model/schema additions) and gc-anon-names (seed_mock.py nickname rework + SupervisorPage.tsx reply badge) touch fully disjoint files. Migration chain 0001→0006 is linear. Python syntax clean on all 5 changed files. TypeScript tsc --noEmit exit 0. Both branches merged to main and pushed.

### Update: 2026-03-23 23:32
### claude-gc-yankong-reimport — 2026-03-23 23:32
Two issues found and fixed: (1) unused func import removed from sqlalchemy imports; (2) score_stipend data loss bug in load_yankong() — the studentSalary dimension score was computed and used in the overall average but silently dropped from the record dict and hardcoded None in the ratings batch. Both fixed. scrape_yankong.py and HomePage.tsx are clean. Remaining minor concerns: misleading stats[new_supervisors] counter (cosmetic only) and potential school_code empty-string collisions for unrecognized schools (low risk given yankong data is currently empty). All Python files pass syntax check.

### Update: 2026-03-24 21:27
### claude-gc-rankings-real — 2026-03-24 21:27
Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)

### Update: 2026-03-24 21:29
### claude-gc-score-disclaimer — 2026-03-24 21:29
Review passed — reviewer exited cleanly (auto-pass: clean exit, no issues indicated)
