"""Compare two GLBs by eye and by pixel — the acceptance gate for `scripts/optimize-models.mjs`.

    PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/compare-model-fidelity.py \
      /models/mandevilla-living-presence.glb \
      /models/queen/mandevilla-living-presence.v2.glb \
      docs/evidence/model-fidelity

Both models are loaded in one headless Chromium page (SwiftShader draws the
WebGL), normalised exactly the way `bloom.ts` normalises the Queen — base on
the floor, 2.05 units tall — and drawn from the same cameras under the same
lights. For each camera it writes `<view>.before.png`, `<view>.after.png` and
`<view>.diff.png` (the per-channel difference multiplied by 8 so a shift you
could not otherwise see becomes visible), and it prints the mesh, material and
bounding-box readings of both models plus the pixel statistics.

Nothing here touches a hosted service or reads money: it serves the repository
over loopback and draws two porcelain cats.
"""
import functools
import http.server
import json
import os
import socketserver
import sys
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
BEFORE = sys.argv[1] if len(sys.argv) > 1 else "/models/mandevilla-living-presence.glb"
AFTER = sys.argv[2] if len(sys.argv) > 2 else "/models/queen/mandevilla-living-presence.v2.glb"
OUT = Path(sys.argv[3] if len(sys.argv) > 3 else "docs/evidence/model-fidelity")
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"]
SIZE = 900

PAGE = """<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#12100e}canvas{display:block}
</style><script type="importmap">{"imports":{
 "three":"/node_modules/three/build/three.module.js",
 "three/addons/":"/node_modules/three/examples/jsm/",
 "meshoptimizer":"/node_modules/meshoptimizer/meshopt_decoder.mjs"
}}</script></head><body><script type="module">
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'meshoptimizer';

const SIZE = __SIZE__, HEIGHT = 2.05;
// The cameras: straight on, a three-quarter turn, and close on her face and crown.
const VIEWS = {
  front:   {pos:[0, 1.35, 4.2],  look:[0, 1.0, 0], fov:32},
  quarter: {pos:[2.9, 1.9, 3.0], look:[0, 1.0, 0], fov:32},
  crown:   {pos:[0.35, 2.15, 1.5], look:[0, 1.72, 0], fov:30},
};

await MeshoptDecoder.ready;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

/** `bloom.ts`'s own normalisation: centre on x/z, base at y = 0, scaled to 2.05 units tall. */
function normalise(scene){
  const group = new THREE.Group();
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
  scene.position.set(-centre.x, -box.min.y, -centre.z);
  group.add(scene);
  group.scale.setScalar(HEIGHT / Math.max(size.y, .01));
  return group;
}

function readings(scene){
  let meshes = 0, vertices = 0, triangles = 0;
  const materials = new Set(), names = [];
  scene.traverse(node => {
    if (node.name) names.push(node.name);
    if (!node.isMesh) return;
    meshes += 1;
    const position = node.geometry.getAttribute('position');
    vertices += position ? position.count : 0;
    const index = node.geometry.getIndex();
    triangles += (index ? index.count : (position ? position.count : 0)) / 3;
    for (const m of Array.isArray(node.material) ? node.material : [node.material]) materials.add(m.name || m.uuid);
  });
  return {meshes, vertices, triangles, materials: materials.size, names: names.sort()};
}

const renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

function lights(scene){
  scene.add(new THREE.AmbientLight(0xfff4e8, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(2.4, 4.2, 3.1); scene.add(key);
  const rim = new THREE.DirectionalLight(0xbcd4e8, 0.9); rim.position.set(-3.0, 2.0, -2.4); scene.add(rim);
}

async function draw(url, view){
  const gltf = await loader.loadAsync(url);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x12100e);
  lights(scene);
  scene.add(normalise(gltf.scene));
  const v = VIEWS[view];
  const camera = new THREE.PerspectiveCamera(v.fov, 1, 0.1, 100);
  camera.position.set(...v.pos); camera.lookAt(new THREE.Vector3(...v.look));
  renderer.render(scene, camera);
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  renderer.getContext().readPixels(0, 0, SIZE, SIZE, renderer.getContext().RGBA, renderer.getContext().UNSIGNED_BYTE, pixels);
  return {pixels, gltf};
}

const canvas = document.createElement('canvas'); canvas.width = SIZE; canvas.height = SIZE;
const ctx = canvas.getContext('2d');
/** WebGL hands back pixels bottom-up; flip into the 2d canvas so the png is the right way up. */
function put(pixels, transform){
  const image = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    const src = (SIZE - 1 - y) * SIZE * 4, dst = y * SIZE * 4;
    for (let i = 0; i < SIZE * 4; i += 1) image.data[dst + i] = transform ? transform(pixels[src + i], i % 4) : pixels[src + i];
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

window.__run = async () => {
  const report = {views: {}};
  for (const view of Object.keys(VIEWS)) {
    const before = await draw('__BEFORE__', view);
    const after = await draw('__AFTER__', view);
    if (!report.before) { report.before = readings(before.gltf.scene); report.after = readings(after.gltf.scene); }
    let changed = 0, worst = 0, sum = 0;
    const diff = new Uint8Array(SIZE * SIZE * 4);
    for (let i = 0; i < before.pixels.length; i += 4) {
      let pixelWorst = 0;
      for (let c = 0; c < 3; c += 1) {
        const d = Math.abs(before.pixels[i + c] - after.pixels[i + c]);
        pixelWorst = Math.max(pixelWorst, d); sum += d;
        diff[i + c] = Math.min(255, d * 8);
      }
      diff[i + 3] = 255;
      if (pixelWorst > 2) changed += 1;
      worst = Math.max(worst, pixelWorst);
    }
    report.views[view] = {
      beforePng: put(before.pixels), afterPng: put(after.pixels), diffPng: put(diff),
      changedPixels: changed, changedShare: changed / (SIZE * SIZE),
      worstChannelDelta: worst, meanChannelDelta: sum / (SIZE * SIZE * 3),
    };
  }
  return report;
};
window.__ready = true;
</script></body></html>
"""


