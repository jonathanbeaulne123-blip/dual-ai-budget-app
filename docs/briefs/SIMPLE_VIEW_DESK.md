# The Simple View Desk — build brief (approved 2026-09-24)

Jonathan approved the full plan ("I want all of it in the app") in the roadmap chat, 2026-09-24.
Plan of record: project doc `claude/simple-view-desk-plan-2026-09-24.md` / artifact "The Harbourmaster's Desk".
Base: `main@87f6027` (#531). Branch: `claude/simple-view-desk`.

## The concept

The simple view ("the Desk", in-world the Harbourmaster's Desk) is the whole 2D world. The
existing Illustrated / Reading-edition mechanism (`hearth:motion` localStorage key + event,
see `src/harbour/nav/QuickSheet.tsx` `MOTION_KEY`) becomes **the flip between the two worlds**.
The 3D harbour is the place; the Desk is the numbers. Door-sign parity: the Desk's chip
subtitles reuse the door-sign sentences (`src/harbour/nav/doorSigns.ts`).

Three ways to flip:
1. The edition switch at the bottom of the All-tools pop-up (kept as today).
2. The **`` ` `` (backtick) key** — never Tab (Tab is focus navigation; capturing it breaks
   keyboard/screen-reader roving). Ignored while an input/textarea/contenteditable has focus.
3. A **flip button at the LEFT END of the quick-travel bar** (Jonathan circled the spot), and
   the same button flipped in the Desk header to go back.

## One bar, two worlds (S1)

The Compass district row (Home · Study · Kitchen · Making · Together + big All-tools handle)
**retires from the 3D world**. `src/harbour/village/VillageHUD.tsx` becomes the one bar:

`[Simple-view flip] [⌖ Village map] [Quick travel…] [↗ Look around] [◇ Journey] [+ money verbs] [All tools]`

- The + keeps the existing `FabSpeedDial` verbs (Record / Add income / Move money / Add shift)
  as its own button so adding stays 2 presses.
- All tools opens the existing quick sheet (space switch, Status, every tool/place, edition switch).
- Phone: 44px targets; the quick-travel `<select>` compresses to an icon button; verify 320px.
- District travel survives via Quick travel, the Village map, and All tools.

## The Desk (S2–S5)

`src/harbour/desk/` — flat React + CSS, **no WebGL anywhere**. Page chips across the top
(roving tablist like FundBoard), swipe or press; a **drawer** holds the full quick-sheet
content. Pages register in `src/harbour/desk/pages.ts`.

1. **Today** — Everyday "Now" leads big (`fundSnapshot(h,{memberId,view,today}).now` — approved
   money call, matches the Queen's big-number rule), Prepare/Protect/Build beneath; the three
   wax seals (`deskMonthSeals` from `src/core/officeWide.ts`: Money in / Money out / Leftover);
   the Level small (reuse `src/Level.tsx` or a compact drawing from `fundWalk`), tap expands;
   the sundial (next dated commitment — harvest the idea from `src/harbour/flat/CourtFlat.tsx`);
   Hercules corner (top card from `core/herculesDiscovery.ts` `discoveryCandidates` + a Talk
   button opening the existing Hercules panel).
2. **Leaving** — next-out table + spoken-for bar (`core/nextOut.ts`, `spokenFor`; reuse
   `src/NextOutStage.tsx` where sensible); the calendar-weight rail (`core/calendarWeight.ts`,
   ink=posted / copper=scheduled); cellar bill-jar states (planned / set aside / paid / short /
   missing — same data the CellarFlat reads); doors: Read the bill jars (3D), Unfold the Calendar.
3. **Accounts** — `accountRows` (`core/accountsWidget.ts`) tiles: balance, card utilization,
   glance pick; tap an account → recent register rows (`accountActivity`); door to the Wallet
   pane. **Money note:** use the existing `accountsWidget` figures unchanged — the known
   accountsWidget vs booksPresentationFloor divergence is an OPEN ruling for Jonathan; do not
   resolve it here.
4. **Calendar** — this-week strip (`core/fundWeek.ts`) + mini month grid with heat tint and
   kind glyphs (`src/calendar/semantics.ts` KIND_REGISTRY); one tap opens the full Calendar
   surface. Light version — do not embed the full calendar.
5. **Books** — the Books divisions as live rows: Today waterline (operating, reserved, free to
   spend, last reconciliation — `projectHouseholdFund`/`fundLensToday`), Spending shape
   (`core/categoryShape.ts` small multiples), Goals, Contributions, Record; each row opens its
   Books pane via `openHouseObject("books")`-style navigation with the pane deep link.
- **Drawer** — the quick-sheet content, kept whole.
- **Personal scope (S5)** — same shell, personal instruments: `personalPlates`
  (`core/officeLayout.ts`/`core/plates.ts`: clock, tips, pay, wallet, mine-saving, month),
  "Personal income this month" seal, personal calendar/books rows. Space switch in the Desk
  header. Personal currently has no harbour — the Desk mounts for personal view from App.tsx.

## One flat world (S6)

Flat tier (`src/harbour/scene/quality.ts`: no WebGL / Save-Data / `hearth:motion=flat`) lands
on the Desk. The flat door-directory editions (`VillageFlat` and per-place flats) retire into
the Desk's drawer as place links; keep DoorSign. Delete the dead `CourtFlat` branch after
harvesting the sundial / mailbox notice / "since you were here" slip onto Today. Keep the
source-fence tests satisfied (update `test/harbour-source-fences.test.ts` intentionally).
The Suspense/loading frame stays a lightweight flat frame.

## Look (S7 + throughout)

Cut-paper ledger language in CSS: layered paper cards, stacked shadows, raking light, ink +
copper (the calendar-weight palette), embossed wax seals, the Level as an inked line on graph
paper. Build on theme tokens from day one so Classic / Taylor / Newfoundland all function;
S7 authors the three distinct dressings (Classic ledger · Taylor scrapbook page · Newfoundland
fisherman's log). Little things: the flip button wears the Everyday figure at rest; the flip
is a page-turn (plain cut under `prefers-reduced-motion`); the Leftover seal's wax cracks when
the month goes negative; a pawprint on the All-tools handle when Hercules has a fresh
suggestion; Today's corner dog-ears when the month's Sitdown is waiting.

## Hard rules (non-negotiable)

- **No changes under `src/core/`** except where a slice explicitly says so (none do). The Desk
  reads selectors; it never posts money. All posting goes through existing flows (FAB, Swipe).
- Unknown amounts render the engraved "—", never "$0" (`engravedCents` pattern).
- Flat mode never gates a money task.
- No new env flags ("no more flags", 2026-09-21). Everything ships inside the existing
  `VITE_HEARTH_HARBOUR` + house-world gates.
- 44px targets, keyboard roving on tablists, visible focus, `prefers-reduced-motion` honoured.
- Currency is CAD integer cents; civil dates America/Toronto.
- Fictional Development/demo data only in tests and evidence.

## Open rulings for Jonathan (do not resolve in code)

- The Visa divergence: accountsWidget ($4,716.80) vs Books presentation floor ($4,646.30).
  The Desk shows the existing accountsWidget figure, unchanged.
- The label on the flip button ships as "Simple view" (his term); rename is one string.
