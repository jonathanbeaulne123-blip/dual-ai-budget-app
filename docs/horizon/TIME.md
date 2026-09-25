# The Horizon — TIME: the flow of time, and the plan

Version 1.0 · 25 September 2026 · Jonathan: "redesign how the Journey map tells the flow of time to fit our map instead of its own systems … flesh out the Plan Studio … before we start building the island." · Grounded in `main@cc1aab6`.

This file decides two things the island stands on. It refines `SCALES.md` §3 (the camp and the stations) and settles the Plan Studio. Where a choice assigns meaning to money it is listed as a decision for Jonathan; everything else is decided here.

---

## Part 1 · The flow of time

### 1.1 What the Journey does today (facts)
- **Four metaphors at once.** Months sit on a golden-angle spiral on a grown island (`src/path/grow.ts`). The simple view draws days and weeks as stepping stones with Prepare/Protect/Build lanes, curling into a month ring that ends at a "Sitdown gate" (`src/path/mini/miniWorld3d.ts`). Eras are separate islands on a ring. The future is weather along "the road ahead": bills as clouds, a big bill as a storm, paydays as sunrise, a thin Fund as mist (`src/core/pathWeather.ts`).
- **A Replay slider** regrows the whole island to a past month (1.3 s per step). "As of" for landmarks is the month's last day.
- **The focus** has five levels (day/week/month/era/journey); day and week are only in the simple view; the world camera jumps between four radii.
- **The calendar and the Journey do not share a board.** The strip reads Fund selectors; the Calendar reads `buildMonthBoard`; tasks are in neither board and appear only in `agenda()`; the Desk's Leaving page reads a third walk.
- **Chapters are calendar months** (D-273), never auto-close, close at the Campfire; the books close separately (`closeBooksMonth`); a skipped month reads "no Chapter".

### 1.2 What it should do
One metaphor for time at every scale, legible on the island itself, explicit about money, honest about past, present and future, shared with the Calendar and the Desk, continuous through the zoom, and free of any system that only exists to explain itself.

### 1.3 The decision: time is a walk, and the day is the unit

**The Year Walk is a road of stones.** Every day is one paving stone. A month is the *stretch* of the Walk from the previous station to its own station: 28 to 31 stones ending at a garden. A week is seven stones ending at a broader flagstone with a lantern post. A year is one lap. An era is a gate across the Walk where it ended. The whole island is the calendar, and you are standing on today.

