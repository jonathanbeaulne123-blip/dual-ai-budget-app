# Dual Course Strategy

This is the living product law for **Hearth**, the household company Jonathan and Bianca run from a Toronto kitchen: family-office books, and a companion who makes those books a habit.

Do not plan from [nostalgia/](nostalgia/). Those files are a museum. This file, [DECISIONS.md](DECISIONS.md), [ARCHITECTURE.md](ARCHITECTURE.md), and Jonathan’s latest instruction are what to build from.

---

## The company in one breath

Hearth is the household **general ledger** two people can run from a phone — CAD cents, `America/Toronto`, splits that must sum, tips that preview as posted, a trial balance that refuses to lie — **and** the education/companion layer that makes Jonathan and Bianca *want* to post milk on a Wednesday.

Mint died as a monthly chore glued to a bank feed. YNAB taught envelopes so hard that a Visa became pretend cash. Tamagotchi taught a check-on loop, then killed the pet. Finch proved a creature can carry real habits, then paywalled the heartbeat. Pokémon Sleep proved the daily act *is* the game.

Hearth already has the rare object: a two-person journal that does not lie. Dual Course is how that object becomes the best budgeting, education, and companion product in the world — without ever letting the companion touch a cent.

**One sentence:** the books are the company (weight **5**); Hercules and every other interactable are how the company gets opened (weight **3**); each course exists to make the other one better.

---

## Dual Course (D-048)

Two courses. One kernel. One household.

| | Course A — Family office | Course B — Companion & interactables |
|---|---|---|
| **Weight** | **5** | **3** |
| **Job** | True books a CPA would recognize, a spouse can post, and a bank could one day settle against | Presence, ceremony, teaching, and play that make posting, rec, and sit-down the thing you *do* |
| **Spine** | Commands, journal, Health, accounts, statements, rec, close | Hercules, chalkboard, wardrobe, wallet tiles, sparks, Ask, rituals |
| **Trust** | `postEntry` / `postTransfer` / `postShift` and kin | Cosmetics and talk. **Never** `postEntry` |
| **Win** | Debits = credits. Card paydown is a transfer. Sit-down is a close. Wallet is the object | Bianca adds milk because the cat is a friend and the tile is a bank book, not because she feels guilty |

### Coupling law

A change is incomplete until it names both deltas:

1. **Budget delta (5).** Which posting, rec, sit-down, account-literacy, split-honesty, Health, or statement primitive got better?
2. **Engagement delta (3).** Which Hercules line, unlock, chalkboard, wallet tile, ceremony, or Ask chip now teaches or celebrates that primitive?

- A Hercules-only PR that does not improve a budget primitive is a toy.
- A Books-only PR that does not surface on an interactable is a developer tool nobody opens.
- **If they conflict, Course A wins.** A prettier cat that hides a grocery, invents CAD, names who spent more, or posts money is a defect. Shrink him.

### What Dual Course is not

- Not two apps. Not two ledgers. Not a game database beside PostgreSQL.
- Not “fun now, accounting later.” Accounting is already shipping. Fun is a projection on facts both phones can see.
- Not a permission to skip Auth + RLS for anything that moves money, reads a bank, or stores receipts (D-039).

---

## Laws that do not move

These are **important features**. Dual Course does not rewrite them. Smaller surfaces may change only with a why-note in [DECISIONS.md](DECISIONS.md).

