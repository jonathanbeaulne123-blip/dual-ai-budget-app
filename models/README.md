# Hercules 3D source

These files are the **canonical 3D model**, not the 96px kitchen cat.

| File | What |
|---|---|
| `hercules.source.glb` | THREE.GLTFExporter r184 from three-d-stage. ~7.2 MB, 4458 nodes, 788 meshes, no skins, no clips. Fur is thousands of cards (`fur_tail_*`, `fur_ruff_*`, `fur_cheek_*`, `fur_britches_*`). Hull parts exist: hips, torso, skull, muzzle, four legs, eleven tail bones, eyes, whiskers. |
| `hercules.pro.glb` | Generated Meshopt delivery asset for the optional ChatGPT companion. 2,797,232 bytes; named `rig_*` nodes are preserved so the browser can animate breath, head, ears, eyelids, and all eleven tail parts without baked clips. The build copies it to `dist/hercules-pro/hercules.pro.v1.glb` and fails if it exceeds 3 MB. |
| `hercules.mtl` | Matching palette: `furWhite`, `furTan`, `nosePink`, `whisker`, `eyeGold`, `pupilInk`, `earInner`. |

## Why this is not the live cat

At 96px on a phone almost none of a drawing survives. Claude's ink SVG is the kitchen runtime: one DOM, six parts, ruff under the head, breath and a drifting tail. Shipping the source GLB into `public/` would put 7 MB and thousands of draw calls next to Add, which is the kill criterion. The compressed `hercules.pro.glb` is a separate optional delivery: ChatGPT loads it only after `summon_hercules`; the Hearth app never loads it during ordinary navigation.

The 3D file **does** have hind legs. The 2D figure does not. That cheat is acknowledged in `docs/HERCULES_MARK.md`. Do not "fix" the SVG by tracing this mesh unless Jonathan asks.

## Palette

Live SVG stays paper-tuned (`--herc-coat: #fdfbf6`, `--herc-spot: #c9a884`) so he sits on `--paper`. MTL `furWhite` is warmer (`#e2d6c0`). Use MTL only when rendering the GLB.

Hex helpers: `src/herculesMaterials.ts`.

## Provenance

Original paths / a stage export. The old reference JPEG does not travel into this file or the SVG mark.
