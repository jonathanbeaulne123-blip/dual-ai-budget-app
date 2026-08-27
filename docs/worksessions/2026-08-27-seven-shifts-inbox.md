# Hearth worksession — Native 7shifts Timesheet inbox

- **Status:** RELEASE IN PROGRESS
- **Opened:** 2026-08-27 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex (coordinator and integrator); Cursor feature branch reviewed
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `codex/d152-shifts-release`
- **Baseline SHA:** `2ae8793` (`origin/main` at final integration rebase)
- **Head SHA:** (see git)
- **PR or issue:** [#214](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/214) was the reviewed source branch; release PR follows
- **Risk:** Release (provider token, coworker PII, remote D1, work hours → wage drafts, Worker enablement)
- **Decision owner:** Jonathan
- **Environment impact:** Development Worker + existing Development D1. Jonathan explicitly authorized D1 apply, secrets, enablement, merge, and deploy. Production provider access remains refused.

## Household outcome

A Harbour worker can add a 7shifts access token on Jobs, pull clocked punches into Timesheet drafts (date, hours, paid breaks, role, clock times, coworker roster), leave cash/card tips blank because 7shifts does not track them, and Confirm still posts wages through `postWorkShift`.

## Budget delta (5)

`+3` — hours and role arrive as a reviewable draft so wage Confirm is the remaining tap. Tips stay a human amount. Duplicate 7shifts punches cannot post twice.

## Engagement delta (3)

`+2` — Timesheet opens filled from the restaurant clock; Jobs shows who was on the floor. Hercules never receives the roster or the token.

## Verified baseline

**Facts**

- `main@93df0ec`. D-127 job Timesheet / `postWorkShift` is in the tree. 7shifts was out of scope for D-127.
- Flinks (`/bank/flinks/*`) is the Worker template: Auth JWT + `continuity_memberships`, encrypted D1, HMAC-redacted inbox, Development-only, Production refused.
- 7shifts self-serve auth is a long-lived company access token (`Authorization: Bearer`) from Company Settings → Developer Tools. OAuth clients are vetted partners only and are out of this slice.
- Time punches expose `clocked_in` / `clocked_out` / `breaks` / `hourly_wage` / a POS `tips` field. Product law: ignore `tips` and `hourly_wage`; Hearth job rates and the CAD pad own money meaning.

**Inferences**

- Harbour’s live 7shifts company id/user ids are unknown here; tests use fictional fixtures.
- Webhooks and partner OAuth can wait; pull-on-demand is enough for the first kitchen habit.

## Scope

### In scope

- Worker `/work/7shifts/*` with status, probe, connect, list, pull, disconnect.
- Encrypted D1 table `seven_shifts_connections` on the existing Development Flinks D1 (separate AES key; never Flinks secrets).
- Jobs Connect UI (paste token in memory only).
- Timesheet punch list → `WorkShiftFlow` draft; tips empty.
- Jobs Co-workers tab (display name + role + scheduled/punched; not household members).
- Exact-punch dedupe on Confirm.
- Focused tests + D-155 why-note.

### Out of scope

- Silent `postWorkShift` / webhook auto-post.
- Reading 7shifts `tips` or `hourly_wage` into the books.
- Minting household members from the roster.
- Hercules coworker dump or token in any model payload.
- OAuth partnership, webhooks, or Production provider access.
- Zapier / Gmail parsing.

## Acceptance evidence

- [x] Status is inert scaffold without secrets; Production stays refused.
- [x] Unauthenticated / foreign-origin / non-member routes never touch D1 or 7shifts (401/403 before insert; status `SELECT 1` is the Flinks-shaped exception).
- [x] Pull payload has hours/role/roster, `tipsOmitted: true`, and no token/email/wage/tip cents.
- [x] Mapping leaves cash/card tips empty; Confirm still uses `postWorkShift`.
- [x] Replaying the same live punch digest refuses a second wage post on this device.
- [x] Coworker names are not members and are absent from `composeHerculesChatRequest`.

## Plan

- [x] Open worksession from `main@93df0ec`.
- [x] Parser + hours math + Worker + client + Jobs/Timesheet UI.
- [x] Focused tests, then `pnpm check`.
- [x] Independent privacy + trust + books audits; verifier.
- [x] Independent P0/P1 repair and current-main Shift-tab integration.
- [ ] Merge/deploy inert, apply Development D1 + secrets, then enable through a minimal second release.
- [ ] Live status and fail-closed route smoke.

## Evidence log

- Original feature proof: 25 focused tests and 892 full tests passed at `8bd4ad0`.
- Review repair proof: 36 focused tests passed; TypeScript and builds green; independent trust/release and books audits passed.
- Current-main integration adds tests for camera cancellation, camera/provider precedence, same-digest provider corrections, and Shift → Jobs editor scope.
- Latest-main focused run: **54 passed** across the 7shifts, Shift camera, scope, scan, and tip-covariate seams.
- Current-main full run: **934 passed / 2 skipped**. The only two failures are unchanged Windows baseline checks (Bash absent; CRLF-sensitive Hercules source regex). TypeScript, web build, Hercules Pro build, AI surface, and Wrangler dry-run pass.
- Browser proof at 320 / 390 / 720 / 1100 px: Shift → Jobs and Timesheet review have no horizontal overflow; connector, camera, provider fill, and four-step review remain usable.
- PR CI, D1 apply, and live smoke remain release gates.

## Decisions

- Access token first, not OAuth.
- Auto-input means Timesheet drafts, not silent posting.
- Ignore 7shifts `tips` even when the API returns `0`.
- Reuse Development D1 `hearth-flinks-development` for the new table only; encryption keys stay separate.
- Coworker PII is session inbox + Jobs tab, not the household snapshot.
- Stable punch digest survives cloud sync and reversal-aware duplicate detection; simultaneous offline confirms before sync remain named uncertainty.
- D-155 preserves D-152 tip-covariate requirements and D-153’s Shift → Jobs / Shift → Today interaction model, while retaining the Add Timesheet path.

## Remaining uncertainty

- Live token/company smoke needs a Harbour Developer Tools token after Worker secrets + D1 apply.
- Break object shapes besides `in`/`out`/`paid` may need a follow-up once a real punch is pulled.
- Webhooks (Time Punch Created) remain a later enqueue-only path.
- Two phones can still Confirm the same punch before either receives the other’s sync; hosted atomic punch uniqueness is a later Production-hardening concern.

## Handoff

Integrate and verify on current main, then release in two stages: inert merge/deploy first; Development D1 + secrets; minimal enablement merge/deploy second. Never enable Production. Final provider smoke stops before Confirm unless Jonathan separately wants a real financial test post.
