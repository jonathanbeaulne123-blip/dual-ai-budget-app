# Hercules mark and figure

**Supersedes** the “Hercules redrawn” brief’s §2a / §2b / §4. The mark and the 96px character are drawn. §2c (furniture targeting), §5 (the fly and drag collisions), and the `useFurniture` publish path are implemented here too.

Do not redo the ink paths. Do not scale the mark down for the tab icon. Do not put `models/hercules.source.glb` on the kitchen Worker.

## What ships at runtime

| Surface | File | Why |
|---|---|---|
| Live cat (96px, 72px on Add) | `src/HerculesFigure.tsx` + `src/hercules.css` | One drawing, six parts, pose class on the root. |
| Wardrobe still | same figure, `size="stage"` | Cosmetics overlay; equipped `ruff` is a no-op (the mane is already there). |
| In-app mark | `public/hercules-mark.svg` | Front-facing, `currentColor`. |
| Tab icon | `public/favicon.svg` | Separate file. Heavier stroke, no muzzle, own `prefers-color-scheme`. |
| 3D source | `models/hercules.source.glb` + `models/hercules.mtl` | Anatomy and physical palette. **Not** bundled into `dist/`. |

Together the two SVGs replace `public/icon.png` (~822 KB).

## Coat

`--herc-coat: #fdfbf6` on `--paper`, `--herc-spot: #c9a884` dapples at 13–28% opacity, asymmetric. Line `--herc-ink` falling back to `--ink`. That replaces the brown-gradient cat (`#c4a574 → #8b5a2b → #3c2412`).

The GLB’s `furWhite` is warmer (`#e2d6c0`). Keep that on the 3D source. Do not retune the 96px cat to match it or he punches a hole in the paper.

## Rig

Paint order is load-bearing:

```
tail → body → ruff → head → legs → ground
```

**The ruff sits under the head.** That hides the neck join so the head can tilt. Drawing the ruff over the head produced the napkin.

Flip is an outer wrapper (`scaleX(-1)`). Pose animations also set `transform` on `.herc`; they must not share a node.

Clip-path ids are unique per instance (`useId`), so the live cat and the wardrobe still can coexist.

`HerculesFigure` does not import `src/core/` and cannot post money.

## Motion

Timing carries him. At 96px almost none of the drawing survives.

- Idle is never still: slow breath + drifting tail under every pose.
- Tail is the primary expressive organ.
- `pounce` opens with a butt wiggle, then launch (the fly is the usual target).
- `attack` is a raised-paw lunge at a `warn` instrument, not a bigger bump translate.
- Squash/stretch on jump. Slow blink every 6.5s.
- `hide` scales down and folds ears.
- Reduced motion: animations off; each pose still a distinct static silhouette.

## Weaknesses (aim here; do not silently “fix” the drawing)

- **No back legs** on the SVG. Two front legs and a body mass. Fine for sit, loaf, perch, sleep. A visible cheat in walk and pounce. The GLB *has* hind legs; that is source, not a mandate to redraw.
- **`bump` and `attack`** were both X-axis lunges. Attack now raises a paw. They may still read close at 96px.
- **Only faces left or right.** Sill perch is profile along the ledge. There is no looking-out-the-window drawing. Do not invent a three-quarter view unless Jonathan asks.
- Tail crosses the body outline in `sleep`.

## Furniture, fly, publish

- `perchTarget` lands on live widget rects. Sill uses the left or right of the ledge, facing along it.
- `attackStand` puts him beside the warning instrument, facing it.
- Dragging the cat across an instrument emits `bump` (existing 3px nudge). No clink. `pointer-events: none` while Add is open.
- The fly is a 16px mote. It never carries CAD, Health, or a notice. Reduced motion hides it. Mobile does not render it. On desktop he may `pounce` or be dragged across it to catch it, carry it to the litter box above More, and drop it into an unbounded session-only pile. Dropping spawns a new fly; dragging him over an existing pile without a carried fly clears the pile.
- The litter pile is not persisted. It is play state, not household state, a streak, a balance, or a care meter. `keepHerculesOutOfLitter` applies to automatic lands, perches, attacks, and pounces; only a person may drag him into that bottom-right zone.
- `useFurniture` publishes on mount, resize, scroll, and rAF while a widget is being dragged. **No 100ms `setInterval`.**
