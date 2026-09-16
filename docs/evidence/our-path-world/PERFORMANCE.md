# Our Path world: does the loop stop? (2026-09-15)

**No real phone was available. These are SwiftShader numbers in a headless Chromium. They only show that the loop stops. They say nothing about real frame rate or battery.**

## What changed

- **The tent.** Opening the Plan Studio tent now puts the world to sleep (`world.sleep()`): the frame loop stops and the WebGL context stays. Coming back calls `world.wake()`, which measures the host again, draws, and reports anchors. Before this change, the tent destroyed the context and built a new one.
- **Idle pause.** With ambient motion on, the loop now stops after `IDLE_MS = 20 000` ms with no pointer, wheel, keyboard or touch input and no scene change. The next input or `invalidate()` starts it again. It also stops while the canvas is scrolled fully out of view (`IntersectionObserver`, skipped where it doesn't exist) and, as before, while the document is hidden.
- **Quality tier.** Full keeps soft shadows (1536² map), the decor animations and today's pixel-ratio cap of 1.5. Lite turns off the shadow map and the sun's shadow, caps pixel ratio at 1.25 and skips the decor animations (orbit, flutter, spin). Each device picks its own default: Lite for reduced motion, `hardwareConcurrency ≤ 4`, `deviceMemory ≤ 4`, or a coarse pointer under 720px wide; Full otherwise. Your choice is saved on the device in `hearth:pathWorld:quality`.

## How it was measured

- Proof server: `node scripts/serve-our-path-world-proof.mjs` on port 5193.
- URL: `/path-proof?theme=taylor&story=well&motion=full&quality=full|lite`, plus `&idle=off` for the "before" run.
- `idle=off` is a proof-only setting that turns off the idle pause (`idleMs: Infinity`). It stands in for the loop before this change, which never paused while ambient motion was on. The scroll pause and the tent sleep stay active in that run, but the canvas stayed on screen with the tent closed, so they had no effect.
- Frames come from `window.__pathWorldStats().frames`. Only the proof page sets that global; the app never does.
- Setup: Chromium 1194 (`/opt/pw-browsers`), `--use-angle=swiftshader`, 1100×900 viewport, devicePixelRatio 1, fictional `habitat-well` books. Each run starts with a mouse drag on the canvas.
- Measurement windows: 1 to 11 s after the drag (ambient drift) and 22 to 32 s after the drag (past `IDLE_MS`).

SwiftShader renders on the CPU. Here it drew about one frame a second, so the absolute counts are tiny. The number that matters is zero versus non-zero.

| Quality | Idle pause | Frames 1–11 s (drifting) | Frames 22–32 s (idle window) | `idle` flag at 32 s |
|---|---|---|---|---|
| full | off (before) | 11 | **11** | false |
| full | on (after) | 11 | **0** | true |
| lite | off (before) | 14 | **17** | false |
| lite | on (after) | 13 | **0** | true |

Tent and scroll checks (full quality, idle pause on):

| Check | Result |
|---|---|
| Frames in 10 s with the tent open | **0** (`sleeping: true`) |
| Same world after the tent? | Yes: the frame counter went from 39 to 42 and did not reset. A newly built world would start again at 0. |
| Canvas size after the tent | 1050×646 backing store, matching the host's 1050×646 client size; 4 marks shown |
| Frames in 10 s with the canvas scrolled out of view | **0** |
| Frames within 1.5 s of scrolling back | 3 |

## What these numbers don't show

- Real GPU frame time, thermal behaviour or battery use on Jonathan's or Bianca's phones.
- Whether Lite looks acceptable on a real phone screen. The pixel-ratio cap and the missing shadows need someone to look at a real device.
- `lastFrameMs` only times the JavaScript side of `render()`, so it was left out as a cost comparison.

## Hidden-host note

The island section uses `hidden`, and `.path-world [hidden]` sets `display: none`. While the tent is open, the host therefore measures 0×0. `resize()` ignores zero sizes, so the ResizeObserver's 0×0 report while hidden changes nothing. `wake()` runs in a React effect after the section is shown again, reads `clientWidth` and `clientHeight` at that point, and resizes only if the size changed. For example, the phone may have rotated while the tent was open.
