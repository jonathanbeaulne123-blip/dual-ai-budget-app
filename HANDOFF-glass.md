# HANDOFF — Tool Atlas track B2 · the glass (branch `claude/tool-atlas-glass`)

Brief: `docs/briefs/tool-atlas-2026-09-25.md` §2.4 Surface, §3.2 right-hand column, §3.4, §4.1–§4.4, §6. Baseline `main@4e0234a3`.
Risk: **Medium** (chrome, navigation and a11y; no money meaning, no command, no schema, no sync).
Budget delta (5): **+1** — "Mark paid", Record and the Fund bank's accepted balance are one panel away from the map; nothing posts outside the existing flows.
Engagement delta (3): **+1** — five things on the glass instead of a seven-control bar; the pawprint stands on Hercules, not on the escape hatch.

## What I built

| File | What |
|---|---|
| `src/harbour/bubbles/Bubble.tsx` + `bubbles.css` | The glass bubble (§4.1): 56 px (48 ≥ 720), 24/22 px stroke icon, label pill **outside** the circle, fixed anchors (Record right 16 / All tools left 16, both `--dock-height` + 12 px; Simple view right 16 / top 100; ≥ 1100 a right-hand column; landscape at `--dock-width`'s edge), `data-camera-deadzone="44"`, two-tone `outline` focus, pressed / open / `aria-disabled` states, Record accent (`#B04C34` / `#826789` / `#2f5b63`, 2 px paper ring, paper label), solid fallback (`.is-solid`: `#F6F0E4`, 1 px `#8A7A69`, no blur) for reduced transparency / motion, more contrast, forced colours (`1px solid transparent`), Save-Data, `calm`, `lite`, `frameOverBudget`; blur off while `cameraMoving`, back 120 ms after. Label rule: pill until 5 uses per member (`hearth:atlas:used:<member>:<kind>`), then long-press 350 ms / focus / hover tooltip, Escape dismisses, long press never activates. |
| `src/harbour/bubbles/GlassChrome.tsx` | `GlassChrome` (the three, fixed, DOM order Simple view → `between` → All tools → Record), `GlassBar` (the bar form `[Island│Simple view] [Record] [All tools]`, Record centred), `SimpleViewBubble` / `AllToolsBubble` / `RecordBubble`, `GlassRippleDefs` (NF `feDisplacementMap`, rendered once), `flipWords`, `useGlassEdition`. |
| `src/harbour/bubbles/{glassMode,usage,deadzone,flipStanding}.ts`, `icons.tsx` | Pure rules (`glassMode`, `labelAtRest`), `useGlassEnvironment`, per-viewer counts + Recent (`hearth:atlas:recent:<member>`), `inCameraDeadzone(x, y)`, the one-flip store (`useFlipStanding`). |
| `src/harbour/nav/QuickSheet.tsx` (+ `harbour-nav.css`) | **All tools, with search** (§3.4): `role="dialog"` named "All tools and search", focus contained, Escape / "Put it back" return focus; search (`type="search"`, autofocus ≥ 1100, `/` inside), Recent, Record chips → `onPick(mode)`, the six jobs, Places, Hercules, Settings, the edition switch (`aria-disabled` + reason). Exports `focusAtlasSearch()`, `useAtlasSearchKeys(enabled, open)`, `atlasSearchKey`. Keeps `HARBOUR_GO_EVENT`, `quickSheetPlaces`, `onGo`, `onOpen`, `onStatus`, `onHercules`, `spaceSwitch`, `householdSwitcher`, `current`. |
| `src/harbour/nav/atlasFallback.ts`, `atlasSearch.ts` | `AtlasTool` / `AtlasGroup` typed as the brief asks; `ATLAS_FALLBACK` (§3.2 groups, tools, synonyms, spaces, hosts, targets); `searchAtlas` (name > synonym > household word, group shown). |
| `src/harbour/panels/{CompactPanel,HostPanel}.tsx`, `panelModel.ts`, `panels.css` | One compact panel per host (§3.2 right column): ≤ ⅓ screen, above the dock, `role="dialog"`, Put it back, **Step in**; pure readings over `HarbourReading` + `PanelExtras`. |
| `src/harbour/nav/worldActions.ts` | The seam that keeps the bar's retired world controls reachable: `VillageHUD` offers `step-in` (→ its `onGuide`: tour, monorail, race) and `arrange` (→ `onArrange`) while it stands; All tools › Places lists those rows only while offered and runs them (`runWorldAction`). An App-level `onWorld` prop overrides. |
| `src/harbour/nav/barBadges.ts` | Pawprint semantics moved to Hercules: `herculesHasSuggestion(household, member, scope, today)` (pure) and `useHerculesSuggestion()` (store). |
| `src/harbour/nav/Compass.tsx` | Door edition → `GlassBar` (`[Simple view] [Record] [All tools]`), swipe-up kept; `useToolsPawprint` and `BarFab` removed. `EditionFlip`, `useEditionFlipKey`, `useIslandBar(Standing)` unchanged. |
| `src/harbour/village/VillageHUD.tsx` (+ `village.css`) | Seven-control bar and the dead "Village map / Beyond the village" list removed; island renders `GlassChrome`, Desk (`flat`) renders `GlassBar edition="desk"`; address card is glass (`data-glass-card`, three dressings, solid fallbacks); rooms row renamed "Atlas". |
| `src/harbour/HarbourEntry.tsx` | ReadingHarbour bar → `GlassBar edition="desk"`: `[Island] [Record] [All tools]`; "⌖ Village map", the raw-id Quick travel `<select>` and the second flip are gone. |
| `src/harbour/desk/DeskShell.tsx` | Header keeps **one** flip: hidden while a glass flip stands (`useFlipStanding`), `headerFlip` prop overrides; `spaceSlot` kept. |

## Wiring the integrator does (App.tsx / HarbourWorld.tsx — I did not touch them)

1. **Swap the atlas**: in `QuickSheet.tsx` change `import { ATLAS_FALLBACK as ATLAS, ATLAS_JOB_GROUPS, ATLAS_RECORD_VERBS, … } from "./atlasFallback.ts"` to `src/core/toolAtlas.ts` (same shape). `atlasSearch.ts` imports the same types — point it there too.
2. **QuickSheet** (both mounts, `App.tsx:9210` and `:9299`), add:
   `onPick={(mode)=>{setQuickSheetOpen(false); mode==="bill" ? openBillPaid() : openAddFor(null, mode);}}` ·
   `recordModes={memberHasJob ? undefined : ["expense","income","bill","transfer"]}` ·
   `onPlace={(place,{keyboard})=>{setQuickSheetOpen(false); setHostPanel(place); if(!keyboard) flyTo(place);}}` ·
   `onSettings={(section)=>{setQuickSheetOpen(false); goTab("more"); /* scroll to section */}}` ·
   `onTarget={(t,o)=>{setQuickSheetOpen(false); /* accounts→Accounts, activity|import|audit→Books division, campfire→Campfire ritual, leaving→Cellar panel / Desk Leaving, sitdown→Calendar's week */}}` ·
   `onWorld` is optional: without it Step in / Arrange room run through the HUD's offers (`nav/worldActions.ts`) and Skate stays hidden; pass it only to route Skate (HarbourWorld's skate card) ·
   `recent={readRecentTools(memberId)}` + `onUsed={(id)=>rememberRecentTool(memberId,id)}` (from `bubbles/usage.ts`) ·
   `householdWords={…}` (bills → `{target:"cellar-bills",object:recurrenceId,group:"bills"}`, accounts → `"accounts"`, goals → `"loft-banks"`, members → `"queen"`) ·
   `space={view==="personal"?"mine":"ours"}`. `onOpen` now receives `(id, object?)`.
   Call `useAtlasSearchKeys(HARBOUR_ENABLED, ()=>setQuickSheetOpen(true))` once (retires the Ctrl/Cmd+K palette, K7).