def serve(port: int):
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    # The urls are given the way the app fetches them (`/models/…`); the loopback
    # server is rooted at the repository, so they are served out of `public/`.
    served = lambda url: f"/public{url}" if url.startswith("/") else url
    page = PAGE.replace("__BEFORE__", served(BEFORE)).replace("__AFTER__", served(AFTER)).replace("__SIZE__", str(SIZE))
    scratch = ROOT / ".model-fidelity.html"
    scratch.write_text(page, encoding="utf-8")
    httpd = serve(4193)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(args=ARGS)
            page_ctx = browser.new_page(viewport={"width": SIZE, "height": SIZE})
            errors: list[str] = []
            page_ctx.on("pageerror", lambda e: errors.append(str(e)))
            page_ctx.goto("http://127.0.0.1:4193/.model-fidelity.html")
            page_ctx.wait_for_function("window.__ready === true", timeout=60_000)
            report = page_ctx.evaluate("window.__run()")
            browser.close()
            if errors:
                print("page errors:", errors)
                return 1
    finally:
        httpd.shutdown()
        scratch.unlink(missing_ok=True)

    summary = {"before": BEFORE, "after": AFTER, "readings": {"before": report["before"], "after": report["after"]}, "views": {}}
    names_match = report["before"]["names"] == report["after"]["names"]
    for view, data in report["views"].items():
        for kind in ("before", "after", "diff"):
            payload = data[f"{kind}Png"].split(",", 1)[1]
            (OUT / f"{view}.{kind}.png").write_bytes(__import__("base64").b64decode(payload))
        summary["views"][view] = {k: data[k] for k in ("changedPixels", "changedShare", "worstChannelDelta", "meanChannelDelta")}

    print(f"\n  {BEFORE}\n  {AFTER}\n")
    b, a = report["before"], report["after"]
    for key in ("meshes", "vertices", "triangles", "materials"):
        mark = "same" if b[key] == a[key] else f"{((a[key] - b[key]) / b[key] * 100):+.3f}%"
        print(f"    {key:<10} {b[key]} → {a[key]}   ({mark})")
    print(f"    node names {'identical' if names_match else 'CHANGED'}")
    print("\n    view        changed px   share      worst Δ/255   mean Δ/255")
    for view, row in summary["views"].items():
        print(f"    {view:<11} {row['changedPixels']:>9}   {row['changedShare'] * 100:>6.3f}%   {row['worstChannelDelta']:>9}      {row['meanChannelDelta']:.4f}")
    (OUT / "report.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"\n  screenshots and report.json → {OUT}\n")
    return 0


if __name__ == "__main__":
    os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/pw-browsers")
    raise SystemExit(main())
