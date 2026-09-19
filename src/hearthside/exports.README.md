# Hearthside production-file export toolkit

P14, isolated baseline `429db8ef0447dac6347e89e945dd04aad05e84fb`. Risk: Medium-High. Budget delta (5): no money writer, household input, balance-derived scale, or external service. Engagement delta (3): a couple can preserve a selected authored Kitty as real geometry and paint files, with an explicitly reviewed manufacturing derivative.

This is a local file toolkit. Root owns the UI, shared design authority, permissions, canonical documentation and package integration. It does not order, quote, take payment, upload, repair the original design, or promise a printer-ready object.

## Integration

Add these exact production dependencies and regenerate the normal pnpm lockfile:

```sh
pnpm add --save-exact manifold-3d@3.5.3 fflate@0.8.2
```

`manifold-3d` includes additional CLI/glTF dependencies in its package manifest, even though this toolkit imports only its core WASM API. pnpm may also resolve its `esbuild-wasm` peer. Preserve the resulting transitive lock entries; do not copy this worktree's manually isolated `node_modules`. Existing Three, Vite, Playwright, and Vitest dependencies suffice otherwise. There are no shared package/config edits in this commit.

1. Resolve the selected immutable design revision through the existing design authority. Materialize the normal `KittyPieceV1` projection of that revision. This module is a consumer, not a new source of design/goal truth; `documentId` and `revision` are provenance labels, not server authentication.
2. Construct `ExportSelection` with `version:1`, `documentId`, positive integer `revision`, `piece`, user-selected `heightMm` (30–1000), and `construction:'solid'|'hollow'`. Hollow additionally requires `hollow:{wallMm,coinSlotWidthMm,coinSlotDepthMm,baseOpeningDiameterMm}`. Wall range is 0.5–20 mm; slot width and base diameter must be at most half the height, slot depth at most one quarter. These are input bounds, not approved maker tolerances.
3. On the browser main thread, call `normalizeExportSelection()` then `captureAuthoredKitty(selection)`. This builds a fresh sculpture, captures the existing Canvas paint, and disposes its resources. Never capture the live bank presentation: `setFill`, squash, idle/spin, presentation poses, stage and invisible paint hit shells are excluded. Capture uses the canonical sculpture and current selected eyes, with the mouth closed. Size changes uniformly scale the authored design; no financial value enters this path. Internal `firedBy` actor identifiers are stripped from the export selection.
4. Start a dedicated worker with `new Worker(new URL('./exportWorker.ts', import.meta.url), {type:'module'})` (adjust the relative source path from the importing module). Post `{type:'prepare',requestId,selection,capture}`. The worker returns `{type:'prepared',requestId,token,selection,proposal,report}` and retains one job. `exportWorker.ts` bundles `manifold-3d/manifold.wasm?url` as a same-origin asset. Do not accept a remote WASM URL from a user.
5. Show the source preview, measured report, every proposed action, listed omissions/caps, and any blockers. Source-exact solid export needs no repair approval. To make a solid manufacturing derivative or any hollow bank, require explicit acceptance of this exact proposal. If `proposal.blockers` is nonempty, the proposed repair cannot run; source-exact solid files remain available. Surface failure codes and keep the source preview.
6. Post `{type:'finish',requestId,token,approvedRepairDigest?}`. Set `approvedRepairDigest` only after the user accepts that exact proposal. The worker returns `{type:'complete',requestId,manifest,files:[ [name,Uint8Array], ... ]}` with transferred buffers, or `{type:'error',requestId,code}`. Convert files to a Map and call `zipExportFiles(files)` for one archive. Revoke download object URLs. Use progress/cancel UI; terminate the worker on cancel, sign-out, scope/revision changes or navigation, and discard late replies. No worker job survives reload. A stale token is rejected and a busy worker rejects another job.

For tests or an existing export worker, the lower-level API is `await prepareKittyExport(selection, capture)` then `await finishKittyExport(prepared, {approvedRepairDigest?,wasmUrl?})`. Capture may be omitted only in a Canvas-capable browser. The prepared data and proposal are rehashed/rederived before export; callers cannot rewrite the repair description and merely rehash it. Capture is a trusted locally generated design projection, not an uploaded-geometry endpoint. A bare capture cannot prove a server revision. Keep the existing authority check in the host.

## Files and semantics

| File | Payload |
| --- | --- |
| `kitty.stl` | Binary triangle STL, Z-up, numeric coordinates in mm. STL cannot encode units or color; the user must import as mm. |
| `kitty.3mf` | Real OPC ZIP, content types/relationships, explicit millimeter/Z-up geometry, material colors, UV resources and embedded PNG textures. |
| `kitty.glb` | glTF 2.0 GLB JSON/BIN chunks, meters/Y-up, embedded PNGs, UVs, normals and PBR color factors. |
| `source-authored.glb` | Original authored geometry/paint, included whenever a repair was approved. |
| `source-design.json` | Selected design revision and normalized design copy. No household snapshot, goal or balance. |
| `paint/source-paint.json`, `paint/material-*.png` | Stroke/stamp source data and the actual baked Canvas paint references. |
| `geometry-report.json`, `geometry-sheet.pdf` | Source/final reports, measured dimensions, opening evidence and a readable one-page sheet. Its schematic is explicitly not to scale. |
| `manifest.json` | Selected revision, selection/source/final geometry digests, approved repair, reports and SHA-256/byte size for every other payload. The manifest does not recursively hash itself. |

