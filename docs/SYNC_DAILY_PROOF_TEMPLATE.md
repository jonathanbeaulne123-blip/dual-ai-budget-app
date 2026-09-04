# Sync daily-use proof template

> **Template only — no live proof has been run.** This packet prepares a local evaluator and the exact operator steps. A real two-account Development run, hosted mutation, deployment, or daily-use claim requires a separate explicit instruction from Jonathan.

## Claim boundary

The evaluator can earn only this narrow result:

> The named Development release produced a passing two-account/two-device sync evidence ledger.

It does not prove Production, literal field co-editing, perfect networks, fourteen-day daily use, or Auth/RLS state beyond the observed Development run. A local Vitest fixture always uses `synthetic-contract-test` and is structurally refused as live evidence.

## Privacy boundary

The retained JSON may contain only:

- the exact 40-character release SHA;
- the observed deployment completion time that opens the evidence window;
- one-way 16-character household, member, device, and command hashes;
- ISO timestamps, Development environment, bounded transport/status values, revision numbers, duplicate counts, and the 64-character accepted-books hash;
- four clock-calibration rows containing only hashed device identity, local measurement time, signed offset, uncertainty, and the fixed authenticated-cloud-clock source label;
- three recovery outcomes: reconnect, poll recovery, and relaunch/outbox exactly once.

Never put amounts, notes, merchants, account names, household/member/device names, emails, tokens, raw IDs, browser storage, screenshots of books, or exports in the proof JSON. The collector rejects unknown fields and does not echo rejected payloads. Keep any private source export local and copy only its accepted-books hash into this ledger.

## Separate authorization required

Before running this with Jonathan and Bianca's real Development accounts, obtain one explicit instruction that names:

- the exact deployed release SHA;
- Development only;
- the two-account/two-device test window;
- permission to create disposable Development commands for the run;
- permission to collect the local privacy-safe evidence ledger.

That instruction does not authorize Production, schema changes, secrets, provider settings, destructive cleanup, or deployment of a different SHA.

## Preflight

- [ ] Record the exact 40-character deployed SHA. Do not use a branch name or unmerged commit.
- [ ] Record the successful deployment completion time; every retained sample and recovery row must occur after it.
- [ ] On each signed-in device, open **More → Pairing → Advanced recovery** and press **Copy proof clock calibration**. Paste the copied allowlisted row into the operator ledger outside the repository. The action calls the authenticated Development-only `/sync/clock` route; no token, raw id, or ledger fact is copied. If the action reports uncertainty above 50 ms, retry on a stable connection. If it still cannot produce a row, stop: wall-clock p95 cannot be claimed.
- [ ] Confirm the build is Development with Google Auth, Realtime, command log, online-required Shared writes, and pilot diagnostics enabled; Production continuity remains off.
- [ ] Confirm the required existing migrations and Realtime publication through read-only inspection only. Do not apply or change them.
- [ ] Use two different authorized Google accounts and two different supported devices/browsers in the same disposable Development household.
- [ ] Start with both replicas reconciled and PGlite/accepted-books hashes green.
- [ ] Keep an independent household record. Hearth is not the sole record during the rehearsal.
- [ ] Create the input ledger outside the repository, preferably in a new `mktemp -d` directory.

## Sample run

Collect at least 100 fresh Realtime Shared command samples after the exact release SHA is deployed: at least 50 from participant one to participant two and at least 50 in the reverse direction. The bounded poll sample is separate recovery evidence and may bring the total above 100.

Immediately before the first sample and after the last sample, press **Copy proof clock calibration** on each device. Retain exactly two rows per device. Each measurement uses five authenticated NTP-style probes and keeps the lowest-uncertainty result after subtracting Worker-side Auth processing time. Uncertainty must be at or below 50 ms, the two measurements must bracket every timestamp from that device, and observed offset drift must be at or below 100 ms. Never estimate an offset after the fact. The evaluator interpolates the offset and adds both endpoint uncertainties to each latency, so the reported p95 is a conservative upper bound.

For every command:

1. On the sender, record the hashed confirmation/command ID and the `local-accepted` timestamp from **Copy sync diagnostic**.
2. Record its `cloud-ack` timestamp for the same command hash.
3. On the receiver, wait until the accepted command has crossed PGlite and is visibly present in the active UI. Record that observed `receiverVisibleAt`; PGlite acceptance without active UI visibility is not enough.
4. Record the receiver revision and the 64-character `booksAcceptedHash` from the receiver's accepted-books receipt. Do not use row count as proof.
5. Record `realtime-command`, `realtime-snapshot`, or `poll`, plus the duplicate count. Never guess a missing field; an incomplete sample must fail.
6. Confirm the sample's release, Development household, two member hashes, and two device hashes match the run preflight.

The evaluator requires consecutive receiver revisions, unique command hashes, calibrated monotonic `senderAcceptedAt <= cloudAckAt <= receiverVisibleAt`, active UI visibility, zero duplicates, zero wrong-scope samples, at least 100 Realtime samples split at least 50/50 by direction, conservative calibrated Realtime p95 at or below 500 ms, and any separate poll sample at or below four seconds.

## Required recovery rows

### CLOSED to authenticated catch-up

- [ ] Record the receiver at `CLOSED`.
- [ ] Restore a matching authenticated Google/member identity.
- [ ] Observe `SUBSCRIBED` and the named command caught up through the ordinary accepted-books path.
- [ ] Record ordered `closedAt`, `authenticatedAt`, and `caughtUpAt` timestamps.

### Realtime refusal to poll to Realtime

