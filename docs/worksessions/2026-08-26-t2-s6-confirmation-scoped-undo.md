# T2-S6 handoff — Confirmation-scoped undo

- **Status:** OPEN (branch + tests; not merged / not deployed)
- **Branch:** `cursor/t2-s6-confirmation-scoped-undo-7270`
- **Base:** `cursor/t2-s5-interleaving-harness-7270` @ `2ad8a20`
- **Depends on:** T2-S2 slim outbox, combined undo engine (D-119), D-124 restore
- **Risk:** High

## Household outcome

Daily **Undo** removes only this member's latest ledger Confirm (`postedIds` + command receipts). Partner live-pulled rows stay. Undo refuses when a reversal already references the row. Owner **Restore** remains separate (D-124). Legacy whole-snapshot `undo()` is deprecated and kept only for regression tests.

## Dual Course

- **Budget (5):** +2 — dual-use-safe undo through command log; reversal journal integrity guard
- **Engagement (3):** +1 — toast + Recent copy state partner-safe Undo explicitly

## Acceptance

| Criterion | Result |
|-----------|--------|
| Two-phone: A undo cannot remove B's concurrent post | ✅ `continuity-command-undo-interleaving.test.ts` |
| Reversal journal integrity preserved | ✅ refuse after partner reversal; undo-of-reversal peel |
| Replace whole-snapshot Dev undo | ✅ `App.applyUndo` → `undoLedgerConfirm`; `undo()` @deprecated |
| UI copy truth | ✅ `commandClassification.ts`, `recentChangesCopy.ts`, toast |
| Command classification table | ✅ below + `src/core/commandClassification.ts` |

## Command classification table

| commandKind | writeKind | correctionRoute | undoScope | partnerSafe |
|-------------|-----------|-----------------|-----------|-------------|
| postEntry | ledger-write | confirmation-undo | This Confirm's posted transaction ids | yes |
| postTransfer | ledger-write | confirmation-undo | Both transfer legs from this Confirm | yes |
| postShift | ledger-write | confirmation-undo | Shift + wage/tip transactions | yes |
| reversePostedMoney | ledger-write | confirmation-undo | Reversal lines (LIFO) | yes |
| undoLedgerConfirm | ledger-write | non-undoable | Tombstones only | yes |
| restorePoint | ledger-write | owner-restore-point | Shared tip; personal rows stay | no |
| hercules-pro-transaction | ledger-write | confirmation-undo | Hercules Pro draft ids | yes |
| commit | kitchen-local | kitchen-local-only | No money ids | yes |
| boot-reconcile / google-discovery / continuity-pull | non-commit | non-undoable | Transport only | yes |

## Files

| File | Change |
|------|--------|
| `src/core/commandClassification.ts` | Classification table + `undoToastSecondaryCopy()` |
| `src/core/confirmationUndo.ts` | Reversal guard before row removal |
| `src/core/commands.ts` | `@deprecated` whole-snapshot `undo()` |
| `src/App.tsx` | Toast uses confirmation-scoped copy |
| `src/recentChangesCopy.ts` | Shared undo copy helper |
| `test/continuity-command-undo-interleaving.test.ts` | Two-phone undo + reversal tests |
| `test/command-classification.test.ts` | Table smoke tests |
| `test/undo-restore-engine.test.ts` | Partner reversal refuse |
| `test/write-safety.test.ts` | Legacy vs scoped regression |

## Verification

```text
pnpm exec vitest run test/continuity-command-undo-interleaving.test.ts test/command-classification.test.ts test/undo-restore-engine.test.ts test/write-safety.test.ts test/recent-changes-copy.test.ts
→ 26/26 passed

pnpm test
→ 715 passed, 2 failed (batch-import-ui SubtleCrypto — pre-existing, unrelated)
```

Books-auditor: **no blocking issues**.

## Uncertainty

- Full `pnpm check` not run this slice (focused tests + full vitest).
- `test/ledger.test.ts` / `test/visibility.test.ts` still call legacy `undo()` for tombstone cases; product path is scoped.

## Next owner

Merge T2 stack T2-S1→S6 after T1. **T2-S5 brief deferred item closed.** Tier 2 gate G4 (undo safety) proof attached.
