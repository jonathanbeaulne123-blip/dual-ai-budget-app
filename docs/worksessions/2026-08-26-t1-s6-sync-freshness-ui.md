# T1-S6 — Sync freshness UI

**Branch:** `cursor/t1-s6-sync-freshness-ui-7270`  
**Baseline:** `main@d3709d0`  
**Risk:** Low–Medium (UX truth)

## Goal

Honest sync freshness in the kitchen header and Pairing card: revision, relative time, actor (shared ledger only), Realtime live vs poll fallback, quiet healthy pending.

## Scope

- `src/syncFreshness.ts` — pure freshness model
- `src/SyncFreshnessStatus.tsx` — accessible status region
- `src/App.tsx` — Realtime status state, reconcile metadata, header row
- `src/Pairing.tsx` — freshness-aware copy (no false “up to date”)
- `test/sync-freshness.test.ts`
- `src/styles.css` — 320–1100 + reduced motion

## Forbidden

- “Synced” / “Up to date” when outbox pending or conflict blocked
- Partner personal detail in shared freshness row

## Verification

- `pnpm test test/sync-freshness.test.ts`
- `pnpm check`
- hearth-ux-auditor
