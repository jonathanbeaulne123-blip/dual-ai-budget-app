# Claude assignment — Desktop office (unique desks)

Paste **this whole file** into Claude. Then attach `docs/packets/CLAUDE-DESKTOP-OFFICE-SOURCE.txt` (regenerate with `pnpm pack:claude-desktop`). Open the kitchen or `pnpm dev` at **≥720px** *and* at **390×844**. Do not plan from `docs/nostalgia/` or `docs/reference/`.

You are **Claude**: design lead **and** implementer of the **desktop / wide Home office**. You produce real React and CSS, iterated in a browser at laptop width, until Home is a desk a CPA and a kid would both claim as theirs.

Cursor Grok owns domain wiring, persistence, tests, Dual Course gates, and **partners with you on what, if anything, of this packet belongs on the phone**. Grok does not restyle your desktop after drop-in unless a Dual Course gate is red (contrast, Post covered, invented CAD).

Jonathan’s latest instruction (2026-08-23, this document) wins over the “desktop frozen” line in [CLAUDE_MOBILE_SHELL.md](CLAUDE_MOBILE_SHELL.md) and over “customization later” in [OFFICE.md](OFFICE.md). Two UI branches (D-079) still stand. The freeze is over. This is the desktop pass.

---

## 0. Jonathan’s brief (do not drop a line)

These are the product owner’s words. You may **reshape how they land**. You may not **omit** them from the catalog. A reshape with a Dual Course why is work. A silent skip is a defect.

> I need you to implement a quality of life update; create a state of the art environment one that offers a customizable user experience. it should be attractive for both cpa's and kids learning how to budget. under no circumstances are you to limit your own thinking you are able to freely think and apply features. ask questions if you need clarification
>
> Role: Ceo Hearth Fintech Company
> Scope: this project and its context, rival apps like
>
> mint and ynab — for the family office budgeting aspect
>
> tamagotchi, finch, pokemon sleep — for the companion aspect
>
> Copilot Money, Apple Fitness, Splitwise, Monzo, Notion, Cleo, Duolingo, Typeform, Cash App, Linear — for widgets and features
>
> the popular features, engagement strategies, and implementations. as well as other cutting edge features either researched, thought of, or taken from an existing codebase.
>
> task: Implement these update ideas, each task should be treated as a separate feature and fully thought out planned and executed. No task should be considered a one off fix but a whole idea to build on
>
> task: we need deep thinking and research. the app has started to feel bloated and cumbersome. a whole lot of useful updates but a horrible way to navigate them. We are on the right page with the widgets and customizability. Users should feel like their home pages are their own completely unique office. give users the tools to customize appearance, widget sizes, dashboard displays and other ideas you come up with. The widget board should be designed to feel like a light weight controller that has the functionality to launch a spaceship under the hood. incorporate all features relevant to this task from rival apps. add widgets, functionalities, backgrounds and default layout options for users depending on what they want to get out of this app (basic transaction tracker, budget and habit and google manager, certified cpa). give them the tools to fully customize their layout. Do not limit yourself to the ideas posted, if other apps do it better steal the idea.

**What “do not limit your thinking” means here:** be revolutionary in the **room** — sizes, stocks, stacks, personalities, window, how a CPA desk differs from a kid’s desk. Do **not** be revolutionary in **money meaning**. Commands stay the trust boundary. Widgets never `postEntry`.

**Ask Jonathan** only when a question changes money, privacy, or Auth. Design questions you can settle with Dual Course, the kill criterion, and the two shells: settle them. Write the why in the handoff.

---

## 1. The split (read this twice)

Hearth is **one product, two UI branches, one kernel.**

| | Mobile | Desktop / wide |
|---|---|---|
| **Breakpoint** | `< 720px` (`WIDE_BREAKPOINT`) | `≥ 720px` |
| **This pass** | **Joint decision.** You review. You propose. Grok partners. Neither of you dumps the phone, neither of you starves it. | **You build.** The full customization packet lives here. |
| **Philosophy** | Glance + one-tap. The direction *before* Home became a settings list. Already shipped as `OfficePhone`. | A unique office. Heavy customization, dynamic window, full widget set. The packet that made the phone cumbersome is **doable here**. |
| **Layout key** | `hearth.office.<env>.phone` | `hearth.office.<env>.wide` |
| **Shipped today** | Five or fewer objects, three stamps (Post / Due / Close), drawer, phone layout key | `.desk-wide` canvas, 17 instruments, free move, snap, rings, weather, hide/show |

