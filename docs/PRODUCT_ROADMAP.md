# Hearth — Kitchen ledger to household family office

This is the product vision. It is directional. Jonathan still approves anything that moves money, talks to a bank, or leaves the Development snapshot. Sheets-era calendars (September 1 test build, clasp, dashboard-as-spreadsheet) live in [reference/sheets-era/ROADMAP.md](reference/sheets-era/ROADMAP.md). History, not a bible.

A rival memo called Hearth a “mathematically flawless” ledger that “syncs flawlessly,” then jumped to Open Banking, Interac APIs, Stripe Issuing, and Budgeting-as-a-Service on an 18-month clock. The destination is right. The sequence is a pitch deck, not a build.

This document keeps every one of those destinations, adds the ones they missed, and names **the gate, the command path, the risk, and the proof** for each. Investors fund engines. They also fund teams that know which wire is live.

---

## The one-sentence pitch

Hearth is the first household **general ledger** two people can run from a kitchen table — Toronto time, CAD cents, splits that must sum, tips that preview as posted — and the rails that turn that ledger into a family office: settle, reserve, sweep, and eventually spend, without ever letting a bank feed write money the household did not confirm.

## Why this is not another budget app

Mint, Copilot, and YNAB are **single-player envelopes** on top of a bank feed. Banks are **single-legal-entity ledgers**. Jonathan and Bianca are a two-player kitchen: variable tipped income, a steady paycheck, joint groceries, personal rows, a Visa that is not an expense when paid. That shape is the product.

What we already own, that those apps fake:

| Primitive | What it is in Hearth today | Why it is the moat |
|---|---|---|
| Trust boundary | `src/core/commands.ts` — validate, clone, commit, undo | UI cannot write a partial row |
| Money meaning | Expense / income / transfer / refund (D-016, D-008) | Card payments are not spend |
| Ownership | Splits array that must sum; leftover cents to the last person (D-009) | 70/30 is a first-class document, not a note |
| Tips | `calcShiftAmounts` is the only math; preview = post (D-028) | Variable income is not a memo field |
| Books | PGlite Postgres 18 journal; trial balance; Health refuses imbalance (D-033) | Debit = credit is a constraint, not a chart |
| Two phones | Phrase + join link + Hearth Pass; merge-by-id; tombstones (D-032, D-036) | Concurrent adds do not wipe; deletes stay dead |
| Google bridge | `withGoogle` on demand; shared links; tokens on-phone (D-043) | Identity and calendars without a bank feed |
| Time | `America/Toronto` civil dates; Sunday weeks (D-007) | DST does not invent a week |

The rival memo skipped the buyer. **Bianca** is the buyer. If she will not add a grocery split from a phone, there is no family office. Jonathan’s shifts are the hard income problem. The books are the hard trust problem. All three have to stay true as we scale.

---

## Origin — before Cursor, and what we kept

### Sheets era (through `v0.0.31`, git tag `sheets-v0.0.31`)

The household already had a working Google Sheet. Codex / Claude / Gemini reviewed it as a tri-AI shop. What that era got **right**, and what Hearth still obeys:

- Git as source of truth (D-001). Development vs production never mixed (D-002).
- Transaction Input as a pure validator plus a locked three-stage commit.
- Add Shift: one settings-driven, cent-rounded calculation for preview and post. Negative net tips allowed.
- Duplicate fingerprint vs flag vs reviewed `isDuplicate`.
- CAD is the only currency; account currency is authoritative (D-021, v0.0.30).
- ~500 transactions/month design load; 12-month fixtures.
- Bank import **deferred on purpose** (D-011) so the write kernel would exist first.

What that era could not survive: a 3,300-line `Code.gs`, a 15-item operator menu, a dashboard that rewrote a spreadsheet, `setHours(0,0,0,0)` weeks, blank member columns as “joint,” transfers jammed into Income/Expense, Add Category that could partial-write, and a product Bianca would not live in.

The old roadmap’s Phases 0–5 (ecosystem, review, September 1 test build, planning, Bianca beta, October freeze) were a **prototype calendar**. They produced the money rules. They are not the product calendar now.

### Cursor rebuild (this repository, kitchen site live)

