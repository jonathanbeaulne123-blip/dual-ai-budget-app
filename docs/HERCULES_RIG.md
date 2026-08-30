# Hercules Rig — AI animation engine

**Status:** ACTIVE. Base engine on `main`; remote Worker route, MCP dispatch, and furniture macros ship with PR #167.

Hercules is drawn as one SVG with independently controllable parts: **head**, **ears**, **tail**, **body**, **ruff**, **legs**, **legFront**, **legBack**, **bag**, **whiskers**, **eye**, **eyeShut**, and **root** (whole cat). The engine never posts money, never reads the ledger, and never gains Command authority.

## Architecture

```text
AI / Worker / console
        ↓  HerculesRigCommand
HerculesRigEngine (pure TS, adaptive deadline scheduler)
        ↓  RigSnapshot (per-part transforms)
HerculesFigure (inline SVG transforms)
```

Built-in **pose clips** mirror `hercules.css` (loaf, walk, pounce, beg, …). **Idle overlays** (breathe, tail wag, blink) run unless a pose owns that part. **Mood** modifiers layer on top. **AI overrides** win for the named part until cleared or `holdMs` expires.

The engine sleeps between updates instead of publishing React state on every browser frame. Visible ambient motion runs at 8 fps (`content` / `glowing`), 12 fps (`restless`), or 6 fps (`hiding` and the compact phone portrait); short reactions run at 24 fps. The SVG transition window lets the compositor interpolate between engine-issued snapshots. Hidden and reduced-motion presentations schedule no continuing engine work.

## Quick start (browser console)

When the live cat is mounted:

```javascript
const session = hearthRig().sessionId(); // share with remote agents
hearthRig().playPose("beg");
hearthRig().setPart("head", { rotate: -12, translateY: -6 });
hearthRig().setPart("tail", { rotate: -40 });
hearthRig().dispatch({ type: "blendTo", parts: { legFront: { rotate: -30 } }, durationMs: 400 });
```

## Remote dispatch (Worker + MCP)

**Kitchen Worker routes** (presentation-only queue):

| Route | Method | Body / query |
|-------|--------|----------------|
| `/hercules/rig` | POST | `{ sessionId, commands }` → `{ ok, queueId, at, accepted }` |
| `/hercules/rig/poll` | GET | `?sessionId=…&since=…` → `{ ok, entries[] }` |

After `hearthRig().sessionId()` explicitly activates a remote rig session, the live kitchen tab polls every 2s (and on focus) via `startHerculesRigPoller` inside `HerculesRigProvider`. An ordinary kitchen session makes zero rig polling requests. Commands are validated and bounded server-side (`src/herculesRig/validate.ts`).

**MCP tool (Hercules Pro):** `hercules_rig_dispatch`

```json
{
  "sessionId": "<from hearthRig().sessionId()>",
  "commands": [{ "type": "playPose", "pose": "perch" }]
}
```

Returns `{ status: "queued", queueId, at, accepted, readOnly: true, postedNothing: true }`.

## Furniture expand macros

When a desk instrument expands on Home, `HerculesOfficeRigBridge` runs a macro from `src/herculesRig/macros.ts` — e.g. wallet → perch + head tilt + front leg shift; calculator → pounce + tail flick. Extend `EXPAND_RIG_MACROS` or register clips in `installRigMacroClips()`.

## Autonomous fly pounce

On desktop, ten seconds without pointer, keyboard, wheel, drag, chat, or Office interaction gives Hercules one fly-pounce opportunity for that human-idle period. The engine plays the 650 ms `idle-fly-pounce` clip and the presentation moves him toward the fly's current position. The existing overlap check decides capture at the capture frame; only a real overlap increments the existing litter-box fly count. A miss returns quietly to the current mood/pose. Human activity resets eligibility. Reduced motion, hidden pages, Add, pinned state, open chat, and focused Office instruments suppress the chase.

## Chat trigger words

When the user or Hercules mentions a trigger word in mobile focus or desktop chat, `dispatchChatRigTriggers` plays a rig reaction (`src/herculesRig/chatTriggers.ts`):

**Budget (10):** budget, groceries, rent, savings, paycheck, bill, visa, confirm, balance, expense

**Cat (10):** mrrp, purr, treat, fly, nap, tail, pounce, loaf, whiskers, meow

At most one budget + one cat animation queue per message. Mobile focus hero uses `HerculesLivePortrait` so rig clips are visible.

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
- **Mobile / reduced motion:** compact mobile motion uses the lower ambient cadence; `prefers-reduced-motion` keeps a static frame and schedules no continuing engine work.
- **Wardrobe stills:** `HerculesPortrait` without `HerculesRigProvider` keeps CSS pose classes.

## Extending

1. `registerRigClip({ id, durationMs, loop, keyframes })`
2. `dispatchHerculesRig({ type: "playClip", clipId: id })`
3. Add furniture reactions in `EXPAND_RIG_MACROS` (`src/herculesRig/macros.ts`)

## Related

- Drawing: `src/HerculesFigure.tsx`
- Engine: `src/herculesRig/`
- Canon: `docs/HERCULES_MARK.md`, `docs/OFFICE.md` (furniture registry is separate from part rig)
