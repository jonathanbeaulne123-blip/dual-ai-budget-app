# HANDOFF — Tool Atlas, Wave 2b (branch `claude/tool-atlas`)

Checkout `/home/claude/jonathanbeaulne123-blip/dual-ai-budget-app`. Baseline `main@4e0234a3`; integration head `21f4a7ae`; Wave 2b is `253ed57e..096a8a4d` (27 local commits, nothing pushed, merged or deployed). Risk **High** (App routes, the Add flow, Bill paid, the Fund bank's figures, the privacy boundary of Mine). No new command, no schema, sync, RLS or hosted change. Every write still goes through an existing captured command after its Final Confirm. `docs/DECISIONS.md` has **D-302** (the one Tool Atlas entry, with the Codex trust-review items).

## Part 1 — what the integrator left unwired

| # | What | Where |
|---|---|---|
| 1 | "Mark paid" on the Cellar panel opens Bill paid **preselected**. A due bill lands on its named Confirm; a bill not due yet stays on the slips, where it is listed but not offered. The camp card's Leaving line now opens the Cellar panel, and its Everyday line opens the bank panel (brief §4.1). The panel keeps overdue bills, because the App's list is already the unpaid ones. | `AddSlideshow` prop `billRecurrenceId`; App `billPreselect`, `openBillPaid(recurrenceId?)`, `markPaidFromPanel`; `panelModel.cellarPanel` |
| 2 | The Fund bank panel shows the accepted balance, its as-of date and the last three moves from `buildBasinReading` (MountainPanel's glass-dam source), always read from the **shared** household. In Mine it reads "the shared Fund · Everyday · now" and leads with the shared Everyday figure. The Library panel shows in / out / leftover from the Desk's `readSeals`, in the space on screen. | `panelModel.fundExtrasFromBasin` (with `BasinFlow.date?` added), `PanelExtras.space`, App `panelExtras` |
| 3 | `frameOverBudget` and `cameraMoving` come from the runtime through a new edge-triggered `HarbourCallbacks.onGlass`. `frameOverBudget` is a pure `createFrameBudgetWatch` (60 fps full / 30 fps lite, ×1.5 slack, a whole second of misses, latched until the next place change). **`night` is the device clock, 20:00–06:00, or a dark scene lighting**, because nothing in the harbour steps a sun (`quality.ts` is tiering only). All three reach `VillageHUD` and the dock. The dock's `lite` includes a missed budget, and its blur is skipped while the camera moves (restored 120 ms after). | `scene/framePolicy.ts`, `scene/runtime.ts`, `bubbles/glassMode.ts` `useGlassNight`, `glass/Dock.tsx`, `glass.css`, `HarbourWorld.tsx` |
| 4 | Hercules wears the pawprint: his twin's name gains ", Hercules has a suggestion" and a decorative paw (three dressings, forced colours). His compact panel says "He has a suggestion for you." | `court/CourtTwins.tsx` (`badges`, `Pawprint`), `harbour.css`, `panels/HostPanel.tsx` |
| 5 | A11: the usage counter was already in `Bubble`. New here is the Comfort setting **"Always show labels"** (`Comfort.labels`, per device, `data-labels` on root). It reaches the island glass, the flat bar and the door-edition Compass. More contrast, text ≥ 125 % and calm view already override the counter in `labelAtRest`. | `theme/comfort.ts`, `theme/ComfortControls.tsx`, HarbourWorld / HarbourEntry / App |
| 6 | A30. CadPad's Enter is `aria-disabled`, not `disabled`. Pressed on an amount that is not above zero (or does not read), it shows "Enter an amount above $0.00.", sets `aria-invalid` with a linked message, and moves focus to the field (or to the display, in keypad mode). The full form's amount input does the same. After a named Confirm, an error raises `role="alert"` with **Retry**, which runs the same Confirm; the App's draft is untouched. An error before any post stays a polite status. | `CadPad.tsx`, `cashpad-ux.css`, `KitchenNotice.tsx` (`onRetry`), `AddSlideshow.tsx` |

## Part 2 — K rows

- **K1 — done.**
  - The Fund ledge mount and its state are gone from App. `FundLedge.tsx`, `fund-ledge.css`, `core/fundLedge.ts` and `fund-ledge.test.ts` are deleted.
  - The bank panel's door opens **the Fund**: Books' Fund pane, `HouseholdFundPanel`, which holds Needs you (contributions) and To settle (settlements). That pane now draws **The Level** (`DeskLevel`) at its head and says "The Fund". The full card already had it.
  - **The Ask**'s door opens the Glasshouse steps (planner).
  - The atlas finds "the level", "to settle", "needs you" and "fund pocket".
  - *Not removed:* `FundStage`, `FundDrawer` and `FundBoard`, because `OfficeWide` still imports them and the Office is out of scope. Some `.fund-ledge*` CSS rules in other stylesheets, and three `scripts/check-*.mjs` browser scripts, still name the ledge. They are dead, not run.
- **K2 — done.**
  - No `TimeMachine` mount. A stray `timeMachine` route lands in the books at its month.
  - Books loses "See any month" and takes a `month:<YYYY-MM>` request: the Fund register in Ours, statements in Mine.
  - The Journey's month cards say "Open the books for {month}".
  - The Library station is "the month desk" and still opens the Standing Book.
  - The Desk Calendar gets the Calendar's own month controls ("Previous month", "Next month", "This month") over `readMonth(…, monthKey)`.
  - The `TimeMachine` module and its tests stay until it is physically removed. `scripts/check-feedback-four.mjs` still clicks "See any month" (browser script, not run).
- **K5 — done (removed, not buried).**
  - Removed from the house targets, the Hearthside rooms' "Discover a season together" and the Boathouse rowboat. The rowboat now opens memories, and the pulse's "together" destination is wishes.
  - `EncounterEntry` and `encounterSharedClient` are marked `@deprecated`. An old `surface=encounters` deep link still opens them.
  - **Not listed in All tools:** a Buried row would re-host it in the Boathouse group, so it is not "trivially possible".
- **K6 — done.**
  - `MountainPanel` is Step in's panel: rides, the race, the tour and small moments. It has no trigger of its own, no Places tab (All tools › Places) and no glass-dam tab (the card and the bank panel).
  - Twins that asked for the map open the rides. The dam's basin twin opens the Fund.
  - "Town square" is "The square" on the stations, the map and the regenerated `generated/map.json` (terrain unchanged).
- **K7 — verified.** The `<select>` and the palette were already gone. The last rendered "Quick travel" (the blocked-path phrase) now points at All tools › Places.
- **K8 — done (Swipe and Till kept).**
  - Purchase remembers the account of the last accepted purchase, per viewer and per space (`hearth:add:lastPurchaseAccount:<env>:<household>:<member>:<view>`), as the launch account, changeable on the account slide.
  - **Swipe and Till are not dead.** The `#till` hash (the Desk landing surface "till" is synced member data), the classic home's Till door and FundStage's "swipe" destination still reach them. So the `till` tab and `submitSwipePurchase` stay.
- **K9 — done.**
  - `TARGET_NAMES.queen` is "The Fund bank", and the home door reads "Open the Fund bank".
  - The door signs and the Queen's twin say what they open.
  - In Mine the Queen's dressing screen is gone. Status › Appearance and comfort carries `QueenDressing variant="settings"`, which saves her look.
- **K10 — done.**
  - In the Hearthside common room, "Sit together" becomes "Our steps" (the planner) and "Look ahead at the Campfire" (the ritual at `look-ahead`). "Care for our everyday life" opens the steps. App's `boards` destination opens the steps. No new command.
  - The board stays reachable only where a **rejected board draft** is reviewed, so retained data is never stranded.
- **K11 — done.**
  - Opening Hercules lands on his own surface, not the conversation folio.
  - The folio opens from the kitchen table (its anchor and door) and from the Kitchen panel's new "Open our folio".
- **K12 — done.**
  - A bare `pottery` opens the Loft at a bank's **studio** page: `bankRoomRequest` (`src/house/bankRoom.ts`) passes `initialStudio` through `KittyBanks` (Mine), `HouseholdHome` (Ours) and `KittyBankRoom`.
  - The Kiln's stations (wheel, paint, kiln, a piece) still open the Kiln, whose name is now "The Kiln".
- **K13 — done, except 7 files with reasons.**
  - Renames:
    - Paper trail (Books, Desk, bindery, interior).
    - The square.
    - The Atlas and the Journey map.
    - Glasshouse · steps and "Open the steps".
    - The kitchen table.
    - The Fund (as a label).
    - Leaving and Leaving next.
    - Mark paid, and "Mark … paid from the cellar's water".
    - The Boathouse: `HEARTHSIDE_LABEL` defaults to it, and the returns, streets, shell and worktable use it.
    - "Both of us" for joint responsibility.
    - Everyday · now in place of "What now".
    - "Play with him".
  - "Village square" joins `RETIRED_WORDS`. "Add money" is gone from rendered copy. "Household Fund" inside sentences in core copy is kept, because the brief retires it as a label only.
  - The atlas fence ratchet shrinks **from 33 files to 7** (the integrator had already taken it from 40 to 33).
- **K14 — verified.**
  - The Desk has one flip: the header's own flip is hidden while the glass flip stands.
  - Calendar and Books appear once, as chips. The bar is Island / Record / All tools.
- **K15 — done.**
  - The gun's trigger, bill sizes, round, Send and its Confirm are gone. The jug is the one control: custodian only, capped at the safe surplus, with its button and its one Confirm named "Move $X to Kitty Banks", still `pour.onPour` → `allocateHouseholdFundSurplus`.
  - The Tower landing's peg is empty (`gun.available: false`). `core/queenGun.ts` stays for its pure tests.
- **Dead files:** `desk/DeskPersonalToday.tsx` is deleted (no importer). `nav/atlasFallback.ts` had already been deleted by the integration. Appendix A's other dead code is not in my K rows and is left alone.

## Fence allow-list remaining (`test/atlas-vocabulary-fence.test.ts`, each with its reason in the file)

| File | Words | Why it stays |
|---|---|---|
| `src/App.tsx` | Together, Our Path | Legacy tab bar and house-rooms nav (harbour off), plus the classic "Back to Together" chip. Appendix A chrome, out of scope; `five-boards-entry-app` pins the bar. |
| `src/HouseholdHome.tsx` | Together | Legacy panels composition. With presentation on, it already shows `HEARTHSIDE_LABEL`. |
| `src/queen/QueenHome.tsx` | Together | Legacy Queen's-world Home. Its door is the practical board (K10), not the Boathouse, so a rename would mislabel it. |
| `src/DuplicatePrise.tsx` | Together | Not a tab: the slider's end label. |
| `src/plan-v3/{CheckIn,PlanStudioV3,RestScreen}.tsx` | check-in | Plan Studio v3 is flag-off (Appendix A). K3 retires it with the module. |

## Tests

**New:**
- `wave2b-glass-wiring` (8)
- `wave2b-retirements` (13)
- `atlas-add-flow` (+4: preselect, A30 ×3)
- `glass-panels` (+2)

**Updated for the new behaviour** (each edit names its K row):
- `ledger-story-ui`, `household-fund-ui`, `fund-standing-book(-dom)`, `phone-spread`, `mobile-appearance`
- `navigation-one-route`, `our-path-world-ui`, `path-eras-ui`
- `house-targets`, `harbour-reading`, `harbour-rooms`, `desk-mountain-integration`, `harbour-walk-focus`
- `harbour-door-signs`, `harbour-glasshouse(-mine)`, `harbour-bindery`, `authored-interiors`
- `queen-cellar-ui`, `queen-loft-rack-ui`, `queen-loft-gun-ui`, `queens-nest-ui`
- `journey-mini-ui`, `hercules-private-chat-ui`, `hearthside-journeys`, `hearthside-bank-journey-ui`, `house-shell-ui`
- `vision-v2-chapters`, `vision-v2-home-ui`, `add-slideshow-ui`, `swipe`, `five-boards-entry-app`

**Browser and layout scripts:** strings updated, but not run.

**Results:**
- **`pnpm typecheck`: exit 0**, on the final tree.
- **The integrator's suites** (82 files: `harbour-*`, `desk-*`, `glass-*`, `campfire-*`, `mine-*`, `atlas-*`, `tool-atlas`, `terms`, `copy-budget`, `fab*`, `swipe*` and the handoff lists): **1069 passed, 27 failed**. These are exactly the integrator's 27 pre-existing failures (reduced-motion 12, open-world 3, skate-model 2, skate-presence 1, hercules 2, desk-plates 2, copy-budget 2, kitchen 1, ledger-story-ui 1, five-boards quick samples 1).
- **The Bianca regression** (`app-startup-p1` and `month-rehearsal-mainline`): **84 / 84**.
- **A wider sweep** of 121 suites: **1071 passed, 21 failed**. All 21 also fail at `../wt-baseline` (`4e0234a3`):
  - the integrator's 15;
  - `village-architecture` 1, `fund-rail` 1, `phone-spread` 2, `hearth-mountain-channel` 1 and `house-return-cache` 1, each checked there.
- No new failures.

## Could not / did not

- No browser, screen-reader or 320 / 390 / 720 / 1100 px pass in the three dressings. This covers the pawprint badge, the Desk month picker, the invalid-amount outline, the Fund's Level in Books and the Kitchen panel's second door.
- The CSS for the badge, picker and panel paw is authored for all three dressings plus forced colours, but it has not been seen.
- The frame-budget thresholds and the night clock are conservative choices and have not been measured on a device.
- K3's command-level "both present" guard is still owed if the lock must be hard. It is recorded in D-302's review items.

Budget delta (5): +2. Mark paid reaches the named Confirm in 3 taps from the card; the Fund bank shows the real accepted balance; an invalid amount and a failed post say so and keep the draft; the gun's second money path is gone.
Engagement delta (3): +1. One vocabulary, the pawprint on Hercules, and fewer doors that lead to the same place.
Next owner: Codex trust review (D-302's four items), then a browser pass and the live A14 check.
