# Command-state product questions — detailed, for implementation

> **Status:** design decisions for Cursor. Jonathan still owns money-semantic choices.  
> **Baseline:** `main@ac6a8b6e0d1b5b9cfe47dfc49c5407cac25e1fd4`  
> **Related:** `docs/CLAUDE_COMMAND_STATES_UX.md` §10, household workspace epic Phase 6, Phase 1 patch.

This file explains each open question against **current code**, what the epic assumed, and a **safe implementation default** that does not invent a second books merge, a second write path, or a second state machine.

---

## How to read the defaults

| Tag | Meaning |
|---|---|
| **UI default** | Cursor may ship this presentation now. It does not change posting, merge, or Auth. |
| **Jonathan** | Do not build the money-choosing path until he says so. Surface honesty instead. |
| **Already true** | Current code already behaves this way; UI should match it. |

---

## 1. Conflict v1: export-bundle-only vs in-app diff/choose?

### What this is asking

When this phone and the cloud both have new work (`conflict-needs-attention`), what can Bianca **do** besides stare at a banner?

- **Export-bundle-only:** show both sides at a high level (revisions, hashes, “nothing was overwritten”), offer **Export conflict bundle**, keep posting paused for share. A human (or later packet) merges offline.
- **In-app diff/choose:** list differing rows, then tap “Keep this phone” or “Keep the cloud” (or a per-row picker). That **is** a merge. It writes a new accepted household.

### What the code already does

- `acceptHouseholdWrite` keeps both snapshots on `household.conflicts[]` (`src/core/conflict.ts` `recordConflict`).
- Auto-merge is **only** allowed when journals/claims/shifts/sit-down/goal-purchases/tombstones/goal catalog are identical; then goal-contribution union runs (`canAutoMergeConflict` / D-111).
- `makeConflictBundle` already exports `{ local, remote }` without merging (`src/core/recovery.ts`).
- There is **no** “choose this side” command. Last-write-wins is refused.

### What the epic assumed (stale)

Epic §8.4 says “show both versions… and require a human choice.” That was written when the author believed **no CAS existed**. Current main **does** stop on stale revision and keep both sides. In-app choose is still a **new money command**, not a chrome change.

### Recommendation

**v1 = review + export-bundle-only (Jonathan for any Keep-this-side button).**

Ship:

- Blocking banner and conflict sheet: This phone rev N · Cloud rev M · “Nothing was overwritten.”
- Actions: **Export both copies** · **Keep working on this phone** (local books stay; share stays paused) · dismiss does not clear the conflict record.
- Do **not** ship Keep this phone / Keep cloud as a merge.

Why: picking a side silently drops the other journal. That is Course A, not UX polish.

---

## 2. Pending banner: always visible vs only offline / after failed retry?

### What this is asking

After a post is accepted locally but share has not finished (`pending-transport`):

- **Always:** a persistent banner until the outbox drains (`Waiting to share`).
- **Quiet:** only a small header chip while Hearth retries in the background; banner only if offline, after a failed retry, or if the queue is blocked.

### What the code already does

- Local accept is real (`postedExactlyOnce === true`).
- Outbox retries on launch, focus, and reconnect (`docs/CLOUD_CONTINUITY.md` D-113).
- `App.tsx` currently maps this to `syncState = "error"` — that is **wrong**. Pending is not a failure.

### What the epic assumed

§8.2 **Queued for transport** — visible, not green. It did not specify banner vs chip.

### Recommendation

**UI default: chip always; banner only when it needs a person.**

| Condition | Chrome |
|---|---|
| Online, outbox retrying, no conflict | Header chip: **Waiting to share** |
| `navigator.onLine === false` | Banner: saved here, will retry |
| Retry failed / `lastError` set / blocked by conflict | Banner + Review pending |
| Outbox empty + `synchronized` | Chip: **Up to date**; no banner |

Why: a banner after every milk post trains people to ignore it. A chip still tells the truth. A banner appears when waiting is no longer boring.

---

## 3. Undo label: “this phone” when not synchronized?

### What this is asking

Undo restores the **previous snapshot** (`undo()` in `commands.ts`), tombstones the posted ids, then runs that restored household through `acceptHouseholdWrite` again. It is **not** `reversePostedMoney`.

If the write never reached the cloud, undo on this phone is the whole story. If it **already synchronized**, undo here may still need to share a new revision — or hit a conflict if the other device already pulled the original post.

### What the code already does

