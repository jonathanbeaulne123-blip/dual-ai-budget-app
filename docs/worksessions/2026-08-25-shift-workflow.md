# Hearth worksession — Shift workflow rebuild

- **Status:** PLAYTEST-READY — PR #100 open; small polish is batched after real use; review deferred to the comprehensive pre-September audit
- **Opened:** 2026-08-25 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/shift-workflow`
- **Baseline SHA:** `6c48f64`
- **Head SHA:** `d1568d8` plus the final Slice 4 closeout commit on this branch
- **PR:** [#100](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/100) — CI and Cloudflare preview green; merge/deploy not yet authorized
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none; local code and synthetic fixtures only

## Household outcome

A worker can configure each job once, run the Timesheet as the primary daily action on phone or desktop, confirm a finished shift through a guided CAD-pad flow, correct it through Shifts Worked, and see separate earned/received/payday/tip-payout facts on Calendar. Work is locally durable while offline and enters the existing cloud snapshot/outbox after ordinary command acceptance; no peer device is the host.

## Budget delta (5)

`+4` target — one effective-dated job configuration drives wages, paid breaks, tips, tip-outs, sales reporting, owed balances, and settlement prompts; the same deterministic calculation must power preview and posting.

## Engagement delta (3)

`+2` target — Timesheet becomes the primary compact daily act on phone and a reviewable work instrument on desktop; Hercules streaks continue to read confirmed shifts only.

## Verified baseline

Facts:

- `main` and this branch baseline are `6c48f64`; no PR exists for this branch.
- Existing D-028 shift math is one global `ShiftSettings` record and `postShift` writes one wages income plus one tips income.
- Existing D-062/D-068 clock-in stores one shared `kitchen.openShift`; sign-out and finished-shift flows live inside the general Add surface.
- D-079 requires separate mobile and desktop UX decisions with one shared command/kernel.
- The working tree contains an uncommitted dated-global-settings experiment. It is not shipped and is superseded by Jonathan's job-based design.

Inferences to prove:

- Existing snapshot migration helpers can safely default new job/work records for legacy households.
- Existing outbox transport can carry the expanded snapshot without schema changes because hosted continuity transports JSON envelopes.

## Scope

### In scope

- Slice 1: Add/Edit Job, roles, effective-dated pay rules, paid breaks, overtime, tip/tip-out configuration, sales categories, schedules, destinations, location, and remembered defaults.
- Slice 2: primary offline-first Timesheet, one open shift per worker, breaks, compact/expanded widget, scheduled-shift start, and conflicting-device-safe snapshot representation.
- Slice 3: guided confirmation, Add Shift fallback, deterministic calculation/posting, Shifts Worked, duplicate confidence, and correction/reversal flow.
- Slice 4: individual Calendar shift/pay/tip/deferred items, owed projections, settlement prompts, responsive/mobile-desktop polish, reports/export-ready projections, and focused accessibility proof.
- Living decision, architecture, roadmap, and tests required by changed behavior.

### Out of scope

- Hosted schema application, Production, deployment, secrets, destructive hosted cleanup, migration 006, Google provider configuration, push notifications, 7shifts/Google Calendar OAuth implementation, binary photo hosting, payroll filing, bank feeds, or external money movement.
- Silent edit/delete of posted journal facts; a user-facing replacement remains reversal/repost underneath.

## Acceptance evidence

- [x] Effective-dated job rules preserve historical confirmed shift math.
- [x] Preview and posting use the same pure calculation and settings fingerprint.
- [x] Clock, break, and unfinished confirmation data survives snapshot shaping and offline save.
- [x] Personal/shared component destinations do not leak or double-count.
- [x] Calendar distinguishes expected/owed from received money and never posts automatically.
- [x] Desktop (`>=720px`) and phone (`<720px`) retain distinct layouts with the same financial summary and Confirm boundary.
- [x] Focused shift tests, serial full suite, AI verification, TypeScript, and production build pass. Default four-worker `pnpm check` exposed pre-existing PGlite/WASM five-second timeout sensitivity; identical assertions pass with one worker.
- [x] Jonathan explicitly deferred slice-level review; D-127 is queued for the comprehensive review immediately before September.

## Plan

- [x] Slice 1 — job configuration and calculation foundation.
- [x] Slice 2 — live Timesheet and durable open-shift state.
- [x] Slice 3 — confirmation, fallback entry, history, and corrections.
- [x] Slice 4 — Calendar settlements, projections, responsive polish, and documentation.

## Evidence log

- 2026-08-25: baseline `6c48f64`; branch `codex/shift-income-settings`; modified local shift/settings files recorded by `git status --short --branch`.
- 2026-08-25: Slice 1 committed locally as `7f91030`; Add/Edit Job, effective-dated calculation, job receivables, sync/hash support, and focused tests passed (`13` tests, TypeScript, build).
- 2026-08-25: Slice 2 makes open shifts member-keyed and mergeable by punch identity, adds paid/unpaid breaks and a no-money clock-out review state, and adapts the existing warm desktop/mobile Timesheet surfaces. Focused proof: `23` tests passed; TypeScript and build passed.
- 2026-08-25: Slice 3 adds the shared job calculation/posting boundary, separate Wages owed/Card tips owed/cash-tip/paid-break/tip-out rows, four-step CAD-pad confirmation, a five-row expandable Shifts worked card, and reversal-backed correction. Browser proof used a disposable Development ledger at `390px` and `1180px`; a confirmed `8.00 h + 0.30 paid break` shift produced `$149.40` gross, `$124.50` expected take-home, `$150.00` gross tips, `$145.00` tips after tip-out, clean Health, and no horizontal overflow. Focused job/shift/sync proof passed; TypeScript and build passed. A parallel PGlite run exceeded one test's 5-second limit under browser load; the same demo-equation test passed alone in `452ms` after browser shutdown.
- 2026-08-25: Slice 4 adds scheduled wages/card-tip/deferred Calendar facts, partial settlement sheets, receivable-to-cash transfers without duplicate income, deferred tip-out payment allocation, member-facing device-timeline choice, current-shift reporting and CSV export, and D-127 canon. Corrected shifts remain in history but no longer inflate overtime, Calendar, obligations, or reports.
- 2026-08-25: Browser proof at `390px` and `1180px`: two due work Confirm buttons appeared; the paycheck sheet named the `$124.50` Wages owed transfer, offered valid landing accounts, and had no horizontal overflow; Work report showed `8.00 h`, `$149.40` gross wages, `$124.50` expected take-home, `$150.00` gross tips, `$5.00` tip-outs, `$145.00` after tip-outs, and a three-column wide layout.
- 2026-08-25: verification: `61` files / `441` tests passed serially (`--maxWorkers=1 --testTimeout=15000`), `pnpm ai:verify` passed, `tsc --noEmit` passed, production build passed, and `git diff --check` passed. The ordinary four-worker full run hit unrelated existing PGlite/demo/scale time limits; each timed-out file passed serially, with no assertion failure.

## Decisions

- Jonathan approved the mockup direction and delegated remaining edge-case decisions to Codex.
- Timesheet is primary; Add Shift is a failsafe.
- Job configuration is the single source for remembered defaults and shift calculation rules.
- Confirmed corrections appear as replacement shifts to the user but preserve balanced reversal/repost evidence underneath.
- No separate D-127 review is required now; include it in the single comprehensive review immediately before September.
- Jonathan likes the current direction; record small tweaks during playtesting and apply them as one coherent polish batch later.

## Remaining uncertainty

- Exact attachment storage and external schedule provider APIs remain gated and are excluded from these slices.
- Attachments, external schedules, system notifications, and direct Google Sheets upload remain future integrations. CSV export is ready for Google Sheets now.
- The default concurrent suite remains sensitive to parallel PGlite/WASM startup on this desktop; serial proof is clean. This is test-runtime debt, not a changed household result.

## Handoff

PR #100 is pushed, conflict-free, and green. It is intentionally unmerged because merging `main` triggers the live deployment and still needs explicit deployment authorization. Continue useful Development work without a separate D-127 review; batch playtest polish later and include these money changes in the comprehensive review immediately before September.
