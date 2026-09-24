"""Tideline Skate Club v2 · whole-app smoke against the fictional local review.

Run `node scripts/serve-whole-house-review.mjs` first, then
  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/capture-skate-v2-smoke.py <out-dir> [--port=4186] [--grid-only] [--no-grid]

The main pass (about 1100 px, Classic) rides the real app by keyboard: a v1 save
migrated losslessly into v2 (the v1 key is left untouched), board down, push, a
flick-it ollie and kickflip (↓ then ↑ / ↓ then ↑+←), the pause book's pages, a
50-50 at Bookends, stance goofy in settings, Space while skating (the ride pauses,
every tool in the sheet is enabled, on top and clickable), a hidden tab (the ride
pauses), and walking away. The grid pass starts skating at 320/390/720/1100 in
Classic, Taylor and Newfoundland. Console errors and page errors are collected on
every page. SwiftShader draws at 1–3 fps here, so everything is closed-loop on the
runtime's diagnostics (`data-skate`, `data-skate-events`), never on wall time.

Nothing here touches a hosted service: the review server is loopback and its
household is fictional.
"""
import json
import math
import os
import sys
import time

from playwright.sync_api import sync_playwright

OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "/tmp/skate-smoke"
PORT = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--port=")), "4186")
BASE = f"http://127.0.0.1:{PORT}/__review?member=MEM-001&seed=demo"
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"]
HEIGHT = {320: 640, 390: 844, 720: 1024, 1100: 800}
os.makedirs(OUT, exist_ok=True)
report = {"steps": [], "errors": {}, "grid": []}


def log(step, ok, **info):
    row = {"step": step, "ok": bool(ok), **info}
    report["steps"].append(row)
    print(json.dumps(row), flush=True)


def init_script(theme: str) -> str:
    appearance = json.dumps({"appearance": {"theme": theme, "atmosphere": False}, "pending": False})
    # The shell warms every place chunk at idle; on this box that starves the dev server (see capture-walk-everywhere.py).
    return (f"localStorage.setItem('hearth:appearance:v1:development:guest', {json.dumps(appearance)});"
            "window.requestIdleCallback = undefined;")


def new_page(browser, width, theme, errors_key):
    ctx = browser.new_context(viewport={"width": width, "height": HEIGHT[width]}, device_scale_factor=1)
    ctx.add_init_script(init_script(theme))
    page = ctx.new_page()
    page.set_default_timeout(120000)
    errs = report["errors"].setdefault(errors_key, [])
    page.on("console", lambda m: errs.append(m.text[:300]) if m.type == "error" else None)
    page.on("pageerror", lambda e: errs.append("pageerror: " + str(e)[:300]))
    return ctx, page


def wait_court(page):
    page.goto(BASE)
    page.wait_for_selector(".harbour-world[data-world-status='ready']", timeout=180000)
    try:
        page.wait_for_function("() => !/Validating the local journal/.test(document.body.textContent || '')", timeout=120000)
    except Exception:
        pass
    page.wait_for_timeout(1500)


def focus_stage(page):
    page.evaluate("() => document.querySelector('.harbour-world__stage')?.focus()")


def skate(page):
    return page.evaluate("""() => { const h = document.querySelector('.house-world__canvas');
      return { s: h?.dataset.skate ? JSON.parse(h.dataset.skate) : null, ev: h?.dataset.skateEvents || '', at: h?.dataset.bodyAt || null }; }""")


def wait_until(page, fn, timeout=60, every=0.25):
    end = time.time() + timeout
    last = None
    while time.time() < end:
        last = skate(page)
        if fn(last):
            return last
        time.sleep(every)
    return None


def progress(page):
    return page.evaluate("""() => { const out = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i);
      if (k && k.startsWith('hearth.harbour.skate.')) out[k] = localStorage.getItem(k); } return out; }""")


def shot(page, name):
    path = os.path.join(OUT, name)
    page.screenshot(path=path)
    return path


