# Hearth worksession — online-required shared sync

- **Status:** IN REVIEW
- **Opened:** 2026-09-03 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/sync-online-required-launch`
- **Baseline SHA:** `cd6171d9551126e1576485315be60f7b5123d81c`
- **Head SHA:** branch head; exact reviewed SHA recorded in the PR evidence
- **PR or issue:** [#323](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/323)
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** Development launch policy only; Production continuity remains off

## Household outcome

Jonathan and Bianca can use the same shared ledger from two signed-in devices without either device acting as the host. Shared writes require a reachable cloud authority, become visibly Saved only after cloud acceptance, and reach the other device through Realtime with authenticated catch-up as the recovery path. PGlite remains the accounting validator and replaceable local projection, not an independent durable authority.

## Budget delta (5)

`+5`: removes the launch-time offline multi-writer ambiguity, makes cloud acknowledgement the shared-write commit boundary, and gives projection upgrades a receipt-gated repair path without weakening PGlite, double-entry, scope, revision, or idempotency checks.

## Engagement delta (2)

`+2`: the household gets calm, truthful Saved/Saving/Offline copy and fast partner visibility. Offline shared editing is intentionally traded for read-only access at launch.

## Verified baseline

- Fresh isolated worktree rebased to `origin/main@cd6171d9551126e1576485315be60f7b5123d81c` on `codex/sync-online-required-launch`.
- Current main already has authenticated atomic publish, command-log replay, Supabase Realtime, REST catch-up, PGlite acceptance receipts, and projection mismatch detection.
- The screenshot failure is the current `projection-mismatch` startup gate. It prevents the sync coordinator from starting while the header can still derive `Sharing...` from pending transport, so Retry repeats the same local comparison without cloud repair.
- D-189 deliberately refuses automatic rebuild for arbitrary projection mismatches. This worksession supersedes it only for the versioned projection upgrade and for one exact durable legacy-tip generation bound to accepted JSON. Arbitrary mismatches remain read-only until an explicit authenticated restore pulls both cloud scopes, validates them in isolation, and replaces the active projection.
- The accepted product direction still leaves the complete live two-device matrix, fresh 100-sample latency proof, fourteen-day rehearsal, and Production continuity as open release evidence.

## Scope

### In scope

- A Development-only online-required shared-ledger launch policy with reusable isolated PGlite staging before cloud transport.
- Refusal of shared writes while unauthenticated or offline.
- Cloud acknowledgement as the visible Saved boundary.
- Honest sync/readiness copy that cannot claim active sharing while books repair blocks transport.
- A versioned, replaceable PGlite projection with receipt-gated upgrade recovery and an exact legacy crash-window bridge.
- Deterministic tests for two-device ordering, reconnect/catch-up, deployment upgrade, cloud failure, and recovery refusal when local work is pending.
- Current canon, decision, and pilot documentation for the bounded policy change.

### Out of scope

- Production continuity, Production data, hosted schema application, hosted-row cleanup, secrets, provider changes, bank connectivity, or literal field-by-field co-editing.
- Weakening command validation, PGlite/double-entry acceptance, personal-scope isolation, reversal immutability, idempotency, or environment separation.
- Claiming perfect networks, zero latency, completed live two-device evidence, rehearsal completion, or release readiness from local tests.
- Merge or deployment without a later explicit release instruction.

## Acceptance evidence

- [x] Shared Confirm passes isolated PGlite/Postgres acceptance before transport and refuses active mutation when signed-in cloud authority is unavailable.
- [x] A shared command becomes Saved only after atomic hosted acceptance; failure leaves the previous accepted household authoritative and retryable without duplicate posting.
- [x] Realtime applies ordered accepted commands; gaps and reconnect use authenticated command/snapshot catch-up.
- [x] A projection-version upgrade repairs only from a synchronized revision/receipt; a legacy in-flight tip repairs only from one exact durable generation; arbitrary mismatch requires explicit authenticated two-scope restore.
- [x] Pending local work, invalid receipts, cross-scope snapshots, unresolved conflicts, and offline recovery remain fail-closed.
- [x] Blocked validation never renders `Sharing...`; diagnostics and authenticated recovery remain available.
- [ ] High/Release quick gate and relevant independent reviews pass on the complete diff.
- [x] PR is opened but remains unmerged and undeployed.

## Plan

- [x] Establish an isolated current-main baseline and reconcile the reported failure with current code and canon.
- [x] Implement the online-required authority and UI honesty policy.
- [x] Implement versioned receipt-gated local projection repair.
- [x] Add deterministic two-device, reconnect, upgrade, and failure proofs.
- [ ] Close the exact-head Release-risk quick gate and independent reviews; keep PR #323 unmerged and undeployed.

## Evidence log

- Baseline branch/status: `codex/sync-online-required-launch`; isolated and rebased to `cd6171d9551126e1576485315be60f7b5123d81c`.
- Focused verification: TypeScript passed; 106/106 tests passed across books staging/reset, durable outbox/restart, cloud-boundary runtime, and startup recovery UI.
- A filesystem-backed PGlite test closes every stage handle, reloads the slim durable outbox, and replays the candidate from the persisted stage rather than warm memory.
- High/Release quick gate on PR head `c902a1890075b17b2b0b71e1fb543f2c739f9ace`: passed in 63.786s with TypeScript, 122/122 fast tests, and 58/58 serial books tests; no time-budget breach. A trust review then found the newer-remote Shared/stale-Personal generation gap, so this is retained as pre-fix evidence rather than the final gate.
- Focused proof after closing that finding: TypeScript passed and 87/87 continuity, runtime, environment-isolation, and startup tests passed, including a Shared/Personal interleaving retry and same-member second-device Personal adoption.
- A second exact-head audit found Shared-only startup/catch-up and an Auth/member shortcut. The follow-up binds Auth to the exact selected member, adopts stable Shared+Personal together on every launch-mode pull, and binds write readiness to the exact environment/household/member/revision tuple. TypeScript and 96/96 combined startup, continuity, runtime, isolation, and policy tests pass; missing Personal and mismatched Auth prove zero staging or local advancement.
- Browser proof on the current implementation: at 1280px and 390×844 the books reached `ready`, there was no horizontal overflow, the full bottom navigation remained present, and the browser reported no warnings or errors.
- GitHub PR #323 is open. The branch remains unmerged and undeployed; no hosted schema, data, secret, provider, or Production setting changed.

## Decisions

- Online-required applies to shared-ledger writes for launch. Cached reading may remain available, but offline shared mutation is refused before command acceptance.
- `Saved` means the cloud transaction accepted the command. Isolated PGlite acceptance is necessary first but not sufficient for shared durability; active PGlite advances only afterward.
- Automatic local rebuild is permitted only for the synchronized version-upgrade receipt or an exact durable legacy-tip binding. Arbitrary mismatch requires a person's explicit authenticated restore of both Shared and signed-in Personal cloud scopes through isolated validation.
- Realtime is the fast path; authenticated command/snapshot catch-up is the correctness path.
- A newer ambiguous acknowledgement and explicit projection restore reopen writes only after two equal Shared-revision reads bracket the signed-in member's revisioned Personal read; a moving generation retries and then fails closed.
- Startup and normal catch-up use that same pairing. A Shared-only result cannot acknowledge an outbox marker, advance the base revision, or authorize the next write.

## Remaining uncertainty

- Live two-account behavior and latency still require deployed Development evidence after a separately authorized release.

## Handoff

Implementation is complete on a local isolated branch and is moving through the Release-risk quick gate and independent exact-head review. Nothing is merged, deployed, or applied to hosted state.