| Law | Where it lives |
|---|---|
| Commands are the money trust boundary. UI is untrusted. | D-025, D-026 |
| Expense / income / transfer / refund keep their meanings. Card paydown is a transfer. | D-016, D-008 |
| Splits must sum. Joint is explicit. | D-009 |
| CAD only. Integer cents. Account currency is authority. | D-021 |
| Dates are Toronto civil keys. | D-007 |
| Development and Production never mix. | D-002 |
| Double-entry books. Health refuses imbalance. Journal wins if a statement disagrees. | D-033, D-046 |
| Hercules, chalkboard, wardrobe, visit sparks, rec, close, marks, Google, Hercules desk never post money. | D-042, D-043, D-044, D-045, D-046, D-047, D-049, D-050 |
| Hercules never names who spent more. No fake fees. No pay-to-keep-alive. No hunger-meter death. | D-044 |
| Bank feeds, Interac APIs, issued cards: blocked until Auth + RLS. Jonathan approves production money movement. | D-011, D-039 |
| Accounts are financial accounts (chequing, savings, credit, investment, other), not categories. | D-047 |
| Phrase / join link / Hearth Pass join a phone. Google is a bridge, not a bank. | D-032, D-043 |
| Personal rows are a filter until Auth. A hidden tab is not privacy. | D-015 |
| Hosted `USING (true)` is an open door. The publishable key is not a lock. | D-034 |

---

## What already shipped (frozen as product)

Do not re-litigate these as “Chapter 0” or “Ring 1.” They are the kitchen as of this canon:

- Phone-first Home, Calendar, Add, Plan, Books, More
- Command kernel: spend, income, shift, transfer, category, budget, goals, recurrences, undo, confirm, duplicates
- PGlite journal + optional Supabase publish; trial balance; read-only SQL
- Calendar board, rhythms, `.ics`, optional Google overlay; Google never posts
- Phrase / join / Hearth Pass; Shared / Personal / Both
- Development vs Production pills; PGlite per pill
- Home chalkboard; Hercules the Maine Coon (wander, loaf on Add, journal-first talk; OpenAI/Anthropic Worker secrets allowed, then Workers AI); chat and memories in `kitchen.hercules` (D-049); visit spark
- Kitchen habit (D-050): CAD cents pad, Home Milk/Shift/Pay card, guided sit-down, Hercules shift-posting streak from posted shifts
- Audit Office: opinion, statements, equity roll, working capital, notes, rec, close pack
- Accounts Floor: wallet tiles, account rooms, expandable cards, investment marks, interest/rewards as explicit posts
- Kitchen site `hearth-books` from GitHub `main`

