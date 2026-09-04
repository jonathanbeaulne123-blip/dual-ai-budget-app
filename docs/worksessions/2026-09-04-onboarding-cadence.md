# Hearth worksession — onboarding Chapter 8 earning cadence

- **Status:** CLOSED; LOCAL QUICK-GATE + BUILD + UX VERIFIED
- **Opened:** 2026-09-04 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/17-ch8-cadence`
- **Baseline SHA:** `bf19a85341d6135b36c27349d64207706eaad603`
- **Head SHA:** working tree
- **PR or issue:** none
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none; local Development fixtures only

## Household outcome

Each person tells Hearth only when pay usually arrives. The Household can plan
its rhythm without exposing job or pay details, and “no fixed rhythm” remains
an honest complete answer instead of becoming a guessed payday.

## Budget delta (2)

`+2` — member-owned timing can now anchor later plan views without inventing
income, contribution amounts, or work facts.

## Engagement delta (3)

`+3` — one soft five-choice question, a human sentence preview, and explicit
detail-later language make a necessary setup fact feel small and safe.

## Verified baseline

- Clean isolated worktree began at `origin/main@9783492` and was rebased onto
  current `origin/main@bf19a85` after the cloud-ledger authority release landed.
- Baseline repository quick gate passed before implementation.
- The original checkout's unrelated changes were left untouched.

## Scope

### In scope

- Member-owned Shared earning cadence with defensive shaping and continuity.
- First-class irregular cadence with no invented projections.
- Self-only probe, privacy-safe evidence, and acknowledgement gate.
- Existing Shift-surface form and Hercules routing.
- Focused command, projection, continuity, copy, UI, responsive, keyboard, and
  reduced-motion proof.

### Out of scope

- Employer, role, rate, deductions, landing account, shift detail, income,
  assumed contribution, transaction, journal entry, schema, hosted row,
  Auth/RLS, provider, secret, Production, push, PR, merge, or deployment.

## Acceptance evidence

- [x] Each member's probe reads only their own valid cadence.
- [x] Five cadence kinds survive shaping and Shared continuity.
- [x] Irregular satisfies the probe and emits no date, tick, amount, or Fund estimate.
- [x] Explicit detail-later writes no job, income, account, transaction, or journal row.
- [x] Evidence contains no partner work detail.
- [x] The existing Shift surface presents the soft cadence question with no amount field.
- [x] Responsive live-browser and complete local gates pass.

## Plan

- [x] Recover and restate the exact newer Slice 17 contract.
- [x] Implement the smallest typed fact and self-owned command.
- [x] Integrate the probe, evidence, projections, continuity, and existing UX.
- [x] Add core, copy, source-fence, and actual-component tests.
- [x] Complete live responsive UX proof and close local gates.

## Evidence log

- Final focused and adjacent cadence/onboarding/work projection suite passed
  237/237.
- Final Medium quick gate passed AI-surface, TypeScript, diff hygiene, 104 fast
  tests, and 7 serial financial-proof tests in 22.643 seconds.
- Production build passed 462 modules plus Hercules Pro UI. Existing PGlite
  browser-external/eval and chunk-size warnings remain unchanged.
- Live actual-component browser proof covered pending, busy, saved, selected,
  and irregular states at 320, 390, 720, and 1100 px in day and night themes.
  Every combination had zero horizontal overflow, 16 px base card text, one
  selected choice, and controls at least 49 px tall. Keyboard Tab moved from
  the selected choice to a visible-focus Save button; Enter saved. Irregular
  removed the date input and rendered no guessed payday. Reduced-motion media
  produced zero-second choice and save transitions. Browser console errors and
  warnings: zero. The temporary QA files and tab were removed.
- The browser pass replaced copy that implied every cadence places a payday;
  irregular now explicitly leaves paydays open. A final defensive review also
  added a raw-shape fence so malformed cached cadence cannot become a plausible
  default payday.
- `pnpm check:windows` could not run locally because `pwsh` is not installed;
  no Windows result is claimed.

## Decisions

- D-217 establishes Shared timing versus Personal work-detail separation and
  makes irregular cadence an explicit valid state.

## Remaining uncertainty

- Hosted two-device continuity remains release evidence and is not authorized
  by this local slice.

## Handoff

Local implementation and verification are complete. Push, merge, and
deployment require a separate instruction.