Hearth is the working tree on GitHub `main`. Cloudflare Worker `hearth-books` is the website. Supabase Postgres `tykhocwacaxwquhynkok` holds hosted snapshots. PGlite is the on-phone journal.

Shipped and verified in tests (`pnpm test`, 63 passing as of the rebuild):

- Home / Plan / **+** / Books / More
- Spend, income, shift, transfer, refund, category, budget, goals, recurrences
- Household vs Personal vs Both; two-phone pairing
- Queued writes, confirm sheets, Remove, LIFO undo
- Double-entry compile after every commit
- Demo kitchen + 12×200 scale fixture

Still unfinished, and **named so investors cannot be surprised**:

- Hosted RLS is `USING (true)` until Auth exists (D-015, D-034). Phrase-join now also filters environment; that is not a lock.
- GitHub 2FA is still open (D-020).
- Daily kitchen (Hercules, chalkboard, Ask) is cosmetics on a command kernel (D-042, D-044). It does not close the hosted door.

We do not tell a room the sync is flawless. We tell them the **command kernel** is trustworthy, the **hosted door is not yet a lock**, and the next money we spend is to close that door before we invite a bank.

---

## How to read the chapters

Each chapter has:

1. **Entry gate** — a household or engineering fact that must be true. Not a calendar date.
2. **Investor window** — the rival’s months, translated into “if Chapter *n* is true, this is the plausible window.”
3. **Build** — exact objects on today’s architecture (`postEntry`, `postTransfer`, `postShift`, `compileHousehold`, Health, pairing).
4. **Proof** — what Gemini QA’s on the kitchen site, and what `pnpm test` must cover.
5. **Kill criteria** — when we stop, pivot, or refuse a partner.

Nothing in Chapters 1–4 writes a bank row without going through the same command path as a typed grocery.

```text
Kitchen daily use (Ch 0)
        |
        +-- labeled history (Sheets JSON, then CSV)
        |         |
        |         v
        +-- Auth + RLS  ---- Open Banking suggest ---- confirm ---- postEntry
        |
        +-- 8 weeks of posted shifts ---- tip forecast (not money)
        |
        +-- split rows that are not joint ---- IOU ---- Interac request ---- later Interac rail
        |
        v
Safe-to-spend + tax lockbox + sweep-as-transfer (Ch 2)
        |
        v
Issued card whose auth webhook calls the same split math (Ch 3)
        |
        v
Protocol extract: command log + journal compile + merge/tombstone (Ch 4)
```

The rival asked: *Open Banking categorization first, or predictive tips first?*

**Neither.** Both are Chapter 1 **after** Chapter 0. If we must pick inside Chapter 1: **import-shaped `postEntry` (CSV) and an IOU object before Flinks; tip forecast after eight posted weeks of real shifts.** An on-device model with no labels is a demo. A weather-based tip number that posts itself is a financial incident.

---

## Chapter 0 — Kitchen table, daily trust

**Entry gate:** Kitchen site is Hearth (not a Hello-world Worker). Development pill is the default. Bianca can add a grocery split without a 15-item menu.

**Investor window:** now → first real weeks of daily use. This is the unglamorous chapter that makes every later chapter honest.

### 0.1 Close the hosted door

| Work | How, on this codebase | Proof |
|---|---|---|
| Auth | Supabase Auth for Jonathan and Bianca. Publishable key stops being the only credential. | Phrase-join still works; anonymous PostgREST cannot dump `household_snapshots` |
| RLS | Replace `USING (true)` with household membership. Environment is a column in the policy, not a hope. | Joining `copper-thyme-zephyr` from Production cannot overwrite Development |
| Phrase + environment | `pullSupabaseHousehold` filters `invite_phrase` **and** `environment` | QA: two pills, same phrase, two clouds |
| PGlite per env | `idb://hearth-books-development` vs `idb://hearth-books-production` | Switching pills does not mix journals |
| GitHub 2FA | D-020 | Account that owns the remote is locked |

Until 0.1 is true, **no bank, no Interac, no issued card.** That is the adult sentence the rival memo omitted.

### 0.2 Make the household boringly correct

