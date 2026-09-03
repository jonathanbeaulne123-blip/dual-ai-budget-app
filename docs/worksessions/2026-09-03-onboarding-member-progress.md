# Hearth worksession — onboarding member progress

- **Status:** ACTIVE
- **Opened:** 2026-09-03 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/3-progress`
- **Baseline SHA:** `150210765b9eb171b37219966a8023d57c5da731`
- **Head SHA:** pending
- **PR or issue:** pending
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development-only force unlock; no deployment authorized in this slice

## Household outcome

Each signed-in member gets durable, resumable onboarding progress on any device without gaining authority over the other member's progress. Household setup can escape safely in Development without recording false completion.

## Budget delta (5)

`+3`: deterministic member-progress convergence and a fail-closed household-gate selector preserve truthful setup state without changing money, journals, balances, or Confirm.

## Engagement delta (3)

`+2`: acknowledgement, safe resume, and member-owned offer controls let setup continue calmly without streaks, percentages, or partner competition.

## Verified baseline

- The clean branch begins at `origin/main@150210765b9eb171b37219966a8023d57c5da731`, the merge of onboarding slice 2.
- Slice 2 supplies the Shared `HouseholdOnboarding` mode, two-member handshake, trusted acceptance check, and continuity replay.
- Member-owned landing and Fund-rail state already travel only in the acting member's Personal envelope.
- `Household`, `PersonalEnvelope`, and `mergePersonal` do not yet carry onboarding progress.
- Inference to prove: progress can converge per field without allowing acknowledgement or device-local UI state to claim an accepted probe result.

## Scope

### In scope

- Member/chapter progress types, defensive shaping, stable environment-household-member-version identity, next-chapter and household-gate selectors.
- Self-owned acknowledgement, Personal skip, offer mute, and Development-only force-unlock commands.
- Personal-envelope split, payload shaping, assembly/overlay, and deterministic merge.
- Forced-unlock permanence in setup-mode shaping and convergence.
- Focused unit and continuity tests, source fence, and a D-205 decision note.

### Out of scope

- UI, `src/App.tsx`, probe implementations, any command that writes `observedCompleteAt`, personal-module registry entries, analytics, model/provider calls, money behavior, schema, hosted data, Production, merge, and deployment.

## Acceptance evidence

- [ ] One focused test per slice-3 rule.
- [ ] Merge is order-independent and preserves every monotonic field.
- [ ] Progress core imports no component and contains no `document`.
- [ ] Personal split/assembly/merge keeps one member's state out of Shared and out of another member's Personal envelope.
- [ ] Development force unlock is accepted as Shared mode state; Production refuses exact copy.
- [ ] The exact High quick gate passes with no new failing set.
- [ ] Production build and AI-surface verification pass.

## Plan

- [ ] Implement progress model, selectors, and deterministic merge.
- [ ] Integrate progress with the Personal continuity envelope.
- [ ] Add self-owned commands and the Development-only Shared escape hatch.
- [ ] Add focused tests and D-205.
- [ ] Run the authorized quick gate, inspect the diff, push, and open the slice PR.

## Evidence log

- `git fetch origin --prune`; branch baseline verified at `150210765b9eb171b37219966a8023d57c5da731`.
- `git status --short --branch` was clean before this worksession was created.

## Decisions

- Progress is member-owned Personal continuity state. It is not part of Shared, financial audit facts, or command receipts.
- `householdGatesOutstanding` fails closed for each active member represented in the assembled household; missing member progress remains outstanding.
- No slice-3 command may set `observedCompleteAt`; later accepted typed probes are its only writer.

## Remaining uncertainty

- Probe adapters and their trusted acceptance path belong to later slices.
- No personal registry modules exist yet, so skip/mute infrastructure is present before its eventual offer UI.

## Handoff

Pending implementation and verification.
