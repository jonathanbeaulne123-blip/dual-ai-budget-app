# Track C — one island for both spaces (Mine layer) · handoff (2026-09-25)

Branch `claude/tool-atlas-mine` from `main@4e0234a3` (#545). Worktree `/home/claude/jonathanbeaulne123-blip/wt-mine`. **Local only**: not pushed, not merged, not deployed. Decision **D2** (approved): retire Personal Journey (T37) and My private house (T63); Mine = the personal camp card + an owner-only "Mine" layer on the household harbour, with a Mine ribbon. Brief: `docs/briefs/tool-atlas-2026-09-25.md` §2.3, §3.5 "Mine", §7 K4, §9 D2.

**Risk: High** (privacy boundary: the household map becomes the canvas for private things). No money meaning, command, schema, sync or hosted change. A Codex trust review is requested below.

- **Budget delta (5): +0.** No figure, command, posting path or Final Confirm changes. The layer carries no amounts; the Fund bank stays the shared Fund in both spaces.
- **Engagement delta (3): +1.** One island instead of three worlds; your own steps and Kitty Banks stand where they belong (the Glasshouse, the Loft) instead of on a separate island.

## What I built

| File | What |
|---|---|
| `src/harbour/mine/mineLayer.ts` (new) | Pure read model. `mineLayer(household, memberId, today)` → `{ footpaths, steps, banks, empty }`. Footpaths = `core/pathFootpaths.ts` as-is. Steps = open, top-level private tasks (dated first, late first, undated last; ≤ 12). Banks = open goal banks of `projectKittyNest(h, memberId, "personal", today)`, re-checked row by row (≤ 12). No amounts. Unknown/blank member → empty. `mineCamp` = the Desk's `readPersonalToday` (not duplicated). `spaceForView`, `MINE_HOSTS`, `MINE_FUND_WORDS = "the shared Fund"`, `emptyMineLayer`. No command import. |
| `src/harbour/mine/MineLayer.tsx` (new) | Draws the layer over the harbour canvas. On the square: steps as stakes at the Glasshouse door (`visit:glasshouse`), banks on a shelf at Our home's door (`visit:kitchen`, the Loft is upstairs), footpaths as a dashed trail between them with one short stroke per footpath (ported from `PathMiniMap`'s `.path-minimap__footpath` and `our-path-world.css`'s dashed `.path-mark--footpath` label — the 3D `pathWorld3d` renderer is month-indexed Journey geometry and is not reusable on the harbour) plus a "Your footpaths" disclosure. Inside the Glasshouse: stakes in the beds. Inside the Loft: the private shelf. A host off screen docks its group under the ribbon. 5 stakes / 4 banks shown, then "All your steps" / "All your Kitty Banks". Every mark is a ≥ 44 px `<button>` whose name starts with its visible label; the trail is `aria-hidden`. |
| `src/harbour/mine/MineRibbon.tsx` (new) | Glass ribbon, ink "Mine", top-left of the map. A `role="status"` region is always mounted and empty at load; "Showing Mine" arrives 60 ms after the ribbon appears (A24). Driven by `space` only; nothing persists. |
| `src/harbour/mine/mine.css` (new) | Three dressings (see below), solid fallback, reduced motion = no transitions/animation, two-tone `outline` focus ring, forced colours. |
| `src/core/pathFootpaths.ts` | The owner-only guard is now one exported predicate, `ownsPrivateTask` (`:44`), used by `pathFootpaths` (`:62`) and the Mine steps; plus `ownsPrivateGoal` (`:54`) for banks. Behaviour of `pathFootpaths` unchanged. |
| `src/harbour/flag.ts` | `harbourOwnsRoute` (`:124`) owns personal routes too (the `view` argument no longer refuses; `surface: "journey"` still returns false in both spaces). Place names follow §3.2: `court` "the square" (was "the Village Square"), `bank` "the Fund bank" (was "the Fund Bank"). New `HARBOUR_SPACE_NAMES` (Ours / Mine). |
| `src/harbour/HarbourWorld.tsx` | Only: props `space?: MineSpace` (`:115`), `mineHousehold?: Household` (`:121`), `onOpenMine?` (`:123`); `data-harbour-space` on the section; the layer memo (`:1128`); `<MineRibbon>` and `<MineLayer>` in the stage (`:1151-1152`). No HUD/bar code touched. |
| `src/path/OurPathWorld.tsx` | Optional `space` prop. Given: the private footpaths **and my stage-1 private plank** draw in Mine only, the Layers "Mine" toggle is gone, and the per-device key is neither read nor written (`:348-353`, `:679`, `:2035`). Absent: today's per-member toggle, unchanged. |
| `src/house/PersonalJourney.tsx`, `src/house/HouseWorld.tsx` | `@deprecated` headers listing where each feature now lives. Still compile; still mounted by App until the integrator removes them. Nothing but `App.tsx` imports either (fenced). |
| `test/mine-layer.test.ts` (new, 10) | Model: owner-only draw; **two-member fixture: never another member's private rows, nor a household row**; partner device (split/assemble) has nothing of mine; no amount keys/values; unknown member empty; guard truth table; household and AI disclosure unchanged; hosts / Fund words / camp = Desk model. Static: no command import (every `captureCommand` export name checked), no storage/fetch, vocabulary fence. |
| `test/mine-layer-ui.test.ts` (new, 10) | Ribbon (Ours → none; Mine → "Mine", status empty then "Showing Mine"); placement at doors, trail, dock fallback, empty line, Glasshouse beds / Loft shelf / nothing elsewhere; label-in-name, 44 px, `touch-action`; footpath disclosure + Escape returns focus; 5 stakes + "All your steps"; HarbourWorld wiring (static); routes in Mine resolve; retired screens imported by App alone. |
| `test/our-path-world-ui.test.ts` | +1: with `space` the marks follow it, no toggle, nothing persisted. |
| `test/harbour-arrival.test.ts`, `test/harbour-source-fences.test.ts` | Updated for personal ownership, new place names, and the `mine/` directory. |

## Tests and tsc

- `vitest run test/mine-layer.test.ts test/mine-layer-ui.test.ts` — **20/20 pass**.
- `test/our-path-world-ui.test.ts` (footpath / Mine cases, 4/4), `test/path-footpaths.test.ts` 6/6, `test/harbour-arrival.test.ts` 15/15, `test/harbour-source-fences.test.ts` 8/8, `test/desk-personal.test.ts` 11/11, `test/personal-journey.test.ts` 3/3, `test/harbour-reading.test.ts` 23/23 — pass.
- `pnpm typecheck`: see the final line of this section (run under heavy shared load).
- The harbour flag is off in vitest, so the App suites (`app-startup-p1`, `month-rehearsal-mainline`) do not see the `flag.ts` change; the integrator's App wiring must run them.

## Wiring App.tsx needs (the integrator; I did not touch App.tsx)

`flag.ts` and this wiring must land **together**: with the flag change alone, a personal view in production mounts `HarbourWorld` without `space`, i.e. the household harbour with no Mine layer, and the personal flat Desk branch becomes unreachable.

1. **The world mount, `App.tsx:7228`.** Keep the harbour branch; delete the `:personalFlat?(<Suspense…><DeskShell … scope="personal" …/></Suspense>)` branch and the final `:<HouseWorld …/>` branch **for personal**. Pass:
   - `space={view==="personal"?"mine":"ours"}` (or `spaceForView(view)` from `harbour/mine/mineLayer.ts`);
   - `household={view==="personal"?(personalSource??household):household}` — the same source today's personal Desk reads (`test/desk-personal.test.ts:158` fences it); `mineHousehold` may then be omitted (it defaults to `household`);
   - `scope={view}` (unchanged) — keeps world presence silent in Mine (`softPresenceWorld.ts:33-37`: from a personal view nothing is published), keeps the Desk personal in the flat tier, and keys camera returns per space;
   - `onOpen={view==="personal"?openPersonalDeskDoor:openHouseObject}` (`App.tsx:7034`, so the personal plates' `shift` goes to Shifts);
   - `onOpenMine={(kind,id)=>kind==="bank"?openHouseObject("loft-banks",id?`bank/${id}`:undefined):openHearthsideTool("planner",id?{kind:"task",id}:undefined,"Mine")}` (bank ids are `goal:<goalId>`, the object PersonalJourney already sent);
   - **`key`**: drop `:${view}` → `${environment}:${household.householdId}:${actorId}`, so flipping the pill does not rebuild the 3D world ("it closes nothing", §3.5). If you keep it, the flip remounts the scene.
   - The Journey surface: `harbourOwnsRoute` still refuses `surface:"journey"` in both spaces, so the final `HouseWorld` branch remains the Ours Journey backdrop exactly as today; do not delete it for `view==="household"` in this wave.
2. **`App.tsx:6956-6957`** `personalFlat` / `personalDesk`: delete once 1 lands; `App.tsx:7226` becomes `{!harbourOwnsRoute(activeHouseRoute,view)&&spaceSwitchNode}` (the pill lives in the Desk header / quick sheet / track B1's card).
3. **`App.tsx:7446`** `PersonalJourney` mount: delete, and remove the matching exclusion in `App.tsx:7447` (`!(HOUSE_WORLD_ENABLED&&view==="personal"&&activeHouseRoute.surface==="journey")`). A personal `journey` route should resolve to the Ours Journey (the harbour's `onJourney` already names `scope:"household"`; `resolveHouseRouteScope` switches). OurPathWorld (`App.tsx:7525`, household-only mount) keeps its per-member Mine toggle while `space` is not passed; pass `space={spaceForView(view)}` only when the Journey map itself is shown in Mine (a later slice; it needs its own review of Path commands from the personal view).
4. **Imports `App.tsx:16`, `:23`**: delete `HouseWorld` only when no branch uses it (see 1), `PersonalJourney` with 3. Update the comment at `App.tsx:550`.
5. **The personal bottom bar goes** (`App.tsx:9209-9297`): change `HARBOUR_ENABLED&&view==="household"?<Compass…/><QuickSheet…/>:<nav…>` to `HARBOUR_ENABLED?…` so both spaces get the same glass chrome; the personal `<nav>` (the `EditionFlip world="house"` at `:9212`, the `house-nav-phone` room buttons at `:9214`, `data-edition-nav`) and the personal `QuickSheet` with `onGo` (after `:9297`) are removed. `harbourBarFab` already reads `fabActionsFor(view,tab)`, so Record's verbs follow the space. (Compass/QuickSheet/glass are tracks B/dock — coordinate there.)
6. **Routes that must still resolve in Mine** (tested in `test/mine-layer-ui.test.ts` "routes in Mine"): `loft-banks`→the Loft, `planner`→the Glasshouse (tab `planner`), `books`→the Library, `calendar`→the Glasshouse, `plan-studio`→the Kitchen (tab `plan`), `pottery`→the Kiln, `wishes`→the Boathouse; `shift` keeps its room and opens tab `shift`; `hercules` tab `hercules`; `plan` and `play` keep their room. `journey` is not a harbour route.
7. **Fund bank panel in Mine** (track B's panel): it must say "the shared Fund" (`MINE_FUND_WORDS`), never "my Fund". The Loft panel lists private banks in Mine; the Boathouse lists the private folio (T45, `PersonalTogether`, `App.tsx:7302`) in Mine only.
8. **Tests the integrator must update with the wiring:** `test/desk-personal.test.ts:158` (fences the `personalFlat` DeskShell mount → fence the harbour mount's `household={view==="personal"?(personalSource??household):household}` instead), `test/harbour-source-fences.test.ts:114-115` (App seam regexes), `test/personal-journey.test.ts` (delete with the module), and the Bianca full-App regression `test/app-startup-p1.test.ts` + `test/month-rehearsal-mainline.test.ts` (AGENTS.md: App routes changed).

## Retired features and where they live now (K4)

| Retired | Now |
|---|---|
| Personal Journey's island (T37) | the Mine layer on the household harbour (footpaths, steps, banks), owner-only |
| its month picker and readings | the Journey map (T36) and the personal camp card |
| "Open Personal Plan" | the kitchen table in Mine (`plan-studio`, personal view) |
| wishes / experiences / kept memories list | the Boathouse's private folio, Mine only (T45) |
| personal ceramic banks | the Loft's private shelf (Mine layer) → `loft-banks` `bank/goal:<id>` |
| My private house's rooms (T63) | the same hosts on the one harbour; hosts keep their meaning |
| its position card | the personal camp card (`readPersonalToday`, exposed as `mineCamp`) |
| the private pottery studio | a private Kitty Bank's studio tab (K12) |
| the personal Queen dressing (T14) | Settings › Appearance (K9) |

## Three dressings (CSS evidence: `src/harbour/mine/mine.css`)

- **Classic Hearth** (default tokens): porcelain glass `rgba(246,240,228,.72)`, chalk top edge `#fbf5e6`, ink `#2E241B`, sumac stake tip `#B04C34` on a wooden stake, straw footpaths `#c9a36a` → walked green `#4f6b4a`.
- **Taylor's Scrapbook** (`:root[data-theme="taylor"]`): vellum `rgba(255,247,246,.76)` with `blur(10px)`, washi-tape corner `#e8a6bd` at 20 %, deckled white edge, lilac `#826789` stakes, ink `#49323D`.
- **Newfoundland** (`:root[data-theme="newfoundland"]`): wavy-glass fill `rgba(247,247,237,.74)` in a 1.5 px `#f5f3ea` frame, buoy-teal `#2f5b63` stakes, Figtree 800 caps letter-spaced 0.06 em for the ribbon and doors, ink `#273E41`.
- Solid `#F6F0E4` + 1 px `#8A7A69`, no blur, under `prefers-reduced-transparency`, `prefers-reduced-motion`, `prefers-contrast: more`, `data-quiet="true"`, and `data-harbour-tier="lite"|"flat"`; forced colours use system colours and `outline`. Reduced motion (media or `data-motion="reduced"`) and Quiet: no transition, no animation, no press scale.
- Not yet verified visually at 320 / 390 / 720 / ~1100 px (no browser in this lane); see Uncertainty.

## Codex trust review — what changes in who can see what

**Nothing new is stored, synced, sent or disclosed.** No household field, command, `pathWorld` row, envelope, hosted payload, Hercules/model projection or localStorage key is added. The layer is derived on read on the signed-in member's own device and drawn only on that member's screen while the App shows Mine. When `space` is given, OurPathWorld stops reading/writing `hearth:pathWorld:mine:<memberId>`.

**The only guard is the existing owner-only footpath guard, extended to steps and banks:**
- Tasks (footpaths and steps): `ownsPrivateTask` — `src/core/pathFootpaths.ts:44` — `memberId` non-empty ∧ `!task.deleted` ∧ `task.visibility === "personal"` ∧ `task.createdBy === memberId` ∧ `taskInView(task, memberId, "personal")` (`src/core/tasks.ts:180`). This is byte-for-byte the predicate `pathFootpaths` used before (now called at `pathFootpaths.ts:62`); the Mine steps call the same function (`src/harbour/mine/mineLayer.ts:113`).
- Banks: `projectKittyNest(h, memberId, "personal", today)` already filters goals by `goalVisibleInView(g, memberId, "personal")` (`src/core/kittyNest.ts:112` → `src/core/visibility.ts:275`: `!goal.shared && goal.ownerMemberId === memberId`); the layer re-checks every returned row with `ownsPrivateGoal` — `src/core/pathFootpaths.ts:54` (`mineLayer.ts:137`), so a projection change cannot widen it.
- A member id the household does not list reads an empty layer (`mineLayer.ts:105`).
- Device boundary unchanged: a partner's device assembles Shared + its own Personal envelope (`splitForSync` / `assembleHousehold`), so it never holds my rows; tested with a two-member fixture on both the in-memory full snapshot and the partner's assembled device.

**What does change in exposure:**
1. **The household map is now the canvas for private marks** (as the Journey map already was for footpaths, D-264 §2(g)). Glance risk: the Journey hides private marks at Dim; the harbour has no lantern. Mitigation: marks draw **only in Mine** (a deliberate pill choice), the Mine ribbon is always on screen while they do, no amounts are drawn, and every group says "only you see these".
2. **Personal routes now mount `HarbourWorld`**, whose scene reading stays household-scoped (`src/harbour/data/useHarbourReading.ts:45`, `scope: "household"`) — hosts show the same shared facts in both spaces. With `scope={view}`, world presence publishes nothing from Mine (`src/softPresenceWorld.ts:33-37`, gate refreshed on `view` in `src/ledgerSync/worldPresenceMount.tsx:156`). If the integrator passed `scope="household"` with `space="mine"`, the position lane would publish while Mine is on screen (position and place id only, never the marks) — please confirm `scope={view}`.
   The comment at `src/softPresenceWorld.ts:33` still calls the harbour a household-only world via `harbourOwnsRoute`; the gate itself is keyed on `view`, not on the predicate, so it stays correct and only the comment is stale (not my file).
3. In Mine the Queen's bloom reads `livingEvidence(household, memberId, "personal")` (`HarbourWorld.tsx`, existing code path) — personal evidence on the owner's own screen, as the personal house did.
4. OurPathWorld with `space`: my stage-1 private plank now also follows Mine (it followed only the lantern before). Without `space`, unchanged.

Please review: `src/core/pathFootpaths.ts`, `src/harbour/mine/mineLayer.ts`, `src/harbour/mine/MineLayer.tsx`, the `HarbourWorld.tsx` diff, `src/harbour/flag.ts` `harbourOwnsRoute`, the OurPathWorld diff, and `test/mine-layer.test.ts`.

## Uncertainty

- No browser run: placement over projected door rects, the dock fallback and the three dressings are unit-tested in jsdom, not seen at 320/390/720/1100 px or against the real map; the top-left ribbon may collide with B2's HUD chips — check the stack order (`z-index: 8`) when both land.
- Anchors `visit:glasshouse` / `visit:kitchen` come from `village/layout.ts` entries; if the court renames them the groups dock (graceful, but no longer at the door).
- Commit trailers use the session attribution (`Claude Opus 5.5`) from the environment's system reminder rather than the BUILD-BRIEF's `Claude Fable 5.1`.
- `pnpm typecheck` under ~12× CPU contention (see below).

## Left for the integrator

App wiring 1–8 above; DECISIONS entry for D2; the Fund panel's "the shared Fund" words (track B); the Journey-in-Mine follow-up (pass `space` to OurPathWorld once the Journey is shown in Mine, with its own review).
