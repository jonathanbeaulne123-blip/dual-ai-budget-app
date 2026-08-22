# Daily Hearth — ever-expanding product roadmap

This is the living map for making Hearth a **household ritual**, not a spreadsheet people open when they feel guilty. Accounting stays the spine. Fun is a projection on top of true books. Bank connections stay blocked until Auth and RLS exist (D-039, D-011).

Jonathan’s latest instruction wins if this file disagrees with a chat. Rings below only grow. Nothing in a later ring deletes a law from an earlier ring.

Related: [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md) Chapter 0.4, [ROADMAP.md](ROADMAP.md), [DECISIONS.md](DECISIONS.md) D-042.

---

## The product we bought, and the product we are building

The unfinished startup shipped a trustworthy kitchen ledger: CAD cents, Toronto dates, splits that must sum, tips that preview as posted, a double-entry journal, two-phone pairing, Development vs Production. That is the **company**. That is not yet a **habit**.

Customers are screaming for a household budget that covers all bases: **safe, reliable, quick, easy** — and that they open on a Wednesday for no reason. Mint died because it was a monthly chore attached to a bank feed. Hearth should feel like the chalkboard on the fridge: you walk past it, you smile, you add milk, you go on with your life. The books still balance.

**Law:** Commands remain the money trust boundary. Chalkboard scribbles, Hercules the companion, visit sparks, and wardrobe unlocks never call `postEntry`. Mood is computed from household facts. “Punishment” is a face and a sentence, never a fake fee, never a locked wallet, never public shame. Bianca is the buyer.

**Law:** Google is the household bridge, not a second ledger. Tokens stay on this phone. The shared snapshot only stores who is linked. Google never posts money.

**Law:** We do not seek banking approval in this chapter. We make the code and the data door impeccable so that when a bank, Interac, or a card BIN asks, the answer is already yes.

---

## How a household opens this app every day

A useful loop has three beats. All three must stay true:

1. **Five-second truth** — net, this week vs last, a bill that is actually due. Home already had this.
2. **A reason to tap that is not guilt** — Hercules’s mood, a silly chalkboard dare, a hat that unlocked because rent posted on time.
3. **A write that is still a command** — grocery, shift, transfer, “mark paid”. Confirm, undo, Health.

Empty-open streaks as the only dopamine are a dark pattern. A visit spark on this phone is allowed as a gentle “you looked this morning.” Cosmetic unlocks come from **posted money, paid bills, sit-downs, Health, and goals** — facts both phones can see.

---

## Ring 0 — Daily kitchen (this release)

Status: **shipping in the working tree (The Hercules Update).** Home grows a kitchen; the cat also docks on every other tab.

| Piece | What it is | What it is not |
|---|---|---|
| Chalkboard | Shared one-off notes, 80 characters, 12 deep, wipeable, silly prompts | A ledger, a chat, a bill |
| Hercules | Computed mood + earned hats / chains / collars / houses; follows every page; Ask is the same journal brain | A writable score, a fine, a nag bot, an LLM that posts |
| Visit spark | `localStorage` mornings-in-a-row per Development/Production pill | Synced state (Sync must not spam it) |
| Ask the books | Plain-language conversation with the journal | A model that writes SQL the household did not mean |
| Sit-down dollars | Last actual and suggested next, in CAD | Jargon-only preview |
| Goal add | Typed contribution through `contributeToGoal` | Hardcoded +$50 |
| PGlite per env | `idb://hearth-books-development` vs `-production` | One IndexedDB journal for both pills |
| Phrase + environment | Join reads `invite_phrase` **and** `environment` | Same phrase, two clouds, last-write-wins |
| Google household bridge | Link / confirm / Calendar; extra suite is opt-in | A bank, a daemon, a token in Supabase |

### Hercules’s wardrobe (earned, not bought)

| Unlock | Fact |
|---|---|
| Kitchen toque | Any posted expense |
| Bill visor | A repeating item posted through the recurrence path |
| Sit-down chef hat | A monthly sit-down commit |
| Copper chain | Money posted on three different Toronto dates |
| Gold chain | Any goal at 100% |
| Cottage | Health check clean |
| Townhouse | Cottage, no overdue bills, and at least one active recurrence |
| Collar bell | A transfer posted (pay the Visa) |
| Yarn collar | Three chalkboard scribbles |
| Fish treat | A posted shift |
| July patio | Toronto June–August, or any spend in those months |
| Winter ruff | Toronto November–March, or any spend in those months |

Mood: **glowing** / **content** / **restless** / **hiding**. Hiding is for Health findings. Restless is overdue or a hot week. Hercules does not invent CAD.

### Ask the books

Books → **Ask**. Chips for groceries, bills, who spent more, this week vs last, chequing, “are we alright”, goals, coffee. Typed SQL still runs read-only through `assertReadOnlySelect`. Power SQL is behind a fold.

---

## Ring 1 — Rituals (next)

Make the ordinary week feel designed. Still no bank.

