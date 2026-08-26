# Hercules Rig — AI animation engine

**Status:** ACTIVE on branch. The live kitchen cat can be puppeteered part-by-part by any agent with access to the dispatch API.

Hercules is drawn as one SVG with independently controllable parts: **head**, **ears**, **tail**, **body**, **ruff**, **legs**, **legFront**, **legBack**, **bag**, **whiskers**, **eye**, **eyeShut**, and **root** (whole cat). The engine never posts money, never reads the ledger, and never gains Command authority.

## Architecture

```text
AI / Worker / console
        ↓  HerculesRigCommand
HerculesRigEngine (pure TS, rAF loop)
        ↓  RigSnapshot (per-part transforms)
HerculesFigure (inline SVG transforms)
```

Built-in **pose clips** mirror `hercules.css` (loaf, walk, pounce, beg, …). **Idle overlays** (breathe, tail wag, blink) run unless a pose owns that part. **Mood** modifiers layer on top. **AI overrides** win for the named part until cleared or `holdMs` expires.

## Quick start (browser console)

When the live cat is mounted:

```javascript
hearthRig().playPose("beg");
hearthRig().setPart("head", { rotate: -12, translateY: -6 });
hearthRig().setPart("tail", { rotate: -40 });
hearthRig().dispatch({ type: "blendTo", parts: { legFront: { rotate: -30 } }, durationMs: 400 });
```

## TypeScript API

```typescript
import {
  dispatchHerculesRig,
  registerRigClip,
  readHerculesRigState,
  RIG_PARTS,
  type HerculesRigCommand,
} from "./herculesRig/index.ts";

// Play a named pose
dispatchHerculesRig({ type: "playPose", pose: "attack" });

// Direct part control — each leg and the head are separate
dispatchHerculesRig({
  type: "setParts",
  parts: {
    head: { rotate: 8, translateY: -3 },
    legFront: { rotate: -20, translateY: -5 },
    legBack: { rotate: 15 },
    tail: { rotate: -35 },
  },
  holdMs: 1200,
});

// Register a custom clip other agents can reuse
registerRigClip({
  id: "slow-blink",
  durationMs: 3000,
  loop: true,
  keyframes: [
    { t: 0, parts: { eye: { scaleY: 1 } } },
    { t: 0.48, parts: { eye: { scaleY: 1 } } },
    { t: 0.5, parts: { eye: { scaleY: 0.08 } } },
    { t: 1, parts: { eye: { scaleY: 1 } } },
  ],
});
dispatchHerculesRig({ type: "playClip", clipId: "slow-blink" });
```

## Command vocabulary

| Command | Purpose |
|---------|---------|
| `setPart` | Set one part transform; optional `holdMs` |
| `setParts` | Batch part transforms |
| `playPose` | Built-in pose clip (17 poses) |
| `playClip` | Any registered clip id |
| `blendTo` | Smooth transition over `durationMs` |
| `clearOverrides` / `clearOverride` | Release AI holds |
| `queue` | Ordered macro |
| `wait` | Pause queue (ms) |
| `reset` | Loaf pose, clear overrides |

## Part ids (`RIG_PARTS`)

`root`, `tail`, `body`, `ruff`, `head`, `ears`, `legs`, `legFront`, `legBack`, `bag`, `whiskers`, `eye`, `eyeShut`

DOM groups expose `data-herc-part="{id}"` for debugging and computer-use targeting.

## Transform fields

Each part accepts:

- `rotate` (degrees)
- `translateX`, `translateY` (viewBox px)
- `scaleX`, `scaleY`
- `opacity`
- `visible` (false → `display: none`)

Pivots match `hercules.css` (e.g. head pivot 72×92 in the 200×200 viewBox).

## Boundaries

- **Money:** rig commands cannot post, draft, or Confirm.
- **Privacy:** rig state is session UI only; not synced to household snapshot.
- **Mobile / reduced motion:** engine respects `prefers-reduced-motion` (static frame 0).
- **Wardrobe stills:** `HerculesPortrait` without `HerculesRigProvider` keeps CSS pose classes.

## Extending

1. `registerRigClip({ id, durationMs, loop, keyframes })`
2. `dispatchHerculesRig({ type: "playClip", clipId: id })`

For Worker integration, add a bounded `/hercules/rig` route that accepts `{ commands: HerculesRigCommand[] }` and forwards to the client via SSE or postMessage — **not shipped in this slice**.

## Related

- Drawing: `src/HerculesFigure.tsx`
- Engine: `src/herculesRig/`
- Canon: `docs/HERCULES_MARK.md`, `docs/OFFICE.md` (furniture registry is separate from part rig)
