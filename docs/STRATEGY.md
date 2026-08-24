# Dual Course Strategy

This is the living product law for **Hearth**, the household company Jonathan and Bianca run from a Toronto kitchen: family-office books, and a companion who makes those books a habit.

Do not *plan* from [nostalgia/](nostalgia/). Those files stay on GitHub as a museum (D-095) — read them to understand past maps. This file, [HEARTH_ROADMAP.md](HEARTH_ROADMAP.md), [DECISIONS.md](DECISIONS.md), [ARCHITECTURE.md](ARCHITECTURE.md), and Jonathan’s latest instruction are what to build from. The agent constitution is [AGENTS.md](../AGENTS.md).

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
| Hercules, chalkboard, wardrobe, visit sparks, rec, close, marks, Google, Hercules desk, office widgets and weather never post money. | D-042, D-043, D-044, D-045, D-046, D-047, D-049, D-050, D-051 |
| Hercules never names who spent more. No fake fees. No pay-to-keep-alive. No hunger-meter death. | D-044 |
| Bank feeds, Interac APIs, issued cards: blocked until Auth + RLS. Jonathan approves production money movement. | D-011, D-039 |
| Accounts are financial accounts (chequing, savings, credit, investment, other), not categories. Receivable is D-053. | D-047, D-053 |
| Phrase / join link / Hearth Pass join a phone. Google is a live bridge, not a bank, not a parking lot. | D-032, D-043, D-078 |
| Personal rows are a filter until Auth. A hidden tab is not privacy. | D-015 |
| Hosted `USING (true)` is an open door. The publishable key is not a lock. | D-034 |

---

## What already shipped (frozen as product)

Do not re-litigate these as “Chapter 0” or “Ring 1.” They are the kitchen as of this canon:

- Phone-first Home, Calendar, Add, Plan, Books, More
- Command kernel: spend, income, shift, transfer, category, budget, goals, recurrences, undo, confirm, duplicates
- PGlite journal + optional Supabase **snapshot** publish; trial balance; read-only SQL
- Sync integrity (D-052): append-only goal contributions, timestamped catalog merge, personal rows kept on the snapshot, upsert without DELETE
- Calendar board, rhythms, `.ics`; **Google household bridge is live** (D-078 / D-087): Continue with Google, per-member link, step-up on sensitive actions, both people’s Calendar overlay, bill reminders to Google, sit-down Drive workbook (create-only). Drive / Contacts / Gmail / Sheets are opt-in. Google never posts. Tokens stay on this phone.
- Phrase / join / Hearth Pass; Shared / Personal / Both
- Development vs Production pills; PGlite per pill
- Home chalkboard; Hercules the Maine Coon (wander, loaf on Add, journal-first talk; OpenAI/Anthropic Worker secrets allowed, then Workers AI); chat and memories in `kitchen.hercules` (D-049); visit spark
- Kitchen habit (D-050): CAD cents pad, Home Milk/Shift/Pay card, guided sit-down, Hercules shift-posting streak from posted shifts
- **Monthly sit-down (D-083–D-087):** three acts on Plan, leftover arithmetic, plan-then-transfer, hard month lock, reversing entries, on-device auto-coding, Drive create-only workbook. Spec: [SITDOWN.md](SITDOWN.md)
- **Almost-there office (D-088–D-094):** Goals vault + Purchased? expense, no-zoom phone, pin-open, desk JSON on this Google identity, How can I help / perch / click-to-close, chalk on the weather glass. Spec: [GOALS.md](GOALS.md). Recap: [WORKING_MEMORY.md](WORKING_MEMORY.md).
- September Office (D-051 / **D-079** / **D-080** / **D-082**): one kernel, two UI branches. **Mobile** (`< 720px`) is `OfficePhone` (glance + one-tap). **Desktop/wide** takes unique offices, sizes, appearance, and default desks. Live assignment: [CLAUDE_DESKTOP_OFFICE.md](CLAUDE_DESKTOP_OFFICE.md). Phone record: [CLAUDE_MOBILE_SHELL.md](CLAUDE_MOBILE_SHELL.md). History spec: [CLAUDE_OFFICE_UX.md](CLAUDE_OFFICE_UX.md), [OFFICE.md](OFFICE.md).
- Audit Office: opinion, statements, equity roll, working capital, notes, rec, close pack
- Accounts Floor: wallet tiles, account rooms, expandable cards, investment marks, interest/rewards as explicit posts
- Appointments destination, claims tray, receivable kind, quiet labels, Hercules propose-to-save, METC log on the page (D-053 / D-054 / D-055 / D-056). Spec: [APPOINTMENTS.md](APPOINTMENTS.md)
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
| **Google Calendar / Gmail / Drive** | The household already lives here: two calendars, bill mail, a folder for the close pack. On-demand OAuth, not a daemon. | Google as the ledger. Auto-post from an email. A second workbook as source of truth. Tokens in the snapshot. | `withGoogle` is the family-office suite. Overlay and reminders ship. Inbox and Drive are confirm-then-command. Google never posts (D-078). |