**Core functionality is shared.** `postEntry`, `postShift`, `postTransfer`, Confirm, Google, Calendar overlay, Appointments, Books, Hercules talk, Health, sit-down — same commands, same snapshot, same meaning. If it posts money, both shells call the same verb.

**Theme is shared.** Colours, fonts, Hercules bubble chrome, wax, brass, paper, pine, copper. `:root` in `src/styles.css` / `src/office.css` is the house. Do **not** invent a second brand for desktop. Desktop may *use more objects and more of the glass*; it may not look like a different company.

**UI decisions are not shared.** What is on Home, how large it is, whether it jiggles, whether games show, whether the rail is five tiles or a CPA blotter wall — those are per shell.

Jonathan: *the customization, sizes, backgrounds, default desks, and “unique office” tools apply to desktop. You and Cursor decide together what of that belongs on mobile.*

---

## 2. Why this is doable (evidence, not pep talk)

The last time this brief hit a 390px rail, it became seventeen identical header rows. That was a **surface** failure, not a proof the ideas are too big.

What already exists so you are extending a desk, not founding a startup:

| Primitive | Where | Why it unblocks this brief |
|---|---|---|
| Split layout keys | `officeLayoutKey(env, "phone" \| "wide")` | Desktop JSON cannot smash the phone board. |
| Free-move canvas | `.desk-wide`, `snapGrid`, `defaultWidePosition` | Sizes and stacks are fields on items that already move. |
| Hide / restore | `hidden` on `LayoutItem`, Cabinets, D-070 | Edit Desk is the grown-up of a checkbox list. |
| Pinned pad | `PINNED_INSTRUMENTS` | Calculator cannot vanish while you invent personalities. |
| Furniture registry | `publishFurniture` / `useFurniture` / `perchTarget` | Hercules already sits on objects. A bigger blotter is still a blotter. |
| Window + sill | `WindowBand`, `sillOverview` | Atmosphere is shipped. CAD does not belong on the glass. |
| Projections | `buildDashboard`, `householdWallet`, `auditOpinion`, `runHealthCheck`, … | New chrome reads old facts. No second ledger. |
| Mobile controller | `OfficePhone`, stamps, five objects | Daily acts already have a hatch. Desktop does not have to be a phone. |
| Google engine | `withGoogle`, Calendar overlay, D-078 | “Google manager” is a **desk personality and a cabinet**, not a bank feed. |

Layout is `localStorage` per environment per breakpoint. It never enters `splitForSync`. Bianca’s pile is not Jonathan’s; the Visa balance is.

**v: 1 → v: 2 is allowed** on the **wide** key if sizes, stacks, paper stock, or personality need a field. Parse must fall back. Phone key stays valid. Do not migrate household snapshots.

If you conclude a piece is *not* doable this pass, say which primitive is missing and what slice would create it. Do not conclude “too ambitious” because the phone once choked.

---

## 3. How you review (unbiased, required)

Your first job is a **fair review**, not a cheer and not a veto.

For **every** item in §5 and every rival mechanism in §4:

1. **Name it** in your catalog. Silent omission is not a conclusion.
2. **Keep / reshape / refuse.** A refuse needs a Dual Course why (weight 5 vs 3), the kill criterion (Bianca + milk), or a law in §8. “I don’t like it” is not a why.
3. **Say which shell.** Desktop is the default home of this packet. Mobile is opt-in per feature, decided with Grok. “Desktop only this pass” is a valid conclusion. “Nowhere” is only valid if you refused the idea itself.
4. **Treat it as a product**, not a CSS tweak. Widget sizes are a system (S/M/L or better, empty/warn, Hercules perch, persistence). A one-line `width` is not the feature.
5. **Steal the mechanism, not the brand.** Cash App’s pad is already ours. YNAB’s fake Visa cash is poison. Linear’s command palette is a hatch; Linear as the ledger is not.
6. **You may add ideas** the brief did not name, if a rival or this codebase does them better. Mark them **new**. They still need Dual Course deltas.
7. **Disagree with this document** when evidence supports it. Grok will argue Dual Course and the kill criterion. Jonathan breaks ties on money and privacy.

