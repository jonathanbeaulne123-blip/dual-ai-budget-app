# Plan: authored worlds and desktop columns

Jonathan approved the Plan workshop and asked to finish its PR. [PR #416](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/416) is published. Publication is the delivery target; merge/deployment are separate.

Branch `codex/worlds-plan` starts from verified main `6905022927401eb2d435b6d280ea8469bc812be0` (Calendar #415). Risk Medium-High. Owner Jonathan; implementation/review coordinator Codex. No hosted writes, schema, API or Production changes.

Plan uses two desktop columns from1100px: wider Categories on the left, Kitty Banks above Sit-down on the right. Phone/tablet order remains Categories → Sit-down → Kitty Banks, using the same mounted components. DOM/keyboard traversal retains that order on desktop. The compact summary accurately labels budgeted net; Actual / Budget labels and44px edit targets improve scanability. Cancel/Escape restores editor focus. Existing command/Confirm/accounting behavior is preserved.

Classic is a kitchen planning board. Taylor Shared is gold Fearless concert scrapbook with storybook details; Personal is blue-green Debut with guitar/daisy/butterfly art. Newfoundland Shared follows the sunny Signal Hill approach; Personal opens to the summit and a simple generated Jonathan-on-cannon sticker. Scenery continues through the scroll with localized motion, pause/reduced-motion/focus/offscreen handling. Original reference photographs and collages remain private; sources and26KB asset provenance are in the worksession.

Budget(5): less desktop scrolling, clear amounts, retained edits and money authority. Engagement(3): complete scene-specific objects, materials and motion across all themes/scopes.

## Evidence

- Focused quick gate165tests passed (61fast+104serial),104.516s; TypeScript/AI/diff passed. This is not exhaustive-suite/release certification.
- Production build passed: TypeScript,638 Vite modules,54.49s Vite build, HerculesProUI. Existing PGlite/eval/browser-external and large-chunk warnings remain.
-144 normal/empty/long actual-page viewport cases across all6scenes;42 final presentation cases, including both sides of1100px and phone/tablet sizes.
- Expanded category/bank drafts and budget errors; Shared contribution Confirm cancellation; full-bank purchase Review/Cancel; Sit-down fact expansion. Zero axe violations in checked normal/expanded views;44px targets, focus,200%CSSzoom, overflow, persistent pause, reduced motion, focused-entry quieting and offscreen suspension verified.
- Meaningful React tests preserve category draft/focus and an open bank Confirm through all three theme previews without financial callbacks.
- Independent review closed after fixing full-bank sizing, purchase width and phone title art cropping.

[Desktop](../ux/page-worlds/plan-desktop.png) · [Mobile](../ux/page-worlds/plan-mobile-full.png) · [Empty](../ux/page-worlds/plan-empty-desktop.png) · [Long](../ux/page-worlds/plan-long-desktop.png) · [Budget error](../ux/page-worlds/plan-budget-error.webp) · [Purchase](../ux/page-worlds/plan-purchase.webp) · [Confirm](../ux/page-worlds/plan-confirm.webp) · [Receipts](../ux/page-worlds/plan-evidence.json) · [Exact commands and provenance](../worksessions/2026-09-09-plan-worlds.md).

## Limits and next owner

Local Chrome browser proof is separate from physical devices, Safari/VoiceOver, native font enlargement and authenticated OAuth/two-device acceptance. Plan has no page-owned asynchronous loading surface; existing global App recovery was regression-tested. No private-photo publication or real financial writes. Expanded/empty/long evidence predates final header/lower-coast decorative tweaks; final normal layout captures show those corrections. Mobile order was preserved, not pixel-identical appearance.

Next owner Jonathan for PR review. Do not infer merge/deployment authorization from this packet. Rollback is a scoped PR revert; no migration involved. Other page work remains paused.
