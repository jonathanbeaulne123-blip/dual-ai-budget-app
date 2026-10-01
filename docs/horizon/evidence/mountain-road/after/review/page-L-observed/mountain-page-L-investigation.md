# Page L: bounded saved-data investigation

No source changes, world/runtime imports, raycast execution, test, browser or GPU work performed. The prepared diagnostic was syntax-checked only.

## Exact existing evidence

`/tmp/mountain-page-L-saved-views.json` contains the complete C/D/F/L cameras and proofs extracted from current baked JSON, fixed integrated main `1cf76c551e6f49124b6257162bc4d36ca18d7bd1`, and original `324cd5f`.

Current readable world SHA256: `472dcf42f57f15f9c484185828512804c2b712bb19e1d63cdbb904a72a082600`.
Integrated-main readable world: `7ae2357ff113a3eadf195a4e2d95832b621eee2deb3703fd4ffd37af6d60e3bb`.
Original324: `16bfa5985484be9b0224665ee4452de4b6be31006923bd22c3d7b1cbf327a864`.

| Required subject | Original324 landscape / portrait | Integrated main | Current | Threshold landscape / portrait |
|---|---:|---:|---:|---:|
| L Boathouse | 11 / 4 | 13 / 5 | 13 / 5 | 13 / 8 |
| C skate shelf | 30 / 4 | 30 / 4 | 30 / 4 | 13 / 8 |
| D surf | 14 / 0 | 14 / 0 | 14 / 0 | 13 / 8 |
| F L01 | 161 / 0 | 161 / 0 | 161 / 0 | 13 / 8 |

L's current complete proof equals integrated main. Therefore its outstanding three pixels are a **portrait shortfall (5 of 8)**, not three newly lost pixels in Mountain Road. The bridge merge improved landscape by two and portrait by one; this is independently retained in `docs/horizon/evidence/bridges/after/views/comparison.json`, page L, and `after/LOOK.md:22`. The task still expressly owes the shortfall: no inheritance waiver. C/D/F retain identical failing subject counts and exact cameras across all three snapshots; their other scene contents need not be identical (e.g. Stillwater becomes more visible on F).

Original L cameras remain landscape eye `[1484,4.6,1295]`, target `[1285,4,1315]`, horizontal 55° at authored 16:9; portrait eye `[1460,4.6,1300]`, target `[1285,4,1315]`, horizontal 45°.

## What is and is not attributable yet

Current baked proof stores a generic `occludedBy` message and eight aggregate scene-hit categories, not the per-Boathouse-ray blockers. The dominant terrain/S3/quay/bridge categories do **not** establish which hides the three missing subject rays. In particular, naming the Quay Bridge rails from the aggregate list would be unsupported.

Historical source review (`docs/horizon/README.md:496`) attributes the phone shortage to the harbour west bank and reports at most six pixels after old quay pose trials. That is useful prior evidence, not a current first-hit identity. The earlier S3 6–7 m obstruction at `[1433,1298]` in README:219 was an older landscape defect; the current S3 profile pin already requests 3 m there (`land/beds/build.ts:41`), and current sampled S3 height nearby is ~4.27 m after fitting. Neither that pin nor old narrative proves a present local lowering is safe or sufficient.

The current subject is Horizon-owned `host.boathouse*` (`world/views.ts:92`), including its approach because the prefix rule includes it. Walls occupy x1275–1295, z1308–1322, y3–9.65; roof x1274.5–1295.5, z1307.5–1322.5, y9.65–10. The host build is `land/town/hosts.ts:24–53`, not native Mountain scenery. Its slab/door/approach and the harbour bank are separable from native Mountain geometry; this only establishes ownership, not repair permission or feasibility.

**No measured local repair or new camera choice can honestly be recommended from the aggregate proof alone.** Do not cut S3, alter the bridge, lift the host or move the camera speculatively. A first-hit diagnostic must distinguish terrain bank, retained S3 structure, landmark bridge geometry and mere projected subject size. If only a Horizon bank/retaining lip blocks enough rays, root can measure a bounded local repair with camera and bridge fixed. If the unobscured host is too small or only protected bridge geometry can be cleared, a concrete host/view design choice will be needed. Neither outcome is established yet.

## Prepared next measurement, root serialized only

```
node /tmp/mountain-page-L-diagnostic.mjs "$PWD" /absolute/fresh-page-L-diagnostic
```

Optional `--proposals` adds portrait eye +0.3/+0.6/+1.0 m diagnostic variants, with original target/FOV and 8-pixel criterion unchanged. Original is always measured first; these are not adopted or verified standing positions. Use the original-only run to identify cause before proposing any view change.

The script bundles the existing ray caster, subject tests, view pixels, lens and terrain decoder. Its only adapter extracts the exact pure terrain sampling/mouth-mask functions and prevents terrain generation; native Mountain source imports throw. It reads only existing baked world/full terrain, saves bundle and exact input/source hashes, records the original saved proof, and runs only L portrait. It reports every pixel ray whose path intersects any actual Boathouse subject triangle, the nearest Boathouse triangle, its actual first-hit source ID/point, fog treatment, blocker counts, Lantern Row count and geometric horizon. This distinguishes hidden subject area from size limits and can name local blocker triangles/terrain points. No roof/terrain/bridge or camera is mutated.

Decoded terrain is centimetre-quantized; the script explicitly checks original subject-count reproduction and fails if it differs or source hashes change. A discrepancy must be diagnosed, not silently accepted. The raster is the original 60×130 proof grid; no new lower threshold or alternate lens is used. Baked ray proof still excludes separately generated runtime furniture and does not replace actual authored renders.
