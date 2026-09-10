# Hercules slice 4 — 3D dressing-room vertical slice

Status: implemented locally behind an off-by-default fitting flag; ready for owner art review, not release acceptance. Jonathan requested slice 4. No push, merge, deploy, hosted changes, schema, secrets or provider calls.

Baseline: clean `8f2240cd2b2feb254661d20e36b0a342c1a9ebf1` (local slice 3). Fresh `origin/main` was verified at `2e113f69d03872eddc22ac461378a0f3e33f6c55` before implementation. Branch `codex/hercules-3d-wardrobe-slice`. Codex was the sole writer, with independent read-only asset/rig and lifecycle/accessibility reviews. Claude was not needed for this bounded slice.

Budget delta (5): fitting is a member-scoped local cosmetic draft, with no financial, profile or gallery command. Engagement delta (3): a physical dressing room, one complete coordinated look, reactions and useful fitting controls. Risk High for Office integration; rendering itself Medium.

## Implemented

- Cozy at home: cable-knit sweater, pom-pom toque and round glasses; shared colour tokens, rigid head anchors, skinned clothing, body/crown occlusion and original SVG thumbnails. Matching lightweight layers live inside the existing figure's animated head/body groups and are checked in loaf/sit/walk.
- Reproducible export from the unchanged repository-owned source, one 40-bone skin and twelve clips. Corrected actual eyelid closure, alternating strut steps, paw-to-glasses contact and the source's uneven front/hind paw stance. Garment-dependent reactions are unavailable without the item; cape admiration is exported but disabled until a cape exists.
- A real reflective room with garments aligned to their hangers, physical shelf selection and equivalent accessible controls, turn/zoom/back view, pause/reduced motion, scoped local history and an honest 2D fallback that disables 3D-only pose controls with clear explanatory copy. Theme treatments follow the More-page mappings: Classic wood/brass/linen; Taylor Shared cottage and Personal woodland; Newfoundland Shared dressing lounge and Personal music room.
- Desktop rail/mirror/control composition; phone full-height composition with a large preview and reachable controls. A stable Office owner survives breakpoint changes. Close restores focus to the current layout if its original opener disappeared.
- Lazy room/Three/GLB loading; abort and late-result protection; hidden/offscreen RAF suspension; disposal of unique geometry, materials, skeletons, reflection target and renderer. Scene loading applies the latest look, pose, camera and motion choice.
- Guarded environment/household/member local drafts and bounded undo/redo. Storage failure is visible. Asset/WebGL failure keeps fitting controls and offers Retry 3D; a failed JavaScript chunk stays local and offers explicit Reload Hearth because browsers cache rejected module imports.

Enable only for a local fitting build with `VITE_HERCULES_DRESSING_ROOM=1`. The default entrance remains off. The existing worn look is not replaced by a fitting draft. Full 36-item catalogue, acknowledged Wear/Save, personal continuity and explicit shared gallery remain slice 5.

## Asset evidence

| Property | Final export |
| --- | --- |
| Raw GLB | 5,389,228 bytes |
| Gzip transfer copy | 1,854,980 bytes |
| Hierarchy | 58 nodes, 15 meshes, one skin, 40 bones |
| Reactions | 12 exported; 11 usable with the first outfit |
| Source SHA-256 | `4d669d8c3d9255ded4f52644f078fb6ee7f5a0c9649d2d2a5dae89039c62fde4` |
| GLB SHA-256 | `91e9b04be18df3957c8250dcc90e6432768a15ab7fc05584c3d7c584c2ef6734` |
| Gzip SHA-256 | `ca3137a51f546a42e2829c801d106264891f1728d9bf3e6d807acca4b72a1b81` |

Source contained 4,458 nodes and 2,252 mesh instances. Export has no external textures or decoder request. Native gzip decoding is used where needed; already-decoded CDN responses and the raw-GLB fallback are supported. The response-buffer diagnostic is decoded bytes when the host supplies Content-Encoding, not a network-transfer measurement. See [rebuild/provenance](../../scripts/wardrobe/README.md) and the generated public manifest. No third-party art or household photographs/data were used.

## Verification

