"""Little Harbour · the Court: evidence captures against the fictional whole-house review.

Run `node scripts/serve-whole-house-review.mjs` first (it turns VITE_HEARTH_HARBOUR on), then
`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/capture-little-harbour-evidence.py [out-dir] [--quick]`.
Stills are taken with prefers-reduced-motion so the camera cuts and nothing breathes; SwiftShader draws the WebGL.
Nothing here touches a hosted service: the review server is loopback and its household is fictional.
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "docs/evidence/little-harbour"
QUICK = "--quick" in sys.argv
# `seed=demo` is the Demo Suite's synthetic "doing well" habitat (populated stones); `--fictional` takes the small review house.
BASE = "http://127.0.0.1:4186/__review?member=MEM-001" + ("" if "--fictional" in sys.argv else "&seed=demo")
WIDTHS = [390, 1440] if QUICK else [320, 390, 720, 1100, 1440]
THEMES = ["classic"] if QUICK else ["classic", "taylor", "newfoundland"]
HEIGHT = {320: 640, 390: 844, 720: 1024, 1100: 800, 1440: 900}
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"]

os.makedirs(OUT, exist_ok=True)
report = []


def init_script(theme: str, motion: str | None) -> str:
    appearance = json.dumps({"appearance": {"theme": theme, "atmosphere": False}, "pending": False})
    motion_line = f"localStorage.setItem('hearth:motion', {json.dumps(motion)});" if motion else "localStorage.removeItem('hearth:motion');"
    return f"localStorage.setItem('hearth:appearance:v1:development:guest', {json.dumps(appearance)}); {motion_line} sessionStorage.clear();"


def wait_court(page, timeout=45000):
    page.wait_for_selector(".harbour-world", timeout=timeout)
    try:
        page.wait_for_selector(".harbour-world[data-world-status='ready']", timeout=timeout)
    except Exception:
        return page.get_attribute(".harbour-world", "data-world-status")
    # The Queen lands after the court: wait for her twins (crown … pot rim) or give up quietly.
    try:
        page.wait_for_function("() => document.querySelectorAll('[data-twin-group=queen]').length >= 4", timeout=timeout)
    except Exception:
        pass
    # The books gate validates the habitat's journal on first load; its banner sits above the stage until then.
    try:
        page.wait_for_function("() => !/Validating the local journal/.test(document.body.textContent || '')", timeout=90000)
    except Exception:
        pass
    page.wait_for_timeout(1200)
    return "ready"


def snap(page, name: str, full=False):
    path = os.path.join(OUT, name)
    page.screenshot(path=path, full_page=full)
    return path


def measure(page):
    return page.evaluate(
        """() => {
          const host = document.querySelector('.house-world__canvas');
          const stage = document.querySelector('.harbour-world__stage');
          const twins = [...document.querySelectorAll('[data-twin]')].map(b => ({ id: b.dataset.twin, w: b.offsetWidth, h: b.offsetHeight, label: b.getAttribute('aria-label') }));
          return {
            status: document.querySelector('.harbour-world')?.dataset.worldStatus,
            tier: document.querySelector('.harbour-world')?.dataset.harbourTier,
            renderer: host?.dataset.renderer, drawCalls: host?.dataset.drawCalls, renderMs: host?.dataset.renderMs, queen: host?.dataset.queen,
            camera: host?.dataset.houseCamera,
            stage: stage ? { w: stage.clientWidth, h: stage.clientHeight } : null,
            court: document.querySelector('.app')?.hasAttribute('data-harbour-court'),
            twins,
            phrase: document.querySelector('.harbour-world__phrase')?.textContent,
            scrollHeight: document.documentElement.scrollHeight, innerHeight: window.innerHeight,
          };
        }"""
    )


with sync_playwright() as p:
    browser = p.chromium.launch(args=ARGS)
    for theme in THEMES:
        for width in WIDTHS:
            tag = f"{theme}-{width}"
            context = browser.new_context(viewport={"width": width, "height": HEIGHT[width]}, reduced_motion="reduce", device_scale_factor=1)
            context.add_init_script(init_script(theme, None))
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.goto(BASE, wait_until="domcontentloaded")
            status = wait_court(page)
            arrival = measure(page)
            snap(page, f"{tag}-01-court.png")
            # Keyboard focus on the first twin, for the focus ring evidence.
            focus_twin = page.query_selector("[data-twin]")
            if focus_twin:
                focus_twin.focus()
                snap(page, f"{tag}-02-court-focus.png")
            # A piece tap: the Rook when it is in frame, else the Bishop (a phone's court keeps the Rook one swipe away).
            rook = page.query_selector("[data-twin='rook']") or page.query_selector("[data-twin='bishop']")
            opened = None
            if rook:
                rook.evaluate("b => b.click()")
                try:
                    page.wait_for_selector(".harbour-world.has-open-object", timeout=15000)
                    page.wait_for_timeout(800)
                    opened = measure(page)
                    snap(page, f"{tag}-03-loft-open.png", full=True)
                    page.click(".harbour-world__put-back")
                    page.wait_for_selector(".harbour-world:not(.has-open-object)", timeout=15000)
                    page.wait_for_timeout(600)
                except Exception as error:
                    errors.append(f"rook: {error}")
            # Her face: a tap is her portrait, with the phrase beneath her; Escape returns to the court.
            face = page.query_selector("[data-twin='face']")
            if face:
                face.evaluate("b => b.click()")
                page.wait_for_timeout(900)
                portrait = measure(page)
                snap(page, f"{tag}-06-portrait.png")
                errors.append(f"portrait phrase: {portrait.get('phrase')!r} camera {portrait.get('camera')}") if not portrait.get("phrase") else None
                page.focus(".harbour-world__stage")
                page.keyboard.press("Escape")
                page.wait_for_timeout(600)
            # The quick sheet.
            handle = page.query_selector(".compass__handle")
            if handle:
                handle.click()
                try:
                    page.wait_for_selector("[data-quick-sheet='open']", timeout=8000)
                    snap(page, f"{tag}-04-quick-sheet.png")
                    page.keyboard.press("Escape")
                except Exception as error:
                    errors.append(f"quick sheet: {error}")
            context.close()
            # The reading edition.
            flat_context = browser.new_context(viewport={"width": width, "height": HEIGHT[width]}, reduced_motion="reduce", device_scale_factor=1)
            flat_context.add_init_script(init_script(theme, "flat"))
            flat_page = flat_context.new_page()
            flat_page.goto(BASE, wait_until="domcontentloaded")
            try:
                flat_page.wait_for_selector(".court-flat[data-court-flat='flat']", timeout=30000)
                flat_page.wait_for_timeout(500)
                snap(flat_page, f"{tag}-05-flat.png", full=True)
            except Exception as error:
                errors.append(f"flat: {error}")
            flat_context.close()
            report.append({"tag": tag, "status": status, "arrival": arrival, "opened": opened, "errors": errors[:12]})
            print(tag, status, arrival.get("tier"), arrival.get("drawCalls"), "twins", len(arrival.get("twins") or []), "errors", len(errors), flush=True)
    browser.close()

with open(os.path.join(OUT, "report.json"), "w", encoding="utf-8") as handle:
    json.dump(report, handle, indent=2)
print("wrote", OUT)
