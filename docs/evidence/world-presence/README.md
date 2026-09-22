# World presence — two clients, one island

**Claim being evidenced: one person, in their own browser, sees their partner
walking in the Court, live.**

Every still here is Sam's screen. Alex is in a *separate Chromium instance*,
signed in as a different member of the same fictional household, walking the
Court with W/A/S/D. Both are talking to the loopback whole-house review server
(`scripts/serve-whole-house-review.mjs`) — a real `LedgerRoom` Durable Object,
the real `/ledger-sync/v2/.../socket?lane=presence` socket, local dev auth. No
hosted service is touched and the household is fictional.

Reproduce with `node scripts/serve-whole-house-review.mjs`, then
`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/capture-world-presence.py <out-dir>`.

| still | what Sam's page had received | what Sam's page says |
| --- | --- | --- |
| `01-sam-sees-alex-standing.png` | Alex at `(0.5, 0.9)`, 1 ms old | the body stands on the flagstone |
| `02-sam-sees-alex-walked.png` | Alex at `(0.5, 0.9)`, 1 ms old | — |
| `03-sam-sees-alex-walked-again.png` | Alex at `(1.639, 2.984)`, 4 ms old | "Alex (fictional) is here in the Court" |
| `04-sam-after-alex-stops-sharing.png` | Alex turned **Walk together** off | the body is gone; the honest pin is back |

`sam-sees-alex-move.gif` is stills 1 → 3 → 4 in sequence: the body on the
flagstone, the body two metres nearer the camera, then no body at all once the
consent is withdrawn.

`two-client-capture.json` is the machine-readable run: every one of the 46
world-lane frames Sam's page actually received, each stamped by the **server**
with `memberId: "MEM-001"`, `deviceId: "MEM-001:DEV-…"` and `placeId: "court"`
— the identity is the Durable Object's word, re-derived from the authenticated
scope, never the sender's claim. Nothing on the lane but a place, two metres
and an angle.

## The Court's own count

A cheaper, sharper reading of the same thing is the renderer's draw count on
Sam's page (`.house-world__canvas[data-draw-calls]`), sampled while Alex walked:

```
draw 390  no partner at all
draw 392  the pin only            — "Alex (fictional) was here recently"
draw 396  the body                — "Alex (fictional) is here in the Court"
```

It rises when a fresh sample lands and falls back to the pin when the feed goes
stale, which is the product law this lane is built on: **a body drawn walking is
always drawn from a sample less than two and a half seconds old.**

## A caveat, stated plainly

These captures run on SwiftShader with two WebGL worlds on one machine, and a
single screenshot of the Court takes tens of seconds. While a page is being
screenshotted its timers stall, so its own heartbeat lapses and the partner's
feed goes stale — which is why some stills in a run catch the honest
"was here recently" pin rather than a body. That is the lane behaving correctly
under a starved client, not a flaw in the capture. The stills above were each
taken within 4 ms of a frame landing.

The tightest proof of the wire itself is not a picture at all:
`test/world-presence-worker.test.ts` drives two authenticated members through
the real Durable Object over real WebSockets, and asserts that the receiving
side reconstructs a smooth monotonic path from the frames — through the same
`worldMotion.ts` track the Court renders from.
