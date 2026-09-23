"""Little Harbour · the walk, with the feel turned up: a run across the island.

Holds Shift+W from the Court's gate and photographs the crossing, then lets go
and photographs the pull-up. The cadence is the body's, not the clock's:
SwiftShader draws every pixel on the CPU, so a screenshot takes seconds and the
run carries on underneath it — frames are taken back to back and each one is
labelled with where the body had got to.

  node scripts/serve-whole-house-review.mjs &
  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 capture-walk-feel.py <out-dir>

`requestIdleCallback` is stubbed out exactly as `capture-walk-everywhere.py`
does it: the shell's idle warm pass saturates the dev server on this box.
Nothing here touches a hosted service.
"""
import json, os, sys, time
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
WIDTH, HEIGHT = 1000, 620
RUN_FRAMES, SETTLE_FRAMES = 12, 3
BASE = "http://127.0.0.1:4186/__review?member=MEM-001&seed=demo"
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"]
app = json.dumps({"appearance": {"theme": "classic", "atmosphere": False}, "pending": False})
INIT = (f"localStorage.setItem('hearth:appearance:v1:development:guest', {json.dumps(app)});"
        " localStorage.removeItem('hearth:motion'); sessionStorage.clear();"
        " Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });"
        " window.requestIdleCallback = () => 0; window.cancelIdleCallback = () => {};")
os.makedirs(OUT, exist_ok=True)

def numbers(page):
    return page.evaluate("""() => { const h=document.querySelector('.house-world__canvas'); if(!h) return null; const d=h.dataset;
      return {body:d.harbourBody??null, at:d.bodyAt?JSON.parse(d.bodyAt):null, drawCalls:d.drawCalls?Number(d.drawCalls):null,
              renderMs:d.renderMs?Number(d.renderMs):null, bodyMs:d.bodyMs?Number(d.bodyMs):null,
              camera:d.houseCamera?JSON.parse(d.houseCamera):null}; }""")

report = []
with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1)
    ctx.add_init_script(INIT)
    page = ctx.new_page(); page.set_default_timeout(240000)
    page.goto(BASE, wait_until="domcontentloaded")
    page.wait_for_selector(".harbour-world", timeout=120000)
    page.wait_for_selector(".harbour-world[data-world-status='ready']", timeout=120000)
    page.wait_for_timeout(1500)
    page.evaluate("""() => { for (const b of document.querySelectorAll('button')) { const w=(b.textContent||'').trim(); const l=b.getAttribute('aria-label')||''; if (w==='\\u00d7'||/dismiss|close this note/i.test(l)) b.click(); } }""")
    page.evaluate("() => document.querySelector('.harbour-world__stage')?.focus()")
    page.keyboard.press("Escape"); page.wait_for_timeout(900)

    def shot(name):
        t0 = time.time()
        page.screenshot(path=os.path.join(OUT, name), timeout=240000)
        row = {"frame": name, "seconds": round(time.time() - t0, 2), **(numbers(page) or {})}
        report.append(row); print(name, row.get("at"), flush=True)

    shot(f"run-{WIDTH}-00-standing.png")
    # Straight out of the gate, then a hard lean right across the lawn — the
    # turn is in here on purpose: banking into a heading you have only just
    # asked for is half of what this branch changed.
    n = 0
    page.keyboard.down("Shift"); page.keyboard.down("w")
    for i in range(4):
        n += 1; shot(f"run-{WIDTH}-{n:02d}.png")
    page.keyboard.down("d")
    for i in range(4):
        n += 1; shot(f"run-{WIDTH}-{n:02d}.png")
    page.keyboard.up("w")
    for i in range(RUN_FRAMES - 8):
        n += 1; shot(f"run-{WIDTH}-{n:02d}.png")
    page.keyboard.up("d"); page.keyboard.up("Shift")
    for i in range(SETTLE_FRAMES):
        shot(f"run-{WIDTH}-{RUN_FRAMES + 1 + i:02d}-settling.png")
    page.wait_for_timeout(2500)
    shot(f"run-{WIDTH}-{RUN_FRAMES + SETTLE_FRAMES + 1:02d}-stopped.png")
    b.close()

with open(os.path.join(OUT, "run-report.json"), "w") as h:
    json.dump(report, h, indent=2)
first = next((r for r in report if r.get("at")), None)
last = next((r for r in reversed(report) if r.get("at")), None)
if first and last:
    d = ((last["at"][0] - first["at"][0]) ** 2 + (last["at"][2] - first["at"][2]) ** 2) ** 0.5
    print("crossed", round(d, 2), "units; top speed", max(r["at"][4] for r in report if r.get("at")))
