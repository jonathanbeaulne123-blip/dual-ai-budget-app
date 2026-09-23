"""Little Harbour · the moves: a jump and a slide out of a run, and a wave.

  node scripts/serve-whole-house-review.mjs &
  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/capture-walk-moves.py <out-dir>

**Why the world is slowed down here and is not in `capture-walk-feel.py`.**
SwiftShader draws every pixel on the CPU, so one screenshot takes a second or
more of wall clock. A run lasts as long as you hold the key and can be
photographed frame by frame at that rate; a *jump* is over in half a second
and a slide in three quarters of one, so at the camera's real cadence the
whole arc falls between two frames and the evidence is two pictures of
somebody standing.

So the harness scales the clock the world is drawn against — and nothing
else. `requestAnimationFrame` is wrapped so the timestamp handed to every
callback advances at `SLOW` of real time; the runtime reads that timestamp for
its own `dt` (`scene/runtime.ts`), so the body, the dust, the camera and the
frame policy all run exactly as they do, in exactly the proportions they do,
with the second stretched. No app code is touched and no constant is changed:
this is a slow-motion camera, not a different body.

`requestIdleCallback` is stubbed out exactly as `capture-walk-everywhere.py`
does it: the shell's idle warm pass saturates the dev server on this box.
Nothing here touches a hosted service.
"""
import json, os, sys, time
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
WIDTH, HEIGHT = 1000, 620
SLOW = 0.05
BASE = "http://127.0.0.1:4186/__review?member=MEM-001&seed=demo"
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"]
app = json.dumps({"appearance": {"theme": "classic", "atmosphere": False}, "pending": False})
INIT = (f"localStorage.setItem('hearth:appearance:v1:development:guest', {json.dumps(app)});"
        " localStorage.removeItem('hearth:motion'); sessionStorage.clear();"
        " Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });"
        " window.requestIdleCallback = () => 0; window.cancelIdleCallback = () => {};"
        # The slow-motion camera. One wrapper, one multiplier, nothing else.
        # The scaled clock is *accumulated* rather than recomputed, so the
        # multiplier can be turned down for the half-second a jump lasts and
        # back up afterwards without the world jumping a single frame.
        f" (() => {{ const raw = window.requestAnimationFrame.bind(window);"
        f"   let last = null, clock = 0; window.__slow = {SLOW};"
        f"   window.requestAnimationFrame = (cb) => raw((t) => {{ if (last === null) last = t;"
        f"     clock += (t - last) * window.__slow; last = t; cb(clock); }}); }})();")
os.makedirs(OUT, exist_ok=True)


def numbers(page):
    return page.evaluate("""() => { const h=document.querySelector('.house-world__canvas'); if(!h) return null; const d=h.dataset;
      return {at:d.bodyAt?JSON.parse(d.bodyAt):null, drawCalls:d.drawCalls?Number(d.drawCalls):null,
              renderMs:d.renderMs?Number(d.renderMs):null, bodyMs:d.bodyMs?Number(d.bodyMs):null}; }""")


report = []
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1)
    ctx.add_init_script(INIT)
    page = ctx.new_page(); page.set_default_timeout(240000)
    page.goto(BASE, wait_until="domcontentloaded")
    page.wait_for_selector(".harbour-world[data-world-status='ready']", timeout=180000)
    page.wait_for_timeout(2500)
    page.evaluate("""() => { for (const b of document.querySelectorAll('button')) { const w=(b.textContent||'').trim(); const l=b.getAttribute('aria-label')||''; if (w==='\\u00d7'||/dismiss|close this note/i.test(l)) b.click(); } }""")
    page.evaluate("() => document.querySelector('.harbour-world__stage')?.focus()")
    page.keyboard.press("Escape"); page.wait_for_timeout(1200)

    n = 0

    def shot(tag):
        global n
        name = f"moves-{WIDTH}-{n:02d}-{tag}.png"
        n += 1
        t0 = time.time()
        page.screenshot(path=os.path.join(OUT, name), timeout=240000)
        row = {"frame": name, "seconds": round(time.time() - t0, 2), **(numbers(page) or {})}
        report.append(row); print(name, row.get("at"), flush=True)

    shot("standing")
    # ── The run-up. Curved, so the body stays out on the open lawn.
    #    It comes first because the Court's opening screen is a diorama until
    #    you actually move: the follow camera — and with it any view of the
    #    body at all — is something walking earns. ────────────────────────────
    page.keyboard.down("Shift"); page.keyboard.down("w"); page.keyboard.down("d")
    for _ in range(2): shot("running")
    # ── The jump, out of a run: the crouch, the rise, the top, the fall, the
    #    ring of dust it lands in. ─────────────────────────────────────────────
    page.keyboard.press("j")
    for _ in range(12): shot("jump")
    # ── The slide: down into the crouch, the skid, and standing up again.
    #    Asked for on every frame rather than once, because a slide is refused
    #    while the feet are off the ground — which is the rule, not a fault,
    #    and at a twentieth of real time the landing is several frames away. ──
    for _ in range(10):
        page.keyboard.press("k"); shot("slide")
    page.keyboard.up("w"); page.keyboard.up("d"); page.keyboard.up("Shift")
    for _ in range(2): shot("up")
    # ── And something to say. Burned to a standstill first, without a
    #    screenshot, because an emote stops the moment you move and a body
    #    still coasting out of a slide is still moving. ─────────────────────
    # SwiftShader draws about one frame a second here and the runtime caps a
    # step at 80 ms however long the gap was, so "wait for the body to stop"
    # is counted in rendered frames rather than in seconds: the multiplier
    # goes past the cap so every one of them is a full step, and the emote is
    # asked for again on each shot until it sticks.
    page.evaluate("() => { window.__slow = 2; }")
    page.wait_for_timeout(14000)
    page.evaluate(f"() => {{ window.__slow = {SLOW}; }}")
    for _ in range(3):
        page.keyboard.press("1"); shot("wave")
    for _ in range(3):
        page.keyboard.press("2"); shot("dance")
    b.close()

with open(os.path.join(OUT, "moves-report.json"), "w") as h:
    json.dump(report, h, indent=2)
air = [r for r in report if r.get("at") and r["at"][1] > 0.02]
print(json.dumps({"frames": len(report), "framesWithAir": len(air),
                  "highest": max((r["at"][1] for r in report if r.get("at")), default=None)}, indent=2))
