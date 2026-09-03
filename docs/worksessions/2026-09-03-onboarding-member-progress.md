# Hearth worksession — onboarding member progress

- **Status:** CORRECTIVE RELEASE IN PROGRESS
- **Opened:** 2026-09-03 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/3-progress-review-fixes` (correction after `onboarding/3-progress`)
- **Baseline SHA:** `150210765b9eb171b37219966a8023d57c5da731`
- **Head SHA:** initial release `main@cb680c6dc8c65da300c25ed42cfeeba43d7de699`; corrective head follows
- **PR or issue:** initial [#319](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/319); corrective PR follows
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development-only force unlock; Jonathan authorized merge and Development deployment

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

- UI, `src/App.tsx`, probe implementations, any command that writes `observedCompleteAt`, personal-module registry entries, analytics, model/provider calls, money behavior, schema, hosted data, and Production continuity.

## Acceptance evidence

- [x] One focused test per slice-3 rule.
- [x] Merge is order-independent and preserves every monotonic field.
- [x] Progress core imports no component and contains no `document`.
- [x] Personal split/assembly/merge keeps one member's state out of Shared and out of another member's Personal envelope.
- [x] Development force unlock is accepted as Shared mode state; Production refuses exact copy.
- [x] The exact High quick gate passes with no new failing set.
- [x] Production build and AI-surface verification pass.

## Plan

- [x] Implement progress model, selectors, and deterministic merge.
- [x] Integrate progress with the Personal continuity envelope.
- [x] Add self-owned commands and the Development-only Shared escape hatch.
- [x] Add focused tests and D-205.
- [x] Run the authorized quick gate, inspect the diff, push, and open the slice PR.

## Evidence log

- `git fetch origin --prune`; branch baseline verified at `150210765b9eb171b37219966a8023d57c5da731`.
- `git status --short --branch` was clean before this worksession was created.
- Focused onboarding, mode, sync-integrity, and Fund-rail regression set -> **44/44 passed**.
- Clean implementation quick gate at `c4f0b2abb948f10319fa61f79eff77b69301618c` -> TypeScript, AI-surface verification, diff hygiene, **50 fast + 7 serial tests passed** in **84.268s**; no five-minute breach; fingerprint `eca4c60d4bff3012ad003b633584d1ccaea1d3fff3893e6dca2e23f5e8fe1b29`.
- `pnpm build` -> **passed**; existing PGlite browser-external/eval and large-chunk warnings only.
- `pnpm ai:verify` -> **passed**; 48 required files and two Clerk fences.
- `pnpm test:full` was not run; exhaustive proof remains reserved for an explicitly authorized exact clean High/Release-risk SHA.
- Changed files: `docs/DECISIONS.md`; this worksession; `src/core/onboarding/progress.ts`; `src/core/onboarding/mode.ts`; `src/core/types.ts`; `src/core/commands.ts`; `src/core/household.ts`; `src/core/index.ts`; `src/core/sync.ts`; `test/onboarding-progress.test.ts`.
- PR [#319](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/319) was opened against `main` from exact slice head `8fcb003b3e1bb60d4cf28ffc497969d833fefd13`.
- Jonathan authorized merge and deployment. PR #319 merged as `main@cb680c6dc8c65da300c25ed42cfeeba43d7de699`; exact-main CI `33806857891` and Cloudflare workflow `33806857747` passed.
- The initial Development deployment published Worker version `9a4607c6-df9f-49b8-9ceb-1a82af6cae3e`; `/` and `index-wOop2Pzr.js` returned HTTP 200 with no-store HTML and the slice-3 markers.
- A late automated review then reported five release-blocking gaps: absent actor defaulting, hidden partner Personal progress blocking local gates, early force unlock still selecting household chapters, an envelope clock undoing mute, and a corrupt Production force marker surviving shaping.
- Corrective focused regressions -> **44/44 passed**; TypeScript -> **passed**.
- Corrective High quick gate at dirty base `cb680c6dc8c65da300c25ed42cfeeba43d7de699` -> AI-surface, TypeScript, diff hygiene, **29 fast + 7 serial tests passed** in **32.432s**; no five-minute breach; fingerprint `0163b48de0057f778ed93373ff4e95f2f095d89a107c5a354a80bb3ddd86c407`.
- Corrective `pnpm build` -> **passed**; existing PGlite browser-external/eval and large-chunk warnings only.
- Corrective exact-head GitHub CI remains pending.

## Decisions

- Progress is member-owned Personal continuity state. It is not part of Shared, financial audit facts, or command receipts.
- `householdGatesOutstanding` checks each active member whose Personal progress is represented in the assembled household; a normal single-member assembly does not infer failure from the partner's intentionally absent Personal envelope, while no represented progress still fails closed.
- No slice-3 command may set `observedCompleteAt`; later accepted typed probes are its only writer.
- Progress commands require an explicit self-owned actor. Mute uses its own field clock. Development force unlock bypasses unfinished household chapters without claiming them complete, and a Production force marker shapes to blocked with no completion.

## Remaining uncertainty

- Probe adapters and their trusted acceptance path belong to later slices.
- No personal registry modules exist yet, so skip/mute infrastructure is present before its eventual offer UI.
- Corrective exact-head GitHub CI and Development publication remain pending.
- No browser evidence was required because this slice renders nothing.

## Handoff

The initial slice-3 release is live, but a corrective release is required for the late review findings. Merge only after the exact corrective High quick gate, exact-head GitHub checks, and review are clear; then smoke the Development Worker again.
