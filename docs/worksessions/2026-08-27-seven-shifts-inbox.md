# Hearth worksession — Native 7shifts Timesheet inbox

- **Status:** OPEN
- **Opened:** 2026-08-27 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor (chief implementer)
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/seven-shifts-inbox-5958`
- **Baseline SHA:** `93df0ec`
- **Head SHA:** (see git)
- **PR or issue:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/214
- **Risk:** High (provider token, coworker PII, work hours → wage drafts)
- **Decision owner:** Jonathan
- **Environment impact:** Development Worker + D1 table (unapplied until Jonathan orders). No Production. No hosted SQL. No secrets put by this packet.

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
- Focused tests + D-152 why-note.

### Out of scope

- Silent `postWorkShift` / webhook auto-post.
- Reading 7shifts `tips` or `hourly_wage` into the books.
- Minting household members from the roster.
- Hercules coworker dump or token in any model payload.
- OAuth partnership, Production flag, `wrangler secret put`, remote D1 apply, kitchen deploy.
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
- [x] Handoff + draft PR. Do not merge/deploy.

## Evidence log

- Focused 25 tests pass (`sevenshifts-*` + `work-jobs`).
- `pnpm check` on `8bd4ad0`: 892 passed / 2 skipped; production build green.
- Privacy / trust / books / verifier: PASS WITH NOTES.
- Two-phone same-digest merge is named, not fixed.

## Decisions

- Access token first, not OAuth.
- Auto-input means Timesheet drafts, not silent posting.
- Ignore 7shifts `tips` even when the API returns `0`.
- Reuse Development D1 `hearth-flinks-development` for the new table only; encryption keys stay separate.
- Coworker PII is session inbox + Jobs tab, not the household snapshot.
- Duplicate punch refuse is this-device until sync digest reconciliation.

## Remaining uncertainty

- Live token/company smoke needs Jonathan’s Harbour Developer Tools token after Worker secrets + D1 apply.
- Break object shapes besides `in`/`out`/`paid` may need a follow-up once a real punch is pulled.
- Webhooks (Time Punch Created) remain a later enqueue-only path.
- Two phones Confirm-before-sync can still double-post the same punch (merge by shift id).

## Handoff

Draft PR #214. Not merged, not deployed, not live verified. Next owner: Jonathan — secrets, D1 apply, enable flag, then deploy.