Do not write another 640-line spec for Grok to misread. Review, then **build the desktop**. Iterate at laptop width. Put mobile proposals in the handoff; do not block desktop on a phone argument.

---

## 4. Rival research (conclude what we steal)

Use this table as **homework**, not as a clone list. Popular features, engagement, and implementations — plus anything you research or find in this tree.

### Family office

| Rival | Mechanism worth taking seriously | Already in Hearth (check before reinventing) | Poison (do not take) |
|---|---|---|---|
| **Mint** | Account as the object; net-worth glance; bills as dates | Wallet tray, Accounts Floor, Mail, `isOutgoingBill` | Chore dashboard, ads, “you’re over budget” as identity |
| **YNAB** | One hero number; a job for every dollar | Blotter net; sit-down `applySitDown` | Safe-to-spend fiction, credit as fake cash |
| **Copilot Money** | Beautiful merchant dashboard; calm density | Hercules science / notices (D-057–060) | Bank ticker, D-039 |
| **Splitwise** | Who owes whom, settle later | Claims tray, receivable kind (D-053) | A second social ledger |
| **Monzo** | Sparse home; pots | Jars; phone stamps | Instant bank features we cannot ship |
| **Cash App** | Giant pad; 1250 → $12.50 | `CadPad`, Confirm still posts | Emojis as the books |
| **Apple Fitness** | Three rings / three acts as the controller | Phone: Post / Due / Close | Closing rings as a fee |
| **Linear** | Command palette; objects not settings rows; keyboard | Nav + cabinets; room for a hatch | Issue tracker as the household |
| **Notion** | Databases behind a calm surface | Books / Calendar / More as cabinets | Infinite canvas **as** the ledger |
| **Typeform** | One question, then you’re in | Optional first-run personality | A quiz that blocks milk |
| **Cleo** | Short tone | Hercules talk | Roast-shame, who-spent-more |
| **Duolingo** | Daily habit, streak as posted truth | Shift streak = **posted** dates (D-050) | Guilt owl, streak death, pay-to-live |

### Companion

| Rival | Mechanism worth taking seriously | Already in Hearth | Poison |
|---|---|---|---|
| **Tamagotchi** | Care is a daily act beside real life | Hercules; care = household facts (D-042 / D-044) | Hunger-meter death |
| **Finch** | Creature + a few goals, not seventeen chores | Jars, chalk, one cat | Quest spam on Home |
| **Pokémon Sleep** | The daily act *is* the screen | Posting is the game | A second game database that blocks milk |

If another app does a piece better — including something in this repo’s own cabinets — steal that. Name the source.

---

## 5. Feature catalog (whole ideas, not one-off fixes)

Each row is a **feature**. Spec it, persist it on the **wide** key, ship it so a spouse can use it, test it. Do not “add a slider” and call the row done.