- [ ] Record `CHANNEL_ERROR`, `TIMED_OUT`, or `CLOSED`.
- [ ] Observe the named command accepted through `poll` within four seconds and with no duplicate.
- [ ] Observe the channel return to `SUBSCRIBED` after the poll acceptance.

### Relaunch and outbox retry exactly once

- [ ] Record one hashed command identity when it enters the durable outbox.
- [ ] Relaunch the sender before acknowledgement completes.
- [ ] Confirm the same hash survives relaunch, reaches one receiver acceptance, and has duplicate count zero.

## Input skeleton

Use real hashes and timestamps only during an authorized run. The placeholders below are intentionally invalid and cannot pass the collector.

```json
{
  "kind": "hearth-sync-daily-proof-input",
  "version": 1,
  "evidenceSource": "live-two-account-development",
  "releaseDeployedAt": "<ISO-INSTANT>",
  "collectedAt": "<ISO-INSTANT>",
  "environment": "development",
  "releaseSha": "<40-CHAR-DEPLOYED-SHA>",
  "householdId": "<16-CHAR-HASH>",
  "participants": [
    { "memberId": "<16-CHAR-HASH-A>", "deviceId": "<16-CHAR-HASH-A>" },
    { "memberId": "<16-CHAR-HASH-B>", "deviceId": "<16-CHAR-HASH-B>" }
  ],
  "clockCalibrations": [
    { "deviceId": "<16-CHAR-HASH-A>", "measuredAt": "<ISO-INSTANT-BEFORE>", "offsetMs": 0, "uncertaintyMs": 0, "source": "authenticated-cloud-clock" },
    { "deviceId": "<16-CHAR-HASH-A>", "measuredAt": "<ISO-INSTANT-AFTER>", "offsetMs": 0, "uncertaintyMs": 0, "source": "authenticated-cloud-clock" },
    { "deviceId": "<16-CHAR-HASH-B>", "measuredAt": "<ISO-INSTANT-BEFORE>", "offsetMs": 0, "uncertaintyMs": 0, "source": "authenticated-cloud-clock" },
    { "deviceId": "<16-CHAR-HASH-B>", "measuredAt": "<ISO-INSTANT-AFTER>", "offsetMs": 0, "uncertaintyMs": 0, "source": "authenticated-cloud-clock" }
  ],
  "samples": [
    {
      "commandId": "<16-CHAR-HASH>",
      "environment": "development",
      "releaseSha": "<40-CHAR-DEPLOYED-SHA>",
      "householdId": "<16-CHAR-HASH>",
      "senderMemberId": "<16-CHAR-HASH>",
      "receiverMemberId": "<16-CHAR-HASH>",
      "senderDeviceId": "<16-CHAR-HASH>",
      "receiverDeviceId": "<16-CHAR-HASH>",
      "senderAcceptedAt": "<ISO-INSTANT>",
      "cloudAckAt": "<ISO-INSTANT>",
      "receiverVisibleAt": "<ISO-INSTANT>",
      "transport": "realtime-command",
      "duplicateCount": 0,
      "receiverRevision": 1,
      "receiverAuditHash": "<64-CHAR-ACCEPTED-BOOKS-HASH>",
      "activeUiVisible": true
    }
  ],
  "recovery": {
    "reconnect": {
      "commandId": "<16-CHAR-HASH>",
      "closedAt": "<ISO-INSTANT>",
      "authenticatedAt": "<ISO-INSTANT>",
      "caughtUpAt": "<ISO-INSTANT>",
      "statusBefore": "CLOSED",
      "statusAfter": "SUBSCRIBED",
      "matchingIdentity": true
    },
    "pollRecovery": {
      "commandId": "<16-CHAR-HASH>",
      "realtimeRefusedAt": "<ISO-INSTANT>",
      "pollAcceptedAt": "<ISO-INSTANT>",
      "realtimeRecoveredAt": "<ISO-INSTANT>",
      "statusBefore": "CHANNEL_ERROR",
      "statusAfter": "SUBSCRIBED",
      "duplicateCount": 0
    },
    "relaunch": {
      "commandId": "<16-CHAR-HASH>",
      "enqueuedAt": "<ISO-INSTANT>",
      "relaunchedAt": "<ISO-INSTANT>",
      "acceptedAt": "<ISO-INSTANT>",
      "outboxIdentityPreserved": true,
      "receiverAcceptanceCount": 1,
      "duplicateCount": 0
    }
  }
}
```

## Evaluate locally

Run from the exact source checkout after creating the untracked evidence file outside the repository:

```sh
proof_dir=$(mktemp -d)
cp /absolute/path/to/authorized-sync-proof-input.json "$proof_dir/input.json"
pnpm sync:proof:collect -- --input "$proof_dir/input.json" --release-sha <40-CHAR-DEPLOYED-SHA> --output "$proof_dir/result.json"
```

Classification `operator-review-required`, `contractPass: true`, top-level `pass: false`, and exit `3` mean only that the supplied allowlisted ledger satisfied the mechanical contract. Live-candidate evaluation also requires running the collector from a clean checkout whose `HEAD` equals the supplied release SHA. The collector deliberately cannot emit a passing or “live proof” result: Jonathan's authorization record and witnessed operator review are necessary for that claim. Exit `1` is a failed/non-live ledger. Exit `2` is invalid CLI/file/source-checkout input. Retain the privacy-safe input/result with the operator log only after manually confirming they contain no household facts or raw identifiers.

## Stop rules

Immediately stop the run and preserve the replicas, outbox, and sanitized diagnostics if there is silent loss, a duplicate financial post, invalid books, Personal leakage, cross-environment access, or a false Synced state. Do not clear, compact, rewrite, replay over, or delete the evidence. Rollback, hosted cleanup, and any schema action require separate authorization.