- Toast undo is in-memory `history` (last 20). Reloading the tab loses the toast.
- More → Recent changes can still undo from that session list.
- Undo across relaunch/sync is **not** proven durable (roadmap Phase 1 / epic H5).

### What the epic assumed

§5.5 / §13.7: label exact scope; prefer a truthful narrow undo over an ambiguous one.

### Recommendation

**UI default: label the scope; do not pretend cloud undo.**

| Last outcome | Toast action |
|---|---|
| `accepted-local` or `pending-transport` | **Undo (this phone)** |
| `synchronized` | **Undo** + muted line: “This undoes the snapshot on this phone, then waits to share.” |
| After reload / no token | No toast undo; Ledger **Reverse** is the durable correction |

Do not rename Reverse to Undo. They are different verbs (D-085 vs session snapshot restore).

---

## 4. Auto-merge success messaging?

### What this is asking

Sometimes code **does** merge without a human: two devices added **goal contributions** while the rest of the money journals match. `canAutoMergeConflict` returns true; outcome kind is usually `accepted-local` (not `conflict-needs-attention`).

Should the UI say “Merged compatible changes” or stay quiet?

### What the code already does

- Journals, claims, shifts, sit-down money, goal purchases, tombstones, goal catalog: **never** auto-merged (D-111).
- Only the goal-contribution union is proven.

### Recommendation

**UI default: silence, unless we can name the only thing that merged.**

- If auto-merge ran: no extra toast. The post already has a normal “Posted {amount}” if that write posted.
- Optional Audit/More line, not a celebration: “Goal jar amounts were combined. Journals already matched.”
- **Never** “We merged your books” or “Conflict resolved automatically.”

Silence is the Dual Course win: Course B must not imply Course A merged money rows it did not merge.

---

## 5. Personal rows in conflict review before D-105?

### What this is asking

A conflict snapshot is a **full household**, including each member’s `visibility: "personal"` rows. The conflict sheet could:

- Show partner personal amounts/notes (a leak).
- Show counts (“3 personal rows”) (metadata leak).
- Show **shared-only** diffs (household/both rows) and keep personal out of the review UI.

D-105 already filters partner personal rows from the **model excerpt**. It does **not** yet define a member-scoped conflict projection. Roadmap still marks broader AI disclosure as STOP-SHIP.

### Recommendation

**UI default: shared-only review + export of the sealed bundle.**

On screen:

- Revisions, hashes, environment, “both copies kept.”
- Differing **shared** transaction/shift ids only (no partner personal note, place, or CAD).
- No “Bianca has 2 personal rows” counts.

Export:

- `makeConflictBundle` already includes full snapshots. Treat the file as **sensitive household data** (same rule as workbook export: local-only, never commit). The on-screen review is not the same as the file.

Jonathan if we ever want in-app personal diffs (after a real D-105-style projection).

---

## 6. Repost-after-reverse: prefilled Add vs manual?

### What this is asking

Reverse posts a **new** opposite row dated today; original stays (`reversePostedMoney`, D-085). To put the “correct” milk in, someone must Add again.

- **Prefill:** after reverse succeeds, open Add at Review with amount/category/account/note from the original, visibility preserved, date = today, `reversalOfId` context in the copy — still requires Confirm.
- **Manual:** reverse ends; user starts Add from scratch.

### What the code already does

- Ledger ConfirmSheet: “Reverse this row?” then `reversePostedMoney`.
- Add does **not** open afterward.

### What the epic assumed

§5.5 already specified prefill. That is a **draft**, not a post. Confirm remains the money gate.

### Recommendation

**UI default: prefill the draft (epic §5.5). Confirm still required.**

Copy: “Reversed. Original stays. Review the replacement — nothing new is posted until Confirm.”

Closed month / already-reversed stay validation errors (no prefill).

This does not change journal meaning.

---

## 7. Multi-ledger picker: remember last vs always ask?

### What this is asking

Google sign-in on a device that belongs to more than one household:

- **Remember last:** open the replica this device already had selected (`session.householdId`).
- **Always ask:** every launch shows the picker.

### What the code already does (**Already true**)

- `Session.householdId` is persisted per environment (`src/session.ts`).
- Header **Open ledger** appears when `replicas.length > 1`.
- Google discovery: **one** match auto-opens; **many** shows a picker (`continueWithGoogle` in `App.tsx`).
- Fresh device with no session: picker / demo / join.

### Recommendation

**Keep remember-last. Ask only when we cannot know.**

| Situation | Behavior |
|---|---|
| Session has householdId and replica exists | Open it |
| Google finds many and session empty / unknown id | Picker |
| User taps Open ledger | Always the switcher |