| Scale | On the island | The camera tier | What you read there |
|---|---|---|---|
| **Day** | One stone. Today's stone carries the camp (tent + lit lantern). A stone shows its day's facts as small explicit marks with words: a coin per posted entry (amount on tap), a leaf for a ritual held, a stamp when the week is stamped. | Up close | the day: what happened, what is due, what is planned |
| **Week** | Every seventh stone is a flagstone with a lantern post, lit when the week's books are stamped; two small chairs stand there when the Charter's weekly Sitdown falls on it. | Stop | the week: stamped or not, the Sitdown, the week's leaving |
| **Month** | The stretch plus its station. The bed for this month is *forming* at the station as you walk (its cards fade in as the month's scores form); the Chapter close edges it and ticks the waymark's year count. | Region | the month: the card wall, the bed, what rolled, what is new |
| **Season** | The neighbourhood the stretch runs through, under the real sun (LIGHT). | Region | nothing financial; the light |
| **Year** | One lap; the twelve stations with their beds side by side. | Sky | the year at a glance: twelve beds, twelve waymarks |
| **Era** | A gate (two posts, a lantern from the finish rules) on the Walk where the era ended; gates accumulate along laps. | Sky, gates lit | eras, in words, on the gate's plaque and in the Atlas |

**Past, present, future, on the same stones**
- **Behind you**: worn stones. Each still shows its day's marks; past stretches lead to beds already edged. Walking back *is* replay: the Replay slider retires; the strip (§1.4) and the stones are the same control.
- **Today**: the camp. The camp card (SCALES §4.1) reads from it.
- **Ahead, this month**: laid stones to the station. Scheduled things stand *on their stone* as explicit markers, never as weather: a **bill** is a paper slip on a post with its amount and name; a **payday** is a pennant; a **task or plan step** is a stake with the card's name; a **goal deadline** is a stake with a ribbon; the **Sitdown** is two chairs; the **Chapter close** is the station's gate ajar.
- **Beyond the station**: the next stretch is **stakes and string** (unbuilt) until its month begins; scheduled items further out (next month's bills, October's goal) hang as slips on those stakes. The future is planned, not built.
- **Skipped months** (no Chapter): the stretch was walked, the bed formed from the books, but it has no edging and its waymark reads "no Chapter". Nothing is invented.
- **The Fund's horizon** (how far the Fund covers, ≤ 31 days) is a **ribbon on the strip** ("covered through the 22nd"), not a change to the stones. The ground never encodes money.

**Which year's stones?** The stretches repeat every lap, so a stretch shows the days of the year the focus is on (default: now). Older years keep their days in the beds' cards and the Books; the island remembers months as beds and the current lap as stones. That is honest and enough.

**What this retires**: the spiral, `grow.ts` land, the month ring and Sitdown gate as separate geometry, the era ring of islands, the harbour islet, weather-from-money (D18), the Replay slider as a control, and the simple view's stepping-stone world as a *separate* scene. The simple view's *data model* (`miniJourneyModel`) lives on as the strip's and the stones' read model.

### 1.4 The strip is the stretch, flattened
The timeline strip docked under the map is the current stretch drawn straight: the same stones, the same marks, the same camp. Drag it and the camp walks; tap a stone and its day opens; pinch it out to weeks, months, the year. Day/week/month/year/era replace day/week/month/era/journey as the focus levels; `journeyFocus` keeps its shape with `year` added. The world camera follows the same levels (§1.3 tiers). On the phone the strip is the primary time control; on desktop the stones and the strip are equals; keyboard: ←/→ a day, ⇧←/→ a week, PgUp/PgDn a month, Home = today.

### 1.5 One day ledger (the read model that makes this true)
Today three surfaces read three different walks. Decide: **one `dayLedger` read model** (pure, `src/core/dayLedger.ts`) produces, per day, the ordered list of marks with their kind, owner, status (done with receipt evidence / attention / upcoming), amount, and links, from `agenda()` + `monthObligations` + `prepareFundInflows` + the Fund horizon + rituals + plan steps + Chapter events. The stones, the strip, the Calendar board, the Desk's Leaving page and the camp card all read it. The Calendar keeps its semantics (glyph, hue, edge, ownership and status carried separately, stable lanes for spans, D-1248ff); it becomes a grid view of the same ledger. The Journey stops reading Fund selectors on its own. This is the single largest correctness win available: one truth per day.

### 1.6 The month turns
- The Chapter is the calendar month (D-273, kept). The **close happens at the Campfire** (the one two-person ritual, kept) and is the *same event* that edges the bed, ticks the waymark and moves the camp to the next stretch's first stone. If the close is late, the camp waits at the station with the gate ajar and the reminder (once a day, D-273); the next stretch's stones are still walkable (days do not wait for rituals), and the bed edges when the close finally lands.
- The books close (`closeBooksMonth`) paves the stretch's kerb as today; a closed month accepts no posts (kept).
- **Eras**: unchanged rules (D-268; "without going broke" remains Jonathan's money-meaning call). Crossing an era places the gate; the next era's first stretch is the walk beyond it.

### 1.7 Corrections and provenance
Derive on read, as SCALES §6: a reversal re-attributes to the original stone and bed; a moved bill moves its slip; a reopened month loses its kerb; nothing is stored about stones or beds. "What changed here" works on a stone as on a bed.

---

## Part 2 · The Plan Studio

### 2.1 What exists today (facts)
- **Three studios in one tool id.** `PlanStudio.tsx` opens the Kitchen wizard ("One pull raises it": five questions What · How much · By when · From which pot · Who, one answer lays one line; Write it → `savePlanDraft`; Pin it → `proposeHouseholdPlan` / `lockPersonalPlan`; the pull is a view). "Open the drawer" swaps to the **Classic** studio (twelve sections: Overview, four lens workbenches, Scenarios, Assumptions, Bridge, Learn, Reflection, History, Sitdown with eight steps, Review, Settings) unless `VITE_PLAN_STUDIO_V3` is set, in which case **v3** (a rest screen of Now + Prepare/Protect/Build, a drawer of seven tools mapped to Classic sections, a nine-step check-in). v3 is off in deployed builds and has no month switching and two resume owners.
- **Objects**: `PlanLine` (lens, kind, amount, cadence one-time|monthly, dueDate, responsibility, sourceReference, envelopeGoalId, decision{target, deadline, funding, next step…}); `PlanDraft` (private, per target month); `PlanScenario`; `PlanVersion` proposed → scheduled → active → superseded, activated on the 1st by a job; per-member acknowledgements. Tasks link to a line by `planReference` (active version only). Goals link by `envelopeGoalId`. Wishes reference lines, banks, tasks.
- **The wizard pick is still open** ("The Card Writes Itself" vs "Five Objects Across the Table" vs the third pass with the one-pull linkage, built as "One Pull Raises It"). The demo seed has no standing plan. An abandoned card is not stored.
- **Three rituals**: the Classic eight-step Sitdown, the v3 nine-step check-in, and the Campfire Chapter close (`ChapterPanel`), which is the only one that seals a month.
- Earlier direction (Little Harbour brainstorm, D-292): a plan is a recipe card; Hercules across the table asks one question at a time; the wall is the cookbook; **one object, three views** (card on the wall, stake on the island, cat in the tower); the drawer with seven tools stays for depth; Direction C mapped every Classic section to an object on the kitchen table.

### 2.2 The decision: the Plan Studio is the kitchen table, and a plan is a recipe card

**One front door.** The wizard "One Pull Raises It" is the Plan Studio's entry (D28). Five questions, one card, and the pull that shows the consequence: Everyday · now drops by the card's amount, the chosen pot's jar shows it, the day leaf lands on the calendar. Nothing else appears until you turn the card over or open the drawer.

**One object, four views (D-292 extended).** A card on the wall is also: a **stake on the Year Walk** at its "by when" stone (a dated card) or at every stretch's first stone (a monthly card); a **cat in the tower** if it saves (Build → its Kitty Bank); a **slip on a stone** for each payment or contribution it schedules (Prepare/Build). Change the card and all four change, because all four derive from the same `PlanLine` through the overlay and the day ledger. This is how plans reach the map and the world, and it is why the Studio had to be decided before the island.

**Cards have two lifespans (D32).**
- **Every month**: cadence monthly. It rolls forward on the 1st (the existing activation job) until someone takes it down; taking it down is a card in the drawer's past sheets, never deletion.
- **Once**: dated. It lives until its date, then joins the past sheets with what happened (evidence matched, as Reflection does today).
The month you are looking at is the month the camp is on (Part 1); the wall shows that month's cards; past walls are read-only; the tear-off month pad retires in favour of walking.

**The back of the card** is its steps and its truth: the steps are Glasshouse pots (`Task.planReference`, kept; a step is a task with a do-date, so it also stands on a stone), the evidence is the matched entries, "reopen this decision when…" is a stake with a date. Turn it over; nothing new to learn.

**Two chairs (K3, kept).** A household card waits face-down on the table until both have sat (acknowledged on the exact digest); "Not now" sends it to the drawer. A personal card pins itself.

**The card writes itself (fix).** Every answered question saves the private draft (`savePlanDraft`), so an abandoned card is on the table tomorrow, not lost. The pull is still a view; nothing posts.

**The drawer is Direction C's table, and it ships (D27).** v3's seven tools *are* Direction C's objects; give them their bodies and drop the flag: past sheets (History + Reflection on the back), tracing paper (Scenarios, disruption tests, "can this fit?"), the letter tray (the Bridge), two chairs (the Sitdown), the recipe box (Learn), the kitty on the corner (goals, opens the Loft), the desk lamp (coaching pace, what Hercules remembers), sticky notes (Assumptions, curling after 30 days), the note under the corner (the top drift finding). The Classic studio's twelve sections retire as screens; every command they call is kept and reached through an object. Nobody has to open the drawer to make a plan.

**One ritual (D29).** The Classic Sitdown, the v3 check-in and the Campfire close are one ritual with five beats, held at the Campfire, once a month, two people: **Arrive** (both sit; Hercules asks) · **Look back** (the forming bed's cards read aloud with their numbers; wins kept or let fade) · **Settle** (rituals graduate or retire; open moves pause; the books close if they haven't) · **Look ahead** (next month's wall on the table: what rolls, what is new, what needs the second chair) · **Seal** (both agree on the digest; the Chapter closes; the bed is edged; the camp walks on). The v3 steps fold into these beats; the check-in's `appendPlanSitdownTurn` checkpoints and `acknowledgeHouseholdPlan` are the writes; `closeChapter` is the seal. The Charter's **weekly Sitdown** is a short "two chairs" at the week's flagstone: a look at the strip together, no close, no digest.

**Where it lives.** The table is in the Kitchen of Our home, facing the window toward the dam (LIGHT). On the map it is the Kitchen's compact panel ("Plan · 4 cards · 1 waiting · Open the table") and a tier-3 sheet over the map; in the world it is the room. The steps live in the Glasshouse; the close lives at the Campfire; the cats live in the Loft. One object, four buildings, no duplication.

**Money truth (unchanged).** The card never posts money. "From which pot" sets the lens; Protect is never suggested; contributions and payments post through the Fund, Kitty and entry commands with their own confirmations; the Studio's only writes are draft, propose, lock, acknowledge, Sitdown turns, and the drawer's existing commands.

### 2.3 What this closes
| Open item | Closed by |
|---|---|
| Wizard pick | D28: One Pull Raises It |
| v3 has no month switching | the camp is the month (Part 1) |
| two resume owners | one focus state (SCALES §7) |
| abandoned card lost | the card writes itself |
| three rituals | D29: five beats at the Campfire |
| Classic vs v3 | D27: the table ships, Classic retires as screens |
| "decide the calendar-month Chapter shape" | D-273 confirmed: the month is the stretch |
| plans invisible on the island | the stake, the slip, the cat (four views) |
| calendar and journey disagree | D31: one day ledger |
| demo seed has no standing plan | the fictional household gets a wall of four cards (pass 02d) |

---

## Part 3 · Decisions raised here
- **D27** Ship the kitchen table (v3's drawer as Direction C's objects), retire the Classic studio as screens, drop `VITE_PLAN_STUDIO_V3`. Recommend yes.
- **D28** The Plan Studio's entry is "One Pull Raises It". Recommend yes.
- **D29** One five-beat ritual at the Campfire replaces the Classic Sitdown and the v3 check-in; the weekly Sitdown is two chairs at the flagstone. Recommend yes.
- **D30** Time is a walk of day-stones on the Year Walk (retiring the spiral, the weather, the era ring, the Replay slider and the separate stepping-stone scene). Recommend yes.
- **D31** One `dayLedger` read model for the stones, the strip, the Calendar, Leaving and the camp card. Recommend yes.
- **D32** Cards are "every month" or "once"; taking a card down files it, never deletes it. Recommend yes.
- **D33** Money-meaning items kept as Jonathan's: the era finish rule "without going broke" (D-268); whether a skipped month's unedged bed should show at all, or only in the Books.
