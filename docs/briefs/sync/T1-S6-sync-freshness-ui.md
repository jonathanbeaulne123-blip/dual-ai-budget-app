# T1-S6 — Sync freshness UI

**Tier:** 1  
**Depends on:** T1-S3 (can parallel T1-S5 with Claude UX)  
**Risk:** Low–Medium (UX truth)

## Goal

Audit/Office surfaces show actor, revision, freshness (“Updated just now / 2 min ago”), Realtime disconnected honest state, quiet healthy pending (no spam toasts).

## Baseline

- Command states chrome PR #76
- Quiet Sharing… chip from live-pull

## Allowed scope

- Extend sync anchor / freshness in header or Audit
- Realtime status: connected / catching up / offline
- Viewports 320, 390, 720, 1100; reduced motion
- `hearth-ux-auditor` review

## Forbidden

- “Synced” when outbox pending or conflict blocked
- Exposing partner personal detail in shared freshness row

## Acceptance

- [ ] Freshness string updates on Realtime reconcile
- [ ] Disconnected shows fallback poll honest copy
- [ ] a11y: status region, not color-only
- [ ] hearth-ux-auditor PASS

## Cursor prompt

```text
Implement T1-S6 from docs/briefs/sync/T1-S6-sync-freshness-ui.md.

Add honest sync freshness UI: actor/source/revision, relative time, Realtime connected vs poll fallback state. Integrate with existing command/sync chrome (PR #76). Test 320/390/720/1100 and reduced motion. Run pnpm test. hearth-ux-auditor review. Handoff with screenshot list.
```
