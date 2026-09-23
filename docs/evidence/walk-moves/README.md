# The moves — a jump, a slide, and something to say

`moves-1000.gif` is one run across the Court's lawn: the body gathers to a
run, jumps out of it (the anticipation crouch, the arc, the landing), drops
into a slide, stands up, and waves. The frames it is made of are beside it,
and `moves-report.json` carries what the stage's own diagnostics said at each
one — `at` is `[x, y, z, yaw, speed]`, and `y` is the **feet**, so the ground
under them plus whatever of the jump is left.

Read against that report, the arc in this run tops out at **0.482 above the
ground** — a body is 0.58 tall — and the slide enters at **4.38 units a
second**, which is the run's 4.0 with `SLIDE_BOOST` on it, and gives it up
from there.

Taken with `scripts/capture-walk-moves.py` against
`scripts/serve-whole-house-review.mjs` at `/__review?member=MEM-001&seed=demo`.

## Why it is in slow motion

SwiftShader draws every pixel on the CPU and manages about a frame a second
at this size, and a screenshot stops the world while it is being taken. A run
survives that — it lasts as long as you hold the key. A jump does not: it is
over in three quarters of a second, so at the camera's real cadence the whole
arc falls between two frames and the evidence would be two pictures of
somebody standing.

So the harness scales the clock the world is drawn against, and nothing else:
`requestAnimationFrame` is wrapped so the timestamp every callback receives
advances at a fraction of real time. The runtime reads that timestamp for its
own `dt`, so the body, the dust, the camera and the frame policy all run
exactly as they do and in exactly the proportions they do, with the second
stretched. **No app code is touched and no constant is changed** — this is a
slow-motion camera pointed at the real thing, not a different body.

One consequence is visible in the capture script and is worth stating plainly:
the slide is asked for on several frames rather than one, because a slide is
refused while the feet are off the ground, and at a twentieth of real time the
landing is several frames after the key. That is the rule doing its job.