- Focused asset tests verify byte-identical gzip decoding, source/output hashes, a single joint palette, attachment parents, complete/unique clip tracks, valid normalized weights and finite bounded deformation samples for every clip. The corrected front/hind paw datum agrees within 1 mm; the adjustment's sampled paw point reaches within 10 mm of the glasses (independent calculation: 1.55 mm).
- Mounted UI tests cover latest state during delayed loading, abort/late disposal, failed 3D with usable fitting controls and retry, blocked local storage, unavailable garment reactions, member isolation, breakpoint-stable ownership/focus and matching SVG pose hooks.
- Production build with the local fitting flag passed, including the existing Hercules Pro UI build and no-redirect guard. Main app and lazy scene are separate; the scene chunk is about 637 kB before HTTP compression. Existing PGlite externalization/eval and large-chunk notices remain nonfatal build warnings.
- Actual built-app synthetic browser matrix: **36 checks**, all three themes × Shared/Personal × 320/390/720/1100/1440/1920 px, with no horizontal overflow, no WCAG A/AA/2.1 AA axe violations and no page errors. These layout checks preceded the final neutral-stance correction; the layout CSS did not change. Final control-state refinements were covered by mounted UI tests. The final production build passed in 34.47 seconds; front/back, reactions and 2D comparison were rechecked at 390/1440; an independent reviewer found no visible raised-sleeve separation or stance regression.
- Final-asset cold room opening: **1,591 ms** with 20 Mbps / 50 ms network emulation, including first room/scene loading; **zero 3D requests before opening**. A separate uncached-asset reopening measured 1,763 ms. Twelve cached colour changes measured 2.0–4.4 ms. A 30-second desktop browser run averaged 59.37 rendered frames/s. These are local desktop observations, not physical-phone certification.
- Built-app recovery: rejected room chunk contained locally and recovered after explicit reload; asset 503 retained rose selection and retried; reduced motion added no idle frames; WebGL loss and 2D mode removed their canvases; close returned to the opener. At 320 px with text enlarged to 200%, there was no horizontal overflow, colour controls worked, 40 Tab presses stayed in the modal, and Escape closed the room and focused the phone Drawer button.
- Local artifacts are in `.artifacts/hercules-slice-4/`: `browser-report.json`, `fit-final-report.json`, `recovery-report.json`, `access-report.json`, theme screenshots and final stance/raised-paw images. They contain synthetic demo evidence only and are not committed.

The first gate attempt exceeded its five-minute target during host memory pressure; a multi-megabyte deep-equality assertion also timed out. It was replaced with native byte equality, preserving the exact assertion. A subsequent 95-test High gate passed in 257.8 seconds. The final High quick gate passed all **96 tests** plus TypeScript, AI-surface verification and diff checks in **156,653 ms** (no time-budget breach), with fingerprint `917560528eb787a7b5a935ea3672422f331c1856336b079afabb2b3c0b1ca023` over base/head `8f2240cd2b2feb254661d20e36b0a342c1a9ebf1`. Only this evidence document changed after that tested fingerprint; executable sources, tests and assets are unchanged. Exhaustive/full-suite, hosted, real-member and deployment verification were not requested or run.

## Remaining acceptance boundaries

1. Jonathan's subjective likeness/art review against the existing Hercules.
2. Representative physical midrange-phone proof: at least 30 fps for 30 seconds, fitting gestures and thermal/memory behaviour. Emulation does not close this gate.
3. Physical Safari/VoiceOver and device-specific rendering remain unverified. Current browser evidence is Chrome on this host.
4. The full catalogue, Wear/Save/share and cross-device wardrobe continuity are deliberately deferred to slice 5. No blanket all-garment clipping claim is made from this first look.

The fitting preview is reviewable locally. Keep its default flag off; no release, provider activation, financial write or shared-gallery publication is implied.

## Reproduction and handoff

Use the bundled Node runtime and constrained-worktree pnpm flags:

```sh
export PATH=/Users/jonathanbeaulne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/jonathanbeaulne/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --base=8f2240cd2b2feb254661d20e36b0a342c1a9ebf1 --risk=high --focus=test/hercules-wardrobe.test.ts --focus=test/hercules-wardrobe-ui.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason='Final fitting room, honest 2D fallback, shared rig and scoped Office integration'
VITE_HERCULES_DRESSING_ROOM=1 pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never exec vite build
node scripts/build-hercules-pro-ui.mjs
test ! -e dist/_redirects
```

The build equivalents above passed with Vite's own output-directory cleanup; the aggregate script's shell deletion was not used. Browser commands against the task-owned local preview on port 5193: `node .artifacts/hercules-slice-4/browser.mjs` (36 combinations), `FINAL_FIT=1 node .artifacts/hercules-slice-4/browser.mjs` (final desktop/phone and pose recheck), `node .artifacts/hercules-slice-4/recovery.mjs`, and `node .artifacts/hercules-slice-4/access.mjs`. All exited zero. Latest gate/build logs: `/tmp/hercules-s4-final-gate.log`, `/tmp/hercules-s4-sealed-build.log`; final browser log `/tmp/hercules-s4-fit-sealed.log`.

Changed areas: `src/wardrobe/`, `scripts/wardrobe/`, `public/hercules-wardrobe/`, the two wardrobe test files, optional figure-layer hooks, Office/wardrobe entrance integration and canonical status/decision documentation. No package/dependency change. Independent read-only reviews covered rig/fitting and lifecycle/focus; raised-paw sleeve attachment and corrected neutral stance passed their scoped visual review.

Next owner: Jonathan for likeness/art feedback and representative physical-phone acceptance; Codex can address that feedback before flag activation or slice 5. No release decision is requested by this local implementation. Rollback is removal/reversion of this local slice; no hosted migration or financial repair is involved.