def flick(page, keys_up, hold_ms=260):
    """↓ held (crouch), then the flick keys together, then let go (keyboard.ts: keys within 30 ms land together)."""
    page.keyboard.down("ArrowDown")
    page.wait_for_timeout(hold_ms)
    for k in keys_up:
        page.keyboard.down(k)
    page.wait_for_timeout(45)
    page.keyboard.up("ArrowDown")
    for k in keys_up:
        page.keyboard.up(k)


def chord_flick(page, keys_up, hold_ms=260):
    """↓ held on the real keyboard, then the flick keys as ONE chord: dispatched in the same task so a 1 fps
    SwiftShader frame cannot fall between them (on a real screen they are ~16 ms frames inside a 30 ms chord window)."""
    page.keyboard.down("ArrowDown")
    page.wait_for_timeout(hold_ms)
    page.evaluate("""(keys) => { const el = document.querySelector('.harbour-world__stage');
      const fire = (type, key) => el.dispatchEvent(new KeyboardEvent(type, {key, code: key, bubbles: true, cancelable: true}));
      for (const k of keys) fire('keydown', k);
      setTimeout(() => { for (const k of keys) fire('keyup', k); }, 45); }""", keys_up)
    page.wait_for_timeout(60)
    page.keyboard.up("ArrowDown")


REACH_JS = """() => {
      const sheet = document.querySelector('.quick-sheet__panel');
      const buttons = [...document.querySelectorAll('.quick-sheet__panel button, .quick-sheet__panel [role=switch], .quick-sheet__panel a')];
      const blocked = [];
      for (const el of buttons) {
        el.scrollIntoView({block: 'center'});
        const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const top = document.elementFromPoint(x, y);
        if (el.disabled || el.closest('[inert]') || !(top === el || el.contains(top))) blocked.push((el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40) + ' <- ' + (top ? (top.className || top.tagName) : 'none'));
      }
      const active = document.activeElement;
      return { count: buttons.length, blocked, focusInSheet: Boolean(sheet && sheet.contains(active)), bookOpen: Boolean(document.querySelector('.skate-hud[data-skate-open]')),
               bookDialog: Boolean(document.querySelector('.skate-hud [role=dialog]')) };
    }"""


# A frame-locked thumb for the grind: a 1–3 fps SwiftShader frame carries ~0.3 u of travel, so a
# position polled from Python arrives frames late. This rAF loop reads the runtime's `data-skate`
# each frame and presses the real stage's keys (the same handler as a keyboard) at the right distance:
# W to 1.0 u, ↓ (crouch) with G held at 1.8 u, ↑ (the pop) at `popAt`, one new ride sample at a time. Nobody balances the
# grind, so it may end in a bail. Bookends' start rolls straight down its long ledge.
GRIND_JS = """(popAt) => new Promise(resolve => {
  const host = document.querySelector('.house-world__canvas'), el = document.querySelector('.harbour-world__stage');
  const key = (type, k) => el.dispatchEvent(new KeyboardEvent(type, {key: k, code: k, bubbles: true, cancelable: true}));
  const s0 = host.dataset.skate ? JSON.parse(host.dataset.skate) : null; if (!s0) return resolve({error: 'not skating'});
  let step = 0, frames = 0, samples = 0, last = '', seen = [], grindFrames = 0, s = s0, since = 0;
  key('keydown', 'w');
  const tick = () => {
    frames++;
    const raw = host.dataset.skate || '';
    if (raw && raw !== last) { last = raw; samples++; since++; s = JSON.parse(raw); seen.push(s.phase);
      const d = Math.hypot(s.x - s0.x, s.z - s0.z);
      // Act only on a new ride sample (the runtime's frame), never twice on the same one.
      if (step === 0 && d >= 1.0) { key('keyup', 'w'); step = 1; }
      else if (step === 1 && d >= 1.8) { key('keydown', 'g'); key('keydown', 'ArrowDown'); step = 2; since = 0; }
      else if (step === 2 && since >= 2 && d >= popAt) { key('keydown', 'ArrowUp'); step = 3; }
      else if (step === 3) { key('keyup', 'ArrowDown'); key('keyup', 'ArrowUp'); step = 4; }
      else if (step === 4 && s.phase === 'grind') { grindFrames++; if (grindFrames === 1) resolve({frames, samples, grindFrames, phases: [...new Set(seen)], last: s}); }
    }
    if (frames > 600 || samples > 90 || (step === 4 && grindFrames > 0 && s.phase !== 'grind')) { key('keyup', 'g'); return resolve({frames, samples, grindFrames, phases: [...new Set(seen)], last: s}); }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})"""


