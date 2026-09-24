"""Simple View Desk: browser evidence against the Development demo household.

Start the dev server with the presentation flags .github/workflows/pages.yml sets
(no Auth, Supabase or continuity flags: the demo household is loopback-only), e.g.

  VITE_HEARTH_HOUSE_WORLD=1 VITE_HEARTH_HARBOUR=1 VITE_PLAN_SYSTEM_V2=1 VITE_QUEENS_NEST=1 \
  VITE_FUND_MODEL_V2=1 VITE_CELLAR_V3=1 VITE_HERCULES_ACTIONS=1 VITE_HERCULES_WORKSPACE=1 \
  VITE_HERCULES_CHAT=1 VITE_HERCULES_DISCOVERY=1 VITE_HERCULES_DRESSING_ROOM=1 \
  pnpm exec vite --host 127.0.0.1 --port 5211 --strictPort

then `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/capture-simple-view-desk.py [out-dir]`.
Stills use prefers-reduced-motion (so nothing is caught mid-animation) except the page-turn frames.
The household is the fictional demo household; nothing here touches a hosted service.
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else "docs/evidence/simple-view-desk"
BASE = os.environ.get("DESK_BASE", "http://127.0.0.1:5211/")
HEIGHT = {320: 640, 390: 844, 720: 1024, 1100: 800}
WIDTHS = [320, 390, 720, 1100]
PAGES = ["today", "leaving", "accounts", "calendar", "books"]
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"]
APPEARANCE_KEY = "hearth:appearance:v1:development:guest"

os.makedirs(OUT, exist_ok=True)
report: list[dict] = []


def log(name: str, **facts) -> None:
    report.append({"file": name, **facts})
    print(name, json.dumps(facts))


def snap(page, name: str, full=True, **facts) -> None:
    page.screenshot(path=os.path.join(OUT, name), full_page=full)
    log(name, **facts)


def set_theme(page, theme: str) -> None:
    page.evaluate(
        "([key, theme]) => localStorage.setItem(key, JSON.stringify({ appearance: { theme, atmosphere: false }, pending: false }))",
        [APPEARANCE_KEY, theme],
    )


def set_motion(page, edition: str | None) -> None:
    page.evaluate(
        "(edition) => { if (edition) localStorage.setItem('hearth:motion', edition); else localStorage.removeItem('hearth:motion'); }",
        edition,
    )


def enter_demo(page, snap_loading=True) -> None:
    page.goto(BASE, wait_until="domcontentloaded")
    page.get_by_role("button", name="Open the demo household table").click(timeout=60000)
    page.wait_for_selector("text=Choose yourself", timeout=60000)
    page.locator(".welcome-card button.primary").first.click(timeout=60000)
    # The loading frame: the lightweight flat frame (PlaceFlat, status loading) that stands
    # while the lazy world arrives. Catch it if it stands long enough.
    try:
        if not snap_loading:
            raise RuntimeError("skipped")
        page.wait_for_selector("[data-court-flat='loading']", timeout=60000)
        snap(page, "loading-frame-390.png", full=False, frame=page.get_attribute("[data-court-flat]", "data-court-flat"))
    except Exception:
        if snap_loading:
            log("loading-frame-390.png", captured=False, why="the loading frame did not stand long enough to catch")
    page.wait_for_function(
        "() => !document.querySelector('.welcome-card') && !!document.querySelector('.app')", timeout=120000
    )


def settle(page, ms=1500) -> None:
    try:
        page.wait_for_function("() => !/Validating the local journal/.test(document.body.textContent || '')", timeout=90000)
    except Exception:
        pass
    page.wait_for_timeout(ms)


def wait_desk(page, scope="household", timeout=90000) -> None:
    page.wait_for_selector(f"[data-desk][data-desk-scope='{scope}']", timeout=timeout)
    settle(page, 900)


def chip(page, page_id: str) -> None:
    page.click(f"[data-desk-chip='{page_id}']")
    page.wait_for_selector(f"[data-desk][data-desk-page='{page_id}']", timeout=10000)
    page.wait_for_timeout(400)


def frames(page, stem: str, **facts) -> None:
    """The Desk scrolls inside its stage: a top frame, and an end frame when the page runs on."""
    # The Desk stage is viewport-tall under the App's sticky status strip, so the document
    # itself may have scrolled (a reload restores it); frames start from the top of both.
    was = page.evaluate("() => { const y = window.scrollY; window.scrollTo(0, 0); const d = document.querySelector('[data-desk]'); if (d) d.scrollTop = 0; return y; }")
    page.wait_for_timeout(250)
    snap(page, f"{stem}.png", full=False, windowScrollBefore=was, **facts)
    more = page.evaluate("() => { const d = document.querySelector('[data-desk]'); return d ? d.scrollHeight - d.clientHeight : 0; }")
    if more > 40:
        page.evaluate("() => { const d = document.querySelector('[data-desk]'); d.scrollTop = d.scrollHeight; }")
        page.wait_for_timeout(250)
        snap(page, f"{stem}-end.png", full=False, scrolled=more)
        page.evaluate("() => { const d = document.querySelector('[data-desk]'); if (d) d.scrollTop = 0; }")


TURN_WATCH = """() => {
  window.__turns = [];
  new MutationObserver(list => { for (const m of list) for (const n of m.addedNodes) if (n.dataset && n.dataset.pageTurn) window.__turns.push(n.dataset.pageTurn); })
    .observe(document.body, { childList: true });
}"""


def desk_facts(page) -> dict:
    return page.evaluate(
        """() => {
          const desk = document.querySelector('[data-desk]');
          const world = document.querySelector('.harbour-world');
          return {
            scope: desk?.dataset.deskScope, deskPage: desk?.dataset.deskPage, status: desk?.dataset.deskStatus,
            world: world ? { status: world.dataset.worldStatus, tier: world.dataset.harbourTier } : null,
            bar: [...document.querySelectorAll('[data-harbour-bar]')].map(b => b.dataset.harbourBar),
            flip: document.querySelector('[data-edition-flip]')?.dataset.editionFlip ?? null,
            figure: document.querySelector('[data-edition-figure]')?.dataset.editionFigure ?? null,
            pawprint: !!document.querySelector('[data-bar-pawprint]'),
            notice: document.querySelector('[data-desk-notice]')?.dataset.deskNotice ?? null,
            slip: !!document.querySelector('[data-desk-slip]'),
            dogear: !!document.querySelector('[data-desk-dogear]'),
            cracked: !!document.querySelector('[data-seal-cracked]'),
            overflowX: document.documentElement.scrollWidth > window.innerWidth,
          };
        }"""
    )


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(args=ARGS)
        context = browser.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce", device_scale_factor=1)
        page = context.new_page()
        console_errors: list[str] = []
        page.on("pageerror", lambda e: console_errors.append(str(e)))

        enter_demo(page)
        settle(page, 3000)

        # The illustrated world first: does headless Chromium draw WebGL here?
        world = page.evaluate("() => { const w = document.querySelector('.harbour-world'); return w ? { status: w.dataset.worldStatus, tier: w.dataset.harbourTier } : null; }")
        log("probe", world=world)

        # Choose a walker so the character card does not cover the square.
        chooser = page.locator(".village-character__options button", has_text="Bianca")
        if chooser.count() > 0:
            chooser.first.click()
            page.wait_for_timeout(2500)
        for width in (390, 1100):
            page.set_viewport_size({"width": width, "height": HEIGHT[width]})
            settle(page, 2500)
            snap(page, f"bar-over-world-{width}.png", full=False, **desk_facts(page))
            bar = page.locator("[data-harbour-bar='island']")
            if bar.count() > 0:
                bar.first.screenshot(path=os.path.join(OUT, f"bar-island-closeup-{width}.png"))
                log(f"bar-island-closeup-{width}.png", box=bar.first.bounding_box())
        flip = page.locator("[data-edition-flip]").first
        flip.screenshot(path=os.path.join(OUT, "flip-button-everyday-figure-1100.png"))
        log("flip-button-everyday-figure-1100.png", figure=flip.get_attribute("data-edition-figure"), text=flip.inner_text(), aria=flip.get_attribute("aria-label"))

        # The flip, before and after the backtick; motion allowed so the page-turn plays.
        page.set_viewport_size({"width": 1100, "height": 800})
        page.emulate_media(reduced_motion="no-preference")
        page.evaluate(TURN_WATCH)
        page.evaluate("() => document.activeElement?.blur()")
        snap(page, "flip-before-backtick-1100.png", full=False, **desk_facts(page))
        page.keyboard.press("`")
        page.wait_for_timeout(120)
        snap(page, "flip-mid-transition-1100.png", full=False, turnStanding=page.evaluate("() => !!document.querySelector('[data-page-turn]')"))
        wait_desk(page)
        page.wait_for_timeout(700)
        snap(page, "flip-after-backtick-1100.png", full=False, turns=page.evaluate("() => window.__turns"), **desk_facts(page))

        # Reduced motion: the same flip is a plain cut, no leaf. Desk -> world -> Desk.
        page.emulate_media(reduced_motion="reduce")
        page.evaluate(TURN_WATCH)
        page.evaluate("() => document.activeElement?.blur()")
        page.keyboard.press("`")
        page.wait_for_selector(".harbour-world[data-world-status='ready']", timeout=90000)
        page.wait_for_timeout(1500)
        page.evaluate("() => document.activeElement?.blur()")
        page.keyboard.press("`")
        wait_desk(page)
        log("reduced-motion-flip", turnsUnderReduce=page.evaluate("() => window.__turns"))

        # The Desk pages at every width, Classic.
        for width in WIDTHS:
            page.set_viewport_size({"width": width, "height": HEIGHT[width]})
            page.wait_for_timeout(500)
            for page_id in PAGES:
                chip(page, page_id)
                facts = desk_facts(page)
                if page_id == "accounts":
                    tiles = page.locator(".desk-account__press[aria-expanded='false']")
                    if tiles.count() > 0:
                        tiles.first.click()
                        page.wait_for_timeout(400)
                    frames(page, f"desk-accounts-{width}", **facts)
                    opened = page.locator(".desk-account__press[aria-expanded='true']")
                    if opened.count() > 0:
                        opened.first.scroll_into_view_if_needed()
                        page.wait_for_timeout(300)
                        snap(page, f"desk-accounts-expanded-{width}.png", full=False, expanded=opened.first.inner_text()[:80])
                else:
                    frames(page, f"desk-{page_id}-{width}", **facts)
            chip(page, "today")
            door = page.locator("[data-harbour-bar='door']")
            if width in (390, 1100) and door.count() > 0:
                door.first.screenshot(path=os.path.join(OUT, f"bar-door-closeup-{width}.png"))
                log(f"bar-door-closeup-{width}.png", box=door.first.bounding_box())

        # Keyboard focus on the chip rail, then the quick-sheet drawer.
        page.set_viewport_size({"width": 390, "height": 844})
        page.focus("[data-desk-chip='today']")
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(300)
        snap(page, "focus-chip-rail-390.png", full=False, focused=page.evaluate("() => document.activeElement?.dataset.deskChip"),
             outline=page.evaluate("() => getComputedStyle(document.activeElement).outlineStyle + ' ' + getComputedStyle(document.activeElement).outlineWidth"))
        page.keyboard.press("Home")
        page.click("[data-desk-drawer]")
        page.wait_for_timeout(700)
        snap(page, "drawer-open-390.png", full=False, dialog=page.evaluate("() => !!document.querySelector('[role=dialog]')"))
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

        # The three dressings on Today at 390.
        for theme in ("classic", "taylor", "newfoundland"):
            set_theme(page, theme)
            page.reload(wait_until="domcontentloaded")
            wait_desk(page)
            chip(page, "today")
            frames(page, f"dressing-{theme}-today-390", theme=page.evaluate("() => [...document.querySelector('[data-desk]').classList].join(' ')"))
        set_theme(page, "classic")
        page.reload(wait_until="domcontentloaded")
        wait_desk(page)

        # The personal Desk: the space switch in the Desk header.
        mine = page.locator("[data-desk-slot='space']").get_by_role("button", name="My Money")
        if mine.count() > 0:
            mine.first.click()
            wait_desk(page, scope="personal")
            for width in (320, 390, 1100):
                page.set_viewport_size({"width": width, "height": HEIGHT[width]})
                page.wait_for_timeout(700)
                frames(page, f"personal-desk-today-{width}", **desk_facts(page))
            for theme in ("taylor", "newfoundland"):
                set_theme(page, theme)
                page.reload(wait_until="domcontentloaded")
                wait_desk(page, scope="personal")
                frames(page, f"personal-desk-{theme}-1100")
            set_theme(page, "classic")
        else:
            log("personal-desk", captured=False, why="no My Money control in the Desk's space slot")

        log("console", errors=console_errors[:20])
        context.close()

        browser.close()

        # No WebGL at all: the device lands on the Desk by itself (the flat tier).
        browser = p.chromium.launch(args=["--disable-3d-apis", "--disable-webgl", "--disable-gpu"])
        context = browser.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce")
        page = context.new_page()
        enter_demo(page, snap_loading=False)
        try:
            page.wait_for_selector("[data-desk]", timeout=90000)
            settle(page, 1500)
            snap(page, "no-webgl-lands-on-desk-390.png", full=False, **desk_facts(page),
                 undrawn=page.evaluate("() => document.querySelector('.desk__undrawn')?.textContent ?? null"))
        except Exception as error:
            log("no-webgl-lands-on-desk-390.png", captured=False, why=str(error)[:200], **desk_facts(page))
        browser.close()
    with open(os.path.join(OUT, "captures.json"), "w") as fh:
        json.dump(report, fh, indent=2)


if __name__ == "__main__":
    main()
