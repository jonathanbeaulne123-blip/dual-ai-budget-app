# Walking, with the feel turned up

A run across the island, photographed on the fictional loopback review house
(`scripts/serve-whole-house-review.mjs`, `/__review?member=MEM-001&seed=demo`).
Nothing here touched a hosted service.

**`run-1000.gif`** — seventeen frames: standing at the Court's gate, Shift+W
held out through the trees, a hard lean right across the lawn, and the pull-up
on the shore. **22.2 units of island covered at a top speed of 4.0 units a
second**, which is the whole point of the branch: the same crossing used to be
a stroll at 1.5, and Shift used to be 2.6.

What to look for, in order of how hard it lands:

1. **It is fast.** The Court's terrace goes past in two frames.
2. **The turns are led, not reported.** The body rolls into the new heading on
   the frame the key goes down — `bank` comes from the *heading error*, not
   from the turn already made (`body/bodyModel.ts`).
3. **Dust.** Every footfall of a run throws a puff, and pulling up bursts under
   both feet. A fixed pool, one shared geometry, nothing allocated while
   walking (`body/dust.ts`, built to `footprints.ts`'s rule).
4. **The camera opens out.** Above a walk the eye dollies back 0.62, the lens
   widens 5.5°, and the look-at lags — and all three come back in on the
   settle. Indoors the whole thing stands down: the room's own
   `holdPoseInRoom` is still the last word.
5. **Weight.** A squash on each landing, a deeper bob at a run, arms that pump,
   and a pitch forward off the mark that keeps going after the speed has
   settled — then back into a skid when you let go.

## Numbers

`run-report.json` carries every frame's `data-body-at` (x, y, z, yaw, speed),
`data-render-ms`, `data-body-ms` and `data-draw-calls`, read off the stage
while the body was running. The body's own step cost **0.12–0.14 ms a frame**
across the crossing, and the render stayed between 8 and 24 ms on SwiftShader —
which draws every pixel on the CPU, so a screenshot takes seconds and the run
carries on underneath it. That is why the frames are two units apart rather
than a sixtieth of a second: the cadence is the body's, not the clock's.

## Reproducing

```sh
node scripts/serve-whole-house-review.mjs &
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
  python3 scripts/capture-walk-feel.py docs/evidence/walk-feel
python3 scripts/make-world-body-gif.py docs/evidence/walk-feel \
  --label=run --width=1000 --scale=0.6 --ms=300
```

Reduced motion is not pictured because there is nothing to picture: the body
walks exactly as it does here and every flourish above is simply off — no dust,
no lean, no bank, no squash, and the camera cuts instead of swinging.
`test/harbour-body.test.ts` holds that promise.
