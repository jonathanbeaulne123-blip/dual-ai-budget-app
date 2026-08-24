# 2026-08-24 — Command states Slice A+B (Development)

**Status:** Merged to `main` as [PR #76](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/76) (`462063c`). No hosted schema, Production data, credentials, or secrets changed.

## AI contributions

| Role | Owner | Delivered |
|---|---|---|
| Product decisions | Jonathan | Eight resolved defaults: in-app conflict choose, conditional pending banner, sync-on-write with last-sync undo/reverse (Development), auto-merge messaging, shared-only conflict review, Development-only scope |
| UX / copy / a11y spec | Claude | [`docs/CLAUDE_COMMAND_STATES_UX.md`](../CLAUDE_COMMAND_STATES_UX.md), [`docs/claude/command-states-mockup.html`](../claude/command-states-mockup.html), [`docs/briefs/CURSOR_COMMAND_STATES_UX.md`](../briefs/CURSOR_COMMAND_STATES_UX.md) |
| Implementation | Cursor Cloud Agent (GPT) | Parallel Slice A (`useDialog`, Confirm a11y, 44px pins) and Slice B (`commandSurface`, `syncAnchor`, `ConflictResolution`), `App.tsx` integration, merge with `main` (ledger naming + D-117 continuity), decision renumber to **D-119** |
| Coordination packet | GPT / Codex lineage | [`docs/briefs/SLICE_AB_INTEGRATION.md`](../briefs/SLICE_AB_INTEGRATION.md), [`docs/briefs/COMMAND_STATES_PRODUCT_QUESTIONS.md`](../briefs/COMMAND_STATES_PRODUCT_QUESTIONS.md) |

## Delivered

- Header command chip and conditional pending/conflict/recovery banners derived from `CommandOutcome` / `toCommandSurface()` — no second state machine, no epic `WriteTruth` patch.
- Development sync-on-write transport; `lastSyncAnchor` saved on `synchronized`.
- Undo and “Revert to last sync” restore the anchor in Development (**D-119**); Production keeps D-085 reversal rows until Jonathan approves.
- In-app conflict choose (Keep this phone / Keep cloud) plus export bundle; shared-only diff on screen.
- Add sheet `role="dialog"` with focus trap; Confirm `aria-describedby` / `aria-busy`; 44px pin targets.
- Static Development pill; Production switch hidden for this slice.
- Auto-merge toast via `AUTO_MERGE_MESSAGE` when goal union merges.

## Proof

- `pnpm check` — pass on merged `main`.
- `pnpm test` — **51 files, 373 tests** pass on merged `main`.
- Real-app screenshots at 320 / 390 / 720 / ~1100px (not the mockup gallery).

## Honest boundary

- Unlinked/demo households still show **This phone · Not shared yet** until Google continuity or legacy `linked` transport applies (D-110 containment).
- Conflict choose needs live two-device CAS proof in disposable Development.
- “Recent changes” copy on More still describes generic LIFO undo; tighten to D-119 wording in a follow-up if Jonathan wants.

## Dual Course

- Budget delta (5): **+2** — honest command chrome, sync anchor undo, in-app conflict choose without silent last-write-wins.
- Engagement delta (3): **+1** — accessible Add sheet, clear chip/banner/toast copy, preset prompt unchanged.