3. **VillageHUD** (`HarbourWorld.tsx:1124`) may pass: `memberId`, `theme`, `calm={mountainCalm||comfort.quiet}`, `lite={tier==="lite"}`, `frameOverBudget`, `cameraMoving`, `night`, `toolsOpen`, `alwaysShowLabels`, and `glassBetween={<>map stop · strip · card</>}` — the dock goes **between** Simple view and All tools so Tab visits Simple view → map → strip → card → All tools → Record (A5). The retired props (`onGuide`, `onView`, `onWander`, `onJourney`, `onArrange`) are still accepted and ignored.
4. **Panels**: mount one `<HostPanel host reading extras onClose onOpen={openHouseObject} onRecord onMarkPaid onStepIn onTalk onVisit returnFocusTo/>` as a sibling after `VillageHUD` inside the stage (above the dock). `extras.fund` = accepted balance/as-of/last three moves, `extras.bills` = next bills **with `recurrenceId`** (from `cellarJars`), `extras.books` = in/out/leftover, `extras.needsYou`, `today`, `memberId`. `onMarkPaid(recurrenceId)` → the existing Bill paid named Confirm (`postOneRecurrence`). `PANEL_DOORS` lists each door's target; `campfire` needs routing.
5. **Compass** (`App.tsx:9210`) may pass `member`, `theme`, `calm`, `toolsOpen={quickSheetOpen}`.
6. `--dock-height` (and `--dock-width` in landscape) on `:root` from the dock (track dock).
7. **Record**: per the prompt I call `<FabSpeedDial actions closedLabel="Record" onPick />` only. If track A keeps `closed` / `onOpenChange`, add `closed={fab.closed} onOpenChange={fab.onOpenChange}` in `RecordBubble` (one line) so the dial shuts while an Add sheet is open.
8. The Hercules figure on the map reads `useHerculesSuggestion()` for its pawprint.