def grind_run(page):
    """50-50 on Bookends' ledge (the spot is discovered by the migrated v1 save). Up to five tries from the marker."""
    for attempt, pop_at in enumerate((2.6, 2.9, 2.45, 2.75, 3.0)):
        wait_until(page, lambda s: s["s"] and s["s"]["speed"] < .05 and s["s"]["phase"] in ("idle", "roll"), 30)
        # The page loop answers the moment the ride reports `grind` (and keeps holding G until it ends),
        # so the still is taken on the ledge without Python polling the page during the approach.
        result = page.evaluate(f"(p) => ({GRIND_JS})(p)", pop_at)
        if result.get("grindFrames", 0) > 0:
            shot(page, "final-04-grind-bookends-1100.png")
            page.wait_for_timeout(6000)
        ev = skate(page)["ev"]
        ok = result.get("grindFrames", 0) > 0 and "grind:" in ev
        log("grind" if ok or attempt == 4 else "grind-attempt", ok, attempt=attempt, pop_at=pop_at, result=result, ev=ev[-80:])
        if ok:
            return True
        page.keyboard.press("r")
        page.wait_for_timeout(4000)
    return False


def grind_only(browser):
    ctx, page = new_page(browser, 1100, "classic", "grind-1100-classic")
    key = "hearth.harbour.skate.v2:development:HH-WHOLE-HOUSE-HABITAT-REVIEW:MEM-001"
    blob = json.dumps({"version": 1, "deck": "tideline", "discovered": ["tideline", "bookends"], "bestLine": 0, "routeBest": {}, "stamps": []})
    page.add_init_script(f"if (!localStorage.getItem({json.dumps(key)})) localStorage.setItem({json.dumps(key.replace('.v2:', '.v1:'))}, {json.dumps(blob)});")
    wait_court(page)
    focus_stage(page)
    page.keyboard.press("b")
    page.wait_for_selector(".skate-hud", timeout=120000)
    page.keyboard.press("p")
    page.wait_for_selector(".skate-hud[data-skate-open]", timeout=60000)
    page.locator(".skate-hud [role=tab]").nth(0).click()
    page.wait_for_timeout(500)
    page.locator(".skate-hud .skate-book__grid button", has_text="Bookends").first.click()
    at = wait_until(page, lambda s: s["s"] and math.hypot(s["s"]["x"] + 18, s["s"]["z"] + 4.1) < .5, 90)
    log("spot-jump-bookends", at is not None, at=at and at["s"])
    if page.locator(".skate-hud[data-skate-open]").count():
        page.keyboard.press("Escape")
        page.wait_for_timeout(1500)
    focus_stage(page)
    grind_run(page)
    ctx.close()


