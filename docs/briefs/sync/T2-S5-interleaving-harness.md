# T2-S5 — Interleaving harness

**Tier:** 2  
**Depends on:** T2-S3  
**Risk:** High

## Goal

Deterministic suite: simultaneous disjoint posts, same-row conflict, reversal vs edit, personal scope, clock skew, duplicate delivery, long offline.

## Acceptance

- [ ] All scenarios in SYNC_ARCHITECTURE.md §8 Tier 2 column green
- [ ] Post-reconcile journal equality + stable hash

## Cursor prompt

```text
Implement T2-S5 from docs/briefs/sync/T2-S5-interleaving-harness.md.

Expand two-client fault harness for command-log interleaving: disjoint merge, same-row conflict, personal isolation, offline replay, duplicate delivery. Run pnpm test. books-auditor + verifier. Handoff with scenario table and results.
```
