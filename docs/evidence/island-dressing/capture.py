"""Island dressing evidence: the clearings in the tree ring, and every door facing the Court.

Run the review server first (`scripts/serve-whole-house-review.mjs`, with its
port changed if 4186 is taken), then, from the repo root:

  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 \
    docs/evidence/island-dressing/capture.py docs/evidence/island-dressing <port> after

`before` was shot the same way against an unmodified `origin/main` worktree.
Nothing here touches a hosted service: the review server is loopback and its
household is fictional.
"""
import json, math, os, sys
from playwright.sync_api import sync_playwright

OUT, PORT, LABEL = sys.argv[1], sys.argv[2], sys.argv[3]
BASE = f"http://127.0.0.1:{PORT}/__review?member=MEM-001&seed=demo"
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"]
HEIGHT = {390: 844, 1440: 900}
SHOT = 240000
os.makedirs(OUT, exist_ok=True)
report = []

INIT = (
    "localStorage.setItem('hearth:appearance:v1:development:guest', "
    + json.dumps(json.dumps({"appearance": {"theme": "classic", "atmosphere": False}, "pending": False}))
    + "); localStorage.removeItem('hearth:motion'); sessionStorage.clear();"
    " Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });"
)

def court_side(bx, bz):
    """Look outward from the Court at a building's Court-facing wall."""
    return math.atan2(-bx, -bz)

# name, focus (x,z) for streaming, target, r, theta, phi
SHOTS = [
    # Focus (0,0) leaves every placed interior let go, so these frames are the
    # Court's own exterior shells — which is where the doors live.
    # From over the gate, looking down the island at the four buildings whose
    # doors used to be turned to the sea.
    ("00-island-above", (0.0, 0.0), [0, 0.4, -6], 22, 0.0, 0.40),
    # The Kiln's shell, from the Court side: the door, and the tree ring behind it.
    ("01-kiln-shell", (0.0, 0.0), [7.0, 0.9, -2.9], 6.5, court_side(7.0, -2.9), 1.02),
    # The Kiln with its interior standing — the room the conifers were inside.
    ("02-kiln-room", (7.0, -2.9), [7.0, 0.9, -2.9], 7.5, court_side(7.0, -2.9), 1.02),
    # The south lawn: the Library, the Glasshouse and the Boathouse together.
    ("03-south-lawn", (0.0, 0.0), [-1.0, 0.8, -8.0], 9.5, court_side(-1.0, -8.0), 1.04),
    # The Kitchen's cottage on the west lawn.
    ("04-kitchen-cottage", (0.0, 0.0), [-8.0, 0.8, -2.4], 7.5, court_side(-8.0, -2.4), 1.04),
]

def wait_court(page, timeout=300000):
    page.wait_for_selector(".harbour-world", timeout=timeout, state="attached")
    try:
        page.wait_for_selector(".harbour-world[data-world-status='ready']", timeout=timeout)
    except Exception:
        pass
    try:
        page.wait_for_function("() => !/Validating the local journal/.test(document.body.textContent || '')", timeout=120000)
    except Exception:
        pass
    page.wait_for_timeout(1500)

def tidy(page):
    page.evaluate("""() => { for (const b of document.querySelectorAll('button')) {
        const w=(b.textContent||'').trim(), l=b.getAttribute('aria-label')||'';
        if (w==='\\u00d7' || /dismiss|close this note/i.test(l)) b.click(); } }""")
    page.wait_for_timeout(200)

def aim(page, focus, target, r, theta, phi):
    return page.evaluate(
        """([focus, look]) => {
            const host = document.querySelector('.house-world__canvas');
            const api = host && host.__harbour;
            if (!api) return { error: 'no runtime' };
            api.setFocus(focus[0], focus[1]);
            api.restream();
            api.look(look);
            return { resident: api.resident(), focus: api.focus(), pose: api.pose(), drawCalls: Number(host.dataset.drawCalls || 0) };
        }""",
        [list(focus), {"target": target, "r": r, "theta": theta, "phi": phi}],
    )

with sync_playwright() as p:
    browser = p.chromium.launch(args=ARGS)
    for width in (1440, 390):
        context = browser.new_context(viewport={"width": width, "height": HEIGHT[width]}, device_scale_factor=1, reduced_motion="reduce")
        context.add_init_script(INIT)
        page = context.new_page()
        page.set_default_timeout(SHOT)
        console = []
        page.on("console", lambda m: console.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: console.append(f"pageerror: {e}"))
        page.goto(BASE, wait_until="domcontentloaded")
        wait_court(page)
        tidy(page)
        for name, focus, target, r, theta, phi in SHOTS:
            info = aim(page, focus, target, r, theta, phi)
            page.wait_for_timeout(2500)
            try:
                page.wait_for_function("() => !/Validating the local journal/.test(document.body.textContent || '')", timeout=120000)
            except Exception:
                pass
            tidy(page)
            info2 = aim(page, focus, target, r, theta, phi)
            page.wait_for_timeout(1800)
            shot = f"{LABEL}-{width}-{name}.png"
            page.screenshot(path=os.path.join(OUT, shot), timeout=SHOT, animations="disabled")
            report.append({"shot": shot, "width": width, "aim": info2, "console": console[-4:]})
            print(LABEL, width, name, "resident", (info2 or {}).get("resident"), "draw", (info2 or {}).get("drawCalls"), flush=True)
        context.close()
    browser.close()

with open(os.path.join(OUT, f"{LABEL}-report.json"), "w") as h:
    json.dump(report, h, indent=2)
print("wrote", OUT)
