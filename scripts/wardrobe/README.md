# Hercules fitting asset

This is the slice-4 vertical slice, not the full wardrobe catalogue. The source and the generated GLB are repository-owned. No third-party art, textures, personal photographs, household records or model-provider calls are used.

## Rebuild

From the repository root with its pinned Node dependencies installed:

```sh
node scripts/wardrobe/build.mjs
```

The builder reads `models/hercules.source.glb`, writes `public/hercules-wardrobe/hercules-cozy.v1.glb`, a deterministic gzip transfer copy, `manifest.json` and three original SVG thumbnails. The manifest records source/output SHA-256, byte count, mesh/bone counts, clips, anchors and occlusion regions. Source geometry stays intact in the original file; generated outputs are replaceable. Runtime uses the exported asset, never the authoring script.

## Rig and fit

The canonical 40 `rig_*` transforms become one joint palette. A 50 mm shoulder-subtree and weighted-vertex correction plants the source model’s front and hind paws on a common datum; inverse binds are recalculated before clips are authored. World-space body geometry is consolidated by material and removable body region. Torso vertices blend hips/spine/chest; other anatomy follows its existing nearest rig bone. Coat cards are deterministically reduced and shortened while anatomical hulls are retained. Normalized byte weights sum to 255; signed 16-bit normals use `KHR_mesh_quantization`. No external decoder or texture request is required. Browsers with native DecompressionStream fetch the gzip copy; older browsers fetch the GLB. Both paths parse identical verified bytes.

The sweater has a shaped shell, actual braided cable relief, open cuffs and shoulder-bound sleeves. It shares the body skeleton. The toque and metal glasses are rigid attachments under the head bone. Equipping the sweater hides `torso_*`; the hat hides `crown_*`. Removing a piece restores those regions. Named item nodes, catalogue IDs, SVG thumbnails and the lightweight pose layers use the same three IDs. Colour tokens are shared between the 3D material and SVG controls.

Twelve clips are exported. The glasses adjustment brings a sampled paw point within 10 mm of the frame at peak; blinks rotate the source eyelid hemispheres shut, and the short in-place strut alternates front/hind steps. Cape admiration remains unavailable until a cape exists. This is rig validation, not subjective likeness or all-garment visual acceptance.

## Runtime and release boundary

Set `VITE_HERCULES_DRESSING_ROOM=1` for a local fitting build, then Home/More → Hercules outfits → Open dressing room. The default build keeps the new entrance off. Room code, Three, GLTFLoader and the GLB load only after explicit opening. The scene has a real reflection, reachable HTML controls for each physical shelf object, camera controls, pause/reduced-motion support, intersection/document visibility suspension and explicit GPU-resource cleanup. No cosmetics command, profile save, financial command, AI call or gallery write exists in this preview.

Drafts use a guarded local key partitioned by environment, household and member. An unavailable local store is reported; the in-memory fitting remains usable. Lost WebGL/assets recover into matching 2D with Retry 3D. A failed JavaScript chunk is contained locally; because browsers cache failed module imports, its recovery explicitly reloads Hearth instead of promising an ineffective in-place retry.

Physical midrange-phone performance, owner likeness approval, and visual fitting acceptance remain required before enabling the wardrobe. Browser desktop emulation is not phone certification. See the slice-4 worksession for measured evidence and limitations.
