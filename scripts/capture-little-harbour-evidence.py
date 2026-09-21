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
# Slice 2 captures the three places of `home` — the Court with its cistern and stairhead,
# the Rook's Tower above, the Cellar below — plus a mid-travel frame of each journey.
SLICE2 = "--slice2" in sys.argv
# `seed=demo` is the Demo Suite's synthetic "doing well" habitat (populated stones); `--fictional` takes the small review house.
BASE = "http://127.0.0.1:4186/__review?member=MEM-001" + ("" if "--fictional" in sys.argv else "&seed=demo")
WIDTHS = [390, 1440] if QUICK else [320, 390, 720, 1100, 1440]
THEMES = [a.split("=", 1)[1] for a in sys.argv if a.startswith("--theme=")] or (["classic"] if QUICK else ["classic", "taylor", "newfoundland"])
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




# A twin that only the arrived place has: the place attribute flips the moment the
# journey starts, so waiting on it alone catches the room you just left.
# Any one of them will do: a phone's tower may push the shelf plate off the stage,
# and an empty rack has no banks at all.
PLACE_TWIN = {
    "court": ["queen"], "tower": ["shelf", "bank", "jug"], "cellar": ["rail", "jar", "waterline"], "glasshouse": ["beds", "pot", "harvest"],
    "kitchen": ["empty-card", "card", "drawer"], "boathouse": ["boat", "projector", "wishes"], "library": ["book", "bindery", "balcony"],
    "cottage": ["wardrobe", "mirror", "cabinet", "window-seat", "bell"],
    "kiln": ["wheel", "bench", "shelf", "piece"],
    "atlas": ["island", "plaque", "next-island", "stones"],
}


def wait_place(page, place: str, timeout=45000):
    page.wait_for_function(f"() => document.querySelector('.harbour-world')?.dataset.harbourPlace === {json.dumps(place)}", timeout=timeout)
    page.wait_for_selector(".harbour-world[data-world-status='ready']", timeout=timeout)
    want = PLACE_TWIN.get(place)
    if want:
        try:
            page.wait_for_function(
                "(ids) => [...document.querySelectorAll('[data-twin]')].some(b => ids.some(id => b.dataset.twin === id || (b.dataset.twin || '').startsWith(id + ':')))",
                arg=want, timeout=timeout,
            )
        except Exception:
            # The place is standing and ready; it simply has nothing of that name in frame.
            page.wait_for_timeout(1200)
    page.wait_for_timeout(1600)


def twin(page, name: str):
    return page.query_selector(f"[data-twin='{name}']")


LEVELS = {"court": "middle", "tower": "above", "cellar": "below", "glasshouse": "above", "kitchen": "middle", "boathouse": "middle", "library": "middle", "cottage": "middle", "kiln": "above", "atlas": "above"}


ROOMS = {"court": "home", "tower": "home", "cellar": "home", "glasshouse": "study", "kitchen": "kitchen-table", "boathouse": "together", "library": "study", "cottage": "making", "kiln": "making", "atlas": "kitchen-table"}


def route_to(page, place: str) -> None:
    """Walk to a level the way the compass does: push the route and let the App hear it."""
    page.evaluate(
        """([room, level]) => {
          const here = new URL(location.href);
          const household = here.searchParams.get('household') || 'HH-WHOLE-HOUSE-HABITAT-REVIEW';
          history.pushState({}, '', `/house/${room}/${level}?household=${household}&scope=household`);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }""",
        [ROOMS[place], LEVELS[place]],
    )


def put_back(page) -> None:
    """Close whatever the door opened: the sheet's own header button first, then Escape."""
    try:
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)
        if page.query_selector(".app[data-harbour-door]"):
            for selector in (".house-tool-heading button", ".harbour-world__put-back"):
                button = page.query_selector(selector)
                if button:
                    button.click()
                    break
        page.wait_for_selector(".app:not([data-harbour-door])", timeout=10000)
    except Exception:
        pass
    page.wait_for_timeout(500)