Always-ask would fight D-114’s explicit active replica. Do not add a second “which household?” ritual on every focus.

---

## 8. Production pill: block entirely vs read-only browse?

### What this is asking

Until Auth/RLS (late September):

- **Block:** tapping Production does nothing, or a dead-end “not available.”
- **Read-only browse:** allow the local Production snapshot (often empty) but **no** hosted discovery/push.

### What the code already does (**Already true**)

- Pill is a **local environment switch**, not a cloud switch. Copy already: “This is not a cloud switch.” Production starts empty until you open/join there.
- D-113: Production **Google discovery is disabled**.
- Development and Production are separate replica catalogs.

Epic §4.3: **never hide which snapshot is active.**

### Recommendation

**UI default: keep the pill; do not browse hosted Production; do not pretend Production is live-shared.**

- Tap still switches local books after Confirm.
- Chip/banner if someone is in Production: “Production cloud wait until the security cutover. This phone’s Production replica is local only.”
- Do not enable Production discovery or REST.
- Do not hide the pill (hiding the environment is a trust bug).

“Block entirely” would hide the environment or trap people in Development with no honest empty Production — worse than an empty local ledger.

---

## Incorporation into the household workspace epic

### Short answer

**Yes, fold command-state UX into the epic — as Phase 6 implementation on current `CommandOutcome`, not by applying `claude-ux-epic-phase1` as a patch.**

The Phase 1 patch and §10 `TruthState` / `WriteTruth` types are a **second state machine** on an **old write path**. Current main already has D-111 `acceptHouseholdWrite`. Applying the patch as-is would reintroduce “Saved on this phone, but the books did not accept it” — which the contract forbids.

### What the epic got right (keep)

| Epic slice | Keep in this implementation |
|---|---|
| §8 is the priority phase | Command-state chrome is that phase |
| Honesty over green ticks | Gate success on `postedExactlyOnce` |
| Add as real dialog, 44px, live region, `aria-current` | Salvage from the Phase 1 **patch** |
| Reverse + prefill (§5.5) | Question 6 UI default |
| Failure copy: not posted / previous intact / next action | Map to `userMessage` + retry rule |
| Hercules may explain after reject, never during Confirm | After `toCommandSurface` only |
| 320 / 390 / 720 / ~1100 proof on the real shell | Required; mockup chips are not enough |

### What the epic got wrong vs current main (do not inherit)

| Epic claim | Current fact |
|---|---|
| H1: save can succeed while PGlite fails | **Refuted.** `acceptHouseholdWrite` ingest-before-persist; reject restores previous |
| §10 `WriteOutcome` / `TruthState` | **Superseded** by `CommandUiKind` + posting flags |
| Patch `WriteTruth` + `writeTruthLine` | Collides; “saved but books disagree” is a lie under D-111 |
| Patch `persist()` → `saveHousehold` then `syncHouseholdBooks` | `commitHousehold` already uses `acceptHouseholdWrite` |
| §8.4 “no CAS” | Client revision check + conflict records exist; hosted atomic CAS still unapplied |
| Optional-publish as the model | D-112 / D-113 Google continuity |
| Decisions through D-106 / `main@75574e4` | Baseline is `ac6a8b6` with D-111–D-114 |

### How to merge the Phase 1 patch

**Do not `git apply` the patch onto this branch.** Re-implement the accessibility hunks on current `App.tsx`:

1. `src/useDialog.ts` + Add `role="dialog"` / focus trap / Escape / restore (patch F5–F8).
2. Accessible names on Add chips/selects; duplicate panel `role="alert"` (F10–F12).
3. Nav `aria-current`, FAB `aria-label="Add money"`.
4. Pin hit targets 44×44 and pin-corner padding (`office-phone.css` / `office.css`).
5. **Replace** `WriteTruth` with `toCommandSurface(outcome)` and the copy matrix.
6. One live region driven by command surface, not `writeTruthLine`.

### Suggested implementation slices (one epic, one branch)

| Slice | Risk | Contents |
|---|---|---|
| **A — Add/Confirm a11y** | Medium | useDialog, labels, focus, 44px pins |
| **B — Command surface chrome** | High (claims about money) | header chip, conditional pending banner, conflict/recovery banners, toast gating |
| **C — Correction** | High | truthful undo label; reverse then prefilled Add |
| **D — Visual proof** | Low | real-app screenshots at four widths for each surface state |

Forbidden in all slices: new merge command, Production discovery, schema, Auth/RLS, second enum besides `CommandUiKind`.
