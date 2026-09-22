# The body: a person you walk the island as

The Court has never had a character. `HarbourWorld.tsx` promised "W A S D walk"
in the stage's own label while the keys called `court.pan()` — the camera's
look-at target slid, and nothing on the island moved. This is the person, the
camera that walks with them, and the proof.

Captured against `scripts/serve-whole-house-review.mjs` (loopback, fictional
household, `seed=demo`) with

```
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/capture-world-body-evidence.py docs/evidence/world-body --port=<port>
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/capture-world-body-door.py     docs/evidence/world-body --port=<port>
python3 scripts/make-world-body-gif.py docs/evidence/world-body --label=walk-full --width=1440
```

WebGL is drawn by SwiftShader on a loaded two-core box, so a screenshot takes
the better part of a minute and the walk carries on underneath it. **The
cadence of these frames is the body's, not the clock's**: each one is labelled
with where the body had got to, from `data-body-at`.

## The walk

| file | what it shows |
| --- | --- |
| `walk-full-1440.gif` | **the animated walk** — out of the gate, past the Queen and the Everyday flagstone, across the terrace, at 1440 × 900 on the `full` tier |
| `walk-full-1440-00-standing.png` | the Court as it has always opened. The body is standing by the gate; the Look camera still has the view, because the follow camera only takes over when you move |
| `walk-full-1440-01…09.png` | the walk. The follow camera trails behind and above; the feet are on `groundHeightAt` every frame |
| `walk-full-1440-10-arrived.png` | the key comes up and the body stands at the Knight's plinth |
| `walk-phone-390-*.png` | the same walk in a phone's column (390 × 844, `lite` tier) |
| `walk-lite-1440-*.png` | the `lite` tier at a desktop width, for the frame cost of a phone-class machine on a big stage |
| `walk-reduced-1440-*.png` | reduced motion: **the character still walks** — that is the app — and the camera cuts rather than swinging |
| `door-1440.gif` | **the Court to a door** — out of the gate, off the terrace and across the lawn to the Kitchen cottage |
| `door-1440-*.png` | the same, frame by frame (see below) |
| `walk-report.json`, `door-1440-report.json` | every sample behind the numbers below |

### Where the body actually went

`data-body-at` is `[x, y, z, yaw, speed]` in island units. The desktop walk,
frame by frame:

```
(0.95, 5.10) → (0.61, 4.07) → (0.15, 3.23) → (-0.43, 2.17) → (-0.95, 1.23)
   → (-1.41, 0.39) → (-1.93, -0.56) → (-2.40, -1.40) → (-2.92, -2.35) → (-3.44, -3.30)
```

9.47 units of ground in a straight line — the latched input basis at work; an
unlatched one walks you in a slow circle, and `test/harbour-body.test.ts` holds
that line to a displacement/distance ratio above 0.93.

The phone walk is the collision, in numbers. Heading almost due −z, it meets
the Queen and goes round her:

```
(0.95, 5.10) → (0.87, 3.82) → (0.80, 2.62) → (0.74, 1.55) → (0.89, 0.68) → (1.12, -0.06) → (1.04, -1.38)
```

`1.119` is exactly the Queen's own radius (0.95) plus the body's (0.17): the
push-out is perpendicular, so the walk slides round her rather than stopping.

### The Court across the lawn to a building's door

`door-1440-*.png`. W out of the gate, then W and D together from frame 4 to
steer west off the terrace. The body climbs the lawn's hump and ends standing
on the grass in front of the Kitchen cottage, its sign readable over his
shoulder — the door is still a door, still tappable, still a row in the quick
sheet; walking there is simply another way to arrive.

```
(0.95, 5.10) → (0.72, 4.28) → (0.15, 3.22) → (-0.31, 2.38)   ← W
   → (-1.35, 2.08) → (-2.39, 1.77) → (-3.42, 1.47) → (-4.34, 1.20)   ← W + D
   → (-5.50, 0.86) → (-6.88, 0.46) → (-7.80, 0.18) → (-8.72, -0.09) → (-8.89, -0.22)
```

11.3 units of ground. `data-harbour-body` reads `standing` on the first frame
and `following` from the second: the Court opens the way it always has, and the
follow camera takes the view the moment you move. Body cost over that walk:
0.079 – 0.252 ms a frame (one 0.398 on the last, after the key came up).

## The frame cost while walking

`data-body-ms` is the rolling mean of **one step of the walk plus the follow
camera's tick**, measured inside the frame the renderer lease already owns.
`data-render-ms` is what the GPU was asked for and `data-project-ms` is the DOM
twins; both are published by the review server already.

| run | tier | stage | body ms / frame | render ms (SwiftShader) | project ms | draw calls |
| --- | --- | --- | --- | --- | --- | --- |
| `walk-full` | `full` | 1440 × 900 | **0.12 – 0.20** (mean 0.16) | 51 → 6 as it warms | 0.26 – 0.40 | 416 → 234 |
| `walk-phone` | `lite` | 390 × 844 | **0.07 – 0.11** (mean 0.10) | 54 → 8 | 0.32 – 0.62 | 277 → 206 |
| `walk-lite` | `lite` | 1440 × 900 | **0.11 – 0.39** (mean 0.29) | 40 → 21 | 0.24 – 0.39 | 310 → 292 |
| `walk-reduced` | `full` | 1440 × 900 | **0.20 – 0.22** | 38 → 18 | 0.37 – 0.64 | 416 → 316 |

Read honestly:

- **The body's own cost is a fifth of a millisecond a frame** at the `full`
  tier and a tenth at `lite` — the walk, the collision push-out against 30-odd
  volumes, the ground sample, the gait, the footprints and the camera together.
  At the 30 fps the frame policy runs the world at, that is well under 1 % of a
  frame's budget. It is CPU work and these are CPU numbers, so they are the one
  set here that carries over to a real machine.
- **The render numbers do not.** SwiftShader draws every pixel on the CPU on a
  contended two-core box; the first frames of each run are the scene warming
  up. They are here for shape, not for a budget. Draw calls *are* real: the
  body adds **seven meshes and one footprint pool** — one group, and the pool's
  meshes are invisible until a foot lands.
- One outlier: the phone run's last sample reads 6.1 ms, taken after the key
  came up while four browsers and a typechecker shared two cores. Every other
  sample in that run is between 0.07 and 0.11.

## What is proved here, and what is not

Proved by the pictures: a person at village scale (0.58 units against the
Queen's 2.05), a follow camera that trails and looks over their shoulder, feet
that stay on the island's own profile, a walk that goes round the Queen instead
of through her, both compositions, both tiers, and reduced motion.

Not proved by the pictures, proved by `test/harbour-body.test.ts` (36 tests):
the shore stopping you before the sea, push-out against a building being
perpendicular and idempotent, the tree ring matching the trunks
`scene/ground.ts` actually plants, the follow camera standing behind the body
at every heading, and the frame policy coming back to rest with nothing queued.

Not proved at all, and stated as a limitation: how it feels at 60 fps on a real
GPU. Nothing in this environment can show that.
