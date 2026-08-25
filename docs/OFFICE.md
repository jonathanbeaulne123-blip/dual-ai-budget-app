# The September Office

**Two UI branches (D-079 / D-080 / D-082):** Mobile (`< 720px`) is glance + one-tap via `OfficePhone`. Desktop/wide (`≥ 720px`) is this office — unique desks, sizes, Edit Desk, without turning Home into a dashboard. Current Claude prompt: [CLAUDE_DESKTOP_OFFICE.md](CLAUDE_DESKTOP_OFFICE.md). Mobile record: [CLAUDE_MOBILE_SHELL.md](CLAUDE_MOBILE_SHELL.md).

**The product face for September testing:** Home is a lived-in Toronto office. Rain on the glass. A desk of true instruments. Hercules on the furniture. Deep Books and Calendar still exist for people who want to dive.

This is Course B chrome on Course A facts (D-048 / **D-051** / **D-079**). Widgets **project** the journal. They never `postEntry`. Confirm still posts. Layout is this-phone cosmetics. Weather is atmosphere, never CAD.

The original “Claude specs, Grok implements” pass produced a 17-row **phone rail**. Wide canvas is what Jonathan wants to **finish**. Assignment history: [CLAUDE_OFFICE_UX.md](CLAUDE_OFFICE_UX.md) (historical feeling), [CLAUDE_MOBILE_SHELL.md](CLAUDE_MOBILE_SHELL.md) (shipped phone).

Laws: [DECISIONS.md](DECISIONS.md) D-044 / D-047 / D-049 / D-050 / D-051. Strategy: [STRATEGY.md](STRATEGY.md). Companion: [HERCULES.md](HERCULES.md).

## Kernel the office may not change

- Commands remain the money trust boundary.
- Expense / income / transfer / refund keep their meanings. Card paydown is a transfer.
- CAD cents. `America/Toronto`.
- Hercules never posts, never reads partner-personal money, and never dies on vacation. D-132 lets on-device household talk explain named members' shared posts without shame.
- Bank / Interac / issued cards stay gated on Auth + RLS (D-039).
- **Kill criterion:** if Bianca will not add milk because a widget or the cat is in the way, shrink the furniture.

---

## The feeling

You sit down and the room is already warm. Rain is on the glass to your left — real streaks, a wet sill, the light gone grey-green the way it does over Toronto in August when the humidity finally breaks — and it stays *over there*, on the window, because the desk in front of you is dry paper and you can read every number on it. A used desk. A blotter with the month's net pressed into it, a wallet tray with the Visa face-up because it is the one that needs you, a calculator sitting slightly askew where someone last pushed it, chalk notes in yesterday's hand **on the weather glass** (wide). Phone still keeps a chalkboard card. Default packing (D-082) stops one card clipping another; it is not a Bloomberg grid. Names stay Fraunces. Papers stay cream. You can **pin** up to four widgets open; leaving Home still collapses the unpinned one. And there is a very large Maine Coon who hops onto whatever you just opened, then loafs if you tap him again.

---

## A. Office Spec

### A1. Information architecture

Home stops being a scroll of cards and becomes **the office**: one desk, fourteen instruments plus a fixed sill plate, three depths.

```text
                       ┌─────────────────────────────────┐
   GLANCE              │  ▓▓▓ WINDOW ▓▓▓  rain · 19°     │   read without touching
   (always on desk)    │  ═══════ sill ═══════           │   no interaction needed
                       ├─────────────────────────────────┤
                       │  ┌───────────┐  ┌────────┐      │
                       │  │  BLOTTER  │  │ WALLET │ 🐈   │   tap = EXPAND
   EXPAND              │  │  +$412 ✓  │  │ VISA   │      │   in place, desk stays
   (tap an instrument) │  └───────────┘  └────────┘      │   one open at a time
                       │   ┌─────┐ ┌────┐ ┌───┐ ┌────┐   │
                       │   │CALC │ │MAIL│ │LMP│ │CHLK│   │
                       │   └─────┘ └────┘ └───┘ └────┘   │
                       │   ┌──────┐ ┌────┐ ┌────┐        │
                       │   │TIMESH│ │JARS│ │CARD│        │
                       │   └──────┘ └────┘ └────┘        │
                       ├─────────────────────────────────┤
                       │  Home  Cal  (+)  Plan  Books  ⋯ │
                       └─────────────────────────────────┘
                                  │
   DEEP                           ▼
   (nav or cabinet handle)  Calendar · Plan · Books · More
                            month board, statements, rec,
                            close pack, pairing, storage
```

**The rule that decides what goes where:** an instrument lives on the desk if a household member would want it **without having decided to look for it**. It lives in a cabinet if they arrived with an intention. Net, wallet, next bills, health, streak — those find you. Rec, close pack, the general journal — you go to those.

**Does the nav still matter?** Yes, and it stays exactly as it is. The office does not replace Calendar/Plan/Books/More; it makes them optional on an ordinary day. Two paths to every cabinet — the nav (intentional) and a widget's cabinet handle (curious) — is correct, not redundant. **Do not remove a nav tab because a widget covers it.**

### A2. The window

A fixed band at the very top of Home. **Not wallpaper.** It occupies `clamp(96px, 22vh, 168px)` and ends in a hard, physical sill edge. Numbers never render on top of weather.

| Condition | Glass | Sill | Light on the desk |
|---|---|---|---|
| clear day | pale blue, faint cloud drift | dry, warm | `--paper` unchanged |
| rain | vertical streaks (CSS gradient + 2 animated layers), puddle sheen on sill | dark, wet | desk shifts 3% cooler |
| snow | slow drift, frost creep at corners | pale, piled | desk 4% cooler, `--copper` warms |
| night | deep indigo, warm rectangle of interior reflection | dark | desk dims 6%, lamp glow reads stronger |
| humid August | hazy, low contrast, still | dry | very slight amber cast |

Season comes from `kitchenSeason(today)` → `"patio" | "ruff" | "none"` (already wardrobe-bound). Hour comes from `hourInToronto()`. Weather comes from **Open-Meteo, no key**:

```text
GET https://api.open-meteo.com/v1/forecast
    ?latitude=43.65&longitude=-79.38
    &current=temperature_2m,precipitation,weather_code,is_day
    &timezone=America/Toronto
```

- **Timeout 4s.** Cache in `localStorage` under `hearth.weather.<environment>`, TTL 30 min, stale-while-revalidate.
- **On any failure** (offline, timeout, non-200, malformed): fall back to `hourInToronto()` + `kitchenSeason(today)` and render a clear/night/snow glass from clock and season alone. The window never shows an error, never shows a spinner after first paint, and **never blocks Add**.
- **No CAD in the sky.** No "you spent $40 today" in the weather sentence. Ever. Temperature is the only number the window may show.
- `prefers-reduced-motion`: all drift/streak animation off; rain becomes a static wet-glass texture and a darker sill. The state still reads.

