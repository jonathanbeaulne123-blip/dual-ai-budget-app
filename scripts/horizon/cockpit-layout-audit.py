"""Horizon plane cockpit: real-Chromium layout audit of the airport panel, flight pads and cockpit.

Loads the repository's own horizon.css and glass.css (so --dock-height is the real dock's) around the
same markup HorizonStage renders in plane mode, sets --horizon-toolbar-bottom the way the stage does,
and measures — for every theme, viewport and pointer type — whether any touch control is covered:

  * the lever and both yaw pedals must be the top element at their centres (nothing intercepts them),
  * the Move pad and Look pad must be the top element at theirs,
  * the panel, cockpit and pads must all sit inside the viewport.

This is a layout harness, not a capture of the running world (no WebGL): it proves the CSS geometry
the Codex review on PR #582 questioned. Run: python3 scripts/horizon/cockpit-layout-audit.py [out-dir]
Exit code 1 if any check fails. Fictional markup only; nothing touches a service.
"""
import json
import os
import pathlib
import sys
import tempfile

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(tempfile.mkdtemp(prefix="cockpit-audit-"))
OUT.mkdir(parents=True, exist_ok=True)
CSS = [ROOT / "src/harbour/glass/glass.css", ROOT / "src/harbour/horizon/horizon.css"]
THEMES = ["classic", "taylor", "newfoundland"]
# (width, height, touch): phones in portrait, a small tablet, and a wide touch screen; wide + mouse hides the pads.
VIEWPORTS = [(320, 568, True), (360, 640, True), (390, 844, True), (430, 932, True), (720, 1024, True), (800, 1180, True), (1100, 800, True), (1100, 800, False)]
DETENTS = ["Idle", "Taxi", "Approach", "Cruise", "Full"]


STAGE_JS = r"""  const shell=document.querySelector('.horizon-shell'),bar=document.querySelector('.horizon-top-controls');
  function placeAirportPanel(shell,toolbarBottom){
    const panel=shell.querySelector('.horizon-airport');if(!panel)return;
    const box=shell.getBoundingClientRect(),row=shell.querySelector('.horizon-touch-controls'),dock=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dock-height'))||0;
    const floor=box.height-dock-8,rowBox=row&&getComputedStyle(row).display!=='none'?row.getBoundingClientRect():null;
    let top=toolbarBottom,room=floor-top;
    if(rowBox){const rowTop=rowBox.top-box.top-8,rowBottom=rowBox.bottom-box.top+8;if(top<rowTop)room=rowTop-top;else if(top<rowBottom){top=rowBottom;room=floor-top;}}
    shell.style.setProperty('--horizon-airport-top',Math.round(top)+'px');shell.style.setProperty('--horizon-airport-room',Math.max(72,Math.floor(room))+'px');
  }
  const place=()=>{const bottom=bar.getBoundingClientRect().bottom-shell.getBoundingClientRect().top+12;shell.style.setProperty('--horizon-toolbar-bottom',bottom+'px');placeAirportPanel(shell,bottom);};
  place();new ResizeObserver(place).observe(bar);new ResizeObserver(place).observe(shell);
"""


def page_html(theme: str, in_shell: bool) -> str:
    links = "".join(f'<link rel="stylesheet" href="{p.as_uri()}">' for p in CSS)
    detents = "".join(f'<button aria-pressed="false">{d}</button>' for d in DETENTS)
    shell_cls = f"horizon-shell horizon-shell--{theme}" + (" horizon-shell--in-shell" if in_shell else "")
    notches = "".join(
        f'<span class="horizon-lever__notch" style="bottom:{v}%"></span>'
        for n, v in [("Idle", 0), ("Taxi", 13), ("Approach", 37), ("Cruise", 80), ("Full", 100)]
    )
    return f"""<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">{links}
<style>html,body{{margin:0;height:100%}}.app{{height:100dvh}}</style>
<div class="app">{'<div class="glass-dock" style="position:fixed;left:0;right:0;bottom:0;height:var(--dock-height,0px)"></div>' if in_shell else ''}
<section class="{shell_cls}" aria-label="The Horizon" style="height:100dvh">
  <div class="horizon-stage" tabindex="0"></div>
  <div class="horizon-airport" role="group" aria-label="Airport and aircraft">
    <strong>Kestrel</strong>
    <p>0 km/h · Power 0% · On the ground</p>
    <div class="horizon-airport__power" role="group" aria-label="Power detents">{detents}<button class="horizon-airport__takeoff">Take off</button>
      <label class="horizon-airport__sr">Power <input aria-label="Aircraft power" type="range" min="0" max="100" value="0"></label></div>
    <p class="horizon-airport__hint">A/D bank · Q/R yaw · S climbs · W descends · C view</p>
    <button>Stop / ground brake</button><button>Leave &amp; open parachute</button><button>Park &amp; get out</button>
  </div>
  <div class="horizon-top-controls"></div>
  <div class="horizon-touch-controls horizon-touch-controls--plane">
    <div class="horizon-pad" id="move">Move</div>
    <div class="horizon-cockpit"><div class="horizon-lever" id="lever" data-detent="idle">{notches}<span class="horizon-lever__knob" style="bottom:37%">Approach</span></div>
      <div class="horizon-pedals"><button id="yl" aria-label="Yaw left (Q)">◀</button><button id="yr" aria-label="Yaw right (R)">▶</button></div></div>
    <div class="horizon-pad" id="look">Look</div>
  </div>
</section></div>
<script>
{STAGE_JS}
</script>"""