The frozen manifest and file hashes provide a reproducible local record, not a signature or server approval. Compare hashes before using mutable byte arrays. Given identical captured PNG bytes and selection, JSON and archive metadata are deterministic. Browser/Canvas/font versions can rasterize the same strokes differently, so cross-platform paint bytes are not claimed identical.

The source-exact default preserves the authored triangles. The actual Kitty consists of intersecting solids plus zero-thickness decorations and open tube ends. Its STL is readable reference geometry; it is not automatically suitable for slicing. Its 3MF uses `type="other"`, since `type="model"` asserts manufacturing mesh requirements. Some slicers may ignore reference objects. The reviewed derivative uses `type="model"` only after oriented closed-edge checks pass, and retains the authored GLB separately. No source-exact output is silently repaired.

## Reviewed derivative and honest limits

The displayed proposal binds the exact selection and source geometry. It explicitly lists zero-thickness omissions and planar caps; it permits seam welding, removing numerical zero-area triangles, Boolean union, and a maximum 0.001 mm simplification tolerance. The final float32 geometry is canonicalized by 0.00001 mm cells while preserving UV seams, then rechecked. New cavity/cut surfaces use neutral clay; the original painted outer faces retain their texture coordinates. Repairs never mutate the source design.

Hollowing uses axis-aligned cube erosion, which is conservative and does not produce a uniform wall offset. It keeps only an interior component reached by both openings; other components remain solid. The slot is centered over the authored head and base access under the authored body. The base cut is a 96-sided cylinder; the report includes its nominal diameter and smaller inscribed diameter. Evidence includes measured cutter bounds, shared cavity volume, center rays, nine near-edge/interior slot rays and seventeen base rays against the final serialized mesh. These are sampled clearances, not coin-fit or stopper-fit certification; no stopper or maker tolerance profile is invented.

Reports count boundary, nonmanifold and reversed edges, degenerate triangles, connected components, and measured dimensions (X width, Y height, Z depth, in mm). Self-intersection checks are bounded to 200,000 candidate pairs or 20 findings, use a 0.00001 mm epsilon, and omit shared-vertex neighbors; exhaustion is explicitly `not-fully-checked`. Vertex-link manifoldness is unverified. Hollow wall checks use at most 128 inward-normal triangle-centroid rays and report the sampled minimum; this does not establish global minimum wall, strength, thin-rim suitability, shrinkage or support requirements. `printerReady` is always false and maker tolerances always unverified.

The tested default authored Kitty retains six disconnected solid components after review. The report warns about them; attaching them or removing them needs a different reviewed repair. A closed, textured file is useful for downstream review, but does not establish a printable one-piece keepsake. Unsupported/nonplanar repairs, empty cavities, openings that miss or fail to share a cavity, blocked access, invalid topology and detected intersections fail explicitly. No fallback changes the selected design.

## Verification and handoff

Focused test: `test/hearthside-exports.test.ts`. It checks selection/accessor safety, proposal tampering, deterministic containers/hashes, units, independent STL/3MF/GLB loading, actual Canvas brush replay, reviewed authored solid and hollow geometry, shared cavity and serialized opening clearance, and browser WASM worker execution. The browser suite uses an isolated Vite server and installed Chrome; it does not navigate or alter a user browser. Synthetic designs only. It does not represent Safari/iPhone/Android performance, slicer interoperability, physical printing, color calibration, or maker acceptance.

Run `pnpm test -- --risk=medium-high --focus=test/hearthside-exports.test.ts --focus-reason="Production export payloads, reviewed geometry and browser worker integration"`. This is scoped quick-gate evidence, not exhaustive/release evidence. Parent integration must rerun with the committed package/lock changes and test real UI review/cancel/scope isolation before enabling the feature. Root owns canonical docs and the program worksession; this focused README is the bounded module handoff.

Local evidence, 2026-09-12: the final quick gate passed all 15 tests, TypeScript, AI surface and diff checks in 181.447 seconds, within its 300-second budget. The actual authored hollow check took 64.259 seconds under concurrent machine load (earlier isolated work was about 17 seconds); real-device performance is open and the dedicated worker is required for responsive UI. The final executable change fingerprint was `90ef502e389b25cf8c212d208f4c3693cf183094918d50e4eac1273785bd5fbb` at baseline HEAD, with files uncommitted; this paragraph was added afterward. The previous gate failed only on obsolete PDF test cleanup, then was corrected and rerun. With the desktop runtime pnpm wrapper, use `pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- ...` to prevent its automatic dependency check from touching a shared install. No release, deployment, external upload or physical fabrication was performed.

Primary format references: [3MF Core](https://github.com/3MFConsortium/spec_core/blob/master/3MF%20Core%20Specification.md), [3MF Materials](https://github.com/3MFConsortium/spec_materials/blob/master/3MF%20Materials%20Extension.md), [glTF 2.0](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html), [Manifold API](https://manifoldcad.org/docs/jsapi/classes/manifold.Manifold.html). The 3MF UV origin is lower-left; glTF uses upper-left, so GLB flips V. Linear base factors and sRGB PNGs are kept distinct.