def slice2_pass(browser, theme: str, width: int, report: list) -> None:
    """The three places, their doors, the rail's walk, both reading editions and a frame of each journey."""
    tag = f"{theme}-{width}"
    errors: list[str] = []
    context = browser.new_context(viewport={"width": width, "height": HEIGHT[width]}, reduced_motion="reduce", device_scale_factor=1)
    context.add_init_script(init_script(theme, None))
    page = context.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text[:160]) if m.type == "error" else None)
    page.goto(BASE, wait_until="domcontentloaded")
    wait_court(page)
    court = measure(page)
    snap(page, f"{tag}-01-court.png")

    # ── Up the tower. The Rook is a way, not a door; on a narrow phone the
    #    compass route stands in for a piece that is out of frame. ────────────
    tower = None
    try:
        rook = twin(page, "rook")
        if rook:
            rook.evaluate("b => b.click()")
        else:
            route_to(page, "tower")
        wait_place(page, "tower")
        tower = measure(page)
        snap(page, f"{tag}-02-tower.png")
        bank = page.query_selector("[data-twin^='bank:']")
        if bank:
            bank.evaluate("b => b.click()")
            page.wait_for_selector(".harbour-world.has-open-object", timeout=20000)
            page.wait_for_timeout(1200)
            snap(page, f"{tag}-03-tower-bank-open.png", full=True)
            put_back(page)
        else:
            errors.append("no bank twin in the tower")
    except Exception as error:
        errors.append(f"tower: {error}")

    # ── Down into the cellar, by the stairhead when it is in frame. ──────────
    cellar = None
    try:
        route_to(page, "court")
        wait_place(page, "court")
        down = twin(page, "cellar-stair") or twin(page, "bishop")
        if down:
            down.evaluate("b => b.click()")
        else:
            route_to(page, "cellar")
        wait_place(page, "cellar")
        cellar = measure(page)
        snap(page, f"{tag}-04-cellar.png")
        # Walk the rail back through the month: the water falls and the jars ahead go pale.
        page.focus(".harbour-world__stage")
        for _ in range(7):
            page.keyboard.press("ArrowLeft")
            page.wait_for_timeout(200)
        page.wait_for_timeout(900)
        scrubbed = measure(page)
        snap(page, f"{tag}-05-cellar-scrub.png")
        if not scrubbed.get("phrase"):
            errors.append("the rail said nothing on the live region")
        page.keyboard.press("Home")
        page.wait_for_timeout(800)
        jar = page.query_selector("[data-twin^='jar:']")
        if jar:
            jar.evaluate("b => b.click()")
            page.wait_for_selector(".harbour-world.has-open-object", timeout=20000)
            page.wait_for_timeout(1200)
            snap(page, f"{tag}-06-cellar-jar-open.png", full=True)
            put_back(page)
        else:
            errors.append("no jar twin in the cellar")
    except Exception as error:
        errors.append(f"cellar: {error}")
    # ── The Glasshouse: the planner as a room, and a door open over it. ──────
    glasshouse = None
    try:
        route_to(page, "glasshouse")
        wait_place(page, "glasshouse")
        glasshouse = measure(page)
        snap(page, f"{tag}-11-glasshouse.png")
        pot = page.query_selector("[data-twin^='pot:']")
        if pot:
            pot.evaluate("b => b.click()")
            page.wait_for_selector(".app[data-harbour-door]", timeout=20000)
            page.wait_for_timeout(1600)
            snap(page, f"{tag}-12-glasshouse-door-sheet.png")
            put_back(page)
        else:
            errors.append("no pot twin in the glasshouse")
    except Exception as error:
        errors.append(f"glasshouse: {error}")
    # ── The Kitchen: the five-question recipe card on the table. ─────────────
    kitchen = None
    try:
        route_to(page, "kitchen")
        wait_place(page, "kitchen")
        kitchen = measure(page)
        snap(page, f"{tag}-13-kitchen.png")
        card = page.query_selector("[data-twin='empty-card']") or page.query_selector("[data-twin^='card:']")
        if card:
            card.evaluate("b => b.click()")
            page.wait_for_selector(".app[data-harbour-door]", timeout=20000)
            page.wait_for_timeout(1600)
            snap(page, f"{tag}-14-kitchen-door-sheet.png")
            put_back(page)
        else:
            errors.append("no card twin in the kitchen")
    except Exception as error:
        errors.append(f"kitchen: {error}")
    # ── The Boathouse: the slip, the rowboat, the sail. ──────────────────────
    boathouse = None
    try:
        route_to(page, "boathouse")
        wait_place(page, "boathouse")
        boathouse = measure(page)
        snap(page, f"{tag}-15-boathouse.png")
    except Exception as error:
        errors.append(f"boathouse: {error}")
    # ── The Library: the Standing Book's hall. ───────────────────────────────
    library = None
    try:
        route_to(page, "library")
        wait_place(page, "library")
        library = measure(page)
        snap(page, f"{tag}-16-library.png")
        book = page.query_selector("[data-twin='book']")
        if book:
            book.evaluate("b => b.click()")
            page.wait_for_selector(".app[data-harbour-door]", timeout=20000)
            page.wait_for_timeout(1600)
            snap(page, f"{tag}-17-library-door-sheet.png")
            put_back(page)
        else:
            errors.append("no book twin in the library")
    except Exception as error:
        errors.append(f"library: {error}")
    # ── Hercules's Cottage: the armoire, the glass, the cabinet, the seat. ───
    cottage = None
    try:
        route_to(page, "cottage")
        wait_place(page, "cottage")
        cottage = measure(page)
        snap(page, f"{tag}-18-cottage.png")
        station = page.query_selector("[data-twin='cabinet']") or page.query_selector("[data-twin='wardrobe']")
        if station:
            station.evaluate("b => b.click()")
            page.wait_for_selector(".app[data-harbour-door]", timeout=20000)
            page.wait_for_timeout(1600)
            snap(page, f"{tag}-19-cottage-door-sheet.png")
            put_back(page)
        else:
            errors.append("no cabinet or wardrobe twin in the cottage")
    except Exception as error:
        errors.append(f"cottage: {error}")
    # ── The Kiln: the wheel, the bench, the warm kiln, the shelf of fired pieces. ─
    kiln = None
    try:
        route_to(page, "kiln")
        wait_place(page, "kiln")
        kiln = measure(page)
        snap(page, f"{tag}-20-kiln.png")
        wheel = page.query_selector("[data-twin='wheel']")
        if wheel:
            wheel.evaluate("b => b.click()")
            page.wait_for_selector(".app[data-harbour-door]", timeout=20000)
            page.wait_for_timeout(1600)
            snap(page, f"{tag}-21-kiln-door-sheet.png")
            put_back(page)
        else:
            errors.append("no wheel twin in the kiln")
    except Exception as error:
        errors.append(f"kiln: {error}")
    # ── The Atlas: the island on its stand, the era plaque, the next island. ─
    atlas = None
    try:
        route_to(page, "atlas")
        wait_place(page, "atlas")
        atlas = measure(page)
        snap(page, f"{tag}-22-atlas.png")
        island = page.query_selector("[data-twin='island']") or page.query_selector("[data-twin='plaque']")
        if island:
            island.evaluate("b => b.click()")
            page.wait_for_selector(".app[data-harbour-door]", timeout=20000)
            page.wait_for_timeout(1600)
            snap(page, f"{tag}-23-atlas-door-sheet.png")
            put_back(page)
        else:
            errors.append("no island or plaque twin in the atlas")
    except Exception as error:
        errors.append(f"atlas: {error}")
    context.close()

    # ── Mid-travel frames: full motion, caught part way through each journey. ─
    for name, place in (("09-travel-court-tower", "tower"), ("10-travel-court-cellar", "cellar")):
        moving = browser.new_context(viewport={"width": width, "height": HEIGHT[width]}, reduced_motion="no-preference", device_scale_factor=1)
        moving.add_init_script(init_script(theme, None))
        mover = moving.new_page()
        try:
            mover.goto(BASE, wait_until="domcontentloaded")
            wait_court(mover)
            route_to(mover, place)
            # ~40% through the 900 ms lift, with the roof (or the lid) part way.
            mover.wait_for_timeout(380)
            snap(mover, f"{tag}-{name}.png")
        except Exception as error:
            errors.append(f"{name}: {error}")
        moving.close()

    # ── Both reading editions, reached by their own real buttons. ────────────
    for name, place, nth in (("07-flat-tower", "tower", 1), ("08-flat-cellar", "cellar", 2)):
        flat = browser.new_context(viewport={"width": width, "height": HEIGHT[width]}, reduced_motion="reduce", device_scale_factor=1)
        flat.add_init_script(init_script(theme, "flat"))
        reader = flat.new_page()
        try:
            reader.goto(BASE, wait_until="domcontentloaded")
            reader.wait_for_selector("[data-court-flat]", timeout=45000)
            reader.wait_for_timeout(900)
            reader.click(f".court-flat__plinths li:nth-child({nth}) button", timeout=15000)
            reader.wait_for_function(f"() => document.querySelector('[data-place-flat]')?.dataset.placeFlat === {json.dumps(place)}", timeout=20000)
            reader.wait_for_timeout(600)
            if place == "cellar":
                moved = reader.evaluate(
                    """() => {
                      const el = document.querySelector('input.place-flat__scrub');
                      if (!el) return false;
                      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                      set.call(el, String(Math.max(0, Number(el.value) - 5)));
                      el.dispatchEvent(new Event('input', { bubbles: true }));
                      return true;
                    }"""
                )
                if not moved:
                    errors.append("flat cellar: no day scrub")
                reader.wait_for_timeout(500)
            snap(reader, f"{tag}-{name}.png", full=True)
        except Exception as error:
            errors.append(f"{name}: {error}")
        flat.close()

    report.append({"tag": tag, "court": court, "tower": tower, "cellar": cellar, "glasshouse": glasshouse,
                   "kitchen": kitchen, "boathouse": boathouse, "library": library, "cottage": cottage, "kiln": kiln, "atlas": atlas, "errors": errors[:12]})
    print(tag, "court", court.get("drawCalls"), "tower", (tower or {}).get("drawCalls"), "cellar", (cellar or {}).get("drawCalls"),
          "kitchen", (kitchen or {}).get("drawCalls"), "boathouse", (boathouse or {}).get("drawCalls"), "library", (library or {}).get("drawCalls"),
          "cottage", (cottage or {}).get("drawCalls"), "kiln", (kiln or {}).get("drawCalls"), "atlas", (atlas or {}).get("drawCalls"),
          "errors", len(errors), flush=True)
    for error in errors[:6]:
        print("   ·", str(error)[:170], flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(args=ARGS)
    if SLICE2:
        for theme in THEMES:
            for width in WIDTHS:
                slice2_pass(browser, theme, width, report)
        browser.close()
        report_path = os.path.join(OUT, "report.json")
        with open(report_path, "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2)
        print("wrote", OUT)
        raise SystemExit(0)
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

report_path = os.path.join(OUT, "report.json")
previous = []
if os.path.exists(report_path):
    with open(report_path, encoding="utf-8") as handle:
        previous = [row for row in json.load(handle) if row.get("tag") not in {row["tag"] for row in report}]
with open(report_path, "w", encoding="utf-8") as handle:
    json.dump(previous + report, handle, indent=2)
print("wrote", OUT)
