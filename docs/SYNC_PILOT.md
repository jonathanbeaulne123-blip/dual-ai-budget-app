# Ledger-native “Google Docs feel” Development pilot

> **Status — 2026-08-31:** the pilot implementation is merged through [PR #256](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/256) as exact `main@e9c5127594a9fd4e6d8b203f19db57cc4b31390a` and deployed to the Development kitchen. It is **not activated for daily use or proven through the live matrix or fourteen-day rehearsal**.

## Entry and household-identity repair — Development deployed

D-182 adds the human entry layer needed before the live matrix: one Google account door, an authorized-household chooser even for a single result, honest accepted-edit timestamps on every household card, invitation/QR redirect recovery, and a member · household · device-time header. A successful invite refreshes and highlights the joined household for an explicit Open action instead of silently changing ledgers. Phrase and Hearth Pass entry remain under Advanced recovery.

This repair reuses the existing membership and snapshot contracts. It adds no migration, hosted API, secret, Production flag, or hosted-data mutation. The independently reviewed implementation was fast-forwarded to `main` and deployed from exact `244bc67c21df389e22b5aa0dd764c5e1d4bf68c7`; main CI `33421668514` and Cloudflare Build/Deploy `33421668573` passed. The live bundle and signed-in identity header were observed without console errors. Live OAuth/invite proof, two-account/two-device acceptance, and the rehearsal remain open.

## Claim boundary

This is a Development-only Jonathan/Bianca rehearsal of ledger-native command sync. It is not literal field co-editing, a promise that every collision is automatic, a Production-readiness claim, or permission to make Hearth the sole household record.

The claim earned only after every exit criterion passes is:

> **Docs-like Development sync proven for Jonathan and Bianca.**

## Immutable pilot boundary

The pilot kitchen build must contain all four exact settings:

- `VITE_SUPABASE_AUTH_ENABLED=1`
- `VITE_CONTINUITY_REALTIME=1`
- `VITE_CONTINUITY_COMMAND_LOG=1`
- `VITE_PRODUCTION_CONTINUITY=0`

`VITE_SYNC_PILOT_DIAGNOSTICS=1` enables the Development-only local diagnostic. Production discovery, transport, Realtime, and diagnostics must remain refused. The Production code path stays in source for a separate approved packet.

No new API, table, migration, secret, provider setting, or hosted-data mutation is part of this pilot. Migration 017 session/device membership is cloud authority. `household.devices` is soft presence only. Revocation denies cloud access; it cannot remotely erase books already cached by an offline browser.

## Normal command and recovery paths

The normal shared path is:

`Confirm -> balanced PGlite acceptance -> durable device snapshot/outbox -> command append -> Realtime event -> partner PGlite acceptance`

Snapshots are reserved for first household creation, initial device catch-up, a revision gap, and integrity repair. They are not the ordinary per-command collaboration path.

- Distinct additive transactions, shifts, contributions, and Fund events converge.
- Duplicate or out-of-order command delivery is accepted exactly once.
- Divergent edits to one financial fact, and conflicting reversal/restore work, preserve both versions and open explicit human review.
- Personal events reach only their owning member.
- Open shifts are member-keyed; Jonathan and Bianca can each keep an independent punch.
- A second-device join or failed pull never silently replaces the last accepted local ledger.
- Financial command events, receipts, reversals, and tombstones are retained throughout the pilot. No compaction or deletion job is authorized.
- Confirm remains the only financial writer. Realtime, polling, retry, diagnostics, presence, and Hercules never create money.

## Preflight before an approved deployment

1. Use a clean release worktree and record its exact SHA. Keep the original dirty checkout untouched.
2. Run the automated gate below and receive independent books, trust, verification, and release-review results.
3. Confirm the workflow artifact was built from that exact SHA and contains the five pilot settings above.
4. Read the hosted migration inventory without applying anything. Required existing migrations are 001–017, including 012, 013, 014, and 017.
5. Read the Realtime publication without changing it. Required continuity tables are `continuity_command_events`, `continuity_personal_snapshots`, and `household_snapshots`.
6. Use only disposable, non-critical Development rehearsal information. Keep an independent record; Hearth cannot be the sole record during this pilot.

On 2026-08-31, the read-only preflight found migrations 001–017 and the three required Realtime tables. After explicit approval, reviewed head `0f54fa28e59db6997fa7c96bceb8a51f242c51d3` passed PR checks, merged as exact `main@e9c5127594a9fd4e6d8b203f19db57cc4b31390a`, and passed exact-merge main CI run [`33403561215`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33403561215). Cloudflare run [`33403561188`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33403561188) deployed it successfully. Live origin inspection found the pilot diagnostic, command-Realtime, Production-off, cached-offline-data warning, and Realtime module markers. No schema, hosted household row, Production, secret, or provider change accompanied the release.

## Automated gate

Run from the clean pilot worktree:

```powershell
pnpm exec vitest run test/hosted-cas-two-client.test.ts test/continuity-coordinator.test.ts test/continuity-outbox.test.ts test/continuity-command-outbox.test.ts test/continuity-realtime.test.ts test/continuity-command-realtime.test.ts test/continuity-two-browser-proof.test.ts test/continuity-command-interleaving.test.ts test/sync-freshness.test.ts test/supabase-auth-session.test.ts test/auth-membership-authority.test.ts test/shared-money-membership.test.ts test/auth-invite-discovery.test.ts test/shift-clock.test.ts test/sync-pilot-diagnostics.test.ts
pnpm test
pnpm ai:verify
pnpm exec tsc --noEmit
pnpm build
git diff --check
```

Any unavailable or renamed test must be replaced with the nearest current equivalent and recorded rather than silently skipped.

## Live two-device matrix

Use Jonathan and Bianca's separate Google accounts on actual supported devices. Keep both kitchens open for the latency run. Record pass/fail, timestamp, device/browser, expected outcome, actual outcome, diagnostic summary, and follow-up for every row.

- Fresh-device discovery while the old device is off.
- Jonathan Shared post; Bianca Shared post; each partner sees the accepted result.
- Jonathan Personal post and Bianca Personal post; the other account cannot see either event.
- Concurrent disjoint Shared posts converge automatically.
- An intentional same-fact divergent edit preserves both versions and opens human resolution; choosing a version converges both devices.
- Both devices work offline, queue accepted work, reconnect, and converge without a duplicate.
- Background then foreground; network loss then recovery; Realtime failure displays fallback/polling honestly and later recovers.
- Duplicate and out-of-order event delivery applies each command once.
- Browser restart preserves accepted local books and pending outbox work.
- Expired session refresh resumes only after a matching authenticated identity.
- Invite, voluntary leave, ordinary member revoke, current-device revoke, wrong account, wrong household, and anonymous access all produce the intended allow/deny result.
- Revoked-device UI states that cloud access is denied and cached offline data cannot be remotely erased.

### Latency gate

Record at least **100 received Shared command events**. On the receiving device, use **Copy sync diagnostic** and retain the sanitized bundle with the rehearsal log. Require `remoteAcceptanceMs.p95 <= 500` while both kitchens are open.

The local diagnostic contains only revisions, pending count, constrained transport/outcome values, event timing, and hashed household/member/device/confirmation identifiers. It must never contain amounts, merchants, notes, emails, tokens, or raw identifiers. It is bounded to the newest 500 Development records so a multi-phase 100-event run remains measurable, stays on the device, and is transmitted only when a person explicitly copies it.

Latency-only failure may degrade to the honest polling fallback. Polling must recover to Realtime without duplicate posting. A false Synced state or lost/duplicated money is not a latency-only failure.

## Fourteen-day Development rehearsal

Use disposable rehearsal information only. For fourteen consecutive days:

- post ordinary groceries, transfers, shifts, corrections, and Personal entries;
- complete at least one deliberate offline period on each device;
- complete at least one browser/device restart and old-device-off recovery;
- copy one diagnostic after any delay, retry, conflict, sign-in interruption, fallback, or confusing status;
- reconcile both replicas to the expected books and record every anomaly.

Suggested log columns are: Toronto date/time, actor/device, scenario, local result, partner result, sync state shown, delay, diagnostic filename, conflict/resolution, accounting check, severity, and disposition. Never paste rehearsal amounts or Personal contents into Git.

## Exit criteria

All must be true:

- zero silent loss, duplicate financial posts, invalid books, cross-member Personal disclosure, cross-environment access, or false Synced states;
- both devices converge after offline work, restart, and old-device-off recovery;
- every intentional same-fact collision has a clear human resolution path;
- at least 100 Shared samples meet the 500 ms p95 gate with honest fallback behavior;
- no open P0/P1 sync, privacy, accounting, or recovery finding remains after the fourteen-day rehearsal.

## Stop and rollback

If money loss, duplicate posting, invalid PGlite state, Personal/privacy leakage, cross-environment access, or a false Synced state appears:

1. stop hosted sharing and daily-use rehearsal;
2. preserve every local PGlite replica, device snapshot, outbox, and sanitized diagnostic;
3. do not clear, compact, rewrite, or replay over the evidence;
4. roll back to the prior approved kitchen artifact through a separately approved deployment;
5. triage the preserved state before resuming.

No rollback step authorizes deleting hosted rows or changing schema. Latency-only failure may remain on honest polling while it is investigated.
