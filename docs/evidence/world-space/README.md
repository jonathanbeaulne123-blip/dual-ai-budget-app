# World space — the island as one continuous place

Vertical slice on three buildings: **the Library**, **Hercules's Cottage** and
**the Kiln**. Captured against `scripts/serve-whole-house-review.mjs` (loopback,
fictional household, SwiftShader), `prefers-reduced-motion: reduce`.

## What stands where

An interior used to build its root group at the scene origin while the Court
stood that building's shell out on the island. Three of them now carry a
**placement** (`src/harbour/scene/place.ts`) — the Court's own spot and yaw,
copied from `court/CourtScene.ts` and checked against it by
`test/harbour-world-space.test.ts`:

| place | spot (x, z) | yaw | floor lift | interior | exterior shell | ratio |
|---|---|---|---|---|---|---|
| library | −4.7, −11.6 | `atan2(-x,-z) + π` | 0.287 | 8.8 × 6.8 | 2.6 × 1.7 | 3.4× / 4.0× |
| cottage | 9.8, 5.6 | `atan2(-x,-z)` | 0.252 | 6.4 × 5.2 | 1.5 × 1.25 | 4.3× / 4.2× |
| kiln | 10.6, −4.4 | `atan2(-x,-z) + π` | 0.273 | 7.6 × 5.8 | 1.8 × 1.45 | 4.2× / 4.0× |

The other eight places declare no placement and keep the origin, the old
dispose-on-navigate and their own hold boxes, unchanged.

## Resident draw calls

One camera for every row — the island overview, `look({target:[0,0,−1], r:22,
theta:0.18, phi:0.52})` — so nothing is counted in or out by where the eye
happened to be pointing. `draw-calls.json`.

| resident | desktop 1440×900 draw | geometries |
|---|---|---|
| none (the Court alone) | **408** | 241 |
| kiln | **437** (+29) | 282 |
| kiln + cottage | **458** (+50) | 311 |
| library alone | **447** (+39) | 284 |
| all three (arithmetic, same camera) | **≈497** (+89) | ≈353 |

Each marginal already includes hiding that building's exterior shell, so the
three-interior figure is the sum of three measurements at one camera.

**Three interiors resident at once is not reachable by walking.** The Library
is 19–22 units from the Kiln and the Cottage and the release radius is 11.6, so
crossing the island always lets it go; and walking out of a building returns
the route to the Court, which removes the last thing holding it up. Two — the
Kiln and the Cottage, ten units apart on the Making lawn — is the real ceiling,
and it costs **+50 draw calls over the Court alone**. The runtime test
(`stands all three at once…`) reaches three by holding the route in one place
while the viewer stands between the other two.

`draw-calls-phone.json` carries the 390×844 run, and reads oddly on purpose:
at the same overview pose a portrait frame does not contain the Making lawn, so
the Kiln and the Cottage stand resident **and cost nothing** (382 → 380 → 381
draw calls) because the frustum culls them whole — their geometries are never
even uploaded. The Library, which is inside that frame, costs **+54** (382 →
436). A resident room you are not looking at is close to free; the budget to
watch is the one in front of you.

## The stills

- `desktop-1440-resident-none.png` — the Court alone; the buildings are shells.
- `desktop-1440-resident-kiln.png`, `-kiln-and-cottage.png`, `-library.png` —
  the interiors standing at their real positions, seen from the Court.
- `desktop-1440-06-island-three-interiors.png` — the whole island from above
  with the Kiln's room and the Cottage's room open on the lawn.
- `desktop-1440-03-one-interior.png` — the moment of crossing: the compass has
  moved to **Making** and the door strip says **← Back to the Court**, from
  walking to the Kiln's doorway and nothing else.
- `*-09-inside-kiln-looking-out-*.png`, `*-10-inside-kiln-*.png` — standing
  inside the Kiln, `as-shipped` and `with-place-relative-camera` (below).

## The one thing that does not work as shipped

`camera/poses.ts` clamps a pose's **target to nine units of the world origin**
(`COURT_BOUNDS.targetRadius`), and `courtCamera.ts` clamps it again through
`ROAM_COURT_BOUNDS`. Both are measured from the origin, unconditionally. The
three buildings stand at radius 11.3–12.5, so the camera cannot look at any of
them: `holdPoseInRoom` runs last and puts the eye inside the placed room, but
the target it is given has already been dragged 2.4–2.7 units back toward the
Queen, and the eye ends up jammed against the room's Court-facing wall.

- `desktop-1440-09-inside-kiln-looking-out-as-shipped.png` — eye at
  (6.73, 1.96, −2.92), 4.1 units from the Kiln's centre: a flat wall.
- `desktop-1440-09-inside-kiln-looking-out-with-place-relative-camera.png` —
  eye at (9.59, 3.12, −2.83), 1.9 units in: the bench, the window, the door.

`camera-place-relative-bounds.patch` is the whole change — measure those bounds
from the standing room's centre instead of the origin, defaulting to the origin
so the Court is untouched. It is **not committed**: `src/harbour/camera/**`
belongs to the character/follow-camera lane, and a body that walks the island
needs exactly the same change. The patch was applied only to take the paired
still above, and reverted.

## Two coherence problems the slice exposes

1. **Interior and exterior are not the same building.** An interior is 3.4–4.3×
   its shell's footprint. Hiding the shell while the room is resident
   (`showExteriors` in `scene/runtime.ts`) keeps them from being drawn twice,
   but it cannot make them agree: the Library's room spans island radius
   9.1–16.5 — past `LAWN_RADIUS` and onto the shore — and its spot is 4.13 units
   from the Glasshouse's, so it swallows the Glasshouse shed whole.
2. **The island's planting does not know the rooms are there.**
   `scene/ground.ts` plants its tree ring at radius 13–15.4, straight through
   the Kiln's and the Cottage's footprints. Two conifers stand inside the Kiln
   in `*-09-inside-kiln-looking-out-with-place-relative-camera.png`.

Neither is silently papered over. The fix belongs upstream of this slice: either
the exteriors grow to the interiors' footprint (and the Library and the
Glasshouse must move apart, and the island must grow), or the interiors shrink
to village scale, and the planting must take a keep-out list from
`PLACE_PLACEMENTS`.
