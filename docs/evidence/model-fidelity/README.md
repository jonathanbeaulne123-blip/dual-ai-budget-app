# Living Presence · master vs optimised

Evidence that `public/models/queen/mandevilla-living-presence.v2.glb` draws the
same Queen as `public/models/mandevilla-living-presence.glb`.

Regenerate with:

```sh
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/compare-model-fidelity.py \
  /models/mandevilla-living-presence.glb \
  /models/queen/mandevilla-living-presence.v2.glb \
  docs/evidence/model-fidelity
```

Both files are loaded in one headless Chromium page (SwiftShader draws the
WebGL), normalised the way `bloom.ts` normalises her — base on the floor,
2.05 units tall — and drawn from the same three cameras under the same lights.

| view | changed pixels | share | worst channel Δ | mean channel Δ |
| --- | --- | --- | --- | --- |
| front | 2 721 | 0.336% | 76 / 255 | 0.0895 / 255 |
| quarter | 1 704 | 0.210% | 104 / 255 | 0.0663 / 255 |
| crown | 5 639 | 0.696% | 81 / 255 | 0.1757 / 255 |

Every changed pixel sits on an antialiased silhouette edge — the `*.diff.png`
files are the per-channel difference **multiplied by 8**, and they are still
almost entirely black. Nothing moved that a person could see; nothing moved
that a person could see if it were eight times worse.

Readings, from the same run: 71 → 71 meshes, 656 380 → 656 380 triangles,
26 → 26 materials, node names identical, 337 062 → 335 813 vertices (weld
merged 1 249 bitwise-identical duplicates). Scene bounds moved 2.35e-6 units.

`report.json` carries the exact numbers, measured off the framebuffers before
any image encoding. The `.png` files are palette-encoded to keep the
repository light; read the numbers from the json, not off the pixels.

Sizes: 12.32 MB → 2.99 MB raw, 8.15 MB → 1.74 MB gzipped.