| Work | How | Proof |
|---|---|---|
| Sit-down dollars | `sitDownPreview` shows CAD, not jargon. Copy last month, trim overspend, commit through existing sit-down command. | Plan tab: numbers a human would say out loud |
| Goals | Kill hardcoded +$50. `contributeToGoal` is already a command. Home shows real progress. | Seed $340 / $1600 remains data, not a constant |
| Recurring auto-post | Calendar shows due items and spotted bills. Mark paid / Post due recurring confirm, then `postOneRecurrence` / `postDueRecurrences` → `postEntry`. | Calendar and More never surprise-write |
| Calendar reminders | Optional Google overlay for both members; `.ics` always. Tokens on-device. D-040, D-043. | Google event exists; ledger row does not until confirm |
| Sheets inheritance | Sanitized JSON export from the prototype mapped through `postEntry` / `postShift` / `postTransfer`. Historical blank Shift IDs stay unmigrated (already decided). | Health clean after import; duplicates flagged, not auto-merged |
| Confirm + undo | Already shipped (D-036). Keep it as law for every new writer. | AI_QA.md smoke pass stays green |

### 0.3 Sit-down as the family-office ritual

The rival jumped to lock-screen widgets. The household already has a **monthly sit-down**. Productize it:

- **App/website:** Hearth  
- **Tab/page:** Plan → Sit-down  
- **Instructions:** pick last month, see copy vs actual, trim, confirm, undo from More → Recent changes.

This is the operating cadence of a family office: close the books, then decide. Widgets come after the close is trustworthy.

**Kill criteria:** If Bianca will not open Hearth for ordinary groceries after two weeks of Development use, we do not spend on Flinks. We spend on the Add sheet.

### 0.4 Daily kitchen (habit without a second ledger)

The household will not become a family office if the app is only opened in guilt. Daily Hearth is the ever-expanding map: [DAILY_HEARTH.md](DAILY_HEARTH.md). D-042.

| Work | How | Proof |
|---|---|---|
| Chalkboard | `scribbleChalk` / `wipeChalk`; shared; tombstoned; never `postEntry` | Chalk does not change `transactions` |
| Hercules | Mood computed; hats/chains/collars/houses (incl. patio / ruff) unlock from posted facts + Toronto season; dock hides on Add; `askHercules` | Equipping a locked cosmetic throws; chat `postedIds` empty |
| Visit spark / clink / Sunday envelope | `localStorage` per pill | Not in the snapshot, not in Sync |
| Ask the books | `askBooks` projections; SQL still `assertReadOnlySelect` | Groceries / balance / due answers without SQL |
| Phrase + environment | `pullSupabaseHousehold` filters both | Join URL contains `environment=eq.` |
| PGlite per env | `idb://hearth-books-development` vs `-production` | `booksIdbName` |
| Sit-down CAD / goal add | Plan tab shows last/next dollars; typed contribution; postcard on Home | No `+"50"` in the UI |
| Cook-off / shift pulse | Household groceries vs coffee; trailing 8-week shift average | Never names a person; forecast never `postShift` |

Bank, Interac, and cards still wait on 0.1. Cosmetics do not wait — they must not write money.

---

## Chapter 1 — Frictionless truth

Rival Horizon 1, rebuilt. **Investor window:** after Chapter 0 gates, typically the next two quarters of a serious build — not “month one” while RLS is open.

### 1.1 Import-shaped writes (the missing step)

D-011 said: defer bank integrations; keep an import-shaped command path. That path is the whole game.

1. **CSV adapter** — map date, amount, account, memo → `NeedsConfirmationError` or `postEntry`. Currency must be CAD. Duplicates use the existing five-day scorer.
2. **Single-tap confirm** — the UI is a review list, not an auto-poster. Confirm calls the command. Undo tombstones.
3. **Split suggestion** — if the merchant is a known joint grocery, default Who = Split % from last time at that place. Bianca can still type 60.

This is “zero-touch” without lying. Touch is one confirm. The ledger stays a command kernel.

### 1.2 Open Banking (Flinks first, Plaid as backup)

