# Slice A+B integration contract

Jonathan decisions (2026-08-24):
1. In-app conflict choose (local vs cloud)
2. Pending: chip always; banner offline/failed/blocked only
3. Sync on write; undo reverts to last sync anchor
4. Auto-merge: show messaging when goal union merges
5. Conflict review: shared-only on screen
6. Reverse reverts to last sync (not reversal journal pair) — Development only
7. Multi-ledger: remember last (unchanged)
8. Production: ignore for this slice

## Shared types
- `CommandSurfaceState` from `src/claude/commandContract.ts`
- `renderCommandSurface(state)` in `src/commandSurface.tsx`
- `lastSyncAnchor` in `src/syncAnchor.ts` — save on `synchronized`, restore on undo/reverse

## File ownership
| Agent | Files |
|---|---|
| A | `src/useDialog.ts`, `src/office-phone.css`, `src/office.css`, `src/Confirm.tsx`, `test/claude-ux-dialog.test.ts` |
| B | `src/commandSurface.tsx`, `src/syncAnchor.ts`, `src/ConflictResolution.tsx`, `src/core/conflict.ts` (resolveConflictChoice), `test/command-surface.test.ts`, `test/sync-anchor.test.ts` |
| Integrator | `src/App.tsx`, `src/styles.css` (banner/chip only), `docs/briefs/COMMAND_STATES_PRODUCT_QUESTIONS.md` |

## App integration points
- After `commitHousehold`: `setCommandSurface(toCommandSurface(outcome))`; save anchor if synchronized
- Replace `syncState` error on pending with derived chip
- `applyUndo`: restore `loadSyncAnchor(env, householdId)` when present
- Reverse guard: restore anchor instead of `reversePostedMoney` (Development)
- Conflict sheet when `conflict-needs-attention` or open conflict record
- `aria-live` from `commandSurface.announcement`