**Expanded** (tap the glass): one forecast sentence — "Rain easing by four. 19°." — plus the season word. Nothing else. **Minimized:** sill only, 14px, still atmospheric.

**Sill plate (D-064):** a paper strip *under* the glass, weather-tinted ≤6%, `--ink` on `--paper`. Month net, hottest card, next bill, next visit (quiet title), groceries remaining, and a YNAB-style “what needs me.” Tapping a figure expands that instrument. CAD never renders on the glass.

Leaving Home or opening Add **collapses** expanded instruments. Wide drag snaps to a 16px grid and auto-levels. Cabinets → **Straighten** restores default positions (wide) or rail order (phone). Cabinets → **Desk** hides or shows instruments (calculator stays). Calendar and Appointments are instruments; Mail remains **outflow** bills (never Bianca pay); Claims remain A/R; Accounts is the Mint/YNAB tile strip; Accessories is Hercules’s wardrobe; tic-tac-toe and hangman are kitchen games (inert during Add).

### A2b. Widget environment (D-066–D-077)

Each instrument is a product, not a glance:

| Instrument | What it is |
|---|---|
| Calendar | Day / week / month. Past and upcoming **shifts with income**, visits, bills/subscriptions, paychecks, owed-to-us landing. Never posts. |
| Timesheet | Analog Toronto clock. Start shift underneath. Live start-vs-now while punched. Posted same-day shift stays on the gold arc. New day = plain clock. |
| Calculator | Milk / Coffee / expense Confirm. Shift is **preview-only** tip math (`calcShiftAmounts`). Never `postShift`. |
| Accounts | Current balances, utilization, days until due, last post, recent journal rows. Pay card is still a transfer. |
| Jars | Hercules-coat piggy banks that fill with `savedCents / targetCents`. Contribute stays on Plan. |
| Accessories | Hats, chains, collars, houses, rename, kitchen notes, clink. Chalkboard is drawing only. |
| Games | Two-phone tic-tac-toe and hangman. Household words. Last-write-wins kitchen rows. Empty `postedIds`. |

Opening any instrument makes Hercules speak sample queries for **that** object (`herculesInstrumentSurface`). Civil date labels format UTC so Toronto does not see yesterday.

### A3. The desk canvas

This is where most "office" designs die on a phone. The honest answer:

**Phone (< 720px) — a rail, not a canvas.** One column, thumb-reachable, but it *reads* as a desk because of overlap, rotation, and shadow, not because of free 2D placement. Instruments are ordered in a list the user can reorder by long-press-drag. Adjacent instruments overlap by 6–10px and carry ±0.4° rotation seeded from their id (stable across reloads — the same object is always askew the same way). Shadows are contact shadows, not card elevation. Two half-width instruments may pair on one row.

**Tablet / wide (≥ 720px) — free move.** Absolute placement on a grid with 8px snap, drag anywhere, overlap allowed. Layout persists per breakpoint separately (`phone` and `wide` keys) so rearranging on an iPad does not scramble the phone.

**Why not free move on phone:** a 390px viewport minus a 96px cat minus a 76px nav has no room for a canvas, and free-positioned instruments under a thumb produce exactly the hit-test hell the kill criterion forbids. The rail keeps Milk at ten seconds.

**Overlap rules.** Overlap is decoration, never occlusion of content: an instrument may be overlapped along its outer 10px margin only. An expanded instrument pushes its neighbours down (phone) or lifts to `z:10` and dims the desk 8% (wide). **One expanded at a time** — expanding the wallet collapses the blotter. This keeps the room legible and keeps the cat's furniture map small.

**Layering contract.** The existing z-index values are load-bearing; extend, do not renumber.

| Layer | z-index | Status |
|---|---|---|
| window glass / sill | `0` | new |
| desk instruments | `1`–`9` | new |
| instrument being dragged | `10` | new |
| nav | `15` | **new — currently `position:fixed` with no z-index; give it one** |
| Add sheet (`.sheet`) | `20` | unchanged |
| Hercules (`.hercules-live`) | `28` | unchanged |
| Hercules bubble | `29` | unchanged |
| toast | `30` | unchanged |
| `.sheet.guard`, `.cmdk` | `40` | unchanged |

Consequences, stated so Grok does not have to infer them: **instruments never cover Add.** **Hercules is always above instruments** — which is what "sits on the furniture" requires. **The toast is above the cat**, so undo is never blocked by a loafing Maine Coon.

### A4. Persistence

| What | Where | Why |
|---|---|---|
| Instrument order, position, minimized/expanded, which are on the desk | `localStorage` key `hearth.office.<environment>.<breakpoint>` | This phone, this environment. Bianca's pile is not Jonathan's. |
| Weather cache | `localStorage` `hearth.weather.<environment>` | Atmosphere, disposable |
| Instrument **data** | household snapshot, via existing projections | The Visa balance is the Visa balance on both phones |
| Hercules pin, cosmetics, chat/memories | `kitchen.hercules` (D-049), unchanged | Already merges |

**Layout must never enter the shared snapshot.** Look and layout may copy to a Hearth-owned Drive `Hearth desk.json` keyed to this Google account (D-092). The snapshot still must not grow a layout blob.

Layout schema is versioned (`{ v: 1, items: [...] }`) and **fails soft**: unknown widget id → dropped; missing widget id → appended at its default rank; corrupt JSON → reset to default desk, no error surfaced. A layout bug must never cost someone their ability to post.

### A5. Accessibility

- **Hit targets ≥ 44×44px.** The minimize affordance is the instrument's own header, not a 20px chevron.
- **Contrast on rain is the main risk and is solved structurally:** no text ever renders over the window. Desk text stays `--ink` on `--paper` (≥ 12:1). The only weather-tinted text is the forecast sentence inside the expanded window, which sits on a `--card` plate.
- `prefers-reduced-motion`: no rain animation, no cat walk tween (he cuts to the destination pose), no expand spring — cross-fade instead. All state remains readable.
- **Screen reader names.** Every instrument is a `<section>` with `aria-label` naming the object *and* its reading: `aria-label="Blotter. Month net four hundred twelve dollars. Clean opinion."` Minimized instruments keep their label. The window is `aria-label="Window. Rain, nineteen degrees."` Hercules lives in an `aria-hidden` layer with a single polite live region for chat only — the cat must never spam a screen reader.
- **Never require hover.** Every hover affordance has a tap equivalent. Drag has a keyboard equivalent: focus an instrument, `Space` to lift, arrows to reorder, `Space` to drop, `Escape` to cancel.
- **Reduced-transparency / forced-colors:** window collapses to a flat sill rule; instruments get solid borders.