Canada: **Flinks** (majority of FI coverage, Interac ecosystem) then Plaid’s Canadian rails. Not “Plaid/Flinks” as a shrug.

| Step | How | When it is allowed |
|---|---|---|
| Sandbox | Read-only transactions into a **staging** household on Development | Auth + RLS live |
| Categorization | On-device rules first: merchant → last subcategory + last split. ML only after **≥90 days of confirmed labels** on this household. | Model never calls `postEntry` |
| Multi-row splits | Bank feed is one Visa authorization. Hearth still stores **one transaction, N splits**. The model proposes percentages; cents still fill to 100% | Existing split math |
| Webhook | Cloudflare Worker receives Flinks events, writes an **inbox table**, never the journal | Inbox → confirm → command |

**Kill criteria:** If a feed posts even one row without confirm, the integration is rolled back. If a FI requires storing bank passwords, we refuse.

### 1.3 Predictive shift intelligence

Do not forecast into the journal.

| Step | How |
|---|---|
| Features | Posted `postShift` history (hours, wages, tips, weekday, member, settings fingerprint). Optional: Environment Canada weather, City of Toronto events — as **explanatory** inputs, not as money. |
| Model | Gradient boosting on-device or a tiny Worker; output is a **forecast document**: expected wages, tips, net, and a range. |
| UI | Home pulse: “If Thursday looks like last six Thursdays, tips land near $X before you clock in.” |
| Liquidity | Forecast income **minus** due recurrences **minus** unpaid IOUs. That number is a projection, like trial balance, not a row. |

**Entry gate:** ≥8 weeks of real posted shifts for Jonathan, Health clean. Until a trained model exists, Home shows a trailing-average **shift pulse** from posted `postShift` weeks (`shiftForecastDisplay`) — already in the app after the Hercules Update. That pulse is a projection. It never calls `postShift`.

**Kill criteria:** If forecast is ever posted as wages without `postShift`, that is a P0.

### 1.4 Real-time settlement (IOU → Interac)

The rival’s “Pending IOUs” are not a concept in the code yet. Splits exist. Settlement does not.

**Object:** `Settlement` — from_member, to_member, cents, source_transaction_ids, status (`owed` / `requested` / `paid`). Paid is a `postTransfer` between personal funding accounts **or** an external payment marked as clearing that transfer.

Sequence (this is how Interac actually happens for a household app):

1. **In-app IOU** — after a Shared split that is not 50/50 joint, Home shows “Bianca owes $18.42” / “Jonathan owes …”. Tap marks paid via `postTransfer` (Visa/chequing already in the catalog).
2. **Interac Request Money deep link** — `interac://` / bank app URL with amount + memo `Hearth IOU-…`. No partnership required. User confirms in their bank. Hearth marks `requested`, then `paid` when they tap “I sent it” — still a command, still undoable.
3. **Interac e-Transfer API** — only with a registered partner (a bank, EMT, or a payments-platform sponsor). Canada does not hand that API to a two-person Vite app. When a sponsor exists, the Worker holds the credential; the phone still only confirms.

**Kill criteria:** Auto-sending e-transfers without a confirm sheet. Mixing IOU payment as an `expense` (it is a transfer).

---

## Chapter 2 — Autonomous liquidity

Rival Horizon 2. **Investor window:** after Chapter 1.1–1.4 are in daily use, not in parallel with an open RLS policy.

The pivot is real: stop only recording, start **proposing** where cash goes. The writer is still `postTransfer`. Autonomy is a **mandate**, not a daemon with the household’s chequing password.

### 2.1 Safe to spend (the real widget)

Lock-screen “84 days of runway” is a projection:

```text
runway_days =
  (chequing + cash - credit_used - tax_lockbox - funded_goal_shortfall)
  / max(1, daily_essential_burn)
```

- Essentials = rent, utilities, groceries categories, due recurrences.
- Credit used = Visa liability from the books (already a liability account in the journal).
- Emergency buffer is a **goal** with a target (the rival’s $5,000 is data, not a constant — same class of bug as Goals +$50).

**App/website:** Hearth, later a PWA widget / iOS lock-screen once we are a installed app.  
**Tab/page:** Home hero, then a widget that reads the same projection.  
**Proof:** Health clean; changing a recurrence changes runway; a transfer to the lockbox reduces safe-to-spend.

