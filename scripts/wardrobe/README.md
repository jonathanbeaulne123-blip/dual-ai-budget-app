# Hercules fitting asset

The slice-4 canonical rig now supports the complete slice-5 catalogue: 36 original pieces and 12 legacy wearables. The source and the generated GLB are repository-owned. No third-party art, textures, personal photographs, household records or model-provider calls are used.

## Rebuild

From the repository root with its pinned Node dependencies installed:

```sh
node scripts/wardrobe/build.mjs
node scripts/wardrobe/collections.mjs
node scripts/wardrobe/collection-thumbnails.mjs
```

The builder reads `models/hercules.source.glb`, writes `public/hercules-wardrobe/hercules-cozy.v1.glb`, a deterministic gzip transfer copy, `manifest.json` and three original SVG thumbnails. The manifest records source/output SHA-256, byte count, mesh/bone counts, clips, anchors and occlusion regions. Source geometry stays intact in the original file; generated outputs are replaceable. Runtime uses the exported asset, never the authoring script.

## Rig and fit

The canonical 40 `rig_*` transforms become one joint palette. A 50 mm shoulder-subtree and weighted-vertex correction plants the source model’s front and hind paws on a common datum; inverse binds are recalculated before clips are authored. World-space body geometry is consolidated by material and removable body region. Torso vertices blend hips/spine/chest; other anatomy follows its existing nearest rig bone. Coat cards are deterministically reduced and shortened while anatomical hulls are retained. Normalized byte weights sum to 255; signed 16-bit normals use `KHR_mesh_quantization`. No external decoder or texture request is required. Browsers with native DecompressionStream fetch the gzip copy; older browsers fetch the GLB. Both paths parse identical verified bytes.

The sweater has a shaped shell, actual braided cable relief, open cuffs and shoulder-bound sleeves. It shares the body skeleton. The toque and metal glasses are rigid attachments under the head bone. Equipping the sweater hides `torso_*`; the hat hides `crown_*`. Removing a piece restores those regions. Named item nodes, catalogue IDs, SVG thumbnails and the lightweight pose layers use the same three IDs. Colour tokens are shared between the 3D material and SVG controls.

Twelve clips are exported. The glasses adjustment brings a sampled paw point within 10 mm of the frame at peak; blinks rotate the source eyelid hemispheres shut, and the short in-place strut alternates front/hind steps. Cape admiration is available only with the velvet cape. Sleeve checks require an actual sleeved garment. This is rig validation, not subjective likeness or all-garment visual acceptance.

## Runtime and release boundary

Set `VITE_HERCULES_DRESSING_ROOM=1` for a local fitting build, then Home/More → Hercules outfits → Open dressing room. The default build keeps the new entrance off. Room code, Three, GLTFLoader and the GLB load only after explicit opening. The scene has a real reflection, reachable HTML controls for each physical shelf object, camera controls, pause/reduced-motion support, intersection/document visibility suspension and explicit GPU-resource cleanup. Wear/Save use the existing member-personal command authority; explicit Share/Rename/Remove use the actor-bound shared gallery command. No financial or AI writer is introduced. Connected saves require the wardrobe capability advertised by the server; offline browsing never queues a fresh mutation.

Drafts use a guarded local key partitioned by environment, household and member. An unavailable local store is reported; the in-memory fitting remains usable. Lost WebGL/assets recover into matching 2D with Retry 3D. A failed JavaScript chunk is contained locally; because browsers cache failed module imports, its recovery explicitly reloads Hearth instead of promising an ineffective in-place retry.

Physical midrange-phone performance, owner likeness approval, and visual fitting acceptance remain required before enabling the wardrobe. Browser desktop emulation is not phone certification. See the slice-4 worksession for measured evidence and limitations.

## Collection extensions and compatibility

`pieces.ts` is the original recipe catalogue. `collections.mjs` authors distinct garment silhouettes, lapels, pockets, embroidery, knit bands, sequins, crowns, frames and charms, using the same corrected bind coordinates as the base rig. Seven small packs (six collections plus legacy) contain no duplicate cat. `collections.json` records their hashes and compressed sizes. The renderer loads them on demand, verifies bone order/inverse binds and rebinds to the one live skeleton. A request token keeps late loads from replacing a newer outfit; errors preserve the prior complete 3D fit, retain the draft and offer retry. Collection display errors clear stale shelf props.

Open cloth is two-sided and front-hanging neck/charm geometry has authored clearance over compatible coats. Closed coats occupy both body and outerwear; capes and aprons can layer. The manifest controls fur occlusion, so a visor/crown does not erase the crown of the head. Shared `glyphs.ts` drawings provide all thumbnails and lightweight layers; neckwear/charm render inside the real ruff pose group after the mane.

Legacy IDs and `legacy-original` remain valid. All old cosmetics are available without financial unlocks. The room treats three house items as distinct Keepsakes, and the old winter ruff as natural mane. Unknown stored IDs survive unrelated edits and display an unavailable item; wearing/saving validates the current catalogue. Competing legacy charms require an explicit first-preview choice, including explicit None, with the source configuration preserved.

Saved personal looks and worn state stay in `companionProfile`; only explicit projections enter root `companionGallery`. Each resource uses its own CAS revision and deletion tombstone. Books restore and Development activity replacement preserve this state. The feature remains off by default pending owner likeness and physical-device acceptance; no schema or hosted release is implied by these local files.

## Repeatable local browser proof

Run from the repository root. Use the installed Node runtime and pinned dependencies. These runners create only synthetic local demo data and block non-local browser traffic. They expect an explicit flagged build served on `127.0.0.1:5193`; do not point them at a real household or a hosted deployment.

```sh
VITE_HERCULES_DRESSING_ROOM=1 pnpm exec vite build
node scripts/build-hercules-pro-ui.mjs
pnpm exec vite preview --host 127.0.0.1 --port 5193 --strictPort
```

In another terminal, run the relevant proofs sequentially:

```sh
FINAL_FIT=1 node scripts/wardrobe/proof/browser.mjs
MATRIX_ONLY=1 node scripts/wardrobe/proof/browser.mjs
node scripts/wardrobe/proof/access.mjs
node scripts/wardrobe/proof/recovery.mjs
node scripts/wardrobe/proof/build-harness.mjs
node scripts/wardrobe/proof/persistence-browser.mjs
```

The first runner captures all 48 pieces, collection looks, poses and 2D comparison. The matrix covers 320/390/720/1100/1440/1920 in all six theme/scope combinations. Access checks enlarged text, keyboard containment and focus restoration. Recovery deliberately rejects a lazy chunk, base asset and collection pack, then tests retry, WebGL loss and cached swatches. JSON and screenshots are written under ignored `.artifacts/hercules-slice-5/`.

The optional fixture builder adds `dist/wardrobe-proof/` only for a local proof session. It uses real Room components and command authority with two synthetic member scopes; it tests lost acknowledgements, explicit sharing, independent copying and offline controls. It is neither Auth nor a second-device test. A normal subsequent Vite build removes that fixture. Never deploy the fixture output. Automated deformation/bounds tests and rendered screenshots still require human fitting review; they do not certify every garment/pose combination or owner likeness.