### Companion, education, habit

| Rival | What they got right | What we refuse | Dual-course take |
|---|---|---|---|
| **Cash App** | Giant cents pad. Type 1250 → $12.50. | Mouse-wheel CAD. Tiny decimal fields. | Add is a CAD pad (D-050). Digits are cents. Wheel blocked. Confirm still posts. |
| **Typeform** | One question per screen. | Quizzes that block posting. | Sit-down is three acts (positives, books, leftover jobs). Pause/resume. Confirm still writes. |
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
- Period lock that **refuses** posts into a closed month (D-084). Reopen is explicit. Reverse instead of delete (D-085).
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
- Chat and memories in `kitchen.hercules` (D-049). The notebook is the snapshot. The model may receive a redacted retrieval (D-059), never chat history, never a quiet title.
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
| **Hercules ledger desk** | Money questions answered from the journal. Chat/memories as protected as the books. | A cat who remembers payday without a vendor memory store. | **Shipping (D-049).** Third-party keys allowed as Worker secrets (D-045). Workers AI if none set. Payload lift: D-059. |
| **Hercules science** | One-tap posting of repeated merchants. Quiet titles never leak. Figures in his mouth trace to posted rows. | He notices without being asked. One cat-voiced proposal. Save is a tap. | **Shipping (D-057–D-060).** On-device notices; presets; retrieved model payload. No bank feed. |
| **Kitchen habit** | Fewer taps to post milk/shift. Sit-down *planning* still `applySitDown`. | Hercules jumps on posted shift streaks. Never streak-death. | **Shipping (D-050).** Sit-down *product* is D-083. |
| **Monthly sit-down** | Leftover arithmetic, plan-then-transfer into the Goals vault, hard month lock, reverse instead of delete, on-device auto-code. | Three-act kitchen-table ceremony. Pigs fill. Purchased? retires a jar. Hercules reads act 1. He never moves a dollar. | **Shipping (D-083–D-089).** Spec: [SITDOWN.md](SITDOWN.md), [GOALS.md](GOALS.md). Postcard is a glance, not an 18th Home stamp. |
| **Almost-there office** | Leftover parking destination, purchase expense, vault receipt. | No-zoom phone, pin-open, chalk on glass, How can I help, perch-on-expand, click-to-close. | **Shipping (D-088–D-094).** |
| **September Office** | Posting, wallet, sit-down, bills, Health reachable without leaving Home unless you dive. | Mobile: five objects, not seventeen rows. Desktop: unique office, sizes, personalities, CPA density. | **Direction (D-051), split (D-079), desktop packet (D-080).** Mobile Home is `OfficePhone`. Claude builds wide. Widgets never post. |
| **Google Dual Course** | Dates, mail, and close-pack files next to the books — still confirmed. | Calendar chips, visit reminders, “there’s a statement.” | **In scope (D-078).** Engine ships. Features below. Not a Home widget. |
| **Lock the hosted door** | Auth + RLS. Personal can become privacy. Opinion about *access* can go unmodified. | Hercules can tell the truth: “the door latched.” No more qualified opinion pretending math is the only issue. | **Next engineering dollar.** Do not apply [sql/rls_auth_ready.sql](sql/rls_auth_ready.sql) while `USING (true)`. |
| **GitHub 2FA** | The canon remote stops being a single-factor door (D-020). | None required — Course A wins. | Open |
| **Due-on-open preview** | Recurring literacy before `postEntry`. | Kettle whistle that matches a real due row. | Confirm still posts |
| **Statement inbox** | D-011 import path. Family-office mail. | Mail on the counter. “There’s a statement. You still confirm.” | **Gmail on this phone** may proceed (D-078). Bank PDF parsers still wait on Auth. |
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

Nothing in that table posts without a command. Nothing that talks to a bank, Interac, or a card BIN skips Auth + RLS. Google is not a bank.

---

## Google Dual Course (D-078)

The household already lives in Google. The engine (`withGoogle`) and the kitchen client ID are **shipping**. Drive, Contacts, Gmail, and Sheets are still opt-in. They may now become real features, not forever-pings.

How-to: [GOOGLE.md](GOOGLE.md). Laws that do not move: tokens on this phone; snapshot stores who is linked; Google never posts; phrase / join / Hearth Pass still join a phone; merchant names, spouse notes, and calendar titles are untrusted DATA (D-059); quiet appointment titles stay coded (D-054 / D-060).

### Already shipping

| Surface | What it is |
|---|---|
| Link / Continue with Google | Per-member identity. Same email cannot be both people. |
| Step-up | Reset, env switch, demo reload, publish, join, Hearth Pass ask Google first when linked. |
| Calendar overlay | Both people’s events on the month board. |
| Bill reminders | Write / patch / delete `Hearth · bills` events at 9:00 Toronto. Not ledger rows. |
| `.ics` | Fallback when this build has no client ID. |
| Suite ping | Opt-in Drive / Contacts / Gmail / Sheets prove the token. Not the product yet. |
| Sit-down Drive workbook | Create a Sheet with `drive.file`. Never edit an existing file. Local download always works. `driveFileId` only on the snapshot (D-087). |
| Desk appearance | `Hearth desk.json` on this Google account. Look + layout. Pull on a fresh household. File id only in localStorage (D-092). |

