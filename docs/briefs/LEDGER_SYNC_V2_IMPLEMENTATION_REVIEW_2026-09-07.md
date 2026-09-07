# Ledger sync v2 implementation review

Jonathan's requested outcome is the ordinary Hearth Add flow: a confirmed grocery reaches another member promptly, with no lost or duplicated money after concurrency, disconnection or replay. This branch replaces the financial transport and its authority. The separate document-editor experiment is preserved outside this branch and is not evidence for ledger sync.

- Repository: `jonathanbeaulne123-blip/dual-ai-budget-app`.
- Branch: `codex/ledger-sync-rebuild`; isolated worktree `.codex-work/ledger-sync-rebuild`.
- Verified base: `origin/main@9c54a8f9fb019360bc6aacae4983ddce0e56b2d5`; fetched again during final verification with zero divergence before the implementation commit.
- Risk: High. Budget delta (weight 5): +5, durable command acceptance and financial integrity. Engagement delta (weight 3): +2, immediate draft interaction and live household presence.
- Decision owner: Jonathan. Target reviewer: independent Principal distributed-systems and accounting/security reviewers. One writer maintained this checkout; read-only agents reviewed application routes and failure semantics.
- Architecture and exact wire contract: [LEDGER_SYNC_V2.md](../LEDGER_SYNC_V2.md). Worksession: [2026-09-07-ledger-sync-rebuild.md](../worksessions/2026-09-07-ledger-sync-rebuild.md).

## Implementation map

| Boundary | Files and responsibility |
|---|---|
| Domain capture | `src/core/commands.ts`, import, charter, rehearsal and weekly stamp wrappers; `src/ledgerSync/capture.ts` records typed intent, not a client household replacement. |
| Server authority | `src/ledgerSync/registry.ts`, `authority.ts`, `resources.ts`, `reviewedFacts.ts`; actor/ownership checks, semantic preconditions, reviewed cents, canonical IDs and safe receipt-based Undo. |
| Durable room | `workers/ledgerRoom.ts`; serialized SQLite transaction, journal, receipts, R2 barrier, resume, independent presence lane, flow control, scoped restore and deletion. |
| Access and cutover | `workers/ledgerSync.ts`, `ledgerSyncAuth.ts`, migration 019; current Supabase membership, short leases, new-ledger bootstrap and permanent old-writer fencing. |
| Browser | `src/ledgerSync/client.ts`, `localStore.ts`, `creationStore.ts`; durable ordered pending commands, one in-flight command, jittered reconnect, stable Create identity and checksum-based canonical recovery. |
| Ordinary App | `src/App.tsx`, `continuity.ts`, `storage.ts`, `ledger/engine.ts`; Add/Undo/startup/discovery/Personal integration, accepted-event paint followed by incremental SQL projection, new creation/restore/delete routes and confirmed device cleanup. |
| Proof | Authority, backup, cutover and real Worker tests; real App latency script; six-member real client/IndexedDB offline/reload script. Test-only auth/fault injection is confined to the local fixture entrypoint. |

## Invariants reviewers must preserve

Only explicit Confirm posts financial intent. Authenticated server scope determines the actor. CAD cents remain exact; journal totals balance; transfers do not become income. Personal data is omitted from every other member's event/snapshot. Supabase membership is authoritative; embedded members are its projection. An unacknowledged UUID survives uncertainty and scope-local reload. An R2 failure before exposure cannot be reported as an accepted posting. A snapshot checksum mismatch requires canonical recovery. A cut-over household never writes through the legacy snapshot outbox or CAS again.

Development restore/erase require owner scope and the exact reviewed sequence. Restoring Shared books preserves Personal state and current membership metadata. Destructive deletion reserves one actor before the control-plane mutation, closes the room, purges archived bodies and leaves a resurrection fence. Creation retries retain the same staged household identity until local installation succeeds.

## Verification commands

Use the repository Node runtime and installed pnpm. The local Worker and Vite server are separate long-lived processes:

```sh
pnpm exec wrangler dev --config test/browser/ledger-worker.jsonc --port 8792 --local
VITE_LEDGER_SYNC_V2=1 VITE_LEDGER_SYNC_LOCAL_AUTH=1 pnpm exec vite --port 5194 --strictPort
```

```sh
HEARTH_LEDGER_WORKER_URL=http://localhost:8792 pnpm test -- --risk=high --focus=test/ledger-sync-authority.test.ts --focus=test/ledger-sync-worker.test.ts --focus=test/ledger-sync-cutover.test.ts --focus=test/ledger-sync-backup.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason="Replacement authority, durability, cutover, real WebSockets and ordinary App regressions"
pnpm build
pnpm exec wrangler deploy --dry-run --outdir /tmp/hearth-ledger-worker-check
HEARTH_LEDGER_SAMPLES=100 node scripts/prove-ledger-sync-browser.mjs
node scripts/prove-ledger-sync-resilience.mjs
```

The browser scripts accept `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. They generate local-only synthetic evidence under ignored `artifacts/ledger-sync/`. The latency harness uses two independent Chromium contexts, ordinary App controls and receiver paint, with before/after clock calibration. The resilience harness uses the real client, IndexedDB, SQLite and WebSockets across six members; it is a focused transport test rather than a second ordinary-App UI claim.

Exact latest results belong in the linked worksession. The final quick gate passed **182 tests across 20 files in 118.709 seconds**. The calibrated development-build App run produced 100 samples: p50 310.8 ms, p95 593.4 ms, maximum 1551.4 ms, with no browser errors or legacy requests. It did **not** meet the 250 ms target. This supersedes the earlier uncalibrated pre-barrier baseline; neither is a hosted SLO result.

For a separate production-compiled local App comparison, run `node scripts/serve-ledger-sync-proof.mjs`, then set `HEARTH_LEDGER_APP_URL=http://localhost:5195 HEARTH_LEDGER_BUILD_LABEL=production-react-local-fixture HEARTH_LEDGER_SAMPLES=100` when invoking the browser proof. The fixture is built into an isolated temporary directory, never shipping `dist`. Its synthetic auth is accepted only by the loopback test Worker.

The quick gate also exposed pre-existing routing mismatches: two onboarding PGlite tests and the ninth Demo Suite case were absent from the lane contract. The serial list now includes those tests and the new SQL migration fixture; its canary verifies the matching fast exclusions. This repairs verification routing, not product behavior.

## Release review boundary

Local implementation evidence does not authorize a claim of hosted release or Production readiness. This worksession has not applied migration 019, provisioned hosted resources, pushed/merged the branch, or deployed the new service. No exhaustive lane has been run; the repository requires an explicit request naming the exact clean High/Release SHA for that gate.

Before daily-use activation, independently review the complete diff and exact commit, complete the required same-SHA verification, provision Development R2/SQLite bindings, apply the one-way migration under the approved procedure, and test real Google create/discovery/invite/revocation and both members' Personal views on the exact deployment. Collect at least 100 calibrated real two-device samples, replay/lost-ACK/Undo/restore proof, and an actual fifteen-minute partition test. Validate queue/resource limits and provider backup/failover behavior before increasing capacity or enabling Production. The current resource bounds and remaining scale limitations are explicit in the architecture document.

No credentials, private workbook/chat exports, meaningful household data or partner Personal rows are included in this packet. Fixtures and browser proof households are synthetic; tests ran locally. No messages were sent to other people or services beyond ordinary repository/tool package reads. A future reviewer should return concrete P0/P1/P2 findings, exact reproduction steps, validation performed and a PASS/CONDITIONAL/FAIL release assessment without quietly reviving legacy writes.
