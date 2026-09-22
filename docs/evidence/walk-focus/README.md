# Walk focus — pressing W with no click at all

The walk shipped in #521 and nobody could reach it. `onKeyDown` on the stage
only fires while the stage holds the keyboard, and no `.focus()` existed
anywhere in `HarbourWorld.tsx`. So this is not a photograph of walking —
`docs/evidence/walk-everywhere/` already has those, and note that the script
which took them had to call `.focus()` on the stage by hand first. This is a
photograph of the **journey**: land on the page, touch nothing, press W.

Captured on the loopback review server (`scripts/serve-whole-house-review.mjs`,
fictional household, no hosted service) with `scripts/capture-walk-focus.py`,
at a desktop's 1440 with a keyboard and a phone's 390 with a touch screen.

## Before — unmodified `origin/main` @ 967d07b7

`before/` is the same probe run against the base, in a separate worktree.

| Width | Who held the keyboard on arrival | W held for 1.5 s |
| --- | --- | --- |
| 1440 | `document.body` | the body moved **0.0 units** |
| 390 | `document.body` | the body moved **0.0 units** |

The keys never reached the stage, so the walk never started. And clicking the
world would not have helped either: `scene/runtime.ts` `onPointerDown` cancels
the pointer's default action, and a cancelled `pointerdown` cancels the focus
the browser was about to give. On the base the only way to reach the walk at
all was to press Tab until you landed on the stage.

## After

| Width | Who held the keyboard on arrival | W held for 1.5 s |
| --- | --- | --- |
| 1440 | `.harbour-world__stage` | the body moved **1.09 units** |
| 390 | `.harbour-world__stage` | the body moved **1.04 units** |

| Frame | What it is |
| --- | --- |
| `*-1-landed.png` | The page, arrived at. No click, no tap, no Tab. The stage holds the keyboard and says nothing, because there is nothing to say. |
| `*-2-walked.png` | W held. The character has moved — the only input in the whole run is that key. |
| `*-3-unfocused-hint.png` | Shift+Tab has carried the keyboard off the stage, so the stage says how to get it back. |
| `*-4-tabbed-focus-ring.png` | Tab back on. A keyboard focus is a **visible** focus: the ring, drawn inward over the canvas. |
| `*-5-pressed-no-hint.png` | One press on the open ground. The stage has the keyboard, the line is gone, and a pointer gets no ring. |

The invitation, in the app's own voice, from `inviteWords`:

* **1440, a keyboard** — `Click the island · then W A S D walks you around it`
* **390, a touch screen** — `Tap the open ground to walk there · drag to look around you`

A phone has no W to press, so on a coarse pointer the keys are not mentioned at
all. The ground changes with the place exactly as `stageWords` changes it: the
island, the fire, the room.

`walk-focus-report.json` has every step of both runs — who held the keyboard,
where the body was, what the stage was saying, and the tier it drew at.

## Two capture-side notes, neither of them the product

* The shell warms all eleven place chunks at idle and eleven concurrent Vite
  dev module graphs never land on this box, so `requestIdleCallback` is stubbed
  out. Same workaround as `capture-walk-everywhere.py`, same reason.
* Headless Chromium paints a page it does not believe is focused without its
  focus ring, so the capture turns on `Emulation.setFocusEmulationEnabled`.
  Nothing about the app changes; the ring is the app's own.