## Commands
None called or added. Every action is a callback to an existing door or Add flow.

## Tests (vitest)
New: `test/glass-atlas-search.test.ts`, `test/glass-bubbles.test.ts`, `test/glass-panels.test.ts`, `test/glass-vocabulary-fence.test.ts`. Rewritten for the new behaviour: `test/harbour-quick-sheet-ui.test.ts`, `test/harbour-one-bar.test.ts`, `test/harbour-compass-ui.test.ts`; adjusted: `test/desk-little-things.test.ts` (pawprint moved), `test/harbourFlatEntry.test.ts`, `test/desk-routing.test.ts` (one flip), `test/harbour-source-fences.test.ts` (`bubbles/`, `panels/` dirs; `bubbles/usage.ts` may touch storage).
`test/harbour-walk-focus.test.ts` opens the guide through `runWorldAction("step-in")` instead of the retired `#world-guide-trigger`.

**Results (this worktree, 2026-09-25):** `pnpm typecheck` equivalent (`tsc --noEmit`) → **exit 0**. Vitest, run file by file: glass-atlas-search 10/10, glass-bubbles 13/13, glass-panels 8/8, glass-vocabulary-fence 5/5, harbour-quick-sheet-ui 18/18, harbour-one-bar, harbour-compass-ui, desk-little-things, harbourFlatEntry, harbour-source-fences, harbour-character-choice, desk-shell, desk-personal, desk-personal-app, desk-mountain-integration, desk-source-fences, desk-routing, desk-accounts, desk-calendar-books, desk-leaving, desk-today-harvest, desk-unknown, harbour-walk-focus, harbour-walk-everywhere, harbour-flat-parity, skate-show-hud, village-arrangement — all green. `test/harbour-reduced-motion.test.ts` fails 12 tests **identically at baseline `4e0234a3`** (frames at rest; `interiors/interiors.css` has no reduced-motion guard) — pre-existing, not this track; my four stylesheets answer the rule. The full gate was not run (per BUILD-BRIEF).

## Three dressings
`bubbles.css` (`:root[data-theme="taylor|newfoundland"]` + `[data-glass-theme]` override): Classic porcelain + chalk edge; Taylor vellum `rgba(255,247,246,.76)`, blur 10, washi corner `#e8a6bd` 20 %, white deckle; Newfoundland `rgba(247,247,237,.74)`, 1.5 px `#f5f3ea` frame, static ripple, Figtree 800 caps labels. Same three in `panels.css`, `village.css` (address card) and the sheet's chips (`harbour-nav.css`).

## Uncertainty / left for the integrator
- No browser pass at 320 / 390 / 720 / 1100 in this track (jsdom only): the fixed anchors, the landscape column and `backdrop-filter: url()` ripple need a visual check.
- The address card still shows `HARBOUR_PLACE_NAMES.court` = "the Village Square" (`flag.ts`, not mine) — the brief says "the square".
- The Desk drawer chip ("All tools & places") still opens the same sheet; A4b heading parity with the drawer is automatic (same sheet).
- `village.css` was re-emitted one rule per line while removing every `.village-tools` / `.village-quick` / `.village-map` selector; no surviving rule changed.
- On phones `WalkTogether` (presence) was only reachable inside the dead Village map; it stays hidden there (`.village-presence-outside`) — Settings › Character and presence is its home per the brief; the integrator routes `settings:presence`.
- Mountain & town guide (K6) is still mounted by HarbourWorld; it is reached through All tools › Step in until the integrator retires it.
- `HarbourWorld`'s own fallback Desk still exists (brief: integrator removes it); its header flip hides while the HUD's flat bar stands.
