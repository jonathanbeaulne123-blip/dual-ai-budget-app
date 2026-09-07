# Ledger acceptance — prepared migration and remaining work

**Jonathan-only Development command, from the checkout containing this file:**

```sh
pnpm exec node scripts/apply-supabase-migration.mjs 020
```

Migration 020 has **not** been applied. Do not run the base-schema `books:apply` command to apply it. Existing local Development credentials are handled by the migration runner; never paste them into a handoff. Do not deploy the reservation Worker before this migration exists. Do not deploy Production or delete legacy source before G4.

Decision owner: Jonathan. Target implementer/reviewer: Codex, with independent read-only accounting/privacy and measurement reviews. Risk: High. Budget delta (5): +5. Engagement delta (3): +3. Authority is the attached September 7 commission, AGENTS.md and the current [contract](../LEDGER_SYNC_V2.md). The exact release and trial ledger is in the [worksession](../worksessions/2026-09-07-ledger-sync-acceptance.md).

## What is ready

Startup PR #366 is deployed. Activity PR #367 isolates bounded rendering, lazy repeat review, member-scoped projection reuse and DOM observation attributes from the migration-dependent Worker. Its exact reviewed head is `7a1768efa58ff0bba29170adcf5f6b3e2d7d28bb`, based on `27fdec0db192925fb225c825f9df0cadb2b199d5`; refresh merge/deployment state before continuing.

The separate reservation patch must remain a draft until the schema prerequisite is confirmed. Migration 020 creates private immutable manifests over **retained** legacy confirmation and idempotency identities, including compacted event IDs and both Personal scopes. The RPC returns scoped SHA-256 digests, never raw posted IDs or private payloads. The Worker validates every manifest page before activation, keeps a SQLite reservation set, strips legacy receipt payloads from public Shared projections, and archives reservations before exposure. Incomplete manifests fail closed. Recovery checkpoints preserve the readiness distinction so an old checkpoint cannot silently certify an empty set.

`GET /ledger-sync/v2/development/{household}/receipt?id={confirmationId}` is authenticated and read-only. V2 receipts require the original member actor; legacy reservations expose only minimal reservation evidence. They cannot fabricate the old actor/hash semantics. IDs absent from both the ring and all retained event history are unrecoverable; do not claim complete historical reconstruction without inspecting the actual source.

## Resume in dependency order

1. Refresh main and PR #367; preserve the separate unmerged reservation branch. Re-run focused checks if its code changed. Jonathan applies 020, then the implementer verifies the authenticated manifest RPC and deploys the reservation patch to Development. No destructive repair or writer-fence reversal.
2. Use **onboarding test Household**, explicitly selected by Jonathan, for G3. Compare each account balance to the cent, full trial balance/equation, every retained receipt reservation, exact member-specific Personal sets, and byte-level derived read models against the frozen import source. Only the member's own authenticated session may supply Personal evidence. An empty/unfinished household does not prove a rich 5,000-row shape; report this limitation. Both-member parity is still missing.
3. Complete the ordinary-App measurement harness against a verified served Development build using two distinct authenticated members. The current script supports protected local storage-state paths; these contain credentials and must never be committed or logged. Local fixture mode targets only loopback and creates synthetic 5,056-row rooms; it never seeds the selected hosted household implicitly. Record the real deployed baseline before assigning G2 green.
4. Profile the full ordinary Confirm path at 5,000 rows. Remaining costs include full household cloning/hash/compile, full health/read-model projections, serialized compatibility cache writes and Add closing only after ACK. Preserve the blocking full guard unless the incremental guard matches the full verdict/error class on at least 500 generated commands including corruption. Current full-guard browser timings are seconds, not an assumed 300 ms.
5. Implement a durable, UUID-keyed pending overlay with validated books before visibility, separate from the accepted replica. Correlate canonical events/receipts to preview IDs, handle unrelated incoming events and definitive refusal, and prevent provisional plus canonical duplicate rows. Never mark Pending as Saved or resolve a durable promise early.
6. Collect at least100 valid samples on two physical Toronto LTE devices, Wi-Fi off, separately witnessed warm and genuinely cold conditions with before/after authenticated clock calibration. The two-frame browser paint bound cannot prove a sub-frame 16 ms target. No simulated radio or self-declared device label passes G4. Delete the superseded path only after G4.

## Reproducible checks

With the repository Node runtime on PATH:

```sh
pnpm exec vitest run test/ledger-reservations.test.ts test/ledger-sync-authority.test.ts test/ledger-acceptance-metrics.test.ts test/ledger-scale-fixture.test.ts --maxWorkers=1 --testTimeout=30000
# Test-only local Worker, in another terminal:
pnpm exec wrangler dev --config test/browser/ledger-worker.jsonc --port 8792
HEARTH_LEDGER_WORKER_URL=http://127.0.0.1:8792 pnpm exec vitest run test/ledger-sync-worker.test.ts --maxWorkers=1 --testTimeout=30000
# Local ordinary-App fixture only:
VITE_LEDGER_SYNC_V2=1 VITE_LEDGER_SYNC_LOCAL_AUTH=1 pnpm exec vite --port 5194
HEARTH_LEDGER_SAMPLES=100 node scripts/prove-ledger-acceptance.mjs
```

Use the same-origin deployed clock and actual served-build identity for hosted evidence. The evaluator exits nonzero when measurements are missing or budgets fail. Preserve failed attempts; never convert ACK, aggregate totals, offscreen rows or cached-shell marks into partner paint.

## What is not yet safe to claim

G1 is documented; G2/G3/G4 remain open. No complete actual-data import parity, incremental guard equivalence, safe optimistic posting, sub-250 ms LTE result, offline/reconnection burst certification, Production readiness or legacy deletion is established. With one more day, start with a production-compiled 5,000-row Confirm profile and remove redundant projection/cache work, then the correctly correlated pending overlay; do not spend that day tuning WebSocket intervals while main-thread rendering takes seconds.