def main_pass(browser):
    ctx, page = new_page(browser, 1100, "classic", "main-1100-classic")
    wait_court(page)
    focus_stage(page)

    # ── Baseline: All tools while walking (what "every tool reachable" is compared against).
    page.keyboard.press(" ")
    page.wait_for_selector("[data-quick-sheet='open']", timeout=60000)
    page.wait_for_timeout(1500)
    walking_reach = page.evaluate(REACH_JS)
    log("space-while-walking-baseline", walking_reach["focusInSheet"], reach=walking_reach)
    page.keyboard.press("Escape")
    page.wait_for_selector("[data-quick-sheet='open']", state="detached", timeout=60000)
    page.wait_for_timeout(800)
    focus_stage(page)

    # ── v1 → v2 migration, in the real app: learn this person's key, stand a v1 save there, reload.
    page.keyboard.press("b")
    page.wait_for_selector(".skate-hud", timeout=120000)
    wait_until(page, lambda s: s["s"] is not None, 60)
    keys = progress(page)
    v2 = next((k for k in keys if k.startswith("hearth.harbour.skate.v2:")), None)
    log("board-down-first", v2 is not None, key=v2)
    page.keyboard.press("b")
    page.wait_for_selector(".skate-hud", state="detached", timeout=60000)
    v1 = "hearth.harbour.skate.v1:" + v2[len("hearth.harbour.skate.v2:"):]
    v1_blob = json.dumps({"version": 1, "deck": "tideline", "discovered": ["tideline", "bookends"], "bestLine": 4321, "routeBest": {"first-line": 44}, "stamps": []})
    page.evaluate("([a, b, blob]) => { localStorage.removeItem(a); localStorage.setItem(b, blob); }", [v2, v1, v1_blob])
    wait_court(page)
    focus_stage(page)
    page.keyboard.press("b")
    page.wait_for_selector(".skate-hud", timeout=120000)
    wait_until(page, lambda s: s["s"] is not None, 60)
    page.wait_for_timeout(1500)
    keys = progress(page)
    migrated = json.loads(keys.get(v2) or "{}")
    log("v1-migrates-losslessly", migrated.get("version") == 2 and "bookends" in migrated.get("discovered", []) and migrated.get("bestLine") == 4321
        and migrated.get("routeBest", {}).get("first-line") == 44 and keys.get(v1) == v1_blob,
        v2=migrated.get("discovered"), bestLine=migrated.get("bestLine"), v1_untouched=keys.get(v1) == v1_blob)

    # ── Push.
    start = skate(page)["s"]
    page.keyboard.down("w")
    got = wait_until(page, lambda s: s["s"] and s["s"]["speed"] > 2.5, 60)
    page.keyboard.up("w")
    log("push", got is not None, skate=got and got["s"])
    shot(page, "final-01-push-1100.png")

    # ── Flick-it ollie: ↓ then ↑.
    flick(page, ["ArrowUp"])
    got = wait_until(page, lambda s: "pop:ollie" in s["ev"], 60)
    log("flick-ollie", got is not None, ev=got and got["ev"])
    wait_until(page, lambda s: s["s"] and s["s"]["phase"] not in ("air", "crouch"), 60)

    # ── Flick-it kickflip: ↓ then ↑+← (regular: ↖).
    page.keyboard.down("w")
    wait_until(page, lambda s: s["s"] and s["s"]["speed"] > 3, 30)
    page.keyboard.up("w")
    chord_flick(page, ["ArrowUp", "ArrowLeft"])
    got = wait_until(page, lambda s: "pop:kickflip" in s["ev"], 60, every=.1)
    air = wait_until(page, lambda s: s["s"] and s["s"]["phase"] == "air", 5, every=.05)
    if air:
        shot(page, "final-02-kickflip-1100.png")
    log("flick-kickflip", got is not None, ev=(got or skate(page))["ev"])
    wait_until(page, lambda s: s["s"] and s["s"]["phase"] not in ("air",), 60)
    if not air:
        shot(page, "final-02-kickflip-1100.png")

    # ── The pause book (P): every page, and the grind hints on the Trick book.
    page.keyboard.press("p")
    page.wait_for_selector(".skate-hud[data-skate-open]", timeout=60000)
    tabs = page.evaluate("() => [...document.querySelectorAll('.skate-hud [role=tab]')].map(t => t.getAttribute('aria-label'))")
    grind_text = ""
    for i, label in enumerate(tabs):
        page.locator(".skate-hud [role=tab]").nth(i).click()
        page.wait_for_timeout(700)
        if "Trick" in label or "Tricks" in label:
            page.evaluate("() => document.querySelector('.skate-hud h3 ~ .skate-book__names, .skate-hud .skate-book__names')?.scrollIntoView({block:'center'})")
            page.wait_for_timeout(500)
            shot(page, "final-03-book-tricks-grinds-1100.png")
            grind_text = page.evaluate("() => document.querySelector('.skate-hud .skate-book__names')?.textContent || ''")
    log("pause-book-pages", len(tabs) >= 5 and "Along the rail" in grind_text, tabs=tabs, grind_hint=grind_text[:120])

    # (The grind is its own pass: `--grind-only`, from Bookends, frame-locked.)
    page.keyboard.press("Escape")
    page.wait_for_selector(".skate-hud[data-skate-open]", state="detached", timeout=60000)
    page.wait_for_timeout(800)
    focus_stage(page)

    # ── Settings: stance goofy (saved to this person's device progress).
    page.keyboard.press("p")
    page.wait_for_selector(".skate-hud[data-skate-open]", timeout=60000)
    page.locator(".skate-hud [role=tab]", has_text="Settings").first.click()
    page.wait_for_timeout(600)
    page.locator(".skate-hud label", has_text="Goofy").first.click()
    page.wait_for_timeout(2000)
    shot(page, "final-05-settings-goofy-1100.png")
    saved = json.loads(progress(page).get(v2) or "{}")
    log("stance-goofy", saved.get("settings", {}).get("stance") == "goofy", settings=saved.get("settings"))
    page.keyboard.press("Escape")
    page.wait_for_selector(".skate-hud[data-skate-open]", state="detached", timeout=60000)
    page.wait_for_timeout(800)

    # ── Space while skating: the ride pauses, the sheet is on top and every tool in it can be reached.
    focus_stage(page)
    page.keyboard.down("w")
    wait_until(page, lambda s: s["s"] and s["s"]["speed"] > 1.5, 30)
    page.keyboard.up("w")
    page.keyboard.press(" ")
    page.wait_for_selector("[data-quick-sheet='open']", timeout=60000)
    page.wait_for_timeout(2500)
    a = skate(page)
    page.wait_for_timeout(3000)
    b = skate(page)
    reach = page.evaluate(REACH_JS)
    shot(page, "final-06-space-tools-while-skating-1100.png")
    still = a["s"] and b["s"] and abs(a["s"]["x"] - b["s"]["x"]) < 1e-6 and abs(a["s"]["z"] - b["s"]["z"]) < 1e-6
    newly_blocked = [x for x in reach["blocked"] if x.split(" <- ")[0] not in [y.split(" <- ")[0] for y in walking_reach["blocked"]]]
    log("space-opens-tools-and-pauses", still and not newly_blocked and reach["count"] >= walking_reach["count"] and reach["focusInSheet"], reach=reach, newly_blocked=newly_blocked, moving_before=a["s"], after=b["s"])
    # One tool actually opens from the sheet, then back.
    first_tool = page.locator(".quick-sheet__tool button, button.quick-sheet__tool").first
    label = first_tool.text_content()
    first_tool.click()
    page.wait_for_timeout(4000)
    opened = page.evaluate("() => ({ sheet: Boolean(document.querySelector('[data-quick-sheet=open]')), url: location.href, dialogs: document.querySelectorAll('[role=dialog]').length })")
    log("tool-opens-from-sheet", not opened["sheet"], tool=(label or "").strip()[:40], after=opened)
    # Close the tool the app's own way ("Put it back") and come back to the island: the ride is restored where it was, paused.
    for _ in range(3):
        if "surface=" not in page.url:
            break
        back = page.get_by_role("button", name="Put it back")
        if back.count():
            back.first.click()
        else:
            page.keyboard.press("Escape")
        page.wait_for_timeout(5000)
    page.wait_for_selector(".harbour-world[data-world-status='ready']", timeout=180000)
    page.wait_for_timeout(3000)
    restored = page.locator(".skate-hud").count() > 0
    log("tool-closes-back-to-ride", restored, url=page.url, restored_hud=restored, book_open=page.locator(".skate-hud[data-skate-open]").count() > 0)
    focus_stage(page)
    if not restored:
        page.keyboard.press("b")
        page.wait_for_selector(".skate-hud", timeout=120000)

    # ── Hidden tab: the ride pauses.
    if page.locator(".skate-hud[data-skate-open]").count():
        page.keyboard.press("Escape")
        page.wait_for_timeout(1500)
    focus_stage(page)
    page.keyboard.down("w")
    wait_until(page, lambda s: s["s"] and s["s"]["speed"] > 2, 60)
    page.keyboard.up("w")
    page.evaluate("() => { Object.defineProperty(document, 'hidden', {configurable: true, get: () => true}); Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => 'hidden'}); document.dispatchEvent(new Event('visibilitychange')); }")
    page.wait_for_timeout(1500)
    a = skate(page)
    page.wait_for_timeout(3000)
    b = skate(page)
    page.evaluate("() => { delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); }")
    page.wait_for_timeout(2500)
    paused_after = page.evaluate("() => Boolean(document.querySelector('.skate-hud[data-skate-open]'))")
    hidden_still = a["s"] and b["s"] and a["s"]["x"] == b["s"]["x"] and a["s"]["z"] == b["s"]["z"]
    log("hidden-tab-pauses", hidden_still and paused_after, before=a["s"], after=b["s"], book_open_on_return=paused_after)
    if paused_after:
        page.keyboard.press("Escape")
        page.wait_for_timeout(1000)

    # ── Walk away (B): the HUD goes, the body walks.
    focus_stage(page)
    page.keyboard.press("b")
    page.wait_for_selector(".skate-hud", state="detached", timeout=60000)
    at0 = skate(page)["at"]
    page.keyboard.down("w")
    moved = None
    end = time.time() + 30
    while time.time() < end:
        at1 = skate(page)["at"]
        if at1 and at0 and at1 != at0:
            moved = at1
            break
        time.sleep(.3)
    page.keyboard.up("w")
    page.wait_for_timeout(800)
    shot(page, "final-07-walk-away-1100.png")
    log("walk-away", moved is not None and skate(page)["s"] is None, at0=at0, at1=moved)
    ctx.close()


