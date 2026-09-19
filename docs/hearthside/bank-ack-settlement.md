# Pending confirmation settlement after a lost ACK

The bank creation review can recover an accepted receipt over HTTP while the original `LedgerSyncClient.confirm()` remains unresolved. App's household writer and busy state still await that original promise. At checkpoint `1d5b08ee49594349e1886344f5e6d1edeb9f0062`, a live socket with a withheld ACK therefore leaves the accepted bank unusable for a subsequent agreement. Returning from the review's bounded wait does not settle App's writer.

`bank-ack-settlement.patch` fixes this in the client. It factors WS ACK and authenticated HTTP recovery through one serialized settlement method. A covered, validated receipt removes the same IndexedDB pending identity, clears its preview and in-flight latch, resolves the original confirmation, and advances the pending queue. Duplicate receipt reads and a delayed ACK do not announce another acceptance. The authority and financial command are unchanged; recovery never creates a new confirmation identity or replays a command to manufacture success.

Before settlement the client checks the requested identity, actor, safe sequence, receipt shape and undo attribution. For a pending command it also checks the existing authority intent digest and that the accepted sequence follows the captured revision. Replica validation checks the household/environment/member scope and accepted books. An uncovered receipt returns unavailable and asks the existing connection to catch up. Destroying the client rejects delivery; aborting an HTTP reader before settlement retains the original pending confirmation for a deliberate retry.

## Integration

The patch is based on checkpoint `1d5b08ee49594349e1886344f5e6d1edeb9f0062`, client blob `081191250a7b714604b17b3cee613302abcd55b1`. Apply or narrowly adapt it after the integration owner's main reconciliation; do not replace the current client with the checkpoint file. No configuration, capability, Worker, schema or hosted activation changes are required.

The package intentionally commits the test and patch, not a second copy of `src/ledgerSync/client.ts`. The new regression expects the patch to be applied. Register `test/hearthside-bank-ack-recovery.test.ts` in the integration owner's bank/ledger focus group before its final gate.

The older `test/hearthside-bank-journey-runtime.test.ts` constructs a reader with `Object.create(LedgerSyncClient.prototype)`. It must construct a real `LedgerSyncClient` before assigning its existing replica/HTTP fixture overrides, because bypassing the constructor omits the receive promise and pending maps now exercised by the real reader. Use a constructor scope with `subject: 'local:MEM-001'`, the existing synthetic token, and no-op `adopt`/`status`; retain the fixture's `localReady`, `store`, `path`, `replica`, `household` and `retryPending` overrides. This is a fixture correction, not a reason to make production settlement tolerate an uninitialized client.

## Evidence

`test/hearthside-bank-ack-recovery.test.ts` runs actual Chromium IndexedDB and WebSocket delivery against the actual LedgerRoom, authenticated HTTP handler, SQLite and private R2 archive. It withholds only completed ACK frames. The fixture's busy flag awaits the real `confirm()` promise as App does; this is real-client proof, not a full App presentation test. Its HTTP response faults are explicit synthetic corruption/latency injections after reading the real endpoint.

- Two concurrent HTTP reads settle the original promise once; the delayed WS ACK leaves acceptance callbacks unchanged. The same identity reuses its accepted result, and a second bank can complete.
- A WS ACK settling first makes the late HTTP result a read only, with no second queue/status callback.
- Wrong actor/id, negative/fractional/stale sequence, changed digest and wrong undo attribution cannot settle. A receipt beyond the current replica stays unavailable until catch-up.
- Closing the client while the HTTP response is withheld rejects both delivery and the original waiter without acknowledging the durable queue.
- Aborting only the reader leaves the original promise pending and allows a new deliberate receipt read to settle it.

The unchanged checkpoint fails the first test with `expected true to be false`: HTTP returned the accepted receipt but the original busy flag remained true. That baseline run took 1.47 seconds. Restoring the patch and running the five new tests plus the twelve existing authority tests passed 17/17 in 4.58 seconds. Test source and the applied client were unchanged after that passing run.

```sh
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never exec vitest run test/hearthside-bank-ack-recovery.test.ts test/ledger-sync-authority.test.ts
```

Tested patched client SHA-256: `b74fb3189f0ceb10c72a2ecf102bffc0343a5b28cb59dbe84537ceea2760ba5c`. Test SHA-256: `0c0612aabe81e5022c6f1d047ee72623b5d6c4345a111c98f10b6f9c9a340ba1`. Logs were written to `/tmp/hearthside-bank-ack-baseline.log` and `/tmp/hearthside-bank-ack-final.log`.

The related run also exposed the older prototype-only fixture described above: that one test failed with `Cannot read properties of undefined (reading 'then')`; the 16 other tests in that earlier run passed. This failure is retained as integration work rather than hidden by weakening the client.

The integration owner requested narrow runtime proof while another agent used the compiler. This package does not claim a High gate, build, hosted continuity proof or release approval. The integration owner still needs its final merged-source gate and the full App bank journey. The separately reported legacy/non-v2 bank creation compatibility finding is outside this settlement patch.
