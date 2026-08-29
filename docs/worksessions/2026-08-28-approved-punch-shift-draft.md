# Hearth worksession — approved punch Shift draft

- **Status:** RELEASED — pushed and kitchen live
- **Opened:** 2026-08-28 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/d171-approved-punch-shift-draft`
- **Baseline SHA:** `57c5537ee676c3c80c1d94340eb0662e34e462c1`
- **Head SHA:** working tree
- **PR or issue:** none
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** code only; no hosted schema, secret, provider call, or household-data mutation

## Household outcome

An approved employee-visible 7shifts punch can become an editable Shift draft with its date, clock window, and worked hours prefilled. Missing breaks, sales, and tip fields remain visibly blank; a person must enter an explicit zero when zero is true. The ordinary four-step review and visible **Confirm shift** remain the only writer.

## Dual Course

- **Budget delta (5):** `+3` — removes retyping from authoritative worked time without converting missing breaks or money into zero.
- **Engagement delta (3):** `+2` — one button moves a reviewed punch into the familiar Shift flow.

## Verified baseline

- `origin/main@d87e2dee28113542ae07005f3907cb425566f6f9` remained the merge base for D-169/D-170.
- Reviewed D-169/D-170 commit `57c5537ee676c3c80c1d94340eb0662e34e462c1` was pushed to `codex/d169-visible-schedule-capture`.
- Exact release deployed as Worker version `f4876180-0819-4972-aab0-c99d269d007d`; the kitchen returned HTTP 200.
- This slice starts from that exact commit on a new clean branch.

## Scope

### In scope

- Deterministically select only approved/final, clear worked-punch observations for a draft.
- Prefill date, start, end, and worked hours; prefill paid-break hours only when explicitly observed, including an explicit zero.
- Keep tips, sales, covers, and staffing blank.
- Parse bounded visible break labels without inventing paid/unpaid meaning.
- Require explicit paid-break, required-sales, cash-tip, and card-tip values at the visible review and command boundaries; zero remains allowed.
- Focused UI, extraction, command, TypeScript, repository, and diff proof.

### Out of scope

- Automatic posting, policy activation, provider calls, raw evidence disclosure, new schema, secret changes, Production data changes, push, merge, or deployment of this new slice.

## Acceptance evidence

- [x] “Use as Shift draft” appears only for a clear approved/final worked punch.
- [x] The draft opens Shift → Today at step 1 of 4 with date/time/hours prefilled and tips blank.
- [x] Missing break label stays blank; an explicit no-break/zero label becomes an authoritative zero.
- [x] Ambiguous break text is preserved without paid/unpaid inference.
- [x] Missing tipped cash/card or required sales cannot cross Confirm as zero; an explicitly entered zero can.
- [x] No draft action calls `postWorkShift`; visible Confirm remains the writer.
- [x] Focused tests, full repository verification, build, and independent review are recorded.

## Decisions

- The derived Evidence read is proposal material. It does not manufacture a `SevenShiftsEvidenceBundle` and does not gain automatic authority.
- A displayed Breaks cell is complete only when it explicitly says no breaks/zero or labels each parsed duration as paid/unpaid. Unclassified durations remain unknown.
- Empty and zero are different UI and command states.

## Evidence log

- Focused Shift/Evidence/command proof: 70/70 passed.
- Full repository suite on the final attribution-bound code: 1,120 passed / 2 skipped; the sole failure is the unchanged Windows harness expectation `spawnSync bash ENOENT` in `test/api.test.ts`.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm ai:verify`: passed (41 required files).
- Production Vite build and Hercules Pro UI build: passed; `dist/_redirects` remains absent.
- `git diff --check 57c5537ee676c3c80c1d94340eb0662e34e462c1`: passed; only Windows line-ending notices were emitted.
- Independent books review: PASS, no P0/P1/P2.
- Independent privacy/attribution review: PASS after requiring one exact mapped, bound provider subject and current-member job; no P0/P1/P2.
- Independent Worker/UI review: PASS after the documentation-status P2 was closed; no P0/P1/P2.
- Exact application commit `021b61e8ea968ff490d52b24eca550b7a64ee089` was pushed to `codex/d171-approved-punch-shift-draft` and deployed as Worker version `3407ba4c-5e0c-4954-bbda-c215ceda8e07`; the kitchen returned HTTP 200.

## Remaining uncertainty

- Exact future 7shifts Breaks labels may require additive fixtures; unknown labels fail open to human review but fail closed for posting defaults.

## Handoff

D-171 is pushed and live. No schema, secret, provider, or household-data mutation occurred. The branch remains separate from `main`; merge is a separate decision.