- **Kettle whistle** — **shipping:** Home / dock copy changes at Toronto morning / after-shift / Sunday sit-down (`hourInToronto`). Still no collection-agency notifications.
- **Two-player high-five** — **shipping:** both people posted a grocery the same day; Hercules sparks; chalkboard can scribble “nice.” Not a public leaderboard.
- **Bill-paid ceremony** — **shipping:** after confirm → `postOneRecurrence`, Home spark + 700ms visor pop on the dock. The toast still offers undo.
- **Sit-down as a close** — **shipping:** Plan → Sit-down copies last month. Home shows a “we closed …” postcard; pin to chalkboard is optional. The postcard is not money.
- **Weekly cook-off** — **shipping:** dining-out (coffee & lunches) vs groceries as a kitchen game. Household totals only. Never “Bianca spent more.”
- **Grocery list that is not a post** — **shipping:** chalkboard **bought** opens Add with the note filled. Confirm still posts. Hercules hides while Add is open.
- **Sunday envelope** — **shipping:** 20-second screenshot recap. Auto once on Sunday per phone; Home can open it any day.
- **Optional clink** — **shipping:** off by default, `localStorage` per pill.

---

## Ring 2 — Quests and seasons

Expand the wardrobe without pay-to-win. Cosmetics stay facts → unlocks.

- Seasonal houses — **shipping:** patio in summer, winter ruff in the cold months (or after a post in those months).
- Quest: “eight weeks of posted shifts” unlocks a forecast *display* — **shipping as trailing average (Chapter 1.3 v0).** Forecast is still not money.
- Quest: “Health clean for a whole month” unlocks a gold kettle. Computed from activity + Health, not a stored score that can desync.
- Shared photo-of-the-receipt is **out** until Auth: images in a snapshot are a privacy incident.

---

## Ring 3 — Daily gravity (keep adding)

Ideas that keep the app in the pocket. Each one must pass: Bianca would tap it; it cannot write money; it cannot shame.

- Lights-on when the other phone posts (sync already happens; surface a “Bianca added milk” spark).
- **Sunday envelope:** a 20-second recap they screenshot to each other. **Shipping** (Home + auto on Sunday).
- “Safe to skip” — **shipping in chat:** discretionary categories under plan. Projection.
- Name-the-week: chalkboard title for the week (“visa diet”). Cosmetic.
- Shift countdown using existing calendar board, not a new clock.
- Sound: optional tiny clink on save. **Shipping,** off by default.
- Widgets / lock screen only after Chapter 2.1 runway math exists. A widget that lies is worse than no widget.
- Apple Watch / glance: net + Hercules mood. After the phone habit exists.

---

## Ring 4 — Blocked until the door locks

Do not build these as product until Chapter 0.1 is true (Auth + RLS, D-039):

- Flinks / Open Banking / Plaid
- Interac Request Money API (deep links without a sponsor can be Ring 1 copy-only)
- Issued cards, BaaS, other households as customers
- Storing receipts in hosted Postgres
- Push notifications that mention amounts on a shared device

The future SQL for membership RLS lives in [sql/rls_auth_ready.sql](sql/rls_auth_ready.sql). **Do not apply it** while the live policy is `USING (true)` and there is no Auth. Applying it now would lock Jonathan and Bianca out.

---

## Ledger spine (always in progress)

Gamification does not pause accounting. This list only grows.

| Work | Status | Notes |
|---|---|---|
| Command kernel, undo, confirm | Shipped | D-025, D-026, D-036 |
| Double-entry PGlite + trial balance | Shipped | D-033 |
| Calendar / rhythms / ICS / optional Google | Shipped | D-040 |
| Google household bridge | This ring | D-043. Tokens on-phone; `withGoogle` on demand |
| Hercules (Maine Coon) | This ring | D-044. Follows every page. `askHercules` never posts |
| PGlite database per environment pill | This ring | Snapshots were already split; the journal name was not |
| Phrase-join filters environment | This ring | Unique index already `(invite_phrase, environment)` |
| Sit-down shows CAD | This ring | |
| Goals contribution is typed | This ring | `contributeToGoal` was always a command |
| Auth + RLS | Next | Hosted door is not a lock (D-034, D-015) |
| GitHub 2FA | Open | D-020 |
| CSV inbox → confirm → `postEntry` | Chapter 1 | D-011 import-shaped path |
| Recurring preview on open | Next | Still confirm, still `postEntry` |
| IOU object | Chapter 1.4 | Splits exist; settlement does not |

---

## Safety bar (impeccable before any bank)

1. UI cannot write money. Commands validate, clone, commit, undo.
2. Hosted Postgres: publishable key is not privacy. Secret and DB password never in `VITE_` or Cloudflare.
3. Development vs Production never mix — snapshot key, PGlite name, and join filter.
4. Personal rows are a filter, not a lock, until Auth.
5. Read-only SQL cannot `INSERT`/`UPDATE`/`DELETE`. Conversational Ask uses projections first.
6. Cosmetics and chalkboard tombstone like any other shared row so a wipe on one phone stays dead on the other.
7. No dark patterns: no fake overdue fees, no “pay to keep Hercules alive,” no streak that breaks if you do not open the app on vacation. Posting streaks are derived from the ledger.
8. Google tokens never leave this phone. Hosted snapshots may list who is linked. Google never posts money.

---

## How this file expands

When a ring ships, move its table to “Shipped” with the commit / PR. When Jonathan adds a ritual, append a row to Ring 3 rather than creating a parallel doc. When a bank conversation starts, add a kill criterion here **and** in PRODUCT_ROADMAP — never only in a chat.

Kill criterion for Daily Hearth: if Bianca will not add a grocery because Hercules is “in the way,” we shrink the kitchen, we do not add a feed.