### A6. States matrix

Rows are `kettlePhase` × weather. Cells say what the **room** does. The CAD never changes — this is the guarantee that makes the atmosphere safe.

| `kettlePhase` | clear | rain | night/snow | Cat (mood-gated) | Instrument promoted to top of rail |
|---|---|---|---|---|---|
| `morning` | bright glass, kettle steams | streaks, wet sill | dark glass, lamp warmer | `glowing`→stretch on sill · `content`→loaf · `restless`→pace · `hiding`→corner | **Calculator** (Milk is the morning act) |
| `after-shift` | warm low sun | heavy rain | interior reflection | `fresh` streak → jump, then loaf on Timesheet | **Timesheet** |
| `sunday` | flat daylight | soft rain | — | perch on Postcard, wash | **Postcard** (sit-down) |
| `evening` | dusk gradient | dark streaks | deepest indigo | sleep on warmest instrument | **Blotter** |

Independent overlays, applied after the above:

- `adding === true` → **window dims 30%, all instruments inert (`pointer-events:none`), cat corner-loafs at `{x:6,y:6}` and cannot be dragged.** Nothing competes with Post.
- `runHealthCheck(household).length > 0` → **Lamp lights**, promoted to rail position 2, cat may `pounce` it.
- `shiftPostingStreak.waiting === true` → Timesheet shows a "Log shift" chip; cat may pounce the Timesheet. **Never a red banner. Never mood=hiding from this alone.** (D-050)
- `auditOpinion.kind !== clean` → Blotter stamp changes colour; cat does **not** attack the blotter (an opinion is not a chore).
- `dashboard.stale === true` → sill shows a faint dust line; no number changes.

### A7. Cut list — considered and refused

| Idea | Why it is out |
|---|---|
| Full-bleed weather wallpaper behind the numbers | Kill criterion. Rain over CAD fails contrast and hides the grocery pad. Weather is *in the window*, and the window has an edge. |
| Free 2D drag on phone | 390px minus cat minus nav is not a canvas. Produces hit-test hell; Milk stops being ten seconds. Rail on phone, canvas at ≥720px. |
| "Safe to spend" gauge on the blotter | The math does not exist and inventing runway is exactly the fake-Visa-cash failure. Out until a real projection lands. |
| Live bank ticker / balance feed instrument | D-039. Auth + RLS first. Do not build the shell "ready for later" — a shell invites a fake. |
| Hercules hunger / care meter that decays | D-044. No pay-to-keep-alive, no death, vacation does not kill him. A lick is a fact, not a need. |
| Widget store / add-widget gallery | The desk is *this household's* twelve instruments. A catalog turns an office into a SaaS dashboard. Instruments can be removed and restored, not shopped for. |
| Layout synced across phones | D-051 cosmetics, and `sync.ts` would corrupt it (footer). Bianca's pile is hers. |
| Cat physics engine (gravity, momentum, collision solver) | Cost is enormous, payoff is a novelty, and every frame competes with the ledger. Directed motion toward registered furniture reads as physical for 5% of the work. |
| Notification/lock-screen widgets showing CAD | Out of engineering scope this cycle; also a privacy surface before Auth. Cabinet: later. |
| A second "office" tab separate from Home | Home *is* the office. A second tab means neither is the default place. |

---

## B. Widget catalog

**Widget law restated as a contract Grok can check:** every instrument is a projection with a Hercules verb. It may open Add with defaults; it may never post. `Confirm` still writes. If an instrument's expand needs a number that no projection returns, the instrument is under-specified — come back to me, do not invent the number.

Shared anatomy (all twelve):

```text
┌─ header (44px, drag handle, tap = expand/collapse) ─┐
│  ▸ NAME                            glance value     │   ← minimized = header only
├─────────────────────────────────────────────────────┤
│  expand body: one primitive taught, honest CAD      │
│  [ cabinet handle → deep surface ]  (if it has one) │
└─────────────────────────────────────────────────────┘
```

Every instrument declares `perchable: boolean` and publishes its rect to `officeLayout.ts` (§C).

---

### B1. Window

- **Glance:** glass + sill, temperature only.
- **Expand:** forecast sentence + season word. Nothing else.
- **Minimize:** sill only (14px band). Still shows weather state through colour.
- **Move:** ✗ — always rail position 0 / top of canvas. The window is in the wall.
- **Data:** Open-Meteo (no key, cached, 4s timeout) → fallback `hourInToronto()` + `kitchenSeason(today)`.
- **Write:** none.
- **Hercules:** `perch` on the sill (his favourite — weight the perch chooser toward it), `stretch`, `sleep`. Never `attack`.
- **Empty/warn:** fetch failed → clock+season glass, no error text, no spinner. There is no warn state; weather is never a warning.
- **Deltas:** budget **0** · engagement **+3**.
- **Taps:** 1 — look at it.

### B2. Blotter — net + opinion

- **Glance:** `formatCad(dashboard.month.netActualCents)` big, in `--display`, pressed into the blotter. `auditOpinion().kind` as a wax stamp in the corner. One Health lamp dot if findings exist.
- **Expand:** in/out for the month (`month.incomeActualCents` / `month.expenseActualCents`), `opinion.hercules` sentence, `opinion.cpa` sentence, trial-balance ✓/✗ from `opinion.trialInBalance` + `opinion.equationHolds`.
- **Minimize:** the stamp alone.
- **Move:** ✓.
- **Data:** `buildDashboard(household, today, now, healthFindingCount)`, `auditOpinion(household)`.
- **Write:** none. Cabinet handle → Books → statements.
- **Hercules:** `perch` (top edge), `lick`/`wash` when mood is `glowing` or `content`. **No `attack`** — an opinion is not a chore.
- **Empty:** no transactions this month → "Nothing posted this month yet." and a dry stamp outline. Not $0.00 styled as an achievement.
- **Warn:** `kind !== "clean"` → stamp in `--copper`, and the expand leads with `opinion.cpa`.
- **Deltas:** budget **+5** (month net is the company; opinion teaches that the journal is the authority) · engagement **+2**.
- **Taps:** 2 — tap blotter, read stamp.

### B3. Wallet tray

