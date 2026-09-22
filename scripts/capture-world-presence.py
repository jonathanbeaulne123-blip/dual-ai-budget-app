"""Two clients, one island: Sam watches Alex walk the Court (stills)."""
import json, os, sys
from playwright.sync_api import sync_playwright

OUT = sys.argv[1]
BASE = "http://127.0.0.1:4186/__review?member="
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"]
os.makedirs(OUT, exist_ok=True)
INIT = """
localStorage.setItem('hearth:appearance:v1:development:guest', JSON.stringify({appearance:{theme:'classic',atmosphere:false},pending:false}));
localStorage.setItem('hearth.world-presence.share:development', 'live');
window.__world = [];
const Native = window.WebSocket;
const Patched = function(url, p) { const s = new Native(url, p);
  s.addEventListener('message', e => { try { const v = JSON.parse(e.data); if (String(v.type).startsWith('world-')) window.__world.push({...v, at: Date.now()}); } catch {} });
  return s; };
for (const k of ['OPEN','CLOSED','CONNECTING','CLOSING']) Patched[k] = Native[k];
Patched.prototype = Native.prototype; window.WebSocket = Patched; sessionStorage.clear();
"""
STATE = """() => { const w=(window.__world||[]).filter(r=>typeof r.x==='number');
  return { draw: document.querySelector('.house-world__canvas')?.dataset.drawCalls,
           steps: w.length, age: w.length ? Date.now()-w[w.length-1].at : null,
           last: w.length ? {x:w[w.length-1].x, z:w[w.length-1].z, yaw:w[w.length-1].yaw, moving:w[w.length-1].moving} : null,
           line: document.querySelector('[data-walk-together-line]')?.textContent ?? null }; }"""

def press(page, key, times=1):
    page.evaluate("""([key, n]) => { const el=document.querySelector('.harbour-world__stage'); if(!el) return;
      for (let i=0;i<n;i++) el.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true})); }""", [key, times])

report = {"stills": []}
with sync_playwright() as pw:
    bs, pages = [], {}
    for m in ("MEM-001","MEM-002"):
        b = pw.chromium.launch(args=ARGS); bs.append(b)
        ctx = b.new_context(viewport={"width":720,"height":560}); ctx.add_init_script(INIT)
        p = ctx.new_page(); p.goto(BASE+m, wait_until="domcontentloaded", timeout=180000); pages[m]=p
    for p in pages.values():
        p.evaluate("""() => { history.pushState({}, '', '/house/home/middle?household=HH-WHOLE-HOUSE-FICTIONAL-REVIEW&scope=household'); window.dispatchEvent(new PopStateEvent('popstate')); }""")
    for p in pages.values(): p.wait_for_selector(".harbour-world[data-world-status='ready']", timeout=180000)
    alex, sam = pages["MEM-001"], pages["MEM-002"]
    stage = sam.query_selector(".harbour-world__stage")
    # Let the lane settle: wait until Sam has actually received positions from Alex.
    for _ in range(90):
        sam.wait_for_timeout(500)
        st = sam.evaluate(STATE)
        if st["steps"] >= 1: break
    print("settled", json.dumps(st), flush=True)

    def shoot_fresh(name, key=None, presses=0, tries=40):
        for _ in range(tries):
            if key: press(alex, key, presses)
            sam.wait_for_timeout(180)
            st = sam.evaluate(STATE)
            if st["age"] is not None and st["age"] < 350:
                stage.screenshot(path=os.path.join(OUT, name), timeout=240000)
                report["stills"].append({"file": name, "sam": st}); print(json.dumps(report["stills"][-1]), flush=True); return
            key = None  # keep Alex still after the first nudge, so he stays in frame
        st = sam.evaluate(STATE)
        stage.screenshot(path=os.path.join(OUT, name), timeout=240000)
        report["stills"].append({"file": name, "sam": st, "note": "no fresh sample in time"}); print(json.dumps(report["stills"][-1]), flush=True)

    shoot_fresh("01-sam-sees-alex-standing.png")
    shoot_fresh("02-sam-sees-alex-walked.png", "s", 2)
    shoot_fresh("03-sam-sees-alex-walked-again.png", "s", 2)
    alex.evaluate("() => document.querySelector('[data-walk-together] input').click()")
    sam.wait_for_timeout(6000)
    st = sam.evaluate(STATE)
    stage.screenshot(path=os.path.join(OUT, "04-sam-after-alex-stops-sharing.png"), timeout=240000)
    report["stills"].append({"file": "04-sam-after-alex-stops-sharing.png", "sam": st}); print("afterOptOut", json.dumps(st), flush=True)
    report["samReceived"] = sam.evaluate("() => (window.__world||[]).filter(r=>typeof r.x==='number').map(r=>({memberId:r.memberId, deviceId:r.deviceId, placeId:r.placeId, x:r.x, z:r.z, yaw:r.yaw, moving:r.moving}))")
    with open(os.path.join(OUT, "report.json"), "w") as fh: json.dump(report, fh, indent=2)
    for b in bs: b.close()
print("done")