| Feature | What “done” looks like on desktop | Notes you must confront |
|---|---|---|
| **Unique office** | Two households (or two personalities) can sit down and not see the same desk. | Layout is this-phone cosmetics. Data is household. |
| **Appearance** | Paper stock / wood / density / cat scale (or a better token overlay you invent) as one control, not four buried menus. | Shared tokens. Do not fork `--ink`. |
| **Backgrounds / dynamic window** | Weather glass earns its height. Time of day, season, reduced-motion fallback. Optional paper/wood behind the desk. | No CAD in the sky. No stock photo that hides numbers. Open-Meteo already exists. |
| **Widget sizes** | At least three honest sizes (or a system you defend). Glance vs expand still work. Hercules perches the real rect. | Pin the calculator. Kill criterion during Add. |
| **Dashboard displays** | Per-instrument: what the face shows (figure, sparkline, list, stamp) without opening Books. | Projections only. Journal wins if a figure disagrees (D-046). |
| **Edit Desk** | Jiggle / lift / size chip / hide / restore. Explicit, reversible. | Auto-promote **off** unless the user opts in (phone already suffered `promoteRail`). |
| **Smart stacks** | Related instruments can sit as a pile that expands without becoming a settings list. | Wallet + accounts is the obvious candidate. You may pick others. |
| **Default desks / personalities** | Starting points, then full rearrange. Minimum set from Jonathan: **Tracker** (basic capture), **Household** (budget + habit + Google manager), **CPA** (certified desk: opinion, statements hatch, rec/close, density). You may add a kid/companion start. | Personalities seed `wide` layout. They do not rewrite commands. Google manager = Calendar overlay + More / `withGoogle`, **not** Flinks. |
| **Full layout tools** | Move, snap, overlap, z-order, reset-to-personality, hide, sizes. | `.app { max-width: 760px }` is now a **desktop decision**. You may use more of the glass if the office needs it. Say so. |
| **Lightweight controller, spaceship under the hood** | Home glances and one-taps the common acts. Cabinets still launch Calendar, Plan, Books, statements, rec, Google, pairing. | Do not duplicate the nav as gold buttons. Do not hide the spaceship. |
| **Widgets worth adding** | Only if the room is missing a primitive. Catalog every candidate; keep/reshape/refuse. | Games exist. Wardrobe exists. Do not add an 18th **mandatory** widget named Google. A Google **tray on a Household personality** is a conclusion you may reach for **desktop**. |
| **Kid and CPA in one product** | A kid can post milk and see Hercules. A CPA can read CLEAN wax, open statements, rec. Same kernel. | Density is a personality + sizes, not a second app. |
| **Engagement without guilt** | Streaks, perch, cook-off, jars, talk — beside posting, never instead of Confirm. | No hunger death. No “you missed a day” as a fee. |

You will think of more. Add them to this table in the handoff. Same keep/reshape/refuse rule.

---

## 6. Desktop philosophy (this pass — build it)

Jonathan likes the current wide office. He wants it **finished**, not replaced with five phone tiles and not frozen.

- All instruments may live here: calculator, blotter, wallet, accounts, calendar, appointments, mail, claims, timesheet, chalkboard, wardrobe, postcard, cook-off, jars, lamp, games.
- Free move, snap, rings, overlap, weather as atmosphere.
- Hercules on the furniture. Loaf during Add. Never cover Post.
- The desk is used. Things stack. Nothing is a widget-store grid.
- Quiet enough to post milk in ten seconds **on a laptop too**. Rich enough that you do not *need* Calendar or Books unless you dive.

**Acceptance for desktop:** at ~1100×900 (and at the current column if you keep it, or wider if you lift the cap) Home is a unique office a person could rearrange. Two personalities look different. Sizes are real. Hide/restore still works. Confirm still posts. Resize to 390: `OfficePhone` is still the phone Home unless you and Grok shipped a reviewed subset.

---

## 7. Mobile (joint decision — do not assume either extreme)

`OfficePhone` is **shipped**. Five objects, three stamps, drawer, phone layout key. That was the cure for the settings list.

This packet is **not** “make the phone into a CPA wall.” It is also **not** “the phone may never gain a size or a personality.”

**Process:**

1. You review each §5 feature for 390×844 using the same keep/reshape/refuse rule.
2. You propose a **short** mobile subset (or “none this pass”) with Dual Course why.
3. Grok argues kill criterion, Post coverage, and whether a control is an escape hatch or a second Edit Desk.
4. You two agree, or Jonathan ties.

Valid conclusions include: Tracker vs Household already derived on phone is enough; a single appearance token could follow desktop; Edit Desk jiggle stays laptop-only. Invalid: deleting `OfficePhone` to “unify”; copying seventeen instruments back onto the rail; restyling `.office-phone` to match a CPA wall “just a little.”

Do not block the desktop build on the mobile argument. Ship wide. Put the phone proposal in the handoff.

---

## 8. Laws that do not move (either shell)

Commands are the money trust boundary. UI is untrusted (D-025 / D-026).