### 2.2 Tax-optimized tip harvesting

Jonathan’s nightmare is real. Implementation is a **liability account**, not a new math religion.

1. Shift settings gain `tax_reserve_bps` (basis points) — user-owned, like tip-out rules.
2. After `postShift`, a second command `reserveTaxForShift` proposes `postTransfer` wages/tips income account → `ACC-TAX-CRA` (liability or contra-asset lockbox).
3. Confirm once: “Always reserve 18% of net tips” = a mandate. Each shift still appears in More → Recent changes as its own undo token.
4. Year-end: export journal lines for that account. That is the CRA pack, not TurboTax.

Negative net tips: reserve can be $0; never invent a positive tax on a loss.

### 2.3 Dynamic cash-flow routing

Bianca’s 15th payday and Jonathan’s daily tips are **recurrence + shift forecast**.

Once: buffer goal funded AND tax lockbox current AND due recurrences posted:

- Hearth proposes a sweep: chequing → HYSA / Wealthsimple Cash / EQ Bank as a **transfer**.
- First 30 days: always confirm.
- After 30 days of no reversals: optional auto-sweep **ceiling** (e.g. max $200/day) with a push: “Swept $50. Undo until 8pm.”

There is no “the app moves money at the bank” until Chapter 3’s rails or a Flinks payment-init (which is a separate, heavier regulation). Until then, sweep = Hearth transfer + “open your bank and match this.” Matching is 1.1’s import.

**Kill criteria:** Sweep that books income. Sweep that bypasses undo. Sweep of personal rows from the household view.

### 2.4 Algorithmic goal acceleration (pulled forward)

The rival parked this in Horizon 3. It is a Chapter 2 feature: `contributeToGoal` already exists.

- Trigger: shift net > trailing 6-week median.
- Offer: “You crushed Thursday. $50 to Bianca’s trip?” Confirm → command.
- Never intercept a surplus without a tap until a mandate exists, same as sweep.

---

## Chapter 3 — Virtual family office

Rival Horizon 3. **Investor window:** after we are a payments participant or have an issuer sponsor. This is measured in **licenses and partners**, not in sprints.

### 3.1 Virtual joint cards

Stripe Issuing is the demo partner (US sandbox). **Canadian Mastercard on a two-person PWA is a BIN sponsor problem** (Collabria, Peoples, a credit union, or an EMT). We do not pretend otherwise.

When a sponsor exists:

1. Authorization webhook hits the Worker.
2. Worker loads the household snapshot, runs the **same split function** as Add → Split % (70/30 is data).
3. Two pulls: Jonathan’s funding account 70%, Bianca’s 30%, remainder cents to the last person.
4. Journal: one purchase expense with splits, **or** two personal expenses + a clearing transfer — product decision at design time, one meaning, Health must stay clean.
5. If either pull fails: decline the auth. Do not book a partial.

Until then, the “card” is the Visa already in the catalog, paid as a transfer, imported in Chapter 1.

### 3.2 Multi-currency and FX as journal lines

D-021 is CAD-only for a reason. When we unlock FX:

- Account.currency becomes real.
- A USD swipe books USD on the card, CAD on chequing, and an **FX spread expense** (or transfer-with-gain) as its own journal lines. Base-currency trial balance stays CAD.
- No silent conversion. Same rule as the old USD-label bug.

Entry gate: a real trip or a USD account. Not a toggle for the pitch.

### 3.3 Family office surface

Beyond the rival:

- **Close package** — monthly PDF/CSV of trial balance, income statement, IOUs cleared, tax reserved, goals. The sit-down output.
- **Heirs / parents** — a third member is already a catalog row. Visibility `household | personal | both` scales past two people. Auth must exist first.
- **Advisor read-only** — a Hearth Pass with no personal rows is already the envelope. A CPA gets Books SQL dump, not the Sheet.

---

## Chapter 4 — The protocol

Rival Horizon 4. White-label when **three** households besides Jonathan/Bianca have used Chapter 0–1 without a Health incident — not at month 18 because a slide said so.