How to run the app: repository [README](../README.md). How the layers fit: [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Competitive field (steal the mechanic, refuse the poison)

### Family-office budgeting

| Rival | What they got right | What we refuse | Dual-course take |
|---|---|---|---|
| **Mint** (died 2024) | Net-worth glance, card utilization, “see it all.” The *object* was the account. | Bank feed as truth. Categories as the product. A monthly guilt chore. Intuit killed the habit and kept the data. | Wallet tiles and utilization as pulse / Hercules line, **not** a Health finding. No feed writes. |
| **Copilot / Monarch / Rocket Money** | Beautiful rolls, subscription hunting, household sharing. | Auto-import as the ledger. Soft meaning for transfers. | Import-shaped path later: inbox → confirm → `postEntry` (D-011). |
| **YNAB** | Give every dollar a job. Sit-down as a ritual. Education as a sport. | Visa-as-envelope. Card payment as spend. Budget as a second truth. | Jobs live as categories, goals, and future lockboxes **on the journal**. Pay the card is `postTransfer`. |
| **Actual / Lunch Money** | Local-first honesty. Envelope *tags* on a real ledger. | Becoming a hobbyist toolkit with no companion, or a cloud blob with no trial balance. | PGlite is already local Fort Knox. Hosted books wait on Auth. |
| **QuickBooks / Xero / Wave** | Statements a CPA recognizes. Rec. Period close. | SMB chrome. Payroll-first. A kitchen should not need a controller to add milk. | Audit Office is the household close. Rec and close never post. |
| **Bloomberg / Addepar / Family-office stacks** | Multi-entity, custody, policy. The *word* family office. | Pretending two people with a Visa need a family office *vendor* before they have a door lock. | We earn the noun with a GL, a close pack, and a wallet — then grow entities. We do not skip Auth. |
| **Bank apps** (TD, RBC, EQ) | Tiles → account room → Add defaults there. | The feed writes. The journal is hidden. | Accounts Floor already stole the object. |

### Companion, education, habit

| Rival | What they got right | What we refuse | Dual-course take |
|---|---|---|---|
| **Cash App** | Giant cents pad. Type 1250 → $12.50. | Mouse-wheel CAD. Tiny decimal fields. | Add is a CAD pad (D-050). Digits are cents. Wheel blocked. Confirm still posts. |
| **Typeform** | One question per screen. | Quizzes that block posting. | Sit-down is Look / trims / Apply. Same `applySitDown`. Close pack still locks. |
| **Tamagotchi** | Three buttons. Check-on loop. Care is physical and tiny. | The pet dies. Pay to revive. Care disconnected from real life. | Three care acts: **post**, **rec**, **sit-down**. He hides when Health is dirty. Vacation does not kill him. |
| **Finch** | Pet health = *your* real habits. Glanceable. Tens of millions in ARR because care is a creature. | Paywalls to keep the pet alive. Self-care detached from money truth. | Hercules’s mood is Health, bills, groceries, goals. Unlocks are posted facts. Never a shop for his heartbeat. |
| **Pokémon Sleep** | The daily act *is* the game. Sleep research *is* play. You do not grind a second loop. | Turning money into a gacha. Research that ignores the journal. | Posting milk, tying rec, closing a month **are** the research log. Hercules’s day is made of journal facts. No separate hunger meter. |
| **Neko / oneko** | No chrome. He lives *on* the screen. You drag him. | Chasing the cursor across Add. | Borderless wander. Loaf on Add. Kill criterion: if he blocks a grocery, shrink him. |
| **Animal Crossing** | One or two sentences, then they walk away. | Paragraphs. Help-desk transcripts. | Compact bubble. Two or three replies. |
| **Duolingo Duo** | Reactive poses. The mascot *is* the feedback. Streaks as identity. | Guilt-streak death. The owl at your door. | Jump on a paid bill. Sleep when the week is kind. Posting streaks, not open-the-app streaks. |
| **Cleo** | Short, human, money coaching. People open it for tone. | Roast-shame. Chat as the whole app. | “Milk. Ordinary. That’s the whole sport.” He points at the net. He does not replace it. |
| **Clippy** | People remember a character. | Unsolicited full-screen help. | No modal. No dimmed overlay. |
| **Neko Atsume / Nintendogs** | Presence over control. Petting. | Collectathon that hides the job. | Scratch him. He stays a Maine Coon, not a gacha. |
| **Khan / Brilliant / YNAB education** | Literacy is the product. Quizzes after a win. | Lectures before a grocery. Shame boards. | After the first card paydown, Hercules may *teach* why it was a transfer. Never a pop quiz that blocks Add. |

**Gold standard:** Neko’s body + Animal Crossing’s mouth + Finch’s care loop + Pokémon Sleep’s “the real act is the game” + YNAB’s sit-down literacy + QuickBooks’ close − Clippy − Mint’s feed − Tamagotchi death − YNAB’s fake Visa cash.

Research we actually use (not slogans):

- **Fogg Behavior Model** — motivation, ability, prompt. Hercules is the prompt. Add is the ability. The journal is the motivation because it is true.
- **Self-Determination Theory** — competence (he explains the books), autonomy (he never posts), relatedness (high-five, not a shame board).
- **The Media Equation** (Reeves & Nass) — people treat screens as social actors. A cat who lies about CAD is a betrayal, not a joke.
- **Yu-kai Chou, companion design** — a pet makes showing up a promise to someone else. We tie that promise to posted groceries, paid bills, and a tied rec — not to opening the app on vacation.

---

## North star (unlimited vision, gated engineering)

Build the best budgeting / education / companion app the world has ever seen. No idea is out of *vision* scope. Money-moving ideas still meet the kernel and D-039.

Every row is a **pair**. If you cannot name both columns, it is not Dual Course yet.

### Course A — family-office quality

A kitchen that could sit beside a small family office without lying:

- Unmodified opinion when the math is clean; qualified when Health or access is not
- Classified balance sheet, comparative periods, opening balances so equity has a true beginning
- Cash flow that already distinguishes card spend, card paydown, and investing
- 13-week cash and runway that match the journal — never a widget that invents CAD
- Rec that can match (amount + two days), partial rec, later three-way match (note, receipt after Auth, bank inbox after Auth)
- Hash-chained command log; maker-checker on Production when Jonathan asks
- Period lock that can *refuse* after a CPA mandate — today’s close is a second look, not a brick wall
- Fund/envelope **tags on journal lines** (YNAB’s job, our GL)
- Shift → tax lockbox as `postTransfer` (education about CRA, not a bank product)
- IOU object, then Interac, only with Auth and a sponsor
- CSV / statement inbox → confirm → `postEntry`
- Open Banking (Flinks first) as an inbox, never as an author
- Multi-entity (cottage, rental) as the same kernel with consolidating worksheets
- External-auditor Hearth Pass (read-only, no personal rows)
- FX only as explicit journal lines if D-021 is ever reopened — not silent conversion
- Issued cards / BaaS only with a BIN sponsor, after other households run the kitchen without a Health incident

### Course B — education and companion

A creature and a kitchen that teach the books by living on them:

- Hercules as auditor-teacher: opinion, working capital, “what’s on the Visa,” “why was that a transfer?”
- Chat and memories in `kitchen.hercules` (D-049). The notebook is the snapshot. The model gets labels, not the milk.
- Pokémon Sleep analog: the day’s posts **are** the research. His idle day is compiled from the journal, not a second sim.
- Tamagotchi analog: post / rec / sit-down are the three buttons. Everything else is a look.
- Wardrobe earned from facts (already shipping). New cosmetics must map to a new honest fact — never a shop.
- Wallet tiles as literacy: tap chequing, a card, the TFSA, learn the object
- Sit-down as the household close, with a postcard, not jargon
- Cook-off, Sunday envelope, grocery-from-chalkboard — household totals only
- Lights-on when the other phone posts (“milk landed”) without amounts on a shared lock screen until Auth
- Watch / widget only after safe-to-spend math exists. A lying widget is worse than none.
- Seasonal presence (patio, ruff) already tied to Toronto and posts
- Quizzes and MD&A chalkboard *after* a win, never as a gate to Add
- Anomaly scores that never auto-post (MindBridge as a whisper, not an author)
- White-label later: other households skin the cat, keep the opinion

### Dual-course inventions worth building (not a chapter list)

| Invention | Budget delta (5) | Engagement delta (3) | Gate |
|---|---|---|---|
| **Hercules ledger desk** | Money questions answered from the journal. Chat/memories as protected as the books. | A cat who remembers payday without a vendor memory store. | **Shipping (D-049).** Third-party keys allowed as Worker secrets (D-045). Workers AI if none set. |
| **Kitchen habit** | Fewer taps to post milk/shift. Sit-down is three confirms, same `applySitDown`. | Hercules jumps on posted shift streaks. Never streak-death. | **Shipping (D-050).** |
| **Lock the hosted door** | Auth + RLS. Personal can become privacy. Opinion about *access* can go unmodified. | Hercules can tell the truth: “the door latched.” No more qualified opinion pretending math is the only issue. | **Next engineering dollar.** Do not apply [sql/rls_auth_ready.sql](sql/rls_auth_ready.sql) while `USING (true)`. |
| **GitHub 2FA** | The canon remote stops being a single-factor door (D-020). | None required — Course A wins. | Open |
| **Due-on-open preview** | Recurring literacy before `postEntry`. | Kettle whistle that matches a real due row. | Confirm still posts |
| **Statement inbox** | D-011 import path. Family-office mail. | Mail on the counter. “There’s a statement. You still confirm.” | Auth before bank parsers |
| **Opening balances** | Equity has a beginning. | Chalkboard: “we started here.” | Money meaning; Jonathan approves |
| **Rec matching rules** | Rec that scales. | Spectacles stay earned; partial rec can earn a look, not a post. | No feed |
| **Hash-chained log** | Commands become evidence. | Spectacles fog if the chain and the journal disagree. | Journal still wins |
| **Tax milk** | Shift → reserve transfer. CRA literacy. | “Set aside the tax milk.” Never an auto-sweep to a bank. | Local transfer needs no bank; any rail needs Auth |
| **Safe to spend** | Runway from books. | Home number + Hercules line. Widget last. | Do not ship a lying glance |
| **Transfer school** | Split and D-016 honesty. | After first card paydown, one teaching breath. Never a blocker. | Kill criterion still Add |
| **IOU → Interac** | Settlement object on the GL. | High-five on settle. | Auth + sponsor for the rail |
| **Open Banking inbox** | Frictionless *truth*, still confirmed. | “The bank wrote. The household posted.” | Auth + RLS |
| **Auditor pass** | Read-only close pack for a CPA. | Spectacles for the guest. | Auth |
| **Maker-checker** | Four eyes on Production. | “Bianca should look.” | Household UX, not a bank |

Nothing in that table posts without a command. Nothing that talks to a bank, Interac, or a card BIN skips Auth + RLS.

---

## Next work (the actual backlog)

Order is **weight and risk**, not nostalgia chapter numbers.

1. **Auth + RLS** on hosted books. Phrase-join already filters environment; PGlite is already per pill. This is the Course A door. Pair it with an honest Hercules line about access.
2. **GitHub 2FA** (D-020).
3. **Google client ID** baked for the kitchen site so both people can link ([GOOGLE.md](GOOGLE.md)).
4. **Recurring preview on open**, then the existing `postEntry` path.
5. **JSON/CSV import** of a sanitized history through commands (D-011).
6. Every subsequent feature as a Dual Course pair from the table above. Prefer pairs that raise posting rate, rec rate, sit-down completion, or account literacy.

Do not open Flinks, Interac APIs, issued cards, receipt images in Postgres, or amount-bearing push on a shared device until (1) is true.

---

## How to ship a Dual Course change

1. Read this file, [DECISIONS.md](DECISIONS.md), [ARCHITECTURE.md](ARCHITECTURE.md).
2. Name both deltas in the PR. If they conflict, cut Course B.
3. Do not change an important feature in the laws table. Smaller edits need a why-note in the decision log.
4. Commands remain the trust boundary. Tests: `pnpm test`.
5. Handoff: [AI_HANDOFF.md](AI_HANDOFF.md) — include budget delta, engagement delta, verification, uncertainty, next action.

Kill criterion for the whole company: if Bianca will not add a grocery because Hercules is in the way, shrink the kitchen. If a statement disagrees with the journal, the journal wins. If a rec, cosmetic, or model posts money, roll it back.

---

## Why the old maps retired

| Old map | What it was | Why it is nostalgia |
|---|---|---|
| Sheets Phases 0–5 | clasp, September 1 test build, dashboard-as-spreadsheet | The prototype worked. It is not the product. |
| Cursor Chapters 0–4 (+5) | Kitchen → Open Banking → lockbox → cards → BaaS | Right destinations, wrong spine. Two overlapping bibles plus a pitch-deck clock. |
| Daily Hearth Rings 0–3 | Habit map that also tried to be the plan | Rituals shipped. Rings became a second roadmap. Dual Course replaces the taxonomy. |
| Launch essays as “the plan” | Hercules / Audit / Accounts as numbered chapters | Those are **shipped product**. How-to lives in the short living files. The essays are museum copies. |

**Why-note:** we did not delete those ideas. We stopped using them as the index of the future. Destinations such as Open Banking, Interac, tax reserve, issued cards, and a protocol remain valid *under Dual Course and D-039*, not under Chapter numbers.

Museum: [nostalgia/README.md](nostalgia/README.md). Sheets-era: [reference/](reference/).
