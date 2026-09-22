"""Little Harbour · **pressing W with no click at all**, and the line that says to.

The walk shipped perfect and unreachable: `onKeyDown` on the stage only fires
while the stage holds the keyboard, and nothing ever focused it. So this is
not a photograph of walking — `capture-walk-everywhere.py` already has those,
and note that it had to call `.focus()` on the stage by hand before the keys
would do anything. This is a photograph of the **journey**: land on the page,
touch nothing, press W.

  1  landed     — no click, no tap, no Tab. Where the keyboard actually is.
  2  walked     — W held. Whether the body moved.
  3  unfocused  — Shift+Tab off the stage: the invitation appears.
  4  focused    — one click on the open ground: the invitation goes.

At 1440 with a keyboard, and at 390 with a touch screen, where the invitation
says the thing a thumb can do instead.

Run the review server first, then:
  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/capture-walk-focus.py <out-dir> [--port=4186] [--probe-only]

`--probe-only` takes steps 1 and 2 alone, which is what unmodified
`origin/main` can be asked for: it has no invitation to photograph.

One capture-side workaround, and it is not the product's: the shell warms all
eleven place chunks at idle, and on this box eleven concurrent Vite dev module
graphs never land. `requestIdleCallback` is stubbed out so the warm pass never
starts. Nothing else about the page is changed — in particular nothing here
focuses anything, which is the whole point.

Nothing touches a hosted service: the review server is loopback and its
household is fictional.
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "docs/evidence/walk-focus"
PORT = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--port=")), "4186")
TAG = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--tag=")), "")
PROBE_ONLY = "--probe-only" in sys.argv
BASE = f"http://127.0.0.1:{PORT}/__review?member=MEM-001&seed=demo"
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"]
HEIGHT = {390: 844, 1440: 900}
SHOT = 240000

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


def state(page):
    """Who holds the keyboard, where the body is, and what the stage is saying."""
    return page.evaluate(
        """() => {
            const stage = document.querySelector('.harbour-world__stage');
            const host = document.querySelector('.house-world__canvas');
            const api = host ? host.__harbour : null;
            const active = document.activeElement;
            const name = (node) => !node ? 'nothing'
              : node === document.body ? 'document.body'
              : node.className && String(node.className).includes('harbour-world__stage') ? '.harbour-world__stage'
              : `${node.tagName.toLowerCase()}${node.className ? '.' + String(node.className).trim().split(/\\s+/).join('.') : ''}`;
            const invite = document.querySelector('.harbour-world__invite');
            return {
              activeElement: name(active),
              stageHasKeys: active === stage,
              place: document.querySelector('.harbour-world')?.dataset.harbourPlace ?? null,
              tier: document.querySelector('.harbour-world')?.dataset.harbourTier ?? null,
              status: document.querySelector('.harbour-world')?.dataset.worldStatus ?? null,
              coarsePointer: matchMedia('(pointer: coarse)').matches,
              invite: invite ? invite.textContent : null,
              inviteKind: invite ? invite.getAttribute('data-harbour-invite') : null,
              inviteAriaHidden: invite ? invite.getAttribute('aria-hidden') : null,
              stageTabIndex: stage ? stage.getAttribute('tabindex') : null,
              body: api && api.body ? (api.body()?.at() ?? null) : null,
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


def moved(a, b):
    if not a or not b:
        return None
    return round(((b["x"] - a["x"]) ** 2 + (b["z"] - a["z"]) ** 2) ** 0.5, 3)


def shoot(page, name):
    page.screenshot(path=os.path.join(OUT, name), timeout=SHOT, animations="disabled")
    return name


def run(browser, width, touch):
    suffix = f"-{TAG}" if TAG else ""
    context = browser.new_context(viewport={"width": width, "height": HEIGHT[width]}, device_scale_factor=1, has_touch=touch, is_mobile=touch)
    context.add_init_script(init_script())
    page = context.new_page()
    page.set_default_timeout(SHOT)
    # Headless Chromium paints a page it does not think is focused without its
    # focus ring. Capture-side only, and it changes nothing about the app.
    context.new_cdp_session(page).send("Emulation.setFocusEmulationEnabled", {"enabled": True})
    page.goto(BASE, wait_until="domcontentloaded")
    page.wait_for_selector(".harbour-world[data-world-status='ready']", timeout=SHOT)
    page.wait_for_timeout(2500)
    # `tidy` clicks away any dismiss buttons the review page put up; it is the
    # only click in this run, it is nowhere near the stage, and it happens
    # before anything below is measured.
    tidy(page)
    page.wait_for_timeout(1200)

    row = {"width": width, "touch": touch, "shots": [], "steps": {}}
    landed = state(page)
    row["steps"]["landed"] = landed
    row["shots"].append(shoot(page, f"{width}{suffix}-1-landed.png"))

    # ── The whole question ── W, pressed into whatever the browser says holds
    # the keyboard. No click, no tap, no Tab has touched the world.
    before = landed["body"]
    page.keyboard.down("w")
    page.wait_for_timeout(1500)
    walking = state(page)
    row["shots"].append(shoot(page, f"{width}{suffix}-2-walked.png"))
    page.keyboard.up("w")
    page.wait_for_timeout(800)
    after = state(page)
    row["steps"]["walked"] = after
    row["walkedUnits"] = moved(before, after["body"])
    row["walkedWithNoClick"] = bool(row["walkedUnits"] and row["walkedUnits"] > 0.05)
    print(width, "touch" if touch else "keys", "| keyboard on", landed["activeElement"],
          "| walked", row["walkedUnits"], "units with no click:", row["walkedWithNoClick"], flush=True)
    if PROBE_ONLY:
        report.append(row)
        context.close()
        return

    # ── The invitation ── Shift+Tab walks the keyboard off the stage. The
    # stage stops hearing keys, so it says so.
    page.keyboard.press("Shift+Tab")
    page.wait_for_timeout(900)
    row["steps"]["unfocused"] = state(page)
    row["shots"].append(shoot(page, f"{width}{suffix}-3-unfocused-hint.png"))

    # ── Tab back on ── the stage is still in the tab order, and a keyboard
    # focus has to be a *visible* focus: this frame is the ring.
    for _ in range(15):
        page.keyboard.press("Tab")
        page.wait_for_timeout(250)
        if page.evaluate("() => document.activeElement === document.querySelector('.harbour-world__stage')"):
            break
    page.wait_for_timeout(600)
    row["steps"]["tabbed"] = state(page)
    row["shots"].append(shoot(page, f"{width}{suffix}-4-tabbed-focus-ring.png"))

    # One press on the open ground, low and to the side of anything that
    # stands: the stage has the keyboard again and the line stays gone.
    page.keyboard.press("Shift+Tab")
    page.wait_for_timeout(600)
    page.mouse.click(int(width * 0.72), int(HEIGHT[width] * 0.74))
    page.wait_for_timeout(1200)
    row["steps"]["focused"] = state(page)
    row["shots"].append(shoot(page, f"{width}{suffix}-5-pressed-no-hint.png"))
    print(width, "| hint while unfocused:", json.dumps(row["steps"]["unfocused"]["invite"]),
          "| tabbed back on:", row["steps"]["tabbed"]["stageHasKeys"], json.dumps(row["steps"]["tabbed"]["invite"]),
          "| after a press:", row["steps"]["focused"]["stageHasKeys"], json.dumps(row["steps"]["focused"]["invite"]), flush=True)
    report.append(row)
    context.close()


with sync_playwright() as p:
    browser = p.chromium.launch(args=ARGS)
    run(browser, 1440, False)
    run(browser, 390, True)
    browser.close()

name = f"walk-focus-report{'-' + TAG if TAG else ''}.json"
with open(os.path.join(OUT, name), "w") as handle:
    json.dump(report, handle, indent=2)
print("wrote", os.path.join(OUT, name))
