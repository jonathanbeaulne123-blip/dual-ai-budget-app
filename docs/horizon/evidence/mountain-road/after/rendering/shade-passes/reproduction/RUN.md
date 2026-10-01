# Exact-asset shade parity and real CPU timing — root execution only

Prepared driver: `/tmp/mountain-shade-parity-plan/run.mjs`. This is a narrow adaptation of `/tmp/mountain-batching-visual-parity/run.mjs`; `driver.patch` exposes every change and `BASE.json` records hashes. No agent browser, import, test or GPU execution occurred. The rendering builders remain frozen bundle bytes; the existing fog/shadow/framebuffer code is reused. The earlier ordered-v1 failure is retained, not compared as the old material baseline.

The old bundle is `/tmp/mountain-real-draw-packed-depthfix`; new is `/tmp/mountain-real-draw-partitioned-nl-lite`. Both completed attempts have sourceDrift[] and the same world472dcf…/terrain0dc23…/entrycecd8b… hashes. New budget sweep is32/32 within unchanged limits; that does not establish visual parity.

Before launch the driver enforces complete frozen attempts, no source drift, identical world/terrain/audit entry and actual bundle-byte hashes. It compares every effective imported source hash and allows only `orderedContactShade.ts` plus `corridorArt.ts` to differ. It requires current frozen art source, removes only the exact reviewed shade import/installation/two-material declaration/registry entries, and requires the result to equal the old corridorArt SHA `5e1225cd…`. The unrelated raw native planting source drift is explicitly recorded; its actual narrow adapter hash is identical (`77c442…`). All three adapter byte hashes must remain equal. The resulting `source-proof.json` certifies this source scope, not GPU output.

Do not rebake or change these art sources before execution. Asset/source mismatch is an error requiring an explicit new comparison basis; this driver never substitutes a newer world.

## 1. Small callback/near-plane smoke

```sh
node /tmp/mountain-shade-parity-plan/run.mjs --root '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book' --out /tmp/mountain-shade-parity-v2-smoke --poses /tmp/mountain-shade-parity-plan/poses-smoke.json --district crown --themes newfoundland --tiers lite --times night --modes color --season spring --sequential
```

Six pairs: the actual remaining-v1 Crown peak and the actual Library-area lamp's grazing/near-plane/return sequence. Check `shadeEvents` before/after callbacks and `shadeDraws`: the known Crown count predicts676 back +180front=856 shade triangles, versus1680 old. Every source face and actual culling pass remains represented. Expect old legacy2pass versus new partial/partitioned with BackSide/FrontSide. Any pixel mismatch, callback exception, changed material state, or unaccounted count remains a failure to investigate.

## 2. Requested full parity matrix

```sh
node /tmp/mountain-shade-parity-plan/run.mjs --root '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book' --out /tmp/mountain-shade-parity-v2-matrix --poses /tmp/mountain-shade-parity-plan/poses.json --district crown --themes classic,taylor,newfoundland --tiers full,lite --times day,night --modes color,shadow --season spring --sequential
```

This is288 pairs/576 main frames:12 poses ×3themes ×2tiers ×2times ×2modes, fixed wind7.25 and640×420. Pose JSON includes the old10476 and v1-remaining10406 Crown views, actual Library garden bench above/below (all frozen contact samples y=89.05 on both tiers), actual lamp21 above/below/grazing/three near-plane positions, and exact return views. The source builder follows ground per vertex, but this particular frozen bench is measured flat and must not be presented as nonflat pixel coverage. Existing independent varying-face unit tests cover that boundary. The only other authored corridor bench, Long Sands Shore, has a pure-data sampled height range0.130628852m (`bench-height-inventory.json`); it is not added to this agreed matrix. Derived bench anchor is `[1364,89,592]`; lamp shade plane uses actual stored Float32 height91.77200317382812. `pose-source-proof.json` records source rows and exact frozen-grid triangulation/Float32 height conversion. Below/near-plane views deliberately stress rendering in this isolated scene; they are not seated rider cameras.

Within each theme/tier/time/mode/wind case, the same page, renderer, camera, art meshes/materials and light pool survive the ordered pose sequence. The existing `api.begin` recreates planting per pose for deterministic first appearance; this deliberately does not test plant streaming. Only one page is alive at a time; raw attachments are written to disk per pose rather than retained across the matrix. Approximate raw attachment footprint is3.6GB. No comparison tolerance is added: every differing color and shadow-color pixel is recorded. The final `allExact` flag is separate from completion.

Shade diagnostics wrap existing callbacks only to observe states; they do not change index/material/group/scene data. Returned rows include each actual before/after pass status, classification counts, group ranges, final shared material flags and actual renderer counters. The geometry group pointer/index upload behaviors are covered by root's14/14 source tests; the GPU matrix checks the real result.

Shadow mode retains the existing exact runtime walk shadowFrame and fixed bias/normalBias/resolution. The readback is the shadow **color attachment**, not the actual depthTexture; do not describe equal color bytes as measured depth precision. PCF effective type and non-clear counts are retained. Complete-world atmosphere, final baked geometry, interactive movement and device acceptance remain outside this isolated proof.

## 3. Small repeatable CPU sample (serial)

```sh
node /tmp/mountain-shade-parity-plan/run.mjs --root '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book' --out /tmp/mountain-shade-parity-v2-cpu --poses /tmp/mountain-shade-parity-plan/poses-cpu.json --district crown --themes newfoundland --tiers lite --times night --modes color --season spring --sequential --cpu-repeats 30
```

Two peak-view pairs,31 submissions each,124 total. `window.__parityRealNow` is bound to the original browser `performance.now` before replacing the **visual** performance/Date clocks. Each render duration therefore uses real elapsed CPU/WebGL submission time and cannot become a fabricated0ms because the visual clock is frozen. Repeat0 is retained separately; repeats1–30 provide warmed samples, not a GPU-time query or a physical-device frame-rate claim. Shadow repeats, if requested separately, explicitly refresh the shadow map each time so their work is comparable. The CPU run still captures exact pixel/counter output and adds no invisible filtering.

After these scoped passes, root still needs the complete required budget matrix and final baked/live captures. This preparation makes no claims about those pending gates.