def grid_pass(browser):
    for theme in ("classic", "taylor", "newfoundland"):
        for width in (320, 390, 720, 1100):
            key = f"grid-{width}-{theme}"
            ctx, page = new_page(browser, width, theme, key)
            try:
                wait_court(page)
                focus_stage(page)
                page.keyboard.press("b")
                page.wait_for_selector(".skate-hud", timeout=120000)
                page.keyboard.down("w")
                got = wait_until(page, lambda s: s["s"] and s["s"]["speed"] > 1.5, 60)
                page.keyboard.up("w")
                page.wait_for_timeout(800)
                path = shot(page, f"grid-{theme}-{width}.png")
                over = page.evaluate("() => document.documentElement.scrollWidth > window.innerWidth + 1")
                layout = page.evaluate("() => document.querySelector('.skate-hud')?.dataset.skateLayout")
                report["grid"].append({"theme": theme, "width": width, "riding": got is not None, "hscroll": over, "layout": layout, "path": path})
                print(json.dumps(report["grid"][-1]), flush=True)
            except Exception as error:  # a slow load is recorded, not fatal
                report["grid"].append({"theme": theme, "width": width, "error": str(error)[:200]})
                print(json.dumps(report["grid"][-1]), flush=True)
            ctx.close()


with sync_playwright() as pw:
    browser = pw.chromium.launch(args=ARGS)
    try:
        if "--grind-only" in sys.argv:
            grind_only(browser)
        elif "--grid-only" not in sys.argv:
            main_pass(browser)
        if "--no-grid" not in sys.argv and "--grind-only" not in sys.argv:
            grid_pass(browser)
    finally:
        with open(os.path.join(OUT, "report.json"), "w") as f:
            json.dump(report, f, indent=1)
        browser.close()
