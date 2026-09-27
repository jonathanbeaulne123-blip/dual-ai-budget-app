# HANDOFF — Tool Atlas, Wave 2 integration (branch `claude/tool-atlas`)

Checkout `/home/claude/jonathanbeaulne123-blip/dual-ai-budget-app`, baseline `main@4e0234a3` (#545). Local commits only: nothing pushed, merged to `main` or deployed. Risk: **High** (App routes, Add/Record, the month close's door, the privacy boundary of Mine on the shared map). No money meaning changed, no new command, no schema/sync/hosted change. `docs/DECISIONS.md` not touched (the D1–D3 entry is still owed).

Commits on top of the three earlier track merges:

| Commit | What |
|---|---|
| `e34b6c72` | Merge track glass (B2). Test conflicts resolved keeping both intents. |
| `57e460a3` | Merge track mine (C). The harbour directory allow-list is the union. |
| `68792c8d` | Wire the tracks into App (and the harbour seams). |
| `158ff508` | Align the affected suites with the integration. |
| `379d08d6` | Set `--dock-height` / `--dock-width`. |
| `21f4a7ae` | The Campfire host panel's needs-you count. |

## Step 1: merges

- **`test/glass-vocabulary-fence.test.ts`** (add/add, dock vs glass). Both fences now live in one file: the glass's rendered-copy fence first, then the dock's AST fence. The dock's identifiers are renamed (`dockFiles`, `DOCK_RETIRED`, `dockCopyOf`, `repo`) so they do not collide with the glass fence's names.
- **`test/harbour-source-fences.test.ts`**. The harbour directory list is the union of what the tracks added: `bubbles`, `panels`, `glass` and `mine`.
- **`test/harbour-compass-ui.test.ts`** and **`test/harbour-one-bar.test.ts`**. These take the glass bubbles (`[data-glass-bubble]` order, "Record", "All tools and search") together with track A's `.record-dial__label` verb assertions. Bill paid appears only when `onBillPaid` is passed.

## Step 2: what is wired, and where

### App.tsx

| Line | What |
|---|---|
| 815–834 | New state: `billFlow`, `pendingRecord`, `recordStatus`, `hostPanel`, `campfire`, `weeklySitdownOpen`, `stripMonth`, `campCardOpen`. `closeAdd` clears `billFlow`. |
| 944, 2406 | The Ctrl/Cmd+K palette state, effect and render are gone. `useAtlasSearchKeys(HARBOUR_ENABLED, …)` is called once. `commandOpen` is now an alias of `quickSheetOpen`, so everything that stepped aside for the palette steps aside for the sheet. Export is still in Status (`App.tsx` "Export Shared books"). |
| 1538–1549 | The D1 pending-record effect. It is declared after the add-scope effect, so the space switch's `closeAdd` runs first and then the flow opens in the new space. |
| 3653–3676 | The dock read. `stripLedger` is built per space from `personalSource` (Mine) or `household` (Ours). The card always reads this month. `since` comes from a per-viewer localStorage key `hearth:dock:lastSeen:<env>:<household>:<member>`, read before it is rewritten. It is gated on `HARBOUR_ENABLED` and wrapped in try/catch, so a read-model throw hides the dock rather than breaking the App. |
| 6352–6380 | `openRecordFlow`, `openBillPaid`, `postBillPaid` and `onAddPost`. `postBillPaid` re-reads `dueOccurrenceReview` and compares the basis before calling `postOneRecurrence(…,{createdBy,dueReview})`, the same body as the due sheet. `submit()` sets the A24 status only in its `onAccepted`. |
| 6634 | `openHouseObject("campfire-ritual" \| "campfire")` opens the ritual. From Mine it switches to Ours first. |
| 7125 | `memberHasJob` (see Deviations). |
| 7133–7176 | `openAtlasTarget` (`books:<pane>`, `tab:`, `settings[:x]`, `accounts`/`activity`/`import`/`audit`, `leaving`, `sitdown`, `shift`, else `openHouseObject`), `openPlacePanel` (the panel, plus a walk via `HARBOUR_GO_EVENT` unless the place was reached by keyboard), `atlasHouseholdWords`, `panelExtras` and `markPaidFromPanel`. |
| 7177 | `harbourBarFab`: `fabActionsFor(view,{memberHasJob})`, `onPick`→`openRecordFlow`, `onBillPaid`, `closed:adding`. `onGo` is dropped. |
| 7179–7206 | `harbourDock`, the strip and card callbacks. The flagstone opens the weekly Sitdown. The card's Shift goes to `openRecordFlow("shift")`. `onSpaceChange` goes to `changeHouseView`. |
| 7207–7221 | `sharedHerculesReply`, extracted from PlanStudio and shared with WeeklySitdown. |
| 7412 | The harbour mount (both spaces): see the list after this table. |
| 7713, PlanStudio, 7699, 7926 | `ChapterRoom onOpenCampfire`; `PlanStudio onOpenCampfire` (Ours) plus the shared reply; the kitchen table's "Open our shared Sitdown" opens `WeeklySitdown`; Books gets `campfireDoor={…setCampfire({beat:"settle"})}`. `closeTheMonth` is deleted from `BooksTabProps`. |
| 8553–8557, 8641 | AddSlideshow: `mode={billFlow?"bill":mode}`, `view`, `ledger={view}`, `memberId`, `onLedgerChange` (reopens the flow in the chosen ledger and carries the amount), `onPost={onAddPost}`. |
| 9353–9360 | `HARBOUR_ENABLED?` (not `&&view==="household"`): the same Compass and the one QuickSheet in both spaces, with every prop HANDOFF-glass lists. The personal `EditionFlip`, `data-edition-nav` and the personal QuickSheet with `onGo` are gone. |
| 9409–9416 | The classic `FabSpeedDial` (harbour flag off) gets the same verbs and wiring. |
| 9451–9463 | `CampfireRitual` / `WeeklySitdown` (lazy, Ours only) and the `role="status"` Record line. |

The harbour mount at line 7412 is set up as follows:

- `key` drops `:${view}`.
- `household={view==="personal"?(personalSource??household):household}`, with `scope={view}` and `space={spaceForView(view)}`.
- `onOpenMine` is set.
- `dock`, `toolsOpen` and `panel` are set.
- `onOpen` in Mine goes to `openAtlasTarget`, so Shifts still opens as a page.
- The `personalFlat` DeskShell branch is deleted. The final `HouseWorld` renders only for `!HARBOUR_ENABLED||view==="household"`.
- `personalFlat`, `personalDesk`, `motionEdition`, `openPersonalDeskDoor`, the `DeskShell` lazy import and the `PersonalJourney` import and mount (with its plan-tab exclusion) are all removed.

### Harbour and other files

- **`src/harbour/HarbourWorld.tsx`**
  - New props: `dock` (:133), `toolsOpen`, `panel` and `HarbourPanel` (:142).
  - `glassDock` (:1175) is the `Dock` with `calm = mountainCalm||comfort.quiet` and `lite = tier==="lite"`. Step in opens the world's guide.
  - `VillageHUD` (:1184) gets `memberId`, `theme`, `calm`, `lite`, `toolsOpen` and `glassBetween`.
  - `HostPanel` (:1186) sits after the HUD with the reading. `onVisit` and `onStepIn` walk to the host.
- **`src/harbour/HarbourEntry.tsx:57`**: the reading edition (flat Desk) also mounts `HostPanel`, and its GlassBar gets `toolsOpen`.
- **`src/harbour/scene/runtime.ts:1476, :1546`**: the orbit controller's `pointerdown` returns when the pointer is inside `[data-camera-deadzone]` or within its margin (`inCameraDeadzone`). The wheel does the same.
- **`src/harbour/bubbles/GlassChrome.tsx:35, :174`** and **`nav/Compass.tsx:37`**: `onBillPaid`, `closed` and `onOpenChange` pass through `RecordBubble`. `CompassFab.onGo` is now optional and deprecated, because its type had become `never`.
- **`src/harbour/nav/sheetAtlas.ts`** (new) replaces **`atlasFallback.ts`** (deleted). QuickSheet and `atlasSearch.ts` import it, and the sheet dispatches `target === "edition"` (`QuickSheet.tsx:246`).
- **`src/house/navigation.ts:103`**: `TARGET_NAMES` gains `fund` and `personal-experience`, so every `AtlasHouseTarget` resolves.
- **`src/tabs/BooksTab.tsx`**: `closeTheMonth` is removed.
- **`src/harbour/glass/glass.css:276`**: `:root:has(.glass-dock)` sets `--dock-height` to 216px on the phone and 220px on desktop, and `--dock-width` to 300px on a landscape phone.

## Deviations from the five handoffs

1. **The atlas swap is an adapter, not an import.** `atlasFallback.ts` did not have the same shape as `toolAtlas.ts`: its groups contain tools with string targets, while core has flat rows with structured targets. `sheetAtlas.ts` derives the sheet's groups from `TOOL_ATLAS` and `TOOL_GROUPS`, and `FAB_VERBS` supplies the chips. The sheet keeps its own ranking (`atlasSearch.ts`) and its A3 test still passes over core data. Core's `searchAtlas` and `householdAtlasNames` are therefore unused by the sheet.
   The group ids are now core's: `bills-dates`, `kitty-banks`, and so on. Rows that core does not have are gone from the sheet: Pottery, Our folio, Appearance and Hercules Pro. Core puts the Fund bank in **both** spaces, whereas the glass fallback had it in Ours only.
2. **Shift on the dial.** It hides only when the household has active jobs and this member has neither a job nor an open punch. HANDOFF-atlas used plain `memberHasJob`, which failed the Bianca regression, because `auditMount` opens Shift with `workJobs=[]`, and the Punch test opens it with a punch but no job.
3. **D1 is enforced by switching the space, not by posting across.** A flow never opens in a ledger other than the one on screen:
   - When a verb's default ledger differs from the space, Mine or Ours switches first and the flow opens there.
   - Changing the ledger on the first slide does the same and carries the typed amount. It is a reopen, so the rest of the form in the old space stays in that space's saved draft.
   - `onPost` refuses a payload ledger that is not the open view, with a notice.
   - `ledger={view}` is always passed, so the slide never shows a ledger the App is not in.
4. **Mark paid opens Bill paid at its first slide.** AddSlideshow has no preselect prop, so the person picks the bill again. Posting still goes only through the named Confirm.
5. **Not wired, because there is no signal yet:**
   - VillageHUD's `frameOverBudget`, `cameraMoving` and `night`. The Dock uses the `:root[data-scene-lighting]` CSS for night.
   - Panel `extras.fund` and `extras.books`, so the bank panel reads "—" for the accepted balance.
   - `useHerculesSuggestion()` on the Hercules figure (HANDOFF-glass #8).
   - The Mine Fund-bank panel title "the shared Fund" (HANDOFF-mine #7).
   - A11's label pill, A30 Retry, and Settings section scrolling: `onSettings` just opens Status.
6. **Fence exemption: `campfire/ritual/` may import `core/index.ts`.** Track D's `beats.tsx` and `WeeklySitdown.tsx` compose `closeBooksMonth`, `acknowledgeHouseholdPlan` and `appendPlanSitdownTurn`, and hand them to `runKitchen`. The exemption lives in `test/harbour-source-fences.test.ts`. The alternative, moving the ritual out of `src/harbour`, is a structural change. **Codex trust review requested.**
7. **Personal Journey.** App no longer imports or mounts it; the module is not deleted (Wave 2b). A personal `journey` route now renders the personal Plan page with no world backdrop, when the harbour flag is on.
8. **Ctrl/Cmd+K is harbour-only.** With the flag off there is no QuickSheet, so there is no palette at all.
9. **Test edits outside the handoffs' lists:**
   - `harbour-walk-focus` now targets `.harbour-world__phrase[role=status]`, because the Mine ribbon's always-mounted empty status region comes first.
   - `terms`: I reworded "up the kitchen stair" to "up the Kitchen stair" in `QuickSheet.tsx`. `terms` is now green; it was red at baseline.
   - The `atlas-vocabulary-fence` ratchet drops the 11 rows the tracks cleaned.
   - `mine-layer-ui` now checks that PersonalJourney has no importer.
   - `desk-personal` and `desk-personal-app`: Mine is the harbour's flat tier, and the backtick is refused while the island cannot be drawn, as in Ours.
   - `five-boards-entry-app` gains a five-verbs test.
   - `ledger-story-ui` and `harbour-one-bar` pin `openRecordFlow`.

## D1 / D2 / D3 as implemented

- **D1.** Purchase, Income, Bill paid and Move money default to the space on screen. Shift defaults to Mine: from Ours, the space switches to Mine and Shift opens there. The first slide names the ledger ("Into: Ours / Mine"); changing it switches the space and reopens. Final Confirm refuses any other ledger. Bill paid posts through the reviewed `postOneRecurrence`. A `role="status"` line announces the result after acceptance.
- **D2.** There is one harbour for both spaces. Mine passes `space="mine"` and the member's own `personalSource`, with `scope={view}`, so world presence publishes nothing from Mine. The key is the same for both spaces, so flipping the pill does not rebuild the world. Mine gets the Mine layer and ribbon, the same glass, the same sheet (the private folio is listed only in Mine), and the flat-tier Desk scoped personal.
- **D3.** There is one Campfire sheet. It opens from the fire and logs (`campfire-ritual`), from the Campfire panel's door, from Books (at Settle), from the Chapter room and PlanStudio, and from All tools › Plans. The weekly Sitdown opens from the strip's flagstone, the kitchen table's work centre and All tools › The weekly Sitdown. Books no longer closes the month itself; its door goes to Settle. The UI gates track D describes (both chairs, and two people to seal) are unchanged and are **not server-enforced**.

## Verification

**Typecheck.** `pnpm typecheck` (`tsc --noEmit`) exits 0, run at `158ff508` and again at `21f4a7ae`.

**The five handoffs' suites plus `harbour-*`, `desk-*`, `glass-*`, `campfire-*`, `mine-*`, `terms`, `copy-budget`, `fab*` and `swipe`.** 85 files, run with `vitest run`: **1123 passed, 27 failed.** Every one of the 27 also fails at `4e0234a3`; I ran them in `../wt-baseline` (`git worktree add ../wt-baseline 4e0234a3`, with node_modules symlinked). They are:

| File | Pre-existing failures |
|---|---|
| `harbour-reduced-motion` | 12 |
| `harbour-open-world` | 3 |
| `harbour-skate-model` | 2 |
| `harbour-skate-presence` | 1 |
| `harbour-hercules` | 2 |
| `desk-plates` | 2 |
| `copy-budget` | 2 (the same offenders, one line number moved) |
| `kitchen` | 1 ($50 goal) |
| `ledger-story-ui` | 1 ("Kitty Banks") |
| `five-boards-entry-app` | 1 (quick samples 51 ≤ 48) |

**The Bianca regression.** `app-startup-p1` and `month-rehearsal-mainline` pass **84/84**. The run exercises Shift from Ours through the D1 switch.

**A sweep of 37 other suites that read App or the touched modules:** 330 passed, 15 failed. All 15 also fail at baseline:

| File | Pre-existing failures |
|---|---|
| `onboarding-invitation` | 4 |
| `shift-glance` | 2 |
| `month-rehearsal-ui` | 2 |
| `app-kitchen-boot` | 1 |
| `first-entry` | 1 |
| `hercules-pro-permissions-ui` | 1 |
| `mountain-camera` | 1 |
| `shared-money-membership` | 1 |
| `village-routes` | 1 |
| `village-runtime-camera` | 1 |

**Not run:**
- The full gate.
- The browser suites (`hearthside-*-browser`).
- Any visual or screen-reader pass at 320, 390, 720 and 1100 px, in the three dressings. This is still owed; watch the ribbon versus the HUD stacking, the dock versus the bubbles, and the `:has()` variables.

## Left for Wave 2b (not done here)

- **Retirements K1–K15 and renames:**
  - Delete `PersonalJourney.tsx`, `DeskPersonalToday.tsx`, `SitDownGuide`'s shim and `personal-journey.test.ts`.
  - Delete the personal branch of `HouseWorld`.
  - Delete Books.tsx's second "Lock" `closeBooksMonth`.
  - `TARGET_NAMES`' retired words: "Meet the Queen", "Master Planner", "Plan Studio", "bill jars".
  - "Our Path" in the tent header.
  - Paper trail.
  - "Village square" (the stair button).
  - `hearth:pathWorld` toggles.
  - The Mountain & town guide (K6).
- **Wiring and review gaps:**
  - The deviation-5 gaps above.
  - A command-level both-present guard for the books close, if Jonathan wants K3 enforced.
  - The `DECISIONS.md` entry for D1–D3.
  - Browser evidence.
  - The Codex trust review: the Mine layer (track C) and the ritual fence exemption.

Budget delta (5): +2. Bill paid is one tap from Record and goes through the reviewed path. Every Record names its ledger and cannot post across spaces. The month's close has one door.
Engagement delta (3): +2. There is one island and one glass for both of you; the dock gives a reason to open home, and the Campfire is one ritual.
