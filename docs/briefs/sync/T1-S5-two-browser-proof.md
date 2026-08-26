# T1-S5 — Two-browser proof

**Tier:** 1  
**Depends on:** T1-S4  
**Blocks:** Tier 1 gate G4, Tier 2 start  
**Risk:** Medium (evidence)

## Goal

Prove Tier 1 on disposable Development: two authenticated contexts, A posts shared txn, B sees it ≤ **500 ms** p95; offline/outbox/stale/duplicate Realtime scenarios pass.

## Baseline

- `test/hosted-cas-two-client.test.ts` — deterministic harness
- Manual two-browser not yet recorded

## Allowed scope

- Playwright two-context test OR documented manual script with timestamps
- Extend fault harness: offline A, duplicate Realtime, stale CAS
- Record evidence in worksession + artifact log under /opt/cursor/artifacts
- No Production; synthetic Development households only

## Forbidden

- Claim shipped without green harness
- Real household data in tests

## Acceptance

- [ ] 10-sample p95 latency ≤ 500 ms Dev (document network)
- [ ] Offline outbox convergence
- [ ] Stale write → conflict, not overwrite
- [ ] Duplicate Realtime → idempotent
- [ ] verifier subagent PASS on claims

## Cursor prompt

```text
Implement T1-S5 from docs/briefs/sync/T1-S5-two-browser-proof.md.

Extend two-client sync proof: Playwright or Vitest harness with two contexts on disposable Development. Measure A-post → B-visible latency (target p95 ≤ 500ms). Cover offline outbox, stale CAS conflict, duplicate Realtime delivery.

Run full pnpm check. Save evidence log. Invoke verifier. Handoff with latency table and test commands.
```
