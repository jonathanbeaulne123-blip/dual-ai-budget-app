"""Little Harbour · the body: a walk, captured.

Drives the character across the island with the keys the stage promises and
photographs it on the way — at a desktop width and a phone's, on both render
tiers, and with reduced motion — and reads the frame numbers the review server
publishes (`data-render-ms`, `data-project-ms`, `data-body-ms`,
`data-draw-calls`, `data-body-at`) while the body is walking, so the cost of a
step is measured rather than claimed.

The cadence is the **body's**, not the clock's: SwiftShader draws every pixel
on the CPU, so a screenshot takes the better part of a minute and the walk
carries on underneath it. Frames are taken back to back and labelled with
where the body had got to.

Run the review server first, then:
  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/capture-world-body-evidence.py <out-dir> [--port=4186]

Nothing here touches a hosted service: the review server is loopback and its
household is fictional.
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "docs/evidence/world-body"
PORT = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--port=")), "4186")
BASE = f"http://127.0.0.1:{PORT}/__review?member=MEM-001&seed=demo"
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"]
HEIGHT = {390: 844, 1440: 900}
SHOT = 180000

os.makedirs(OUT, exist_ok=True)
report = []


def init_script(theme: str, cores: int) -> str:
    appearance = json.dumps({"appearance": {"theme": theme, "atmosphere": False}, "pending": False})
    # The tier is decided from the stage's width and the machine's cores
    # (`scene/quality.ts`). This box has two, so `full` is asked for out loud
    # rather than waited for; nothing else about the page is changed.
    return (
        f"localStorage.setItem('hearth:appearance:v1:development:guest', {json.dumps(appearance)});"
        " localStorage.removeItem('hearth:motion'); sessionStorage.clear();"
        f" Object.defineProperty(navigator, 'hardwareConcurrency', {{ get: () => {cores} }});"
    )


def shoot(page, name):
    page.screenshot(path=os.path.join(OUT, name), timeout=SHOT, animations="disabled")
    return name


def wait_court(page, timeout=90000):
    page.wait_for_selector(".harbour-world", timeout=timeout)
    try:
        page.wait_for_selector(".harbour-world[data-world-status='ready']", timeout=timeout)
    except Exception:
        return page.get_attribute(".harbour-world", "data-world-status")
    try:
        page.wait_for_function("() => !/Validating the local journal/.test(document.body.textContent || '')", timeout=90000)
    except Exception:
        pass
    page.wait_for_timeout(1200)
    return "ready"


def tidy(page):
    """Dismiss the review house's own notes so the island is what the frame shows."""
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
              camera: d.houseCamera ? JSON.parse(d.houseCamera) : null,
            };
        }"""
    )


def focus_stage(page):
    page.evaluate("() => document.querySelector('.harbour-world__stage')?.focus()")
    page.wait_for_timeout(120)


def run(browser, width, cores, label, frames, reduced=False, theme="classic"):
    context = browser.new_context(
        viewport={"width": width, "height": HEIGHT[width]},
        device_scale_factor=1,
        reduced_motion="reduce" if reduced else "no-preference",
    )
    context.add_init_script(init_script(theme, cores))
    page = context.new_page()
    page.set_default_timeout(SHOT)
    page.goto(BASE, wait_until="domcontentloaded")
    status = wait_court(page)
    tidy(page)
    focus_stage(page)
    # Escape puts the Look camera back in the room's own establishing pose, so
    # the first frame is the Court as it has always opened — with a person
    # standing in it.
    page.keyboard.press("Escape")
    page.wait_for_timeout(900)
    shots = [shoot(page, f"{label}-{width}-00-standing.png")]
    samples = [numbers(page)]
    # Hold the walk key. Frames are taken back to back: the body walks on
    # underneath a screenshot that takes the better part of a minute.
    page.keyboard.down("w")
    for i in range(frames):
        shots.append(shoot(page, f"{label}-{width}-{i + 1:02d}.png"))
        samples.append(numbers(page))
    page.keyboard.up("w")
    page.wait_for_timeout(1200)
    shots.append(shoot(page, f"{label}-{width}-{frames + 1:02d}-arrived.png"))
    samples.append(numbers(page))
    row = {
        "label": label, "width": width, "status": status, "reducedMotion": reduced,
        "coresReported": cores, "frames": shots, "samples": samples,
    }
    report.append(row)
    print(label, width, "tier", (samples[0] or {}).get("tier"), "frames", len(shots), flush=True)
    context.close()
    return row


PLAN = [
    # (width, cores, label, frames)
    (1440, 8, "walk-full", 9),
    (390, 8, "walk-phone", 7),
    (1440, 2, "walk-lite", 3),
]

with sync_playwright() as p:
    browser = p.chromium.launch(args=ARGS)
    for width, cores, label, frames in PLAN:
        run(browser, width, cores, label, frames)
    run(browser, 1440, 8, "walk-reduced", 2, reduced=True)
    browser.close()

with open(os.path.join(OUT, "walk-report.json"), "w") as handle:
    json.dump(report, handle, indent=2)

for row in report:
    first = next((s for s in row["samples"] if s and s.get("at")), None)
    last = next((s for s in reversed(row["samples"]) if s and s.get("at")), None)
    moved = None
    if first and last:
        moved = round(((last["at"][0] - first["at"][0]) ** 2 + (last["at"][2] - first["at"][2]) ** 2) ** 0.5, 2)
    costs = [s["bodyMs"] for s in row["samples"] if s and s.get("bodyMs") is not None]
    print(row["label"], row["width"], "tier", (first or {}).get("tier"), "moved", moved,
          "units; body ms", round(sum(costs) / len(costs), 3) if costs else None)
