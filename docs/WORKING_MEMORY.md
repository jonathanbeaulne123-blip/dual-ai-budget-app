# Working memory — last five updates

This file replaces the long Cursor thread. Use it as the start of a new chat. Do not resume that thread, and do not treat unfinished sixth-pass notes as shipped product.

Canon for money and UX is still [DECISIONS.md](DECISIONS.md), [STRATEGY.md](STRATEGY.md), and the specs linked below. This page is only the recap.

`main` HEAD when this was written: **#53** (`1055d56`). Kitchen: Development. No clasp. No production Sheet. Hosted RLS is still `USING (true)`. Dual Course: books **5**, engagement **3**, books win.

---

## Keep (the last five shipped updates)

These five merged PRs are the live product. Older office / Hercules / appointments work is underneath them; do not re-litigate it.

### 1. Five-object phone Home — #48 · D-079

- **Ship:** `src/OfficePhone.tsx` at `< 720px`. Five objects + three stamps. Milk is still one Confirm.
- **Law:** two UI branches, one kernel. Phone is glance and one-tap. Do not turn it back into seventeen rows.
- **Keep this brief:** [CLAUDE_MOBILE_SHELL.md](CLAUDE_MOBILE_SHELL.md) (assignment record, already shipped).
- **Kill criterion:** if Bianca cannot add milk, shrink furniture.

### 2. Desktop office brief — #49 · D-080

- **Ship:** docs only. Claude’s next paste is unique desks, sizes, appearance, Edit Desk, default layouts (Tracker / Household+Google / CPA). Catalog may be reshaped, not silently dropped.
- **Keep this brief:** [CLAUDE_DESKTOP_OFFICE.md](CLAUDE_DESKTOP_OFFICE.md) + [packets/CLAUDE-DESKTOP-OFFICE-SOURCE.txt](packets/CLAUDE-DESKTOP-OFFICE-SOURCE.txt).
- **Out:** restyling the phone into a CPA dashboard.

### 3. Warm packing, not a cold lobby — #51 · D-082

- **Ship:** collision-free `packWide`, S/M/L, Edit Desk, four personalities, paper stock *under* the papers. App column `min(900px, 100%)`. Duplicate Books/Calendar/Plan/More handles off the desk (footer nav already exists).
- **Refused:** 10px Bloomberg names, always-open L panels, 1280 boxed `.office`, a second theme engine.
- **Keep:** notebook page, Fraunces names, cream papers, window as weather. Spec: [OFFICE.md](OFFICE.md).

### 4. Kitchen-table sit-down — #52 · D-083–D-087

- **Leftover:** `leftoverProjection` — cash-like − outgoing bills in the next 30 days − card minimums, floored at zero. **Month net is not leftover.**
- **One Confirm** runs `postTransfer` (jar lines also `contributeToGoal`). `applySitDown` still only writes `budgetPlans`.
- **Hard lock:** closed month refuses every money post. `confirmClosedMonth` is gone. Sit-down lock closes *last* month so current-month milk still posts. Reopen stays.
- **Reverse, don’t delete:** `reversePostedMoney` + `reversalOfId`. Both rows stay forever.
- **Auto-code:** on-device merchant GROUP BY. Confirm still writes. Not an LLM. Not a bank feed.
- **Drive:** create-only Sheet with existing `drive.file` scope. Local download always works.
- **Keep this spec:** [SITDOWN.md](SITDOWN.md). Phone stays five objects; sit-down lives on Plan.

### 5. Almost-there office — #53 · D-088–D-094

