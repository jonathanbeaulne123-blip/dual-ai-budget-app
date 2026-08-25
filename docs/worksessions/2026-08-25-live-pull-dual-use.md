# Hearth worksession — Live pull dual-use

- **Status:** OPEN
- **Opened:** 2026-08-25 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/live-pull-dual-use-f375`
- **Baseline SHA:** `6eeff0c` (`main` after quiet sync #107)
- **Head SHA:** `87fc751` → follow-up commits on same branch
- **PR or issue:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/109
- **Risk:** Medium (continuity pull + conflict absorb; money meaning preserved — no silent LWW)
- **Decision owner:** Jonathan
- **Environment impact:** Development (no hosted schema; REST pull of existing snapshot row)

## Household outcome

Two signed-in phones on the same household see each other's money while both kitchens stay open, without tapping Sync. Non-overlapping shared posts merge quietly. Same-row money divergence still opens the conflict sheet. Auth kitchens no longer show Publish/Sync.

## Budget delta (5)

`+3` — partner posts arrive via live pull; disjoint shared money absorbs; conflict sheet only when shared money actually diverges; outbox resumes after choose.

## Engagement delta (3)

`+1` — healthy pending chip is quiet (`Sharing…`); Auth Invite drops the manual Sync CTA.

## Verified baseline

- Quiet sync (#107): ledger flush immediate; kitchen enqueue + background flush; undo toast only for TXN/SHF.
- Continuity outbox: `blockedByConflict` skipped on flush until cleared.
- No `@supabase/supabase-js` Realtime client in this tree — pull is REST GET of one `household_snapshots` row by id.
- Development last-sync undo (D-119) restores whole `lastSyncAnchor` snapshot.

## Scope

### In scope

1. Visibility-aware live pull interval (scale-aware ms)
2. Quiet healthy pending chrome; hide Auth manual Sync
3. Auto-absorb non-overlapping shared money; conflict only on diverge
4. Clear outbox conflict blocks + force flush after conflict choose
5. Elaborate Dev undo dual-use risk (item 5) and post-conflict resume design (item 6)

### Out of scope

- Supabase Realtime websocket client (follow-up for 100-person)
- D-124 dated restore points
- Silent money LWW
- Production schema / RLS changes

## Scale capabilities (current REST poll)

| People (active members hint) | Interval | What works | Limit |
|---|---|---|---|
| **2** | 4s when tab visible | Jonathan + Bianca both open → partner post within ~4s after flush | Fine for daily dual-use |
| **10** | 5s | Same household, more devices; still one row GET per open kitchen | Acceptable; more CAS conflicts if everyone posts at once |
| **100** | 8s (stopgap) | Poll still correct but chatty; prefer Realtime `postgres_changes` on `household_snapshots` | Do not ship 100 concurrent open kitchens on poll alone |

**Transport today:** Auth session + membership-gated REST. Outbox still store-and-forward. Live pull does not replace CAS; it only shortens “open kitchen → see partner” lag.

**Realtime path (not built):** subscribe to `household_snapshots` filter `household_id=eq.…`; on CHANGE run the same reconcile absorb/conflict path. Better for 10–100 concurrent focused tabs.

## Item 5 — Dev undo dual-use (elaborate; not shipped this PR)

**Problem:** Development undo / “Revert to last sync” restores the whole `lastSyncAnchor` household. If Bianca posted after your last ack and your phone already live-pulled her rows, undoing *your* coffee can wipe *her* bread when the toast path prefers the anchor over the LIFO token (`applyUndo` Dev branch).

**Must not keep:** whole-snapshot last-sync as the dual-use default once two people write concurrently.

**Options (decide later):**

1. **Toast undo = token snapshot only** — still unsafe in dual-use: `undo()` tombstones every txn/shift added after the token snapshot, including a partner’s live-pulled post.
2. **Confirmation-scoped undo (recommended next)** — remove/reverse only this member’s `postedIds` / confirmation; leave partner rows; then CAS.
3. **D-124 dated restore points** — hosted list, owner-only restore; still needs rebase/reconcile so restore does not clobber concurrent partner work.

**Recommendation:** ship (2) next as High-trust chrome. Do not silently change D-119 without Jonathan’s line.

## Item 6 — Post-conflict outbox resume (elaborate + wired)

**Problem:** On CAS conflict the outbox item sets `blockedByConflict: true`. Flush skips blocked items forever. Compacting enqueue used to inherit the block. Users needed manual Publish/Sync.

**This PR:**

1. `clearContinuityOutboxConflictBlocks` after conflict choose
2. Enqueue no longer inherits `blockedByConflict`
3. Force flush after choose so Auth users do not need Sync

**Still careful:** choosing **local** against a higher remote revision may still need a correct CAS `expectedRevision` (pre-existing). Absorb path should avoid most dual-use conflicts.

## Acceptance evidence

- [ ] Focused tests: live-pull intervals, absorb, outbox clear
- [ ] `pnpm check`
- [ ] Pairing Auth path: no Sync button; muted background-share copy
- [ ] Docs: worksession + handoff with 2/10/100 + items 5–6

## Plan

- [x] `pullHouseholdSnapshotById` + App interval / visibility
- [x] Disjoint absorb in reconcile
- [x] Hide Auth Sync; quiet Sharing… chip
- [x] Conflict → clear blocks → force flush
- [ ] Tests + check + PR

## Evidence log

- `pnpm exec vitest run test/live-pull-dual-use.test.ts` — 8 passed
- `pnpm check` — 478 tests passed; `tsc` + vite build ok
- Artifact: `/opt/cursor/artifacts/live-pull-check.log`

## Remaining uncertainty

- Two-browser manual proof still needed after merge
- Undo (item 5) not changed this PR — awaiting Jonathan’s pick among options
- Realtime not in tree; 100-person remains design-only

## Handoff

Next owner: Jonathan reviews PR. Local → branch → draft PR. Not merged, not deployed.
