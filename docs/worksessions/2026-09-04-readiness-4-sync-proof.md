# Hearth worksession — Readiness 4 sync proof

- **Status:** OPEN
- **Opened:** 2026-09-04 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `readiness/4-sync-proof`
- **Baseline SHA:** `e1097084b914ae4834df54e3ed8497f9df48bb6e`
- **Head SHA:** local implementation in progress
- **PR or issue:** none yet
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none; local/synthetic harness and operator template only

## Household outcome

Jonathan and Bianca can collect one privacy-safe, release-bound ledger of two-account sync evidence and receive a deterministic go/no-go summary for 100 fresh samples, reconnect, poll fallback, relaunch, scope, and duplicate behavior without treating local tests as live proof.

## Budget delta (5)

`+2` — stronger evidence around accepted-book visibility, scope, duplicate prevention, and recovery; no money meaning or writer changes.

## Engagement delta (3)

`0` — proof infrastructure only; no household-facing interaction changes.

## Verified baseline

- Readiness 3 PR #327 passed its exact-head High-risk quick gate at `1f57e2e055fbb27b037b32c6c21a71ff011b96a8`, then merged as `e1097084b914ae4834df54e3ed8497f9df48bb6e`.
- The Slice 3 head is an ancestor of `origin/main`; main CI, Pages, Workers build, and Supabase main checks passed at the merge SHA.
- Slice 4 starts from that exact merge with a clean isolated worktree.
- Current main already has Development-only bounded/hashed sync traces, a synthetic two-client harness, online-required shared sync, Realtime reconnect policy, and poll fallback.
- Existing local 100-sample tests are synthetic. The complete signed-in two-account live matrix, fresh exact-release 100 samples, and fourteen-day rehearsal remain open.

## Scope

### In scope

- A strict privacy-safe evidence schema and deterministic 100-sample summary.
- Exact-release, Development-only, two-account/two-device scope binding.
- Receiver-visible timing with authenticated cloud-clock calibration, accepted revision/hash, transport, duplicate, gap, and clock-order validation.
- Structured CLOSED-to-authenticated-reconnect, Realtime-to-poll-to-Realtime, and relaunch/outbox exactly-once evidence.
- A local collector CLI that accepts only the allowlisted evidence shape and never labels synthetic tests as live proof.
- A manual operator template for a separately authorized real-account run.
- Risk-focused verification mapping and current living decision evidence.

### Out of scope

- Running the real Jonathan/Bianca two-account proof; using real household facts; deploying; applying schema; changing hosted rows, settings, secrets, or feature flags; Production; claiming live or daily-use proof.
- Changing `App.tsx`, financial commands, PGlite acceptance, Realtime transport, Auth/RLS authority, or the hosted sync protocol.

## Acceptance evidence

- [x] Deterministic p50/p95/max and exactly-once summaries over at least 100 fresh samples.
- [x] At least 50 fresh Realtime samples are required in each member-device direction, and conservative clock uncertainty is included in every latency.
- [x] Invalid clock order, duplicate command, revision gap, wrong release/environment/household/member-device scope, evidence window, or missing UI/hash evidence refuses the gate.
- [x] CLOSED to matching authenticated reconnect/catch-up is represented and required.
- [x] Realtime refusal recovers through a poll within four seconds and returns to Realtime without a duplicate.
- [x] Relaunch preserves one outbox command identity and proves exactly one receiver acceptance.
- [x] The CLI rejects synthetic/fabricated-source labels and unknown/private fields, emits hashed identifiers only, binds a live candidate to a clean exact-SHA checkout, and can produce only a non-passing operator-review candidate.
- [ ] Focused High-risk quick gate and independent sync/trust review pass.

## Plan

- [x] Merge Slice 3 and verify it on `main`.
- [x] Branch from exact merged `main`.
- [x] Implement the strict proof model, collector, tests, and operator template.
- [x] Update risk mapping and living decision evidence.
- [ ] Run exact-head verification and independent review; open a draft PR only after the local gate is green.

## Evidence log

- Slice 3 exact-head quick gate: 34/34 selected tests, 79.785 seconds, fingerprint `757d01550a789b799f55def347aa3e9a1ab9d7238000d10442a779e84ca40b18`.
- PR #327 merged through GitHub only at the reviewed SHA; merge commit `e1097084b914ae4834df54e3ed8497f9df48bb6e`.
- No open PR touched the Slice 4 diagnostic, two-client, reconnect, or target test files at branch creation.
- Focused proof/diagnostic/two-client/reconnect/online-policy plus verification-policy gate: 7 files / 63 tests passed.
- `pnpm exec tsc --noEmit` passed. The fresh isolated dependency tree made this run unusually slow (about 140 seconds) but it remained inside the five-minute quick-gate budget.
- `git diff --check`, JSON parsing, and the pre-push secret/private-artifact scan passed; only the eleven named source/test/doc/package files are changed or new.

## Decisions

- Live proof is an operator-produced, exact-release Development artifact. Unit tests validate the evaluator only as synthetic evidence; even a mechanically valid self-declared live JSON remains `operator-review-required` with top-level `pass: false` until Jonathan's authorized witnessed review.
- The collector accepts only hashed identifiers, timestamps, transport/status, revision, and accepted-books hash. Amounts, notes, account names, emails, tokens, and raw identifiers are structurally impossible.
- Receiver visibility is explicit evidence; PGlite acceptance alone does not count as UI visibility.
- Cross-device latency uses four authenticated cloud-clock calibrations, refuses uncertainty above 50 ms or drift above 100 ms, and adds endpoint uncertainty to the reported latency rather than trusting browser wall clocks.

## Remaining uncertainty

- The harness can prove whether a supplied evidence ledger satisfies the contract. It cannot run or certify the real two-account scenario without Jonathan's separate authorization and observed Development evidence.

## Handoff

Implementation is in progress locally. No Slice 4 push, PR, deploy, hosted mutation, real-account run, schema action, secret, or Production action has occurred.
