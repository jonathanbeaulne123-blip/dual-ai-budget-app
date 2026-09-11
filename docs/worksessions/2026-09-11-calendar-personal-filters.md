# Hearth worksession — Personal Calendar and visibility

- Owner and decision owner: Jonathan
- Assignee: Codex
- Date: 2026-09-11, America/Toronto
- Branch: codex/calendar-personal-filters
- Baseline: 91a68ac144b182f89f4dab8646720596304c6f3f
- Risk: High — Personal projection and private planning
- Environment: Development
- Status: Verified locally; Development release in progress

## Household outcome
Personal Calendar can use accessible accounts for private plans and show the resulting scoped receipts. People can choose which categories and Google calendars appear in month, day and upcoming lists.

## Budget delta (5)
Keep personal plans and receipts private, shared posting boundaries intact, integer cents unchanged. Filters never mutate ledger rows or change budget totals, heat, due reminders or the planning board.

## Engagement delta (3)
Independent per-calendar controls and entry categories, preferences scoped to environment, household, member and view on this device. Same functional controls across all themes and widths.

## Findings and scope
The Home account projection removed Shared accounts that Personal plan commands legitimately accept. Dedicated Calendar projection retains scoped facts, accessible account references and private posted rows on Shared accounts. Partner Personal accounts stay excluded. Repeating templates remain Shared because private recurrence persistence is unsupported; the UI explains this and keeps personal accounts out of the repeating form. Native events and appointments retain their existing ownership rules. No schema, Google event writes, token changes, private recurrence migration or Home accounting changes.

## Evidence
Read-only investigation by personal_calendar_paths. Focused core and Google tests passed initially; quick gate, browser proof and release review pending. No real authenticated Google or physical-device proof; browser proof uses synthetic events only.

## Release and recovery
Earlier explicit push/merge/deploy authorization applies to this ongoing Development repair. No Production activation. Revert this client change and redeploy if a scope or Calendar regression appears. No data migration to undo.

- Quick gate passed 185 tests in 13 files, TypeScript and AI surface in 58.5 seconds. Focus: calendar-personal-filters, Google UI/reading, ledger-experience, potential-expenses, startup, month-rehearsal (plus mapped boundary tests). Full suite not requested.
- Vite build passed in 7.27 seconds with existing PGlite and bundle-size warnings.
- `node scripts/check-calendar-filters.mjs` passed 18 theme/scope/viewport layouts (320/390/1440), six Calendar accessibility scans, independent source toggling and keyboard Refresh. 42 mocked Google GETs, zero writes, zero browser errors. Evidence in `/tmp/hearth-calendar-filters/evidence.json`.
- Independent release review caught Personal goals remaining in the Shared repeating form. Restricted its goals and existing recurrence destinations to Shared. Added regression coverage and reran focused checks.
- Conditional release review: scoped tests/build/synthetic browser proof pass; real Google consent and physical-device acceptance remain unverified. Private recurring templates remain unsupported. Personal Home keeps its existing owned-account projection; this correction does not change Home totals for activity on Shared accounts.