CHECK_JS = """
() => {
  const vw = innerWidth, vh = innerHeight, out = {};
  const box = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; };
  const topAt = (sel) => {
    const el = document.querySelector(sel); if (!el) return null;
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) return { hidden: true };
    const pts = [[.5, .5], [.2, .2], [.8, .2], [.2, .8], [.8, .8]], bad = [];
    for (const [fx, fy] of pts) { const hit = document.elementFromPoint(r.x + r.width * fx, r.y + r.height * fy); if (!hit || !(hit === el || el.contains(hit))) bad.push((hit && (hit.className || hit.tagName)) + ''); }
    return { covered: bad };
  };
  for (const [k, s] of [['lever', '#lever'], ['yawLeft', '#yl'], ['yawRight', '#yr'], ['move', '#move'], ['look', '#look']]) out[k] = topAt(s);
  const panel = document.querySelector('.horizon-airport'), pr = box(panel);
  out.panel = pr; out.cockpit = box(document.querySelector('.horizon-cockpit')); out.vw = vw; out.vh = vh;
  out.inside = {};
  for (const [k, s] of [['panel', '.horizon-airport'], ['cockpit', '.horizon-cockpit'], ['move', '#move'], ['look', '#look']]) {
    const r = document.querySelector(s).getBoundingClientRect(); if (r.width === 0) { out.inside[k] = 'hidden'; continue; }
    out.inside[k] = r.x >= -0.5 && r.y >= -0.5 && r.right <= vw + 0.5 && r.bottom <= vh + 0.5;
  }
  out.panelScrolls = panel.scrollHeight > panel.clientHeight + 1;
  out.dock = getComputedStyle(document.documentElement).getPropertyValue('--dock-height').trim();
  return out;
}
"""


def main() -> int:
    failures, rows = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for in_shell in (True, False):
            for theme in THEMES:
                html = OUT / f"harness-{theme}-{'shell' if in_shell else 'plain'}.html"
                html.write_text(page_html(theme, in_shell))
                for w, h, touch in VIEWPORTS:
                    ctx = browser.new_context(viewport={"width": w, "height": h}, has_touch=touch, is_mobile=touch, device_scale_factor=1)
                    page = ctx.new_page()
                    page.goto(html.as_uri())
                    page.wait_for_timeout(120)
                    m = page.evaluate(CHECK_JS)
                    tag = f"{'shell' if in_shell else 'plain'}/{theme}/{w}x{h}/{'touch' if touch else 'mouse'}"
                    hidden_pads = (not touch) and w >= 800
                    bad = []
                    for k in ("lever", "yawLeft", "yawRight", "move", "look"):
                        v = m[k]
                        if hidden_pads:
                            if not (v and v.get("hidden")):
                                bad.append(f"{k} should be hidden with a mouse at {w}px")
                        elif v and v.get("covered"):
                            bad.append(f"{k} covered by {sorted(set(v['covered']))}")
                    for k, v in m["inside"].items():
                        if v is False:
                            bad.append(f"{k} leaves the viewport")
                    rows.append({"case": tag, "dock": m["dock"], "panel": m["panel"], "cockpit": m["cockpit"], "panelScrolls": m["panelScrolls"], "problems": bad})
                    if bad:
                        failures.append((tag, bad))
                        page.screenshot(path=str(OUT / f"FAIL-{tag.replace('/', '_')}.png"))
                    elif theme == "classic" and in_shell and (w, h) in ((320, 568), (390, 844), (720, 1024)) and touch:
                        page.screenshot(path=str(OUT / f"ok-{tag.replace('/', '_')}.png"))
                    ctx.close()
        browser.close()
    (OUT / "report.json").write_text(json.dumps(rows, indent=1))
    print(f"{len(rows)} cases, {len(failures)} failing · out: {OUT}")
    for tag, bad in failures[:40]:
        print(" FAIL", tag, "|", "; ".join(bad))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
