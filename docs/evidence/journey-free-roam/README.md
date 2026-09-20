# Free roam in the journey's open world — browser evidence (D-286)

Produced by `node scripts/capture-journey-free-roam.mjs` on the real Our Path page through
`scripts/serve-our-path-world-proof.mjs`. **Fictional habitats only** — a generated demo household with a fictional
Journey of Life laid on it through the real commands (`?eras=demo`). No real household data, and nothing here posts.

Headless Chromium at `/opt/pw-browsers/chromium` with `--use-gl=swiftshader --enable-webgl --ignore-gpu-blocklist
--enable-unsafe-swiftshader`. 320 / 390 / 720 / 1100 × Classic Hearth, Taylor's Scrapbook and Newfoundland, plus a
reduced-motion pass at 390. Lite quality below 720, Full at and above it, ambient motion off.

## The shots — `<theme>-<width>-<step>.png`

| Step | What it shows |
| --- | --- |
| `1-latched` | The world as it opens. The camera is on the two of you; **Free roam** sits beside Minimize, unpressed. |
| `2-taken` | The unlatch moment: the quiet one-line notice, "You've taken the camera — Return to us". |
| `3-hint` | The first-time hint: every way of moving, with **Got it**. Remembered per device. |
| `4-roam-island` | Roaming across the island — the camera dropped toward the horizon and glided, land running to a horizon with the era islands and their bridge beyond. |
| `5-roam-future-islands` | Out over the future era islands, which only the widened roam ring reaches. |
| `6-radar-cone` | The corner radar on its own: the land as circles, the two of you as their own mark, the camera and the wedge it sees. |
| `7-keyboard-roaming` | Keyboard roaming with the canvas wrapper focused and ringed. |
| `8-reduced-roaming` (390) | Reduced motion: the camera moves while a key is held and stops dead when it is let go. |
| `9-relatched` | **Return to us**: latched again and flown home; the chip and the radar are gone. |

## The measurements — `report.json`

Every shot records `pageErrors`, `consoleErrors`, `overflow`, `smallTargets`, `hudOverlaps`, `offscreen`, plus the
mode (`roaming`, `roamPressed`), the state chip, the first-time hint, the canvas wrapper's `role` and `aria-label`,
the polite announcement, the caption, where focus is, and the radar's camera transform.

**Across all 99 shots: no page errors, no console errors, no horizontal overflow, no HUD control under 44px, no HUD
overlaps, nothing off screen.**

`smallTargets` covers the HUD's own controls and the radar. The compact simple view's own zoom chips inside the
corner map are 30px by D-284's design (36px on coarse pointers); they are counted separately as `miniChipTargets`
rather than hidden.

Alongside them:

- `<theme>-<width>-radar.json` — the exact `roamView` the radar was drawn from.
- `<theme>-<width>-keyboard.json` — how far Shift+W moved the camera and how far E turned it, and that focus was on
  `path-world__host`. Measured range across the matrix: 44–151 world units moved, 0.75–3.7 radians turned.
- `<theme>-390-reduced.json` — `driftAfterRelease`, which is **0** in all three themes: reduced motion carries no
  inertia at all.

## Environment honesty

- Software WebGL draws about two frames a second on this page, and a frame advances at most 50ms of camera time, so
  a held key covers roughly a thirtieth of the ground it would on a real device. The keyboard step therefore holds
  keys for several seconds and records the measured displacement rather than relying on the picture alone. Gestures
  (drag, right-drag, pinch, wheel) change the camera on the pointer event itself and are unaffected.
- For the same reason the quiet "You've taken the camera" line can expire before a screenshot lands. The script
  checks, and if it has, latches and unlatches once from the control so the moment is still captured; `takenBy` in
  each `2-taken` row records whether the drag itself or the control was the one photographed.
- No real phone was measured. Two-finger twist is implemented but was exercised only with mouse gestures.