- Expense / income / **transfer** / refund. Card paydown is a transfer (D-016).
- CAD cents. `America/Toronto`. Splits sum. Joint is explicit.
- Development vs Production are two snapshots. Default to Development.
- Journal wins if a statement disagrees (D-046).
- Hercules, chalk, wardrobe, widgets, weather, layout, Google **never** `postEntry`.
- He never names who spent more. No hunger-meter death. Shift streak = **posted** dates (D-050).
- Bank / Interac / issued cards: Auth + RLS first (D-039). Google is live product (D-078) and is **not** a bank.
- Quiet appointment titles stay coded in Hercules / pulses (D-054 / D-060).
- Layout never enters `splitForSync`. Phone layout ≠ wide layout.
- Hosted RLS is still `USING (true)`. Do not persist Gmail/Drive/Contacts bodies on the snapshot.
- **Kill criterion:** if Bianca will not add milk, shrink the furniture. During Add: instruments inert, cat corner-loafs, never covers Post.

You may be revolutionary on the **desk**. You may not be revolutionary in **money meaning**.

No clasp, no production Sheets, no workbooks in git. No Cloudflare-token PR (#22). No second Google-token PR.

---

## 9. What to build (deliverable)

A **working desktop Home** in this repo:

- Real components and CSS, iterated at **≥720px**.
- Each §5 feature either shipped, reshaped-and-shipped, or refused with a Dual Course why in the handoff — none missing.
- Fixtures / demo kitchen as Jonathan.
- Shared theme tokens. Same `.hercules-bubble`. Prefer `src/office.css` / `src/Office.tsx` / `src/widgets/*`. Scope desktop extras so `.office-phone` does not inherit a CPA wall.
- Nav unchanged in meaning (Home / Calendar / Add / Plan / Books / More).
- Confirm still posts. Calculator still uses existing `CadPad` + existing post path.
- `pnpm test` still green. Do not rewrite `postEntry` / `postShift` / `applySitDown` / journal compile.

### Suggested files

`src/Office.tsx`, `src/office.css`, `src/widgets/DeskItem.tsx`, `src/widgets/Cabinets.tsx`, `src/core/officeLayout.ts`. New helpers in `src/core/` if they have no React (personalities, size math). Tests in `test/`.

Do not fork `src/core` money. Projections stay `buildDashboard`, `householdWallet`, `auditOpinion`, `sillOverview`, etc.

### Test script (desktop)

Development pill → demo kitchen → ≥720 wide:

1. You can post **$12.50** milk in ten seconds without hunting.
2. You can switch a default desk (Tracker / Household / CPA, or your names) and the board changes.
3. You can resize at least one instrument and reload; it sticks on the **wide** key only.
4. Two appearances look like two offices, not two brands.
5. Cabinets still launch the spaceship (Books, Calendar, rec).
6. Resize to 390: phone Home is still `OfficePhone` unless a reviewed subset shipped.

---

## 10. How to work with Grok

1. **You ship pixels on wide.** Grok wires `v: 2` persistence, tests, and Dual Course if you need it — or you persist on the `wide` key yourself and leave `phone` JSON untouched.
2. **Mobile subset:** propose in the handoff. Grok implements or argues. Do not drive-by restyle `OfficePhone` as a side effect of Edit Desk.
3. **Shared CSS:** if you change `--ink` or bubble radius, both shells change. That is allowed when the house should move together. Do not change `--felt` “to simplify” if it also paints the phone.
4. **Disagreement:** Dual Course (5 vs 3), kill criterion, this split. Jonathan breaks ties.
5. Slices are contracts. First slices should ship **Edit Desk + sizes + one personality switch** without breaking Add. Then appearance. Then stacks. Then CPA density. Deep Books stay cabinets.

---

## 11. First message back

1. **Fair review table** — every §5 row and every rival mechanism: keep / reshape / refuse, which shell, Dual Course why. No pep, no silent drops.
2. **Desktop feeling** in one paragraph at ~1100px.
3. **What you will not do to `OfficePhone` this week** (checklist), plus any mobile subset you want Grok to take.
4. Then **build**. Do not wait for another spec cycle.

This is the desktop update. Fill the office. Keep the phone a controller unless you and Grok honestly promote a piece of this packet onto it.
