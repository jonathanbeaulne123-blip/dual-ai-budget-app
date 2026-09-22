"""Little Harbour · walking **inside**: the character in a room, and on the shore.

The body shipped Court-only. This photographs it where it could not go: an
unplaced room (the Cellar, down under the Court's floor), a placed one (the
Library, standing where the Court stood its hall), and the Campfire on the
shore — at a desktop width and a phone's, standing and mid-stride.

The cadence is the **body's**, not the clock's: SwiftShader draws every pixel
on the CPU here, so one screenshot takes the better part of a minute and the
walk carries on underneath it. Frames are taken back to back and each one is
labelled from `data-body-at`, so the filename says where the body had got to.

Run the review server first, then:
  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/capture-walk-everywhere.py <out-dir> [--port=4186]

One capture-side workaround, and it is not the product's: the shell warms all
eleven place chunks at idle, and on this box eleven concurrent Vite dev module
graphs never land, so the chunk the route actually wants never arrives and the
runtime stays in the Court. (Reproduced on unmodified `origin/main`, so it
predates this branch and is a dev-server saturation problem, not a product
one.) `requestIdleCallback` is stubbed out so the warm pass never starts and
the route's own chunk is the only one in flight. Nothing else about the page
is changed, and every navigation below still goes through the app's own
quick-sheet route event.

Nothing here touches a hosted service: the review server is loopback and its
household is fictional.
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "docs/evidence/walk-everywhere"
PORT = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--port=")), "4186")
FRAMES = int(next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--frames=")), "2"))
BASE = f"http://127.0.0.1:{PORT}/__review?member=MEM-001&seed=demo"
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"]
HEIGHT = {390: 844, 1440: 900}
SHOT = 240000

# (place id, the house route that stands it, what kind of ground it is)
PLAN = [
    ("cellar", "home", "below", "an unplaced room — under the Court's own floor"),
    ("library", "study", "middle", "a placed room — standing where the Court stood its hall"),
    ("campfire", "making", "below", "outdoors — the shore in front of the Boathouse"),
]

os.makedirs(OUT, exist_ok=True)
report = []


def init_script(cores=8):
    appearance = json.dumps({"appearance": {"theme": "classic", "atmosphere": False}, "pending": False})
    return (
        f"localStorage.setItem('hearth:appearance:v1:development:guest', {json.dumps(appearance)});"
        " localStorage.removeItem('hearth:motion'); sessionStorage.clear();"
        f" Object.defineProperty(navigator, 'hardwareConcurrency', {{ get: () => {cores} }});"
        # See the note at the top: the idle warm pass, not the product.
        " window.requestIdleCallback = () => 0; window.cancelIdleCallback = () => {};"
    )


def numbers(page):
    return page.evaluate(
        """() => {
            const host = document.querySelector('.house-world__canvas');
            const world = document.querySelector('.harbour-world');
            if (!host) return null;
            const d = host.dataset, api = host.__harbour;
            return {
              place: world?.dataset.harbourPlace ?? null,
              runtimePlace: api ? api.placeId() : null,
              tier: world?.dataset.harbourTier ?? null,
              body: d.harbourBody ?? null,
              at: d.bodyAt ? JSON.parse(d.bodyAt) : null,
              live: api && api.body ? api.body()?.at() ?? null : null,
              renderMs: d.renderMs ? Number(d.renderMs) : null,
              bodyMs: d.bodyMs ? Number(d.bodyMs) : null,
              drawCalls: d.drawCalls ? Number(d.drawCalls) : null,
              camera: d.houseCamera ? JSON.parse(d.houseCamera) : null,
              label: document.querySelector('.harbour-world__stage')?.getAttribute('aria-label') ?? null,
            };
        }"""
    )


def tidy(page):
    page.evaluate(
        """() => {
            for (const button of document.querySelectorAll('button')) {
              const word = (button.textContent || '').trim();
              const label = button.getAttribute('aria-label') || '';
              if (word === '\\u00d7' || /dismiss|close this note/i.test(label)) button.click();
            }
        }"""
    )
    page.wait_for_timeout(200)


def spot(sample):
    """Where the body had got to, for a filename: x and z to a tenth of a unit."""
    at = (sample or {}).get("at") or (sample or {}).get("live")
    if not at:
        return "nowhere"
    x, z = (at[0], at[2]) if isinstance(at, list) else (at["x"], at["z"])
    return f"x{x:+.1f}z{z:+.1f}".replace(".", "p")


def shoot(page, name):
    page.screenshot(path=os.path.join(OUT, name), timeout=SHOT, animations="disabled")
    return name


def go(page, place, room, level):
    page.evaluate(
        "([room, level]) => window.dispatchEvent(new CustomEvent('hearth:harbour-go', { detail: { room, level } }))",
        [room, level],
    )
    for _ in range(24):
        page.wait_for_timeout(2000)
        if page.evaluate("() => document.querySelector('.house-world__canvas')?.__harbour?.placeId()") == place:
            return True
    return False


def run(browser, width, place, room, level, kind):
    context = browser.new_context(viewport={"width": width, "height": HEIGHT[width]}, device_scale_factor=1)
    context.add_init_script(init_script())
    page = context.new_page()
    page.set_default_timeout(SHOT)
    page.goto(BASE, wait_until="domcontentloaded")
    page.wait_for_selector(".harbour-world[data-world-status='ready']", timeout=SHOT)
    page.wait_for_timeout(1500)
    tidy(page)
    arrived = go(page, place, room, level)
    page.evaluate("() => document.querySelector('.harbour-world__stage')?.focus()")
    page.wait_for_timeout(600)
    samples = [numbers(page)]
    shots = [shoot(page, f"{place}-{width}-00-standing-{spot(samples[0])}.png")]
    # Hold the walk key the stage promises. The body walks on underneath a
    # screenshot that takes the better part of a minute.
    page.keyboard.down("w")
    for i in range(FRAMES):
        sample = numbers(page)
        samples.append(sample)
        shots.append(shoot(page, f"{place}-{width}-{i + 1:02d}-walking-{spot(sample)}.png"))
    page.keyboard.up("w")
    page.wait_for_timeout(1200)
    samples.append(numbers(page))
    shots.append(shoot(page, f"{place}-{width}-{FRAMES + 1:02d}-stopped-{spot(samples[-1])}.png"))
    row = {"place": place, "kind": kind, "route": f"{room}/{level}", "width": width, "arrived": arrived, "frames": shots, "samples": samples}
    report.append(row)
    first = next((s for s in samples if s and (s.get("live") or s.get("at"))), None)
    last = next((s for s in reversed(samples) if s and (s.get("live") or s.get("at"))), None)
    moved = None
    if first and last and first.get("live") and last.get("live"):
        moved = round(((last["live"]["x"] - first["live"]["x"]) ** 2 + (last["live"]["z"] - first["live"]["z"]) ** 2) ** 0.5, 3)
    row["walked"] = moved
    print(place, width, "arrived", arrived, "tier", (first or {}).get("tier"), "walked", moved, "units", flush=True)
    context.close()


with sync_playwright() as p:
    browser = p.chromium.launch(args=ARGS)
    for width in (1440, 390):
        for place, room, level, kind in PLAN:
            run(browser, width, place, room, level, kind)
    browser.close()

with open(os.path.join(OUT, "walk-everywhere-report.json"), "w") as handle:
    json.dump(report, handle, indent=2)
print("wrote", os.path.join(OUT, "walk-everywhere-report.json"))
