# Hearth worksession — Charter Held core

- **Status:** CLOSED — CORE VERIFIED; CURSOR UI HANDOFF READY
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `C:\Users\jonat\OneDrive\Documents\ChatGPT\Budget App`
- **Branch:** `codex/charter-slice-5`
- **Baseline SHA:** `4c5b94324166e655aa77076493b8bdf838c6e2ed`
- **Core SHA:** `94a9f50d31bdb95b82e2afab52071809c2edae52`
- **Head SHA:** documentation closeout is the branch head
- **PR or issue:** none
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** local code/tests only; the shared Development/Production on-device PGlite schema upgrades from v5 to v6 when this code is eventually released. No hosted schema, hosted row, secret, push, merge, deploy, or Production household action occurred.

## Household outcome

Either household member can raise a contribution motion; the Fund custodian can place it on Hold for a conversation without moving money or closing it. The holder can release the Hold, the proposer can withdraw an unconfirmed proposal, and an open held motion remains confirmable through the existing custodian-only money boundary.

## Budget delta (5)

`+3` — the Fund gains explicit, append-only consent history and authority checks while preserving the existing confirmation boundary, Fund projection, and journal.

## Engagement delta (3)

`+2` — “Held — let's talk about this.” gives the household a calm, reversible conversation state instead of forcing Confirm or silence.

## Verified baseline

Facts:

- The isolated branch is rebased onto clean `origin/main@4c5b94324166e655aa77076493b8bdf838c6e2ed`.
- D-161 makes Fund events immutable Shared operational facts; only the Fund custodian confirms contributions.
- Charter amendment Holds already remain open and confirmable.
- Fund command-log materialization and compacted outbox payloads already carry posted Fund events generically.
- Current `projectHouseholdFund` counts proposed contributions as pending until a confirmation exists.
- The dated build manual assigns D-175, but current canon already uses D-175. D-193 is unused.

Inference to prove:

- Adding distinct append-only Hold, Release, and Withdraw events can preserve convergence without changing the journal or any confirmed Fund balance.

## Scope

### In scope

- Typed Fund event kinds for contribution Hold, Hold release, and proposal withdrawal.
- Custodian/proposer/holder authority checks in core commands.
- A pure contribution-motion projection for UI consumers.
- Fund integrity rules, Shared continuity/materialization, compacted-outbox, audit, and command-identity proof.
- PGlite books schema v6 upgrade for the expanded local `fund_events.kind` constraint.
- D-193 architecture record and a durable Cursor UI/UX implementation packet.

### Out of scope

- React, CSS, responsive layout, visual evidence, or interaction design.
- A new Till route or full Charter-amendment authoring UI.
- Changes to Fund confirmation, balances, PGlite journal arithmetic, bank evidence, Auth/RLS, hosted schema, providers, hosted rows, secrets, Production, merge, or deploy.

## Acceptance evidence

- [x] A held proposal remains open and may later be confirmed.
- [x] Only the Fund custodian can Hold, and the custodian cannot Hold their own proposal.
- [x] Only the holder can release; only the proposer can withdraw.
- [x] Confirmation after withdrawal is rejected; withdrawal after confirmation is rejected.
- [x] `projectHouseholdFund` and the compiled journal are byte-identical before and after Hold lineage; release is likewise excluded from arithmetic and journal compilation.
- [x] Withdrawal removes only the pending proposal and never changes a confirmed balance.
- [x] Holds, releases, withdrawals, and notes survive Shared command materialization and compacted outbox replay.
- [x] Focused, complete-suite, type, AI-policy, and production-build gates pass on the exact implementation tree.
- [x] The on-device schema upgrades from v5 without losing Fund rows; no hosted schema, data, secrets, or Production action occurs.

## Plan

- [x] Implement and shape the append-only event lineage.
- [x] Add commands and motion projection.
- [x] Prove authority, arithmetic, audit, and continuity invariants.
- [x] Update current canon and write the Cursor handoff.
- [x] Run focused and full verification; close the worksession.

## Evidence log

- Baseline inspection: `git status --short --branch`, `git rev-parse HEAD`, `git rev-parse origin/main`.
- Focused core/continuity/PGlite proof: 7 files, **62/62** tests passed; TypeScript passed.
- Pre-rebase lower-contention Windows gate: `pnpm ai:verify` passed; **225 passed / 2 skipped files, 1,555 passed / 3 skipped tests**. The three skips are the repository's intentional live/benchmark skips.
- Exact current-main rebase gate: official `pnpm check` passed AI verification, **227 passed / 2 skipped files, 1,565 passed / 3 skipped tests**, TypeScript, Vite production build, Hercules Pro UI, and redirect guard. Existing PGlite browser-external/eval, large-chunk, and React `act(...)` warnings remained non-failing.
- Earlier direct invocations before the test-runner update exposed missing Git Bash/Python PATH and a 15-second stress-test host limit. Current `origin/main` added the Windows-safe lane runner; the official command is now the final proof and passed without assertion failures.
- `git diff --check` and the staged secret-pattern scan passed.

## Decisions

- Use D-193 because D-175 is already assigned on current main.
- UI work stays with Cursor. Core exports the motion state and exact copy contract so the visual layer does not infer financial authority.

## Remaining uncertainty

- Browser behavior and visual accessibility remain intentionally unverified until Cursor implements the UI packet.

## Handoff

Next owner after core verification: Cursor, for the visual/interaction slice from the durable packet under `docs/briefs/`.

Packet: [`../briefs/CURSOR_CHARTER_HELD_UI_HANDOFF_2026-09-01.md`](../briefs/CURSOR_CHARTER_HELD_UI_HANDOFF_2026-09-01.md).