- **Glance:** the hottest card face-up (`wallet.hottestCard`), plus `formatCad(wallet.cashCents)` and `formatCad(wallet.owedCents)`.
- **Expand:** the tile list from `wallet.groups` (chequing / savings / credit / investment / other), each with its `sub` line. One card-room summary for `hottestCard` — statement balance, minimum, due date, utilization %.
- **Minimize:** one card edge, name + owed.
- **Move:** ✓.
- **Data:** `householdWallet(household, today)`, `creditCardView(household, account, today)`.
- **Write:** "Pay card" opens Add pre-set as a **transfer** to that card (D-016). Existing `openPayCard` path — do not build a second one. Confirm still posts.
- **Hercules:** `perch` (the tray is his second-favourite), `bump` a tile when walking past → the tile shifts 3px and settles. `attack` **only** on a card past its due date.
- **Empty:** one account only → show it plainly, no group chrome.
- **Warn:** utilization ≥ 80% or past due → tile edge `--copper`; past due adds a small tab. **Never** render APR as a fee, never a "you're in trouble" sentence.
- **Deltas:** budget **+5** (account literacy; paydown-is-a-transfer taught at the point of use) · engagement **+2**.
- **Taps:** 3 — tap tray, read Visa, tap Pay card.

### B4. Calculator — the desk pad

The single most important instrument. This is Milk.

- **Glance:** a small CAD pad face, `Milk` / `Coffee` / `Shift` chips beneath.
- **Expand:** **the pad expands in place on the desk** — full `CadPad` (digits are cents, 1-2-5-0 → `$12.50`, mouse-wheel blocked, per D-050), account + category defaults from `addFormDefaults`, and a full-width **Post**. Details stay collapsed behind "More".
- **Escalation to the sheet:** tapping **More** (splits, date, place, visibility, transfer) opens the existing full `.sheet` at `z:20`. So: **the common case never leaves the room; the complex case gets the sheet it needs.** Both end at the same `postEntry`/`postTransfer`/`postShift` + Confirm.
- **Minimize:** a tiny pad, or a `+` if the user removed it (the FAB still exists and is unchanged).
- **Move:** ✓, but it **cannot be removed from the desk** — remove hides other instruments, never this one.
- **Data:** `addFormDefaults`, `centsDigitsFromDollars`, `dollarsFromCentsDigits`, `padToDollars`, `parseAmount`.
- **Write:** `postEntry` / `postTransfer` / `postShift` through the existing command path and the existing Confirm sheet. **No new money verbs. No new validation.**
- **Hercules:** loafs *beside* it. **Hard rule: the cat's rect may never intersect the Post button's rect.** If the layout puts them together, the cat moves — not the button.
- **Empty:** n/a.
- **Warn:** duplicate detection is unchanged — the existing confirm flow fires. The pad does not pre-warn.
- **Deltas:** budget **+5** (posting rate is the whole ballgame) · engagement **+1**.
- **Taps:** 4 — tap pad, 1-2-5-0, Post, Confirm.

### B5. Chalkboard

- **Glance (wide):** typeset notes on the weather glass, transparent, Fraunces, cozy cream (D-094). Phone keeps the card.
- **Expand:** Chalk button on the glass, or pin the chalkboard. Draw / neaten / bought still never post.
- **Pin:** user pin-open (D-091) is not calculator cannot-hide.
- **Minimize:** the board frame, chalk dust.
- **Move:** ✓.
- **Data:** `household.kitchen` (existing `DailyHearth` props).
- **Write:** `scribbleChalk` / wipe — cosmetics, never money. "Bought" **opens Add**; it does not post.
- **Hercules:** `lick`/`wash` while idle on the board when `content`/`glowing`; `perch` on the frame. This is his signature idle.
- **Empty:** "Nothing on the board." plus a chalk stub. Not a call to action.
- **Warn:** none. A chalkboard cannot warn you.
- **Deltas:** budget **+1** (a note becomes a posting) · engagement **+3**.
- **Taps:** 3 — scribble "milk", tap bought, Post.

### B6. Mail — money dates

- **Glance:** the next money date, `formatDateLabel(item.date)` + title + `formatCad(item.amountCents)`.
- **Expand:** next three from `dashboard.upcoming` (`BoardItem[]`), each with direction in/out. **Mark paid** on a due item uses the existing confirm + `postOneRecurrence`.
- **Minimize:** a closed envelope; a corner lifts if something is overdue.
- **Move:** ✓.
- **Data:** `buildDashboard().upcoming`, `dashboard.dueRecurrences`.
- **Write:** mark paid → existing recurrence command + Confirm. **No auto-post. No auto-pay.** (Widget law.)
- **Hercules:** `attack`/`pounce` on **overdue** mail only — this is his one honest aggression. Envelope shakes, one line max ("mrrp"), no modal, no guilt sentence.
- **Empty:** "No money dates in the next while." Envelope closed, flat.
- **Warn:** overdue → envelope corner lifted, `--copper` edge. Never red, never a count-up of days late.
- **Deltas:** budget **+4** (bills get seen and marked, rec stays honest) · engagement **+2**.
- **Taps:** 3 — tap envelope, read three dates, tap Calendar handle.

### B6b. Claims tray — money owed to us (D-053)

