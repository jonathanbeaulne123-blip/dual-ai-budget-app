# Ledger sync rebuild

Status: IMPLEMENTED LOCALLY; ACTIVATION NOT CERTIFIED. Owner: Jonathan. Risk: High. Budget delta (5): +5; Engagement delta (3): +2.
Implementation commit: `ad7c63ea0ac6635cc71a58624b976ef012aba675`. Branch: codex/ledger-sync-rebuild. Base: origin/main 9c54a8f9fb019360bc6aacae4983ddce0e56b2d5.

Jonathan authorizes doing the work needed to replace the actual ledger sync, following the D-234 review. The document collaboration feature remains in its separate worktree and is not ledger progress.

Outcome: Bianca confirms a grocery in the ordinary Hearth app; the server admits a small immutable command against current household state, commits durably, and Jonathan receives and renders the accepted result. Independent commands do not compete on a whole-household revision. Shared and Personal remain scoped; Supabase membership remains the one control authority. The target is 250 ms confirm-to-receiver-paint, measured separately from cold startup and never claimed from mocks.

Implementation sequence: typed domain command admission and stable receipts; household Durable Object and ordered scoped event log; durable client outbox and existing-app integration; one-time authenticated import and incremental projections; recovery/backup/authorization tests; real-browser acceptance and latency measurement; independent review; release/cutover evidence.

Read-only agents investigate core semantics and App integration. Codex is the sole writer. No legacy snapshot fallback is allowed once a household activates the new authority. Financial constraints still run against current accepted state. Same-ID retries retain immutable intent, independent of observed revision. Genuine changed business intent requires reconfirmation.

## Verification evidence

- Change-focused High-risk quick gate passed: **182 tests in 20 files**, 118.709 seconds, no five-minute breach. TypeScript, diff checks and AI-surface checks passed. Base/head was `9c54a8f9fb019360bc6aacae4983ddce0e56b2d5`, with implementation changes uncommitted. Working-change fingerprint: `d4abb95f7169188dc1a99d7f30fa47b1d98a21895ecd513ec26420ed8b0b6161`.
- Focus included command authority, real SQLite Worker/WebSockets, migration cutover, backup, ordinary-App startup and month rehearsal. Transitive expansion was explicitly trimmed; this is quick evidence, not an exhaustive suite.
- Focused verification passed five tests: four real Worker tests plus the deterministic deletion race regression. The regression reproduced an incorrect 200 response before the fix; it now verifies that the losing owner never calls the deletion RPC or archive cleanup. Stronger real Worker assertions cover restored point identity and preservation of Personal transactions when restoring Shared.
- `pnpm build` and `wrangler deploy --dry-run` passed. The dry run packaged the Worker and assets locally; it did not deploy. Existing PGlite/browser externalization and bundle-size warnings remain.
- Six-member resilience proof passed with real browser IndexedDB, client, WebSockets and SQLite: 100 offline intents retained exact UUIDs/order through reload, five other members posted, and all replicas converged on 105 transactions. Stable staged Create identity and damaged-cache repair at the same sequence passed. This was a network partition simulation, not fifteen wall-clock minutes offline.
- Calibrated ordinary-App development-build benchmark: **100 samples, p50 310.8 ms, p95 593.4 ms, maximum 1551.4 ms**, zero browser errors or legacy transport requests. Before/after clock offsets drifted by less than 0.1 ms, with combined minimum-round-trip uncertainty below 0.5 ms. The **250 ms target was not met**. This result remains preserved in `browser-proof-development.json`.

- Production-compiled ordinary-App comparison on the same code: **100 samples, p50 164.6 ms, p95 329.4 ms, maximum 1723.2 ms**, zero browser errors or legacy transport requests. Before/after offset drift was below 0.11 ms; combined initial uncertainty was below 0.9 ms. This is local Chromium with a loopback Worker, not hosted physical-device evidence. The **250 ms target remains unmet**, even with release compilation. Raw samples are preserved in `browser-proof-production.json`.

## Review and release boundary

Independent bounded reviews covered ledger semantics and actual App paths. Repairs include receipt-based Undo, archive exposure barriers, restored point identity, stable creation retries and deletion ownership. The final concurrent deletion race is closed by propagating the deletion fence instead of treating it as missing membership. Independent read-only review confirmed the correction.

Assessment: **CONDITIONAL** for local implementation; daily-use activation is not established. No push, merge, hosted migration, resource provisioning, deployment, exhaustive same-SHA gate or Production activation has occurred. Hosted Google create/discovery/invite/revocation, real two-device paint, an actual fifteen-minute partition and capacity/disaster-recovery exercises remain unproven. The remaining performance work is explicit: profile sender persistence, authority validation/archive, receiver persistence and paint on the deployed Development path; reduce the measured bottleneck without weakening durability or accounting admission; then repeat at least 100 calibrated samples on two physical devices. The implementation is not certified for daily-use cutover.

See [the implementation packet](../briefs/LEDGER_SYNC_V2_IMPLEMENTATION_REVIEW_2026-09-07.md) and [architecture contract](../LEDGER_SYNC_V2.md). Local synthetic browser evidence is under ignored `artifacts/ledger-sync/`; private household data and credentials are excluded.
