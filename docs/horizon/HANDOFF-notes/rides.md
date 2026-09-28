# HANDOFF-notes — T3 Rides (pass 5, D-M6): the gondola and the funicular

Track T3 of `passes/05-mountain-region.md`. Written 28 Sep 2026 on `claude/horizon-v2-mountain` (working tree, not
committed; the integrator commits). Everything here runs on v2's own pure ride and ride camera in native space and is
placed by the one offset (`regions/mountainV2/placement.ts`).

## 1 · What was built

`src/harbour/horizon/movers/gondola/`

| File | What |
|---|---|
| `route.ts` | Pure line logic in Horizon space: `CableKind`, `CableStation`, `CableLines`, `routeForOffer`, `rideLabel` ("Ride the gondola ↑ Summit Commons"), `neighbours`, `defaultRoute`, `nearestStation`, `cableThresholds(lines)` (the per-direction boarding thresholds). |
| `regionAdapter.ts` | `CableRegion` / `CableTransit` — the structural slice of T2's region the rides consume — and `fallbackCableRegion()`, the same contract built straight over `body/ride.ts createRide`, `body/geography.ts transportCurve`, `mountain/transport.ts TRANSPORT_LINES` + the offset. `curveLength`. |
| `controller.ts` | `createCableRide(kind, deps, link)`: the `ModeController` (id `'gondola'` or `'funicular'`), plus `state()`, `skip()`, `toggleSeat()`. |
| `hud.ts` | `cableHud` (the frame's `MoverHud`), `cableControls`, `arrivalLabel`, `boardingLabel`, `cableRidingStatus(kind)`, and `mountCableHud(host, source)` (a DOM row of real buttons + a polite live region). |
| `index.ts` | `CABLE_LINK`, `connectCableRegion(region, mounted?, aspect?)`, `cableMover(kind)` (the `HORIZON_MOVERS` factory), `asCableRide(controller)`, re-exports. |

Shared rows (the only edits outside the folder):
- `movers/shared/mode.ts`: `'funicular'` added to `ModeId` and `MODE_IDS`.
- `movers/shared/vehicleArt.ts`: `funicular:null` in `VEHICLE_DIMENSIONS` (forced by the `ModeId` change: that table
  `satisfies Record<VehicleId, unknown>`; one token, flagged here because the brief did not list the file).
- `runtime/moverInput.ts`: import `cableMover`; `HORIZON_MOVERS` gains `gondola` and `funicular` rows.
- No alias row was needed: `threshold.ts` already maps `cable → gondola` (the aliases live in `threshold.ts` L22-23, not
  `registry.ts`); `rail` is **not** aliased to `funicular` (`rail` is the Ore Line's cart).

Test: `test/horizonGondola.test.ts` (15 tests, green, ~0.3 s).

Ride times (v2's profile, unchanged): gondola quay ↔ summit 62.1 s; funicular town → hearth 16.0 s, hearth → library
18.2 s, library → reservoir 21.2 s (0 s under reduced motion / calm).

## 2 · Controller API

```ts
createCableRide(kind: 'gondola'|'funicular', deps: MoverDeps, link?: CableRideLink): CableRideController
interface CableRideController extends ModeController {
  kind; state(): CableRideState;   // {route, from, to, progress 0…1, remaining m, seated, moving, arrived, cut}
  skip(): void;                    // cut to the far platform
  toggleSeat(): boolean;           // gondola bench; false on the funicular / off the cabin
}
```

- **enter(offer)**: the trip comes from the threshold id (`<kind>.<from>.to.<to>`; legacy `gondolaBase` → quay→summit,
  `gondolaTop` → summit→quay, `funicular.<station>` → next station uphill, down from the top; else the nearest
  platform). If the offer stands more than `CABLE_PLATFORM_GAP` (12 m) from that platform (a stale threshold, e.g.
  today's `gondolaBase` at the retired G1 station `[1480,1090]`), the ride does not start: the first frame finishes and
  the rider stays where they stood.
- **update(dt, input)**: v2's trapezoid ride (`createRide`), W A S D walk inside the cabin (`ride.move`), **Space** (jump
  rising edge) toggles the gondola bench (seated at the start, as in v2; walking stands you), **E** (the unspent
  Enter edge) skips. Body = `pose` + offset; `pose.crouch` = 1 when seated. HUD: `place` = "↑ Summit Commons · 312 m"
  with action `'gate'` (the stage's existing non-interactive bubble), `label` = "Riding the gondola ↑ Summit Commons.".
  Camera = v2's `createRideCamera` (keyframes, springs, the gondola's gorge reveal, rider kept in frame) with native
  `ground`/`blocked` callbacks over **`deps.geography`** (Horizon ground and solids, offset in/out), eye/target offset
  out, fov 50 (+6 over the reveal).
- **Arrival**: the frame that reaches the far platform returns the body there facing `rideExitHeading(kind, to)`,
  `fade = {to, label:'Arrived at Summit Commons by gondola.'}`, `events:['arrived']`, and `finished()` turns true, so the
  runtime's `ride()` → `registry.finish()` → `exit(null)` → `onFoot(out, label, cut)`: the 300 ms fade covers the ride
  camera → walk camera change and the status line (role=status) announces the arrival. Under reduced motion / calm
  the fade is 0 ms (a cut).
- **exit(offer)**: `offer.to === 'feet'` (stepping off at a threshold in reach, or a reload's `parkOfferFor`) stands at
  the offer; any other end (`finish`, a comfort-sheet landing) is the far platform.
- **Reduced motion** (CONTRACT §2.10): `reducedMotionCut()` = `{landings:[{id:'gondola.summit', label:'Summit Commons,
  by gondola', xy, height}]}`, so the runtime's comfort sheet ("Where to? · Land at") offers the far platform, a page, or
  "Stay here". If the controller is stepped anyway (or reduced motion turns on mid-ride) it arrives on the next frame.
- **Calm view**: the same cut, and the cabins are parked (`setTransit(null)`; never a non-null transit under calm).
- Reads nothing financial; no clock (`dt` only); no randomness. The fence test walks every value import reachable from
  `movers/gondola/index.ts` and finds no `src/core`, `src/ledgerSync` or `workers`.

## 3 · The region contract actually consumed

Only this (declared structurally in `regionAdapter.ts`; T2's `MountainV2Region` satisfies it as specified):

```ts
interface CableRegion {
  offset: {x, y, z};
  rides: {
    lines: Record<'gondola'|'funicular', {stations: {id, name, at /* Horizon, the PLATFORM */, yaw}[]}>;
    createRide: typeof import('body/ride.ts').createRide;       // native space
    curve(kind, from, to): {at /* Horizon */, yaw, pitch, cabin?}[];   // used for the trip's length only
  };
}
interface CableTransit { setTransit(cabin: {at, yaw, pitch} | null, kind): void }
```

- Ground / collision for the camera come from the Horizon geography (`deps.geography.ground`, `.blocked`), not the
  region: after T1's re-bake and T2's `addDynamic` those already are v2's ground and solids.
- **`setTransit` receives the ridden cabin in HORIZON space** (`at` = the cabin floor, `yaw` = the cabin's heading along
  the line, `pitch` = the line's pitch), every frame while riding; `null` at arrival, exit, dispose and under calm.
  If T2's cabin meshes live under the offset host group it subtracts the offset.
- T2's `regions/mountainV2/rides.ts regionRides()` was checked against the fallback in the test (same stations, same
  curve ends, same `createRide`, and a full gondola ride through it arrives). Note `regionRides()` carries `offset` inside
  `rides`; the region object must also expose `offset` at the top (as the brief's interface does).

**Wiring the integrator/T2 owes (runtime/index.ts is not T3's):**
1. After the region mounts: `const off = connectCableRegion(region, mounted /* has setTransit */, () => w / h)`; call
   `off()` on dispose. Without it the rides still work on `fallbackCableRegion()`, but no cabin moves with the rider.
2. Status line while riding a cable mode: `cableRidingStatus(kind)` (the stage shows the board's `RIDING_STATUS` today).
3. HUD buttons: `mountCableHud(host, {ride: () => asCableRide(runtime.registry.active()), lines: () => region.rides.lines,
   focus: () => stage.focus()})` beside the offer row (HorizonStage.tsx), `update()` on the stage's tick. Buttons: "Skip to
   Summit Commons (E)", "Sit down / Stand up (Space)" (`aria-pressed`, `aria-keyshortcuts`); the live region announces
   boarding and arrival.
4. `poseRider` for `gondola`/`funicular`: sit the figure (`emote:'sit'`) when `pose.crouch === 1` rather than the
   generic 0.25 m drop.
5. `test/horizonModeRegistry.test.ts:156` expects exactly `['bicycle','board','cruiser']` in `HORIZON_MOVERS`: update to
   `['bicycle','board','cruiser','funicular','gondola']` (T3 may not edit that file). This is the only failure it shows.

## 4 · Thresholds expected from T1

| Id | Where (Horizon) | Modes | Notes |
|---|---|---|---|
| `gondolaBase` | v2 quay platform `[1279.7, 54.5, 810.7]` (`GONDOLA_LINE.stations[0].platform.at` + offset) | `feet→cable` | rides quay → summit |
| `gondolaTop` | v2 summit platform `[1298.3, 158.1, 481.7]` | **`feet→cable`** (today `cable→feet` only) | with `cable→feet` only, no ride down is offered from the summit |
| `funicular.town\|hearth\|library\|reservoir` | `[1291.1, 55.7, 728.1]`, `[1314.4, 69.6, 677.2]`, `[1325.4, 93.6, 607.5]`, `[1344.9, 141.6, 536.5]` | `feet→funicular` | rides to the next station uphill (down from the top) |

Better (recommended): add `cableThresholds(region.rides.lines)` to the world (manifest rows or the world build), and
drop the plain funicular rows: one threshold per platform **per direction**, ids `gondola.quay.to.summit`,
`funicular.hearth.to.library`, …, `height` = the platform, `action` = the offer's words, so the Horizon's offer row
reads "Ride the gondola ↑ Summit Commons" / "Ride the funicular ↓ The square" with no UI change (the offer row shows
`action`; plain ids show T1's action text instead). Keep `gondolaBase`/`gondolaTop` for the journeys and the saved-body
rule, or give them the same words. Don't keep both a plain and a per-direction row for the same direction: both offers
would show.

Offer rule: `OFFER_REACH` 3.6 m horizontally, `|dy|` ≤ 1.2 m of the platform height (the test checks both platforms,
10 m away, 3.7 m away, and 1.5 m above). While riding, E is first spent on any `cable→feet` offer in reach (e.g. the
legacy `gondolaTop` row at arrival), which parks at that offer.

## 5 · Additive exports needed in `body/ride.ts` / `camera/rideCamera.ts`

None. Used as they are: `createRide`, `Ride`, `RidePose`, `createRideCamera`, `rideExitHeading`, `RideInput`. Neither file
was edited. (`rideExitHeading` still aims at v2's `CAMERA_DISTRICTS`, which include the four undrawn tool buildings
(D-M9); it points at their terraces, which is still "away from the platform".)

## 6 · Left open

- **Ride buttons in the world** (`mountain/rideButtons.ts`: station arrow posts, cabin skip/seat caps) are not ported;
  the HUD buttons and E/Space cover the same actions. T2's stripped-down list (§4) does not draw them either.
- **D-M6b**: the Little Harbour → v2-quay lower leg is not built.
- **Far offer** (`body/ride.ts farOffer`, "Ride there?") is not used: the Horizon's walk plan does not suggest rides yet.
- **Bundle**: `runtime/moverInput.ts` now statically imports v2's `body/ride.ts` (→ `body/geography.ts` → `mountain/definition.ts`,
  `scene/ground.ts`, `village/world.ts`) and `camera/rideCamera.ts` (→ `camera/worldAdapter.ts` → v2 art/data modules)
  into the Horizon runtime chunk. T2's region pulls the same modules; if the chunk budget objects, make the two
  `HORIZON_MOVERS` rows lazy.
- **`test/horizonMoversNoMoney.test.ts`** fails on two checks at the base commit `9fed600`, unrelated to T3:
  `movers/shared/vehicleArt.ts: cameraMount` (the allowance lists `board/art/proxy.ts`) and
  `movers/glider/index.ts: Date.now, performance.now`. No `movers/gondola/**` file appears in either list.
- The camera's `aspect` defaults to 16:9 until `connectCableRegion(..., aspect)` passes the stage's.