- **Glance:** outstanding receivable CAD, or "clear."
- **Expand:** oldest open claims, honest copy (settlement is a transfer, never income). **Landed** uses Confirm + `settleClaim`. Cabinet handle → Calendar → Appointments.
- **Write:** none from the widget directly. Confirm still posts.
- **Hercules:** `perch` when something is outstanding; `attack` ranks after overdue mail.
- **Empty:** "Nothing owed to this household right now."
- **Deltas:** budget **+5** (A/R is a real asset) · engagement **+2** (the cat notices what you're owed).

### B7. Timesheet — punch clock

Clock-in is kitchen cosmetic (`openShift`). Hours are a live preview until sign-out Confirm runs `postShift`. Already-off is a finished-shift ceremony with hours last. Never mind wipes the punch. Streak still reads posted dates.

- **Glance:** live preview hours when on the clock, otherwise `shiftPostingStreak(household, today).count` + `.spoken`.
- **Expand:** Clock in (kitchen `openShift`, no post), Sign out (hours first, then sales/tips, then `postShift`), Already off (hours last), Never mind (wipe). Streak lesson unchanged.
- **Minimize:** a punch clock face.
- **Move:** ✓.
- **Data:** `activeOpenShift`, `shiftPostingStreak`, `calcShiftAmounts` inside Add after hours are known.
- **Write:** none directly. Clock-in `postedIds: []`. Confirm still `postShift`.
- **Hercules:** `jump` then `celebrate` when `fresh === true`; `pounce` the punch clock when `waiting === true`. **Never** "you broke your streak." A day off does not kill him (D-050).
- **Empty:** no shifts ever → "No shifts posted yet." and Clock in. Not a zero streak.
- **Warn:** `waiting === true` → clock hand droops. Prompt, never punish.
- **Deltas:** budget **+4** (shift posting is the household's largest variable income) · engagement **+3**.
- **Taps:** Clock in on the desk; Sign out Confirm still writes.

### B7b. Chalkboard

Drawable slate. Ink stores with the note. **Neaten** is on-device 5×7 letter detection. Typeset fallback remains for accessibility. Never posts.

### B8. Postcard — the sit-down

- **Glance:** `sitDownPostcard(household).sentence`.
- **Expand:** the three-act Plan guide (`SitDownGuide`) — positives, books, leftover jobs. Copy jobs still calls `applySitDown` with `postedIds: []`. Confirm moves calls `executeSitDownMoves`.
- **Minimize:** a stamped postcard edge.
- **Move:** ✓. Auto-promoted to rail position 1 when `kettlePhase === "sunday"` and `ready === true`.
- **Data:** `sitDownPostcard(household)`, `leftoverProjection`, `sitDownFacts`, `sitDownPreview`.
- **Write:** leftover jobs through `executeSitDownMoves` (transfers). Copy jobs through `applySitDown`. **The widget never one-taps leftover** — no "quick apply" shortcut. A sit-down that can be done in one tap is not a sit-down. Phone stays five objects; Plan remains the long session.
- **Hercules:** `perch` on the postcard, `wash` during Sunday. He may read act 1. He never posts.
- **Empty:** `ready === false` → "Next sit-down after the month turns." Card face-down.
- **Warn:** none.
- **Deltas:** budget **+5** (leftover jobs and lock) · engagement **+3** (three-act ceremony).
- **Taps:** glance, then the three acts on Plan / the expanded postcard.

### B9. Cook-off — kettle

- **Glance:** `cookOffScore(household, today).sentence` and the winner as a kettle or a takeout cup.
- **Expand:** `groceryCents` vs `coffeeCents` for the week as two stacked bars.
- **Minimize:** the kettle, steaming if `winner === "kitchen"`.
- **Move:** ✓.
- **Data:** `cookOffScore(household, today)`.
- **Write:** none.
- **Hercules:** `perch` on the kettle when cool; `bump` it when walking past.
- **Empty:** no groceries and no coffee → "Nothing cooked, nothing bought." Kettle cold.
- **Warn:** none, and **explicitly never names a person** (D-044). "Takeout won this week" — never "Jonathan won."
- **Deltas:** budget **+2** (category literacy without shame) · engagement **+3**.
- **Taps:** 2 — tap kettle, read bars.

### B10. Jars — goals

**⚠ Gated. Read the handoff footer before implementing the contribute affordance.**

- **Glance:** the nearest goal jar, fill height = `progress`, name + percent.
- **Expand:** each goal from `dashboard.goals` (`{ goal, progress }`) as a jar; target, saved, deadline; **Contribute** uses the existing `contributeToGoal` command.
- **Minimize:** one jar.
- **Move:** ✓.
- **Data:** `buildDashboard().goals`.
- **Write:** `contributeToGoal` — existing command, existing Confirm.
- **Hercules:** `perch` beside the jars; `lick` a jar that just filled. No attack — a goal behind schedule is not a moral failure.
- **Empty:** no goals → "No jars on the shelf yet." + "Add a goal" → Plan.
- **Warn:** past deadline → jar lid tilts. No countdown, no shame sentence.
- **Deltas:** budget **+4** (goals are why this product exists) · engagement **+3**.
- **Taps:** 3 — tap jar, Contribute, Confirm.

### B11. Lamp — Health

- **Glance:** dark when `runHealthCheck(household).length === 0`. That is the *good* state, and a dark lamp is the most legible "all clear" in the room.
- **Expand:** the finding list, each finding tappable → the row it names.
- **Minimize:** the lamp base.
- **Move:** ✓. Auto-promoted to rail position 2 when lit.
- **Data:** `runHealthCheck(household)` → `Finding[]`.
- **Write:** none. Cabinet handle → More.
- **Hercules:** `pounce` the lamp when lit and mood is `hiding`. This is honest: the books disagree with themselves and he is unsettled.
- **Empty:** dark lamp + `aria-label="Health lamp. Clean."` No green checkmark celebration.
- **Warn:** lit, warm glow, count on the shade.
- **Deltas:** budget **+5** (Health is the imbalance refusal made visible) · engagement **+2**.
- **Taps:** 2 — see it dark, tap it.

### B12. Cabinet handles

Not an instrument — a treatment. A small brass handle with a label at the foot of the desk: **Books · Calendar · Plan · More**. Tapping is identical to the nav. They exist so the room says "there is more behind me" without a menu.

- **Move:** ✗. Always the last row.
- **Hercules:** may `perch` on the row; may not block a handle (44px rule).
- **Deltas:** budget **+1** · engagement **+2**.

---

## C. Hercules physics

### C1. The central change: furniture, not randomness

Today `safePerch(adding, mood, w, h)` picks a **random** x/y and dodges the FAB by arithmetic. That is why the cat does not feel like he lives here. Replace the random draw with a **furniture registry**.

```ts
// src/core/officeLayout.ts  — pure, no React import (matches core/ discipline)
export type Furniture = {
  id: string;              // widget id
  rect: { x: number; y: number; w: number; h: number };
  perchable: boolean;      // top edge can hold a cat
  warn: boolean;           // honest warn state → attackable
  kind: "sill" | "tray" | "board" | "envelope" | "clock" | "lamp" | "card" | "pad" | "jar" | "kettle";
};

export function perchTarget(
  furniture: Furniture[],
  mood: CompanionMood,
  phase: KettlePhase,
  adding: boolean,
  viewport: { w: number; h: number },
): { x: number; y: number; on: string | null; pose: HerculesPose };

export function attackTarget(furniture: Furniture[]): Furniture | null;   // warn === true only
export function walkPath(from: Point, to: Point, furniture: Furniture[]): Point[];  // ≤ 3 waypoints
```

Each widget publishes its rect on mount, resize, drag-end, and expand/collapse (`ResizeObserver` + `getBoundingClientRect`). While a widget is being dragged, publish is rAF-throttled. **Do not poll on a 100ms interval.** `Hercules.tsx` consumes the registry. **`src/core/` still imports no React** — the registry is a plain store with a subscribe function; the React binding lives in `src/widgets/useFurniture.ts`.

### C2. Targeting rules

| Verb | Chooses | Pose | Constraint |
|---|---|---|---|
| **perch** | `perchable` furniture, weighted: sill 3×, tray 2×, board 2×, others 1×; phase promotes its instrument (§A6) 2× | `loaf` → `sleep` (evening) / `stretch` (morning) | Lands on the **top edge**: `y = rect.y - CAT + 12` so his paws overlap the object by 12px. Sill is **profile along the ledge** (left or right), never a looking-out-the-window drawing. |
| **bump** | any furniture whose rect the walk path or a drag crosses | `bump` | Widget nudges 3px and settles (200ms spring). **Never moves a number, never re-orders the desk. No clink.** |
| **lick** | board or tray, mood `content`/`glowing` | `lick` | Idle only. No modal, no chat open. |
| **pounce** | the decorative desktop fly | `pounce` | Butt wiggle, then launch/catch. The fly never carries CAD. Mobile and reduced motion hide the fly and litter box. Automatic paths never enter the litter zone. |
| **attack** | `attackTarget()` — **only** `warn === true`: overdue Mail, waiting Timesheet, lit Lamp while `hiding` | `attack` | Stands beside the object, facing it, raised paw. Never on the user. Never on Add. Never on the Calculator. Never on a person's name. Max once per 90s. |
| **hide** | corner, mood `hiding` | `hide` | Unchanged. |
| **drag / pin** | user | — | Unchanged. Dragging across an instrument emits `bump`. Pinned = he stays; instruments may still move under him, and he does not re-perch until unpinned. |

**What stays random:** which of several equally-weighted perchables he picks, the idle phase cycle (the existing 6-step interval), micro-jitter of the landing point (±4px), and whether an idle tick produces a `wash` or nothing. Randomness gives life; targeting gives place. Keep both.

### C3. Collisions, z-index, and the Add exception

- Cat is `z:28`, above every instrument (max `z:10`). He is **always** on top of the furniture. Correct and intended.
- `.hercules-world` stays `pointer-events: none`; only the cat body is hit-testable. Instruments underneath stay tappable **through** him except for his 96px body — and that is the kill-criterion risk, handled next.
- **Kill criterion, implemented:** when `adding === true`, the cat becomes `pointer-events: none` entirely, corner-loafs at `{x:6, y:6}`, is not draggable, and the window dims. When `adding === false`, if the cat's rect intersects the **Calculator's Post button** rect, `perchTarget` re-rolls — up to 3 attempts, then falls back to `{x:pad, y:pad}`. The cat yields to Post. Always.
- Expanding an instrument under a perched cat: he `jump`s to the new top edge of that instrument (he rides it). If it collapses, he re-perches elsewhere. Never leave him floating over a rect that no longer exists.
- On `prefers-reduced-motion`, he cuts to the destination and sets the landing pose immediately — keep the existing 900ms land timeout for everyone else.

### C4. Chat and chips

Compact bubble, unchanged (`z:29`), 2–3 chips. Chips may now **target instruments**:

- "Pay the card?" → expands Wallet tray + opens Add as a transfer to that card.
- "Sit down?" (Sunday) → expands Postcard at step Look.
- "What's on the Visa?" → expands Wallet, `askHercules` answers on-device.

Typed money questions stay `talkHercules` / `askHercules`, answered **on-device** from the journal (D-049). Unmatched talk goes to the Worker. **He still never posts.** A chip that opens Add is the furthest he goes, and Confirm still writes.

### C5. New poses — each mapped to a fact

| Pose | Fires when | The fact behind it |
|---|---|---|
| `perch` | idle, furniture registry non-empty | none needed — it is placement, not opinion |
| `lick` | idle on board/tray, mood `content`\|`glowing` | `describeCompanion().mood` from posted facts |
| `bump` | walk path crosses furniture | none — motion only |
| `attack` | `attackTarget()` non-null | overdue `BoardItem`, `shiftPostingStreak.waiting`, `runHealthCheck().length > 0` |

Add these to the `HerculesPose` union alongside the existing ten. **A lick is not a hunger meter** — it never decays, never accumulates, never asks for anything.

---

## D. Visual system

### D1. How rain, night, and paper coexist with readable CAD

One rule does all the work: **weather lives in the window; the desk is always paper.** Atmosphere is applied to the *room*, not to the *instruments*. Instruments sit on `--card` plates with contact shadows; their text is `--ink`. A rainy evening changes the desk by ≤ 6% luminance and never touches text colour. There is no scenario in which a number is rendered on a moving surface.

### D2. Token extensions

Extend `:root` in `src/styles.css`. **Do not invent a second theme system** — every new token derives from the existing house.

```css
:root {
  /* room */
  --sill:        #b9a68a;                      /* window ledge, warm wood */
  --glass:       #cfd8dc;                      /* default daylight glass */
  --glass-rain:  #9fb0b5;
  --glass-night: #26303a;
  --glass-snow:  #e6ecef;
  --rain:        rgba(255, 255, 255, 0.35);    /* streak highlight */
  --desk:        var(--paper-2);               /* the surface instruments sit on */
  --felt:        #7b5e3b;                      /* blotter leather */
  --brass:       #b08d57;                      /* cabinet handles, lamp */
  --lamp-on:     #f0c96b;
  --lamp-off:    #6b6258;

  /* instrument depth — contact shadows, not card elevation */
  --lift-0: 0 1px 0 rgba(60, 42, 20, 0.10);
  --lift-1: 0 6px 14px rgba(60, 42, 20, 0.12);
  --lift-2: 0 18px 40px rgba(60, 42, 20, 0.18);   /* dragging */

  /* room mood, set on .office by the weather/phase resolver */
  --room-dim:  0;      /* 0 → 0.06 */
  --room-cool: 0;      /* 0 → 0.04 */
}
```

Room mood is applied as **one** overlay on `.office::after` driven by those two custom properties — not by swapping every token. That keeps every existing `--ink`/`--paper` contrast ratio intact by construction.

New CSS lives in **`src/office.css`**, imported alongside `styles.css`. Existing selectors are not renamed. `.hercules-*`, `.sheet`, `.toast`, `.cmdk`, `.nav` are untouched except for the single `z-index: 15` addition on `.nav`.

### D3. Materials

- **Paper:** the existing body gradient (ruled lines + copper margin rule) stays and *is* the desk. It already reads as a ledger pad.
- **Blotter:** `--felt` plate, inset shadow, slightly darker than the desk, with a leather grain via a low-opacity repeating gradient.
- **Rain:** two `repeating-linear-gradient` layers at different angles and speeds (`translateY` keyframes, 1.8s / 2.6s), plus a wet-sill highlight. ~20 lines of CSS. **No canvas, no WebGL, no image.**
- **Rings:** an instrument that has been moved leaves a faint `--paper` ring where it sat, 3% opacity, decaying over 24h from `localStorage` timestamps. This is the single cheapest "lived-in" cue in the whole design.
- **Rotation:** `--rot: <seeded ±0.4deg>` per instrument, stable from a hash of its id.

### D4. Motion, sound, haptics

- **Rain is visual first.** No rain audio. Ever. A budget app that makes noise when you open it gets muted, and a muted app loses `playClink`.
- `playClink` (existing) stays exactly where it is: on a successful post. It is the reward, and it must stay rare enough to mean something. **Do not add clink to expand, drag, perch, or bump.**
- Haptics: a single light impact on **Post success only**, behind the same `clinkOn` preference. Nothing else vibrates.
- Expand/collapse: 180ms spring. Drag lift: 120ms. Cat land: existing 900ms.
- **No guilt owl.** Nothing in this room ever animates *at* the user to make them feel late.

### D5. Phone vs wide

**D-079 / D-080:** these are two UI branches. Shared theme and commands. Different density and customization. Desktop now takes the original QoL packet.

| | Phone (< 720px) | Wide (≥ 720px) |
|---|---|---|
| Layout | Shipped: glance rail, five or fewer, one-tap common acts (`OfficePhone`) | **This pass:** free move, sizes, stacks, Edit Desk, personalities, appearance |
| Window | Sill line; no CAD on glass | Weather glass — may earn more height; still no CAD |
| Instruments | Hierarchy: one number dominates | Full set, overlap allowed, sizes real |
| Expand | One at a time; stamps open instruments | Lift / dim; CPA density allowed |
| Cat | Corner seat; yields to Post | Perch on furniture; loaf on Add |
| Nav | Bottom bar; do not duplicate cabinet gold buttons | Current; cabinets launch the spaceship |
| Customization | Joint subset only (escape hatch today: hide/restore) | Appearance, sizes, dashboard faces, default desks, full rearrange |

`.app { max-width: 760px }` is a **desktop-branch** decision (D-080). Claude may use more of the glass if the office needs it.

The old line “the office does not become a desktop app at 1400px” is **withdrawn** as product law.

---

## E. September test script

Development snapshot, demo kitchen. Hand this to Bianca unedited.

**App/website:** Hearth — kitchen site or `pnpm dev` → `http://localhost:5173`
**Tab/page:** Home (the office). Calendar / Plan / Books / More are cabinets.

**Instructions:**

1. Tap the **Development** pill. Tap **Open the demo kitchen table**. (This is fictional money.)
2. Look at the **window** at the top. It should show Toronto weather and a temperature. It must **not** show a dollar amount.
3. Look at the **blotter** — the big number is this month's net. Note the stamp in its corner.
4. Tap the blotter. It opens on the desk; the room stays. Tap it again to close.
5. Find the **calculator**. Tap it. Type **1 2 5 0** — it should read **$12.50**, not $1,250.
6. Tap **Post**, then **Confirm**. You should hear a clink.
7. Tap the **wallet tray**. Find the card with the most owing. Tap **Pay card** — check the screen says **transfer**, not expense. Back out without posting.
8. Press and hold the **chalkboard** and drag it above the wallet. Let go. Pull down to reload the page — it should still be there.
9. Tap the chalkboard, write **milk**, then tap **bought**. It should open the calculator with "milk" already filled in. Post it.
10. Leave the phone alone for about a minute. **Hercules should walk somewhere and sit on top of something** — the sill, the tray, the board. Not float in the middle of nothing.
11. Tap Hercules. Ask him **"what's on the Visa?"**. He should answer and open the wallet. He should **not** post anything.
12. Tap the **punch clock**. Tap **Log shift**. Fill it in, Post, Confirm. Hercules should jump.
13. Tap the **lamp**. If it is dark, that is good — the books agree with themselves.
14. Tap **Books** at the bottom. Statements, rec, and the close pack should all still be there, unchanged.
15. Go back to Home. **Time yourself adding a $6.00 coffee.** If it takes more than ten seconds, tell Jonathan which thing was in the way.

**What we are testing:** step 15 is the real test. Steps 2, 7, 11 are the honesty tests (no CAD in the sky, paydown is a transfer, the cat never posts).

---

## F. Implementation packets for Cursor Grok

Ordered. Room chrome first, then projections into instruments, then cat physics, then persistence. Deep Books last (they are already done — they just stop being the default place).

```text
SLICE 1: Room chrome + window + desk canvas
USER-VISIBLE: Home has a window with Toronto weather and a desk you can rearrange; everything that was on Home still works.
BUDGET DELTA (5): 0 — nothing about money changes. This is the container.
ENGAGEMENT DELTA (3): +3 — the room exists.
IF THEY CONFLICT, CUT: the rain animation. Ship the static sill first.
RISK: Medium (touches App.tsx layout root)
TOUCH: src/Office.tsx (new), src/office.css (new), src/core/officeLayout.ts (new),
       src/core/weather.ts (new), src/App.tsx (Home branch only), src/styles.css (:root tokens, .nav z-index)
DO NOT TOUCH: postEntry, postShift, postTransfer, applySitDown, journal compile, RLS,
              Interac, .sheet, .hercules-*, .toast, .cmdk, Books.tsx, Calendar.tsx
READ: hourInToronto, kitchenSeason, kettlePhase
WRITE: none
TESTS: weather fetch timeout falls back to clock+season without throwing;
       weather cache respects 30-min TTL; layout JSON round-trips;
       corrupt layout JSON resets to default instead of throwing;
       kettlePhase × season resolver returns a valid room state for all 16 combinations
ACCEPTANCE: Home shows a window; the existing hero/wallet/pulses still render as instruments;
            Add still opens and posts; pnpm test green.

SLICE 2: Instruments bound to existing projections
USER-VISIBLE: The blotter, wallet tray, mail, punch clock, jars, kettle, lamp and chalkboard are real instruments that expand.
BUDGET DELTA (5): +4 — net, wallet, bills, streak and Health become glanceable without a scroll.
ENGAGEMENT DELTA (3): +2 — the desk fills with true objects.
IF THEY CONFLICT, CUT: Jars (see gate in the handoff footer). Ship the other seven.
RISK: Low (read-only projections)
TOUCH: src/widgets/*.tsx (new, one file per instrument), src/office.css
DO NOT TOUCH: any command, any projection's internals, Books/Calendar/Plan pages
READ: buildDashboard, householdWallet, creditCardView, auditOpinion, runHealthCheck,
      shiftPostingStreak, cookOffScore, sitDownPostcard
WRITE: none in this slice — cabinet handles and Add-openers only
TESTS: each instrument renders an honest empty state on a fresh household;
       blotter net === dashboard.month.netActualCents;
       lamp dark iff runHealthCheck().length === 0;
       no instrument renders a number absent from its projection
ACCEPTANCE: eight instruments on the desk, each expands and collapses, none posts.

SLICE 3: Calculator on the desk
USER-VISIBLE: You can post milk from the desk without a full-screen sheet, and complex adds still open the sheet.
BUDGET DELTA (5): +5 — this is posting rate.
ENGAGEMENT DELTA (3): +1
IF THEY CONFLICT, CUT: in-place expand. Fall back to the existing sheet; the room survives.
RISK: High (money path adjacency — the pad moves, the command must not)
TOUCH: src/widgets/Calculator.tsx (new), src/CadPad.tsx (reuse, do not fork), src/App.tsx (Add wiring)
DO NOT TOUCH: postEntry, postTransfer, postShift, Confirm.tsx, duplicate detection, parseAmount
READ: addFormDefaults, centsDigitsFromDollars, dollarsFromCentsDigits, padToDollars
WRITE: postEntry / postTransfer / postShift via the EXISTING path + existing Confirm
TESTS: 1-2-5-0 → $12.50 from the desk pad AND from the sheet (same helper, both mounts);
       mouse-wheel on the desk pad is blocked (D-050);
       "More" escalates to the sheet with the pad's state intact;
       duplicate confirm still fires from the desk pad;
       a transfer opened from the wallet is still type=transfer after escalation
ACCEPTANCE: post a $12.50 grocery from the desk in under ten seconds; pnpm test green.

SLICE 4: Hercules furniture physics
USER-VISIBLE: Hercules sits on things, bumps into things, and pounces on the envelope you have been ignoring.
BUDGET DELTA (5): +1 — his attacks point at real overdue rows.
ENGAGEMENT DELTA (3): +3
IF THEY CONFLICT, CUT: bump and attack. Ship perch alone — perch is 80% of the feeling.
RISK: Medium
TOUCH: src/Hercules.tsx (replace safePerch), src/core/officeLayout.ts,
       src/widgets/useFurniture.ts (new), src/core/herculesTalk.ts (pose union)
DO NOT TOUCH: talkHercules / askHercules answering, recordHerculesTalk, kitchen.hercules merge,
              the Worker chat path, any command
READ: the furniture registry, describeCompanion, shiftPostingStreak, runHealthCheck, buildDashboard().upcoming
WRITE: none
TESTS: perchTarget always returns a point inside the viewport;
       perchTarget never intersects the Post button rect (property test, 1000 random layouts);
       attackTarget returns null when no furniture has warn === true;
       adding === true forces the corner loaf and pointer-events none;
       an instrument unmounting while perched re-perches instead of leaving a floating cat
ACCEPTANCE: leave the app idle 60s — the cat lands on a real object every time, never mid-air.

SLICE 5: Layout persistence + rings
USER-VISIBLE: Your desk stays how you left it on this phone, and moved things leave a faint ring.
BUDGET DELTA (5): 0
ENGAGEMENT DELTA (3): +2
IF THEY CONFLICT, CUT: rings.
RISK: Low
TOUCH: src/core/officeLayout.ts, src/widgets/*
DO NOT TOUCH: the household snapshot, core/sync.ts, api.ts, anything that merges
READ: —
WRITE: localStorage only — hearth.office.<environment>.<breakpoint>
TESTS: layout persists across reload; development and production layouts are independent;
       phone and wide layouts are independent;
       NOTHING layout-related appears in splitForSync output (assert on the envelope keys)
ACCEPTANCE: rearrange, reload, unchanged; switch environment, layouts differ.
```

**Slice ordering note for Grok:** slices 1 and 2 are safely parallel with anything. **Slice 3 is the one to review hardest** — it moves the pad next to the money path. Slice 5's last test is the guard that keeps layout out of the snapshot; do not drop it.

---

## G. Handoff footer

**Status:** Design complete for September. Sections A–F are specified to build level. No code was changed; the repo was read at `fe3a1e9` and `git status` is clean.

**What I examined:** `src/App.tsx` (Home + Add branches), `src/Hercules.tsx` (`safePerch`, motion effects, `CAT`/`NAV` constants), `src/styles.css` (tokens, the full z-index map, `--nav`, the 520px breakpoint), `src/core/insights.ts` (`Dashboard`), `src/core/accounts.ts` (`HouseholdWallet`, `creditCardView`), `src/core/statements.ts` (`AuditOpinion`), `src/core/hercules.ts` (`kettlePhase`, `cookOffScore`, `sitDownPostcard`), `src/core/shiftStreak.ts`, `src/core/companion.ts` (`CompanionMood`), `src/core/calendar.ts` (`hourInToronto`, `kitchenSeason`), `src/core/herculesTalk.ts` (`HerculesPose`), `src/core/health.ts`, `docs/OFFICE.md`, `docs/CLAUDE_OFFICE_UX.md`, `AGENTS.md`.

**Verified vs assumed:**

- *Verified in code:* every projection name and field cited above; the z-index map (`.sheet` 20, `.hercules-live` 28, `.hercules-bubble` 29, `.toast` 30, `.sheet.guard`/`.cmdk` 40); that `.nav` is `position:fixed` with **no** z-index (hence the explicit `15`); `CAT = 96`, `NAV = 76`; that `safePerch` is random and FAB-avoidant; that `src/core/` imports no React; the existing `:root` token set.
- *Assumed, flag if wrong:* that Open-Meteo is reachable from the Cloudflare Worker's CSP and the phone (no key required, but **check the site's connect-src** — if a CSP blocks it, the fallback path is already specified and nothing breaks); that `DailyHearth`'s `onBuyNote` is the only chalk→Add path; that `applySitDown` is safe to call from a widget-hosted guide as long as the three steps are preserved.

**Open questions for Jonathan — money or privacy only:**

1. **Jars is gated on a real bug.** Concurrent goal contributions from two phones silently lose money today — I reproduced it: Jonathan +$300 and Bianca +$200 on the same goal resolves to **$300**. Root cause is in `core/sync.ts` (`Goal` has no `updatedAt`, so `mergeRecords` degrades to "client wins"), not in anything this spec adds. **Putting a Contribute button on the desk makes that bug easier to hit, not harder.** Ship B10 read-only (jars fill, no Contribute) until it is fixed, or fix it first. Your call — it is the only item here that touches money meaning.
2. **The window is the app's first outbound request to a third party.** Open-Meteo needs no key and receives only a fixed Toronto lat/long — no household data, no identifiers. I judged that acceptable and specified it, but it is the first non-Google, non-Supabase host the phone will talk to, so you should know it is there rather than discover it in a network tab.

Everything else in this spec is Course B chrome over existing projections and needs no decision from you.

**Recommended next slice for Cursor Grok:** **Slice 1**. It is the container, it changes no money meaning, and slices 2–5 are unblocked by it. Have Grok open the PR with the four fallback tests from Slice 1's TESTS block, because the weather fallback is the one piece of Slice 1 that can fail silently in production.

---

## Implementation status (this checkout)

Home **is** the office. Slices 1–5 are in the tree: window + rail/canvas, twelve instruments, desk calculator posting through the existing command path, furniture perch, this-phone layout keys.

**Gated:** Jars on the desk still have no Contribute button. D-052 is on this branch (Plan Contribute is append-only). Desk Contribute can follow after the ten-second milk pass.

**Not this slice:** Auth + RLS, bank ticker, rain audio, widget store, layout in the shared snapshot.