### What we actually productize

Not “the budget app.” The **Hearth Protocol**:

1. Command documents (plain JSON) with integer cents and Toronto civil dates.
2. `compileHousehold` → balanced `journal_entries` / `journal_lines`.
3. Merge-by-id + tombstones for two (then N) devices.
4. PGlite on the edge, Postgres in the cloud, same schema.
5. Confirm-before-feed as a required adapter interface.

BaaS customers (other startups, credit unions, union benefit apps, restaurant-staff cooperatives) pay for the **sync + books + split kernel**, and skin their own UI. Cloudflare + Supabase is one reference host, not the product.

### Regulatory track (the rival left this out)

| If we… | We need… |
|---|---|
| Read bank feeds | PIPEDA, consent UX, Flinks contract |
| Initiate Interac | EMT / payments-institution sponsor, FINTRAC as applicable |
| Issue cards | BIN sponsor, network rules, dispute ops |
| Auto-sweep at a bank | Payment-init / open-banking write scopes, not just read |
| Sell BaaS | SOC 2, tenancy, no `USING (true)` anywhere |

Fort Knox is the **command kernel**. The cloud is not Fort Knox until Chapter 0.1.

---

## What the rival memo missed (and we will sell)

1. **Bianca’s grocery time-to-post** as the north-star metric, not “autonomous engine” slideware.
2. **Sit-down close** as the family-office ritual.
3. **IOU object before Interac API** — Canada will not give us that API first.
4. **Import path before ML** — D-011 was correct.
5. **Forecasts that are not money.**
6. **Environment-aware pairing** — the one sync bug that would wreck a bank feed.
7. **Visa payment as transfer** — already shipped; card issuing is a sequel, not a rewrite.
8. **Negative net tips** — a tipped household that cannot book a bad night is not production-ready; we already can.
9. **Health as an audit opinion** — “Clean” is the consumer word for an unmodified opinion on the books.
10. **Canadian stack by name:** Flinks, Interac Request Money, EQ Bank / Wealthsimple Cash for sweep destinations, CRA lockbox, Toronto civil time.

---

## Investor scoreboard

| Chapter | Household proof | Technical proof | Partner |
|---|---|---|---|
| 0 | Bianca posts a split grocery unaided; sit-down closes a month | Auth, RLS, env-aware join, Health clean on real Development data | None |
| 1 | CSV/Flinks inbox confirmed to journal; IOUs clear; shift forecast on Home | All writers still commands; duplicates still five-day scorer | Flinks sandbox |
| 2 | Tax lockbox moves after shifts; runway widget matches books; goal nudges | Sweeps are `postTransfer`; undo works | Optional HYSA destination |
| 3 | A swipe splits 70/30 without a spreadsheet | Auth webhook → split → two pulls or decline | BIN sponsor |
| 4 | A third household on the protocol | Tenancy, SOC 2 path, documented adapter interface | First BaaS design partner |

---

## Near-term build order (the actual backlog)

Do this in order. Skip nothing to chase a demo.

0. GitHub 2FA (D-020). Auth + RLS. Phrase + environment. PGlite per env.
1. Sit-down dollars, real goals, recurring preview-on-open.
2. Sheets JSON import through commands.
3. IOU + “I sent Interac” + deep link.
4. CSV import inbox + confirm.
5. Trailing-average shift pulse (forecast v0).
6. Tax lockbox mandate after `postShift`.
7. Safe-to-spend / runway on Home.
8. Flinks sandbox, still confirm-to-post.
9. Forecast v1 after eight weeks of shifts.
10. Partners: Interac sponsor, then issuer — only when 0–8 are boring.

---

## Line to the other executive

You named the right company. You skipped the door lock, the IOU, the confirm, and the buyer. Hearth will become a household family office **because** the journal cannot lie, not because a Worker called an API. We will take every destination on your slide — Open Banking, tip forecast, Interac settlement, sweeps, tax reserve, runway, issued cards, FX lines, BaaS — and we will date them by **gates on this kernel**, not by month numbers that assume Flinks and Stripe Issuing are npm packages.

The next dollar of engineering is Chapter 0.1, not a model of Thursday’s tips.