### Proposed next (in scope)

Each row is a whole feature. Call `withGoogle` on demand. No background daemon. **Do not put this on Home while Claude subtracts the desk** — the Google manager is Calendar (and More for link/opt-in). A later Household desk may glance the next overlay event through the Calendar instrument only.

| Feature | Budget delta (5) | Engagement delta (3) | Gate |
|---|---|---|---|
| **Visit and claim reminders** | Visit day and “owed to us” show up on the real calendar. Same upsert path as bills. | Hercules: “the Tuesday visit is on Google.” Quiet titles stay coded. | Calendar already on. Never `postVisit` / `settleClaim`. |
| **Punch-clock busy** | Shift hours become a timed block while `openShift` is live. Wipe on abandon. | Finch daily act on the household calendar. | `postedIds: []`. Never `postShift`. |
| **Gmail statement inbox** | D-011: read-only mail → suggest a recurrence or an Add draft. Confirm still posts. | Mail on the counter: “there’s a statement.” | Opt-in Gmail. **Bodies stay on this phone** — not the snapshot, not the model dump. Bank PDF parsers still Auth. |
| **Sheets import** | Pick a spreadsheet, read a range, sanitize, same command import as CSV. | “The sheet is a source document. The journal is the books.” | Opt-in Sheets **read-only**. Not the old budget workbook. No Sheets write-back. |
| **Contacts match** | Suggest a split member or practitioner from People, not from memory. | Less typing on a visit. | Opt-in Contacts. Not a phone backup. Never posts. |
| **Hercules calendar chips** | “What’s on the calendar?” answers from overlay + month board on-device. | Page-true talk on Calendar. | No Gmail in the model payload. Quiet titles coded. |

### Refused (still)

| Idea | Why |
|---|---|
| Google as the ledger / Sheets write-back | The books stay PGlite. A second workbook is how the prototype died. |
| Auto-post from Gmail or Calendar | Confirm still writes. D-025. |
| Tokens or mail bodies on the hosted snapshot | RLS is still `USING (true)`. Payloads stay on this phone until Auth. |
| Google replaces phrase-join | D-032. Continue with Google identifies *who on this phone*, not a new household. |
| Receipt images in Drive or Postgres as the archive | D-039. Auth first. |
| An eighteenth Home widget named Google | The disease is seventeen equal rows. Calendar is the cabinet. |
| Flinks / Interac / issued cards through Google | Google is not a bank. D-039. |

---

## Next work (the actual backlog)

Order is **weight and risk**, not nostalgia chapter numbers. Claude owns **desktop** Home pixels this pass; `OfficePhone` stays the phone controller unless a reviewed subset ships.

1. **Desktop office (D-080 / D-082).** Unique offices, widget sizes, Edit Desk, personalities — packed so cards do not clip, still a warm desk (cream papers, Fraunces names, 900px column). Prompt: [CLAUDE_DESKTOP_OFFICE.md](CLAUDE_DESKTOP_OFFICE.md). Do not restyle into a 1280 dashboard. Do not turn the phone back into seventeen rows.
2. **Mobile Home (D-079, shipped).** `OfficePhone` (`< 720px`): glance, one-tap, five or fewer objects. Record: [CLAUDE_MOBILE_SHELL.md](CLAUDE_MOBILE_SHELL.md). Further phone customization is a joint Claude+Cursor review, not a dump of the desktop packet.
3. **Google Dual Course (D-078).** Visit/claim reminders first (Calendar already on). Sit-down Drive workbook already ships (D-087). Then Gmail inbox on this phone, Contacts match, Sheets import — each opt-in, each `withGoogle`, none post. How-to: [GOOGLE.md](GOOGLE.md). A desktop Household personality may feature Calendar; Google is still not a bank.
4. **Auth + RLS** on hosted books. Phrase-join already filters environment; PGlite is already per pill. This is the Course A door. Pair it with an honest Hercules line about access. Required before any Google payload is stored hosted, and before bank parsers.
5. **GitHub 2FA** (D-020).
6. **Recurring preview on open**, then the existing `postEntry` path.
7. **JSON/CSV import** of a sanitized history through commands (D-011) — same kernel as Sheets import.
8. Every subsequent feature as a Dual Course pair from the table above. Prefer pairs that raise posting rate, rec rate, sit-down completion, or account literacy.

Do not open Flinks, Interac APIs, issued cards, receipt images in Postgres, or amount-bearing push on a shared device until Auth + RLS is true.

---

## How to ship a Dual Course change

1. Read this file, [HEARTH_ROADMAP.md](HEARTH_ROADMAP.md), [DECISIONS.md](DECISIONS.md), [ARCHITECTURE.md](ARCHITECTURE.md).
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