- **Goals vault** (`purpose: "goals"`, seed `ACC-GOALS`). Sit-down parks leftover jar cash there. Everyday HIS stays general. Pigs are envelopes on the vault.
- **`purchaseGoal`:** real expense from the vault, `GoalPurchase` receipt, pig `retired` (retirement-home shelf, not an 18th Home widget). Do not delete contribution rows.
- **Phone viewport locked** (no pinch-zoom). UI is designed for that lock.
- **Pin-open** (`layout.pinned`, max 4) ≠ calculator cannot-hide (`PINNED_INSTRUMENTS`).
- **Desk JSON** on this Google identity (`Hearth desk.json`, `drive.file`). Layout is still not `splitForSync`.
- **How can I help** when chat opens; click Hercules again to close; perch-on-expand (hop cancels if another widget/tab opens).
- **Wide chalkboard** on the weather glass. Drawing still never posts.
- **Keep this spec:** [GOALS.md](GOALS.md), [HERCULES.md](HERCULES.md), [OFFICE.md](OFFICE.md).

---

## Discard (old chats — do not keep as the plan)

Treat these as closed. Specs that remain on disk are museum or superseded briefs, not the next ticket.

| Chat / artifact | Why it is out |
|---|---|
| This mega Cursor thread after #53, including “sit / beg / bump / Books rundown / duplicate contrast / device list” | **Not shipped.** Working tree was restored to `main`. Do not resume half-patches. |
| [CLAUDE_OFFICE_UX.md](CLAUDE_OFFICE_UX.md) + [packets/CLAUDE-OFFICE-UX-SOURCE.txt](packets/CLAUDE-OFFICE-UX-SOURCE.txt) | Produced the seventeen-row phone. Feeling kept on desktop; do not re-apply to `OfficePhone`. |
| Claude CPA memo PR **#50** (still open) | Adjacent, not one of the last five merges. Who-owes-whom projection only; reversing entries already landed in #52 (D-085). Do not mix into leftover math. |
| Open PRs **#46** (Google roadmap) and **#47** (two shells) | Stacked into **#48**. D-078 / D-079 already on `main`. |
| Open PRs **#19, #18, #22, #24** | Env / QA pack / Cloudflare token / kitchen URL. Not last-five product. Do not open a second Cloudflare-token PR. |
| Cloud agents: env setup, “QA Hearth live app”, calendar retest, kitchen UI test, leftover QA, demo video, add spend, open demo, analyze product, find setup scripts | One-off QA or setup. Not product canon. |
| Sheets-era chats, ODS, `Project Context.txt`, `ai-packets/` | Local-only. Never commit. |
| [nostalgia/](nostalgia/) and [reference/](reference/) | History. Do not cite as the plan. |
| Cursor-era Chapters / Rings / launch essays | Same. Dual Course is [STRATEGY.md](STRATEGY.md). |

I cannot archive Cursor Cloud agent rows from this environment. Close or ignore those dashboard chats yourself; this file is the keep-list.

---

## Still true (so the next chat does not re-argue them)

- Hercules never `postEntry`. Confirm still posts.
- Leftover definition does not move (D-083). Vault is a *destination*, not a new formula.
- Transfers are not income/expense. Card paydown is a transfer.
- Void deletes nothing (D-085).
- Widget layout is this-phone (or this Google identity’s desk JSON). Never the household snapshot.
- Bank / Interac / issued cards wait on Auth + RLS (D-039). Hosted door is still open (`USING (true)`).
- Third-party model keys: Worker secrets only, never `VITE_`.
- America/Toronto. CAD. Jonathan is product owner.

---

## Not shipped (named so nobody “continues” them from memory)

These were asked in the old thread **after** #53. They are ideas, not `main`:

1. Double-click sit + cardboard-bag play.
2. First tap: ears back, beg, red/yellow/green usefulness light — **do not** open chat. Second tap opens help.
3. Expand physics: square / circle / list; expander stays put; others bump; close resets.
4. Books story order + pane rundown; Goals vault first among savings tiles.
5. Duplicate **contrast** UI (confidence 0–100). Do not loosen post-time `scoreSimilarity`.
6. Synced-device list on the kitchen snapshot.

If Jonathan wants them, start a **new** branch off current `main` and implement as complete modules with tests. Do not resurrect the reverted `cursor/sit-attention-cfde` patch.

---

## Next recommended action

Open a **new** Cursor chat. Attach this file plus [DECISIONS.md](DECISIONS.md). Pick one Dual Course slice. Default experiments to Development. Do not clasp. Do not touch production.
