# Hearth worksession — cloud-ledger online authority

- **Status:** OPEN
- **Opened:** 2026-09-04 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/cloud-ledger-online-authority`
- **Baseline SHA:** `8ca2a9b91208922967f91c1ab2fd9841f647ae21`
- **Head SHA:** working tree; record the exact clean candidate before exhaustive verification
- **PR or issue:** follow-up to merged PR #323 / D-208
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** Development only

## Household outcome

Every cloud-backed Personal or Shared household change requires matching Google authority, a reachable cloud, isolated PGlite acceptance, and atomic cloud acknowledgement before Hearth advances the visible or durable books. Cached accepted books remain readable offline. With two signed-in members in one Development household, a Shared Confirm on one open kitchen becomes accepted and visible on the other in under one second; the existing product gate remains the stricter diagnostic `latency.p95Ms <= 500` over at least 100 received Shared command events.

## Budget delta (5)

`+5`: one explicit commit boundary for all cloud-backed ledger scopes removes the remaining shared-only naming ambiguity and protects Personal and Shared writes from device-local divergence.

## Engagement delta (3)

`+2`: Jonathan and Bianca get fast, truthful Saved / Up to date behavior, calm offline read-only access, and no later surprise upload from a supposedly committed offline change.

## Verified baseline

- Current `origin/main` and local baseline are exact `8ca2a9b91208922967f91c1ab2fd9841f647ae21`.
- Merged PR #323 is present on `main` through merge commit `759e84b`; its implementation head was `27004fdd326349dfeba999d181f52496e7f520f5`.
- The baseline Development workflow baked Auth, Realtime, command log, `VITE_SHARED_ONLINE_REQUIRED=1`, diagnostics, and Production continuity off; this candidate replaces the shared-only release flag with `VITE_CLOUD_LEDGER_ONLINE_REQUIRED=1` and retains the old name only as a temporary local-env fallback.
- `commitHousehold` currently derives its gate from cloud linkage / exact continuity membership, not from the current Personal or Shared view. The implementation therefore already covers Personal-view changes inside a cloud-backed household, but its flag, symbols, copy, tests, and canon still claim shared-only scope.
- The live two-account 100-sample latency proof for this exact follow-up is not yet verified.

## Scope

### In scope

- Name and configure D-208 as the Development cloud-ledger online-authority policy.
- Prove Personal-view and Shared-view mutations in a cloud-backed household use the same pre-mutation online/Auth/replica gate.
- Keep every active/durable device advance behind isolated PGlite validation and atomic cloud acknowledgement.
- Preserve cached offline reading and local draft/navigation behavior.
- Preserve crash-safe ambiguous delivery markers, paired Shared/Personal adoption, conflict refusal, environment/member scope, Realtime command-first recovery, and poll fallback.
- Verify the exact clean candidate with focused, quick, authorized exhaustive, hosted workflow, and live two-account latency evidence appropriate to Release risk.

### Out of scope

- Production continuity or Production household data.
- Hosted schema, migration, RLS, provider, secret, bank, or evidence-retention changes.
- Making demo, Hearth Pass, or other intentionally local-only Development households perform unauthorized cloud calls.
- Removing PGlite, cached accepted books, or local drafts.
- Claiming the fourteen-day D-180 rehearsal complete.

## Acceptance evidence

- [x] Development build has one explicit cloud-ledger online-required flag and a fail-closed legacy compatibility decision.
- [x] Offline Personal and Shared mutation in an authenticated cloud-backed household refuses before staging, active PGlite, durable snapshot, or visible household advancement.
- [x] Online mutation refuses wrong/missing Auth, incomplete paired replica, an earlier unacknowledged command, and cloud failure without changing the prior accepted books.
- [ ] Successful mutation validates in isolated PGlite, receives atomic cloud acknowledgement, advances active PGlite/device state once, and reaches the peer through command Realtime/PGlite acceptance.
- [x] Local-only Development households retain their bounded receipt-gated local behavior and make no unauthorized continuity request.
- [x] Duplicate, stale, response-lost, reconnect, restart, scope-switch, Personal-isolation, and Production-refusal regressions pass in the automated focused/quick evidence; live two-account confirmation remains below.
- [x] Final implementation fingerprint passes the Release-risk quick gate; exact clean-SHA Jonathan-authorized full verification remains pending the commit below.
- [ ] Deployed exact Development SHA yields a freshly started run with exactly 100 Shared candidates, 100 painted/valid-clock samples, zero unpainted/invalid-clock samples, diagnostic `latency.p95Ms <= 500`, and a quantitative before/after two-phone clock-offset witness.
- [ ] One shared-time-base recording across both physical phones proves Confirm tap to peer paint below one second.
- [ ] Two distinct Google accounts in the same Development household complete Shared visibility and Personal isolation checks; request Jonathan's browser sign-ins only if no safe existing authenticated sessions are available.

## Plan

- [x] Reconcile current main, merged PR #323, code, canon, and workflow flags.
- [x] Formalize the cloud-ledger policy in runtime names, configuration, copy, tests, and living canon.
- [x] Run focused and Release-risk quick verification; repair every relevant finding.
- [x] Obtain independent Auth/privacy, money/sync, and release/latency review PASS findings on the settled implementation.
- [ ] Commit the exact candidate and run the authorized full gate.
- [ ] Obtain hosted exact-SHA checks and Development deployment evidence without touching Production.
- [ ] Run the two-account live matrix and 100-sample latency gate; iterate until it passes or a human sign-in is the only remaining dependency.
- [ ] Close the worksession with exact SHAs, commands, results, hosted mutations, identity/ledger scopes, and remaining rehearsal boundary.

## Evidence log

- Baseline: clean `codex/cloud-ledger-online-authority` at `8ca2a9b91208922967f91c1ab2fd9841f647ae21`.
- Jonathan's authorization: “ok do it. make sure the sync is perfect don't stop until you achieve sub 1 second write from 1 phone, read from the other.” This authorizes Development implementation, exact-SHA exhaustive verification, and the live two-account latency proof. It does not authorize Production, schema, secrets, or destructive hosted cleanup.
- Focused cloud-authority regression: the final seven-file serial set passed 76/76 before the Release-risk gate, covering Personal and Shared offline refusal, Personal staged/cloud/active ordering, cloud refusal, command Realtime, diagnostics, Fund rail Personal commands, Demo Suite routing, and Personal-account journal projection.
- The audit-driven regression also proved that a lower but stable paired cloud read cannot overwrite a newer cloud-acknowledged local generation; it leaves catch-up/readiness work open instead of rolling visible or durable books backward.
- Superseded Release-risk quick gate: implementation fingerprint `1b14bb34cb58aafe1cdafabb68e251b96e1b251a3675cf69ac8ee065d74a91c1` passed in 164.912 seconds with 144 tests across 14 selected files, but later audit-driven runtime/test fixes changed the candidate. It is historical evidence only and does not certify the current tree.
- Superseded uncommitted-candidate production build: it passed before the later Personal-preference, Demo serialization, clean-run, and uncensored paint-witness fixes. A current exact-tree build and exact clean-SHA full verification remain required.
- Superseded settled-implementation Release-risk quick gate: fingerprint `1630130aa5ebcdc39bed61c090dd766f695408c4ef7d33c52b7dee466822ad8` passed in 71.224 seconds with 192/192 tests (159 fast and 33 serial), but the first exact-SHA full gate then found the privacy, lane, schema-history, and test-race issues recorded below. It is historical evidence only.
- Current production build passed after the final queue and cloud-refusal fixes: `tsc --noEmit`, Vite, Hercules Pro UI, and no `_redirects` artifact. Existing PGlite browser-external/eval and chunk-size messages remained warnings, not failures.
- Independent final read-only audits passed for Auth/privacy, money/sync, and release/latency. They specifically verified Demo identity/serialization, Personal scoped hashes and privacy, Personal/Hercules cloud authority, exact queued-candidate binding, bounded isolated-stage cleanup, clean latency runs, uncensored visible paint evidence, and truthful outstanding live proof.
- Exact-SHA full gate attempt `18b74accf520eedad8aaa6791103fd373695b718` correctly refused the candidate. It found an AI-disclosure bank-institution leak, missing serial-lane registration for the new direct-PGlite continuity test, and five migration assertions that stopped at schema 7 instead of this change's schema 8. Three additional timing failures were separated from those deterministic defects: both Demo tests passed unchanged and under their existing per-test limits on an idle host; the startup suite exposed a background canonical-replica save racing a global counter, so its refusal proof now checks that the exact Personal command candidate never reaches durable storage.
- Post-repair focused verification passed: TypeScript; 40/40 AI privacy, Personal journal visibility, lane-manifest, Fund, and PGlite migration tests; 26/26 startup tests; 8/8 Demo Suite tests; and 2/2 Demo shift-statistics tests. A new Release quick fingerprint and clean exact-SHA full gate remain required.
- Repaired Release-risk quick gate passed with fingerprint `8d5eff406c29a0cbd4b35b0ab1f8156de4f531461a133cd6206aaf884e4db5e9` in 54.104 seconds: diff integrity, AI-surface verification, TypeScript, and 222/222 tests (183 fast and 39 serial). The selected proof included Personal/Shared cloud authority, privacy, schema 8, serial-lane integrity, startup refusal, command Realtime, diagnostics, environment isolation, and exact PGlite proof. The fingerprint predates only this evidence-log update; a clean exact-SHA full gate remains required.

## Decisions

- The policy applies to every mutation of a cloud-backed household regardless of Personal or Shared presentation. The gate follows cloud authority, not the current UI tab.
- “Whole app online-only” means online-authoritative commits, not blanking accepted cached books or disabling harmless offline navigation/drafts.
- The existing 500 ms p95 pilot gate remains the acceptance bar; the user's under-one-second threshold is the outer requirement, not a reason to weaken current canon.
- Cross-phone `latency` is accepted only with a quantitative before/after clock-offset witness, exactly 100 current-run candidates, zero unpainted/invalid samples, and an offset-corrected (or conservatively bounded) p95. The broader Confirm-tap-to-peer-paint claim uses one external time base across both physical phones; `cloudToPaintLatency` and receiver-monotonic `receiverApplyLatency` remain supporting diagnostics.

## Remaining uncertainty

- Whether this Mac already has two safe authenticated browser sessions for Jonathan and Bianca. If not, the final live proof requires Jonathan to sign each account into a separate browser surface.
- The exact current live Worker SHA and hosted migration/publication inventory must be re-read before the latency run; no schema mutation is authorized.

## Handoff

Codex owns implementation and evidence collection in this isolated branch. Jonathan remains release and Production decision owner.
