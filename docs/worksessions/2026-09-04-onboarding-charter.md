# Hearth worksession — onboarding Chapter 3 Charter

- **Status:** CLOSED; LOCAL QUICK-GATE + UX VERIFIED
- **Opened:** 2026-09-04 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/12-ch3-charter`
- **Baseline SHA:** `0c458c8b1206b7f23ca8988e94c4d99dd8ab1a9a`
- **Head SHA:** working tree
- **PR or issue:** none
- **Risk:** Medium-High
- **Decision owner:** Jonathan
- **Environment impact:** none; fictional local Development fixtures for tests/visual proof

## Household outcome

The existing Charter founding conversation and Charter document become the
real Chapter 3 destination. Each person signs only the latest terms, waits
without nagging the other person, and can safely return after an amendment.

## Budget delta (5)

`+2` — the household agreement becomes trustworthy onboarding evidence. No
money, account, Fund event, journal row, or posting authority changes.

## Engagement delta (3)

`+3` — specific Charter actions, patient waiting, safe return, calm stale
recovery, and a complete responsive route replace generic setup scaffolding.

## Verified baseline

- Fresh worktree from `origin/main@0c458c8` (merged Slice 11 / PR #328).
- Slice 11 is the direct dependency and is present on the baseline.
- Existing `CharterFounding`, `Charter`, shaping, commands, signature lines,
  evidence projection, and return-message storage are present.
- No open PR targets `onboarding/12-ch3-charter`; no open Charter PR was found.
- The older Chapter 3 entry has no Create/Modify section, so the bounded
  contract in `docs/briefs/ONBOARDING_SLICE_12_CH3_CONTRACT_2026-09-04.md`
  is explicit authority for this implementation.

## Scope

### In scope

- Current-revision signature projection and stale self re-sign recovery.
- Existing founding/document navigation from the onboarding shell.
- Persistent return instruction, exact Chapter 3 states/copy, tests, and live
  responsive/accessibility proof.
- An honest approximate eight-minute label and optional pause metadata.

### Out of scope

- Charter redesign, answer collection in chat, new revision/schema fields,
  financial behavior, Auth/RLS, hosted data, Production, push, merge, or deploy.

## Acceptance evidence

- [x] Focused Chapter 3 and Charter tests pass.
- [x] Medium-High quick gate passes.
- [x] Browser journeys pass at 320 / 390 / 720 / ~1100 px.
- [x] Keyboard, focus, touch targets, contrast, forced colors, reduced motion,
      and 200% zoom are checked.
- [x] Exact changed files and residual uncertainty are recorded.

## Plan

- [x] Repair current/stale signature semantics and convergence.
- [x] Complete Chapter 3 evidence, copy, navigation, waiting, and return UX.
- [x] Add focused lifecycle and route-without-signature tests.
- [x] Run local verification and the live browser pass.
- [x] Update living canon and close the worksession locally.

## Evidence log

Fresh evidence only; no Slice 11 result is carried forward.

- Focused lifecycle/Charter suite: **8 files / 120 tests passed**, including a
  late offline signature on old wording that must not become current consent.
- Final post-UX focused rerun: `test/onboarding-charter.test.ts` plus
  `test/onboarding-conductor.test.ts`, **35/35 passed**, then TypeScript passed.
- Medium-High quick gate selected Chapter 3, conductor, copy, registry, return,
  command, and serial proof-matrix coverage; AI surface, TypeScript, diff
  hygiene, **118 fast + 7 serial tests** passed in **20.303s**, below its soft
  five-minute target. The exact final-tree rerun is the handoff gate.
- Live browser, fictional Development fixture:
  - 320 px: missing record, specific **Write the Charter**, visible keyboard
    focus, 48 px action, and existing five-question founding route.
  - 390 px: unsigned document, only the viewer's 44 px **sign** action, signed
    date, quiet one-signature wait, and exact 44 px persistent return bar with
    no dismiss control.
  - 720 px: patient waiting card with no partner action.
  - 1100 px: stale **Review and sign the Charter**, quiet own-line **sign
    again**, and accepted cited evidence.
  - Primary CTA computed contrast: **6.16:1**. The equivalent 1100 px / 200%
    reflow viewport had `scrollWidth === clientWidth` (550 px).
  - `forced-colors` and `prefers-reduced-motion` scoped CSS were inspected.
    The in-app browser controller did not expose media emulation. Its iframe
    instrumentation logged an unscoped `MutationObserver` error; no product
    source uses `MutationObserver`, and rendered behavior remained stable.
- Browser QA files were temporary and removed; no test route remains.

## Decisions

- Time is guidance only. No timeout or forced pause is introduced.
- Existing timestamps are sufficient revision evidence: a signature is current
  when `signedAt >= termsUpdatedAt` and its replica carries the winning terms.
- Re-signing changes only the acting member's stale line. Merge keeps a valid
  current signature over stale replicas without adding a model field; a later
  timestamp on old wording is discarded rather than misattached.

## Remaining uncertainty

- Live hosted two-device observation is outside this local implementation
  slice; browser proof uses fictional local Development state.
- Forced-colors and reduced-motion were source-inspected rather than emulated
  by the available in-app browser controller.

## Handoff

Local implementation and UX proof complete. Not pushed, merged, deployed, or
hosted-live verified. Next owner: Jonathan may review and separately authorize
push/PR/merge; hosted two-device consent remains later release evidence.
