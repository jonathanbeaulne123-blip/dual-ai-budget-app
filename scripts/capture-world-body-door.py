"""Little Harbour · the body: the Court to a building's door.

The second half of the walk evidence. The first sequence
(`capture-world-body-evidence.py`) walks out of the gate and across the
terrace; this one steers — W, then W and D together — off the terrace, over
the lawn's hump and down to the Kitchen cottage's door on the west shore, and
photographs the way there.

  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/capture-world-body-door.py <out-dir> [--port=4186] [--width=1440]
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "docs/evidence/world-body"
PORT = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--port=")), "4186")
WIDTH = int(next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--width=")), "1440"))
FRAMES = int(next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--frames=")), "11"))
BASE = f"http://127.0.0.1:{PORT}/__review?member=MEM-001&seed=demo"
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"]
HEIGHT = {390: 844, 1440: 900}
SHOT = 180000

os.makedirs(OUT, exist_ok=True)


def init_script(cores=8):
    appearance = json.dumps({"appearance": {"theme": "classic", "atmosphere": False}, "pending": False})
    return (
        f"localStorage.setItem('hearth:appearance:v1:development:guest', {json.dumps(appearance)});"
        " localStorage.removeItem('hearth:motion'); sessionStorage.clear();"
        f" Object.defineProperty(navigator, 'hardwareConcurrency', {{ get: () => {cores} }});"
    )


def numbers(page):
    return page.evaluate(
        """() => {
            const host = document.querySelector('.house-world__canvas');
            if (!host) return null;
            const d = host.dataset;
            return {
              tier: document.querySelector('.harbour-world')?.dataset.harbourTier ?? null,
              body: d.harbourBody ?? null,
              at: d.bodyAt ? JSON.parse(d.bodyAt) : null,
              renderMs: d.renderMs ? Number(d.renderMs) : null,
              projectMs: d.projectMs ? Number(d.projectMs) : null,
              bodyMs: d.bodyMs ? Number(d.bodyMs) : null,
              drawCalls: d.drawCalls ? Number(d.drawCalls) : null,
              twins: document.querySelectorAll('[data-twin-id], .harbour-twin, [data-twin-group]').length,
            };
        }"""
    )


with sync_playwright() as p:
    browser = p.chromium.launch(args=ARGS)
    context = browser.new_context(viewport={"width": WIDTH, "height": HEIGHT[WIDTH]}, device_scale_factor=1)
    context.add_init_script(init_script())
    page = context.new_page()
    page.set_default_timeout(SHOT)
    page.goto(BASE, wait_until="domcontentloaded")
    page.wait_for_selector(".harbour-world", timeout=120000)
    # Read the status off the dataset rather than waiting on visibility: on a
    # loaded machine the stage is "ready" long before an actionability check
    # gets a turn.
    page.wait_for_function(
        "() => document.querySelector('.harbour-world')?.dataset.worldStatus === 'ready'", timeout=120000)
    try:
        page.wait_for_function("() => !/Validating the local journal/.test(document.body.textContent || '')", timeout=90000)
    except Exception:
        pass
    page.wait_for_timeout(1200)
    page.evaluate(
        """() => { for (const b of document.querySelectorAll('button')) {
            const w = (b.textContent || '').trim();
            if (w === '\\u00d7' || /dismiss/i.test(b.getAttribute('aria-label') || '')) b.click();
        } }"""
    )
    page.evaluate("() => document.querySelector('.harbour-world__stage')?.focus()")
    page.keyboard.press("Escape")
    page.wait_for_timeout(800)
    samples = []
    page.screenshot(path=os.path.join(OUT, f"door-{WIDTH}-00-standing.png"), timeout=SHOT, animations="disabled")
    samples.append(numbers(page))
    page.keyboard.down("w")
    for i in range(FRAMES):
        # Off the terrace first, then steer west: W and D together walk the
        # body down the lawn toward the Kitchen cottage's door.
        if i == 3:
            page.keyboard.down("d")
        page.screenshot(path=os.path.join(OUT, f"door-{WIDTH}-{i + 1:02d}.png"), timeout=SHOT, animations="disabled")
        samples.append(numbers(page))
    page.keyboard.up("d")
    page.keyboard.up("w")
    page.wait_for_timeout(1500)
    page.screenshot(path=os.path.join(OUT, f"door-{WIDTH}-{FRAMES + 1:02d}-arrived.png"), timeout=SHOT, animations="disabled")
    samples.append(numbers(page))
    with open(os.path.join(OUT, f"door-{WIDTH}-report.json"), "w") as handle:
        json.dump(samples, handle, indent=2)
    at = [s["at"] for s in samples if s and s.get("at")]
    print("door walk", WIDTH, "from", at[0] if at else None, "to", at[-1] if at else None)
    browser.close()
