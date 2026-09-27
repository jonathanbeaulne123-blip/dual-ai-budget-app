"""Tool Atlas (Wave 3a): browser evidence against the Development demo household.

Start the dev server with the deployed presentation flags (.github/workflows/pages.yml
lines 57-76; no Auth, Supabase or continuity flags, so the demo household is loopback-only):

  VITE_HEARTH_HOUSE_WORLD=1 VITE_HEARTH_HARBOUR=1 VITE_FUND_MODEL_V2=1 VITE_CELLAR_V3=1 \
  VITE_HERCULES_WORKSPACE=1 VITE_PLAN_SYSTEM_V2=1 VITE_QUEENS_NEST=1 VITE_HERCULES_ACTIONS=1 \
  VITE_HERCULES_CHAT=1 VITE_HERCULES_DISCOVERY=1 VITE_HERCULES_DRESSING_ROOM=1 \
  pnpm exec vite --host 127.0.0.1 --port 5211 --strictPort

then `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/capture-tool-atlas-evidence.py [out-dir] [theme ...]`.

Chromium runs with SwiftShader so the island draws (WebGL); the tier the harbour chose is
recorded per capture. Files are `<screen>-<width>-<theme>[-<condition>].png`; the landscape
phone is `<screen>-844x390-<theme>.png`. Facts per capture go to `captures-<theme>.json`.
The household is the fictional demo household; nothing here touches a hosted service.

Two things in this build would otherwise stand over every capture (HANDOFF-wave3a.md):
- choosing a character is followed by a "Recovery needed" banner, so the chooser is closed
  with its × instead;
- the same banner (and the "books engine accepted this entry" notice) also appears on its
  own, a minute or two into every session here, with no write from us. The first time it
  stands, the screen is captured as it is (`<screen>-<width>-<theme>-app-notice.png`: the
  notice pushes the island down and paints over the fixed glass); after that the notices are
  hidden with one injected rule so the atlas surfaces can be seen, and every capture taken
  that way says `noticesHidden` in the facts and in INDEX.md.
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 else "docs/evidence/tool-atlas"
THEMES = sys.argv[2:] or ["classic", "taylor", "newfoundland"]
BASE = os.environ.get("ATLAS_BASE", "http://127.0.0.1:5211/")
SIZES = [(320, 568), (390, 844), (720, 1024), (1100, 800)]
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader", "--disable-background-networking"]
APPEARANCE_KEY = "hearth:appearance:v1:development:guest"
CONDITIONS = {
    "reduced-motion": [{"name": "prefers-reduced-motion", "value": "reduce"}],
    "reduced-transparency": [{"name": "prefers-reduced-transparency", "value": "reduce"}],
    "contrast-more": [{"name": "prefers-contrast", "value": "more"}],
    "forced-colors": [{"name": "forced-colors", "value": "active"}],
}

os.makedirs(OUT, exist_ok=True)

FACTS = """() => {
  const vw = innerWidth, vh = innerHeight;
  const world = document.querySelector('.harbour-world');
  const clipped = [...document.querySelectorAll('.glass-bubble__label:not(.glass-bubble__label--tip), .glass-card__line, .record-dial__row, .compact-panel__title, .campfire-ritual__put-back, .quick-sheet__close')]
    .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < -0.5 || r.right > vw + 0.5); })
    .map(e => (e.textContent || '').trim().slice(0, 40));
  const dock = document.querySelector('.glass-dock__glass');
  return {
    viewport: [vw, vh],
    overflowX: document.documentElement.scrollWidth > vw,
    tier: world?.dataset.harbourTier ?? null,
    space: world?.dataset.harbourSpace ?? null,
    desk: document.querySelector('[data-desk]')?.dataset.deskPage ?? null,
    glass: [...document.querySelectorAll('[data-glass-bubble]')].map(b => b.dataset.glassBubble + ':' + b.dataset.glass),
    dockOverflow: dock ? dock.scrollHeight - dock.clientHeight : null,
    dockHeightVar: getComputedStyle(document.documentElement).getPropertyValue('--dock-height').trim(),
    clippedHorizontally: clipped,
    banner: [...document.querySelectorAll('.command-banner, .kitchen-notice')].map(b => (b.textContent || '').trim().slice(0, 60)),
    theme: document.documentElement.dataset.theme ?? null,
  };
}"""


HIDE_NOTICES = ".command-banner, .kitchen-notice, .command-chip--danger { display: none !important; }"


class Session:
    """One browser context in the demo household, standing at home."""

    def __init__(self, browser, theme: str, report: list, errors: list, keep_chooser: bool = False):
        self.theme = theme
        self.report = report
        self.errors = errors
        self.hidden: list = []
        self.context = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        self.context.add_init_script(
            "try{localStorage.setItem(%s, JSON.stringify({appearance:{theme:%s,atmosphere:false},pending:false}))}catch(e){}"
            % (json.dumps(APPEARANCE_KEY), json.dumps(theme))
        )
        self.page = self.context.new_page()
        self.page.set_default_timeout(60000)
        self.page.on("pageerror", lambda e: errors.append(str(e)))
        self.cdp = self.context.new_cdp_session(self.page)
        page = self.page
        page.goto(BASE, wait_until="domcontentloaded")
        page.get_by_role("button", name="Open the demo household table").click(timeout=180000)
        page.wait_for_selector("text=Choose yourself", timeout=120000)
        page.get_by_role("button", name="I am Jonathan").click()
        page.wait_for_function("() => !document.querySelector('.welcome-card') && !!document.querySelector('.app')", timeout=180000)
        self.wait_world()
        self.settle(3000)
        if not keep_chooser:
            self.close_chooser()

    def close_chooser(self) -> None:
        close = self.page.get_by_role("button", name="Close character choices")
        if close.count():
            close.click()
            self.page.wait_for_timeout(600)

    def close(self) -> None:
        self.context.close()

    def settle(self, ms=1500) -> None:
        try:
            self.page.wait_for_function("() => !/Validating the local journal/.test(document.body.textContent || '')", timeout=90000)
        except Exception:
            pass
        self.page.wait_for_timeout(ms)

    def wait_world(self) -> None:
        self.page.wait_for_function(
            "() => { const w = document.querySelector('.harbour-world'); return (w && w.dataset.worldStatus === 'ready' && !document.querySelector('[data-desk]')) }",
            timeout=180000,
        )

    def banner(self) -> list:
        return self.page.evaluate("() => [...document.querySelectorAll('.command-banner, .kitchen-notice')].map(b => (b.textContent || '').trim().slice(0, 60))")

    def snap(self, name: str, **extra) -> None:
        page = self.page
        page.evaluate("() => window.scrollTo(0, 0)")
        page.wait_for_timeout(250)
        standing = self.banner()
        if standing and not self.hidden:
            notice_name = name.replace(".png", "-app-notice.png")
            page.screenshot(path=os.path.join(OUT, notice_name), full_page=False, timeout=120000)
            facts = page.evaluate(FACTS)
            self.report.append({"file": notice_name, **facts, "noticeStanding": standing})
            print(notice_name, json.dumps(facts), flush=True)
            page.add_style_tag(content=HIDE_NOTICES)
            self.hidden = standing
            page.evaluate("() => window.scrollTo(0, 0)")
            page.wait_for_timeout(600)
        page.screenshot(path=os.path.join(OUT, name), full_page=False, timeout=120000)
        facts = page.evaluate(FACTS)
        if self.hidden:
            facts["noticesHidden"] = self.hidden
        facts.update(extra)
        self.report[:] = [r for r in self.report if r["file"] != name]
        self.report.append({"file": name, **facts})
        print(name, json.dumps(facts), flush=True)

    def press(self, selector: str) -> None:
        """Activate a control as a keyboard or switch user would (a click event with no pointer):
        a keyboard arrival does not walk the island, and an App notice that happens to stand
        over the dock cannot swallow it."""
        self.page.locator(selector).first.evaluate("(e) => { e.focus(); e.click(); }")

    def escape_all(self) -> None:
        for _ in range(4):
            if self.page.locator(".campfire-ritual, .compact-panel, .quick-sheet[role=dialog], [role=dialog].quick-sheet, .fab-dial.is-open").count() == 0:
                break
            self.page.keyboard.press("Escape")
            self.page.wait_for_timeout(400)

    def size(self, width: int, height: int) -> None:
        self.page.set_viewport_size({"width": width, "height": height})
        self.page.wait_for_timeout(3000)
        self.escape_all()


def block_first_visit(s: Session) -> None:
    if s.page.locator(".village-character__choices").count():
        s.snap(f"home-390-{s.theme}-first-visit.png")


def block_width(width: int, height: int):
    def run(s: Session) -> None:
        t, page = s.theme, s.page
        s.size(width, height)
        s.snap(f"home-{width}-{t}.png")

        s.press(".glass-bubble-anchor--record .fab.record-bubble")
        page.wait_for_timeout(700)
        s.snap(f"record-{width}-{t}.png")
        page.keyboard.press("Escape")
        page.wait_for_timeout(400)

        s.press("[data-glass-tools]")
        page.wait_for_timeout(700)
        page.locator(".quick-sheet__search-input").fill("Hydro")
        page.wait_for_timeout(700)
        s.snap(f"all-tools-{width}-{t}.png", search="Hydro")
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

        s.press(".glass-dock [data-desk-pot='everyday']")
        page.wait_for_selector(".compact-panel")
        page.wait_for_timeout(800)
        s.snap(f"bank-{width}-{t}.png")
        s.escape_all()

        s.press(".glass-dock [data-card-line='2']")
        page.wait_for_selector(".compact-panel")
        page.wait_for_timeout(800)
        s.snap(f"cellar-{width}-{t}.png")
        s.escape_all()

        # The Campfire's first beat: All tools › Plans › The Campfire, then the panel's door.
        s.press("[data-glass-tools]")
        page.wait_for_timeout(600)
        page.locator(".quick-sheet__search-input").fill("Campfire")
        page.wait_for_timeout(600)
        s.press(".quick-sheet__result")
        page.wait_for_selector("[data-panel-door='campfire']")
        s.press("[data-panel-door='campfire']")
        page.wait_for_selector(".campfire-ritual")
        page.wait_for_timeout(1200)
        s.snap(f"campfire-{width}-{t}.png")
        s.escape_all()

        # The Desk (flat), Today.
        s.press("[data-glass-flip]")
        page.wait_for_selector("[data-desk][data-desk-page='today']", timeout=90000)
        s.settle(1200)
        page.evaluate("() => { const d = document.querySelector('[data-desk]'); if (d) d.scrollTop = 0; }")
        s.snap(f"desk-{width}-{t}.png")
        s.press("[data-glass-flip]")
        s.wait_world()
        page.wait_for_timeout(1500)
    return run


def block_landscape(s: Session) -> None:
    t, page = s.theme, s.page
    s.size(844, 390)
    s.snap(f"home-844x390-{t}.png")
    s.press(".glass-bubble-anchor--record .fab.record-bubble")
    page.wait_for_timeout(700)
    s.snap(f"record-844x390-{t}.png")
    page.keyboard.press("Escape")
    page.wait_for_timeout(400)


def block_conditions(s: Session) -> None:
    t, page = s.theme, s.page
    s.size(390, 844)
    try:
        for condition, features in CONDITIONS.items():
            s.cdp.send("Emulation.setEmulatedMedia", {"features": features})
            page.wait_for_timeout(1200)
            s.snap(f"home-390-{t}-{condition}.png", emulated=features)
    finally:
        s.cdp.send("Emulation.setEmulatedMedia", {"features": []})
    try:
        page.evaluate("() => { document.documentElement.style.fontSize = '200%'; }")
        page.wait_for_timeout(1200)
        s.snap(f"home-390-{t}-text-200.png", rootFontSize="200%")
        s.press(".glass-bubble-anchor--record .fab.record-bubble")
        page.wait_for_timeout(700)
        s.snap(f"record-390-{t}-text-200.png", rootFontSize="200%")
        page.keyboard.press("Escape")
    finally:
        page.evaluate("() => { document.documentElement.style.fontSize = ''; }")
        page.wait_for_timeout(600)


def block_mine(s: Session) -> None:
    t, page = s.theme, s.page
    s.size(390, 844)
    s.press(".glass-dock [data-space-option='mine']")
    page.wait_for_function("() => document.querySelector('.harbour-world')?.dataset.harbourSpace === 'mine'", timeout=90000)
    s.settle(2500)
    try:
        for width, height in SIZES:
            s.size(width, height)
            s.snap(f"mine-{width}-{t}.png")
    finally:
        s.size(390, 844)
        s.press(".glass-dock [data-space-option='ours']")
        page.wait_for_timeout(2000)


def capture_theme(browser, theme: str) -> None:
    report: list = []
    errors: list = []
    session = Session(browser, theme, report, errors, keep_chooser=True)
    block_first_visit(session)  # the first-visit chooser, as it first stands
    session.close_chooser()
    for width, height in SIZES:
        block_width(width, height)(session)
    block_landscape(session)
    block_conditions(session)
    block_mine(session)
    session.close()
    with open(os.path.join(OUT, f"captures-{theme}.json"), "w") as handle:
        json.dump({"theme": theme, "errors": errors, "captures": sorted(report, key=lambda r: r["file"])}, handle, indent=1)


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(args=ARGS)
        for theme in THEMES:
            capture_theme(browser, theme)
        browser.close()


if __name__ == "__main__":
    main()
