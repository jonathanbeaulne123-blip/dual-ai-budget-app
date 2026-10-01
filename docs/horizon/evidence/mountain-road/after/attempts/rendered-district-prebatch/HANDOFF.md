# Temporary actual WebGL corridor draw audit

Status: **revised diagnostic, source-reviewed only; revised version not bundled or executed by this agent**. Root's first smoke is retained at `/tmp/mountain-real-draw-smoke/summary.json`: it failed before Chromium because the unused native ground graph reached `node:fs/promises`. The previous proposal files and hashes remain in `previous-before-loader-fix/`. No checkout writes, world imports, tests, Chromium or bake ran here. Root owns serial execution. Both revised files must remain together; there is no repository patch to apply. `/tmp/mountain-real-draw-loader-fix.patch` records the diagnostic-only delta.

- `renderer-audit.mjs`: Node driver, local frozen-asset server, sequential Chromium contexts and evidence writer.
- `renderer-audit.page.ts`: browser entry using existing corridor art, planting and road lighting builders.
- `BASE.json`: source/file identities for this proposal. Future run output hashes its own actual complete bundle input graph and frozen assets.
- `/tmp/mountain-lakeside-rendering-options.md` / `.json`: limits, actual inventory and conditional choices; no batching/removal implementation.

First bounded smoke after the slot is released (a fresh output directory is required):

```sh
node /tmp/mountain-real-draw-proposal/renderer-audit.mjs \
  --root '/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book' \
  --out /tmp/mountain-real-draw-smoke-v2 \
  --districts lakeside --themes classic --tiers full \
  --seasons summer --times day,night \
  --capacity /tmp/mountain-light-gap/candidate-budgets.json
```

The optional retained capacity file above is known to use an earlier world hash. The harness explicitly reports the mismatch; root should substitute the final matching report when available. It does not run the capacity builder itself. For reviewed rider views add `--views /absolute/path/to/captures.json`; `records[].pose.eye/target` are copied exactly and the view-file hash/world match is reported. Do not describe nominal diagnostic station eyes as newly physically seated rider views.

After the smoke is complete and errors are understood, a separate fresh output can request `--districts lakeside,prow,crown,hollow` and omit theme/tier/season/time restrictions for all three themes, both tiers, four seasons and day/night. There is only one browser page alive per theme/tier. If root wants the original capture viewport, pass `--width 1100 --height 720`; the default 550×360 has the same aspect and therefore the same frustum but is less costly for count-only SwiftShader work. `--chromium` overrides the existing macOS Chrome default. No device-performance conclusion is available from this harness.

## What is counted

Each frame calls the actual THREE.WebGLRenderer on one resident district's unchanged furniture and plants. Whole-world lamp competition remains under the real shared 6-full/2-lite point pool. The globally shared road glow and pool mesh submissions are both charged in full whenever drawn; they are never multiplied per lamp. Door/threshold pool/bead geometry is on another camera layer and excluded from corridor attribution, but its light-card competition still runs. Point-light counts and card caps are asserted.

Every submitted Mesh/Line/Points object is instrumented around its existing onBeforeRender/onAfterRender hooks. The sum of category deltas must equal renderer.info.render.calls. It retains actual transparent DoubleSide back/front submissions, zero-alpha/zero-scale shader work, exact active instance counts and submitted triangles. No hidden counting exemption is introduced. GL errors, console shader errors, missing identities, incomplete district builds or unsettled lights fail the run and retain partial evidence. Completed frames earlier in an eight-frame chunk are flushed even if a later sample fails; the failed pose/stack is retained and never marked complete.

Important: existing budget statistics count meshes, not necessarily WebGL submissions. Corridor contact shade is transparent DoubleSide, so Three can render it twice. The harness separately records the current furniture's call upper bound ignoring frustum/detail hiding, using actual material pass counts, without rewriting the retained CPU report. Active plant counts without frustum culling are recorded separately from actual submitted calls. Neither a sum of component peaks nor a finite camera union is reported as an exhaustive simultaneous peak.

## Scope and sampling

It uses all corridors by default (`--corridors` can explicitly restrict them) and the budget's route stations every12 samples plus endpoints in both directions, each selected lamp pool in both x directions, and every planting root in four explicitly recorded headings. Nominal eyes are anchor+1.65m. The authored mountain-air pose is included, along with optional exact captured poses. All requested review views run with each requested isolated district resident, exposing its contribution from that camera. The full ordered pose inventory is saved. Plant distance/residency hysteresis follows that sequence within each case; seasons start with a new planting instance.

Three narrow source adapters isolate data used by the unchanged builders: (1) the exact `crownOf` function from mountain/planting.ts, as in the CPU budget; (2) exact `sceneDressingFrom` and `SCENE_DRESSING` excerpts from scene/place.ts, still using the real COURT_DRESSING and theme data; (3) exact `GEOGRAPHY_REVISION` and `sampleTerrain` excerpts from the Horizon terrain index, still using its real pure clamp. The served terrain decoder is unchanged. The native planting generator and the decoder file's three unreachable encode-only helpers throw if called; no fake height or fallback is returned. Every adapter saves its full raw-source hash, adapted hash and adapted source. A strict native/land dependency allowlist rejects unexpected source generation before browser launch. These guards have not yet run in a bundle here. Frozen served JSON/terrain buffers are loaded once, so changing files later cannot change the active run's assets. Baked terrain ground conformation matches the existing budget approximation; it is not real composed geography. No terrain/native/structure occluders are mounted. Builder materials, wind and plant fades remain, but the live global fog/environment is not mounted. No physical support, appearance or occlusion acceptance is claimed.

Shadow maps and other extra passes are disabled to measure the same base-pass corridor scope. The renderer is actual WebGL, normally SwiftShader, not a hardware device proof or whole-world GPU-time test. `renderSubmitMs` is CPU submit time, not GPU duration. Plant birth animation uses the normal browser clock; work is counted even while it has zero shader scale. Light settling advances only the existing bounded light-update clock; it does not move physical objects or alter light caps.

## Evidence and interpretation

Output retains `frames.ndjson` (each actual frame/pose/category/object), `summary.json` (each case's completed/requested counts and peak witnesses, separate review-view peak, errors and limitations), pose inventories, bundled harness, esbuild input graph, source/asset/script hashes and optional unchanged capacity-reference JSON. Source drift during the run is a failure. Attempts use an exclusive `frames.ndjson` open, so reusing an output directory cannot overwrite a failed attempt.

`sampledAtMost12` and `sampledAllAtMost12` refer only to completed samples. `exhaustiveBudgetAcceptance` stays false. Any timeouts, shader failures or incomplete sample matrices remain incomplete; do not turn them into green budget evidence. A peak over12 is a direct witness. A peak at/below12 demonstrates only this recorded finite set. Required ROAD §8 limits and pending device/visual acceptance remain unchanged.

## Source rereview of actual counting

Installed Three revision185 wraps its two transparent DoubleSide submissions inside one object onBeforeRender/onAfterRender pair. The per-object renderer.info delta therefore correctly records two calls, and the exact category sum is checked against the real renderer total. Default Object3D callbacks are functions, so preserving them with apply is valid. Art update hides nonresident district groups before rendering; each case prebuilds its requested district to avoid partial asynchronous builds. These are source conclusions only, not a successful smoke.
