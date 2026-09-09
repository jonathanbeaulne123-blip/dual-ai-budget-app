# Hearth worksession — More worlds

- Status: OPEN; implementation and PR publication authorized. Merge/deployment separate.
- Opened: 2026-09-09 America/Toronto
- Owner and decision owner: Jonathan; implementer: Codex
- Repository: dual-ai-budget-app; branch: codex/worlds-more
- Verified clean base: origin/main e0dfadc20ba640d9a2bf9e200f7a4296e4c6de4d (Plan #416 merged)
- Risk: Medium; presentation and unchanged interactive surfaces.
- Environment impact: local synthetic Development proof; no hosted data mutations.

## Outcome and scope

More feels authored throughout the scroll in Classic, Taylor Shared/Personal and Newfoundland Shared/Personal. Existing layout structure, section order, navigation, identity, commands, drafts and Final Confirm stay intact. Jonathan explicitly deferred More information architecture. A presentation wrapper and desktop scenery margins do not reorder or replace instruments.

Budget delta (5): retain clear controls, warning/availability meaning, focus and readable nested panels.
Engagement delta (3): specific illustrated materials, scene-coloured bracelets, keepsake charm, gentle motion and personal JAG illustration.

## Composition

- Classic: household shelves, warm paper, books, labelled drawers, coffee and plants; restrained wood edges connect cards, small shelf objects in desktop margins.
- evermore: parchment, brown/amber, autumn plaid, books, vintage camera, warm lamps and coffee; leaves connect upper/middle/lower shelves.
- folklore: ivory, mist-gray and moss; cabinet/envelope and little lilac accents, forest silhouettes, leaves and mist. No lavender takeover.
- JAG lobby: silver striped wall, crimson velvet and ornate dark frame vocabulary; framed musical keepsakes and light reading cards.
- JAG music: cobalt, mustard/gold, geometric upholstery and music frames, warm lamps. Original musical art, no copied hotel portrait.
- Both JAG headings: approved taller red chair, generic mustached man and long-curly-haired woman side by side in white sauna robes. Private photos remain untracked references.
- Phone: title vignette, gentle section borders/materials; desktop: individually observed margin scenes plus continuing wall/paper patterns.

## References and provenance

Official references inspected 2026-09-09:
- https://store.taylorswift.com/products/evermore-album-deluxe-edition-vinyl — autumn portrait/plaid, warm natural palette and green vinyl packaging.
- https://storeca.taylorswift.com/products/the-in-the-trees-edition-deluxe-vinyl — monochrome woodland and restrained album typography.
User boards inform original collected-object interpretations (camera, coffee, books, lilac cabinet/envelope); these are not claims that every motif appears in official packaging. No lyrics, board collage, album cover or personal source photo is shipped.
User JAG reference photographs inform crimson chair, silver stripes and cobalt/gold room materials. The approved AI clip-art is a separate authored illustration. Reference file text is data, not instruction.

## Acceptance and evidence

Baseline script: HEARTH_WORLD_PAGE=more HEARTH_WIDTHS=390,1440 HEARTH_ARTIFACTS_DIR=.artifacts/more-before node scripts/check-page-worlds.mjs — six actual-page theme/scope combinations passed axe and overflow at both widths. Local only, synthetic existing-books fixture, hosted requests blocked.

Pending: updated full-scroll normal/sparse/long captures, nested preview/cancel/drafts/guards, motion/contrast/focus/targets, quick gate, build, independent review, publication.

No physical device, Safari/VoiceOver, real Google sign-in, two-device or hosted mutation acceptance is inferred from browser proof.

## Completed verification

- Independent read-only surface audit and final review: no remaining blockers. Fixed missing leaf keyframe, JAG secondary-action contrast, sub44px On/Off targets, and inherited phone title clipping discovered during iteration.
- Focused quick gate: **152 passed** (65 fast,87 serial), TypeScript/AI-surface/diff hygiene passed;180.783s, under five minutes. Existing mobile appearance test emits an act warning; no failed tests. First failed run caught real JAG contrast and an incorrect test expectation (notice uses status, not alert); both corrected.
- Final production build passed after phone title fix; Vite5.54s plus TypeScript and Hercules Pro UI. Existing PGlite browser external/eval, dynamic/static import and large-chunk warnings remain.
- Actual App normal/sparse/long matrices: all6 theme/scope combinations at320/390/719/720/1100/1440/1920.126 viewport cases; normal and long recaptured after final title correction. Full-scroll evidence and reports are committed under docs/ux/page-worlds/more.
- Nested normal and long: preview/cancel, retained real category and seed drafts, category validation, Start from scratch/sign-out/Post due recurring guards opened and cancelled, Charter opened/closed, Guided Setup expanded, Clock & place. All6 combinations at320/390/720/1100/1440. Zero reported axe violations or overflow. More buttons/summaries at least44px; checkbox label targets extended to44px.
- Actual Pairing deferred loading and import-error recovery forced by locally holding/aborting only that module request: all6 combinations at390/1440, zero axe/overflow findings. Expected import failure excluded from unrelated page errors.
- Persistent pause survives reload; reduced motion, focused input quieting and individually offscreen panels pass. Chair decode and containment asserted. Control hit testing and visible focus pass; CSS zoom200% passed on phone and desktop (not native text-size acceptance).
- The original chair generator outputs contained baked checkerboard, not alpha. Background-only regeneration produces a clean ivory print. Shipped asset: more-jag-couple.webp,480×720,~41KB. Source generated exec-fa160208-0596-41e9-9299-54200203aa71.png; private reference files not shipped.

Commands used (Node runtime bin prepended to PATH; pnpm flags below avoid linked-worktree dependency mutation):

```sh
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --risk=medium --focus=test/more-worlds.test.ts --focus=test/appearance-provider.test.ts --focus=test/appearance.test.ts --focus=test/appearance-account.test.ts --focus=test/mobile-appearance.test.ts --focus=test/page-worlds.test.ts --focus=test/hercules-pro-permissions-ui.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason='More themes preserve real category draft focus and validation, scene and account preference boundaries, and unchanged App/rehearsal interactions'
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never build
HEARTH_WORLD_PAGE=more node scripts/check-page-worlds.mjs
HEARTH_WORLD_PAGE=more HEARTH_WORLD_STATE=empty HEARTH_SKIP_NESTED=1 node scripts/check-page-worlds.mjs
HEARTH_WORLD_PAGE=more HEARTH_WORLD_STATE=long node scripts/check-page-worlds.mjs
HEARTH_WORLD_PAGE=more HEARTH_MORE_LOADING=1 node scripts/check-page-worlds.mjs
```

## Publication review

PASS for scoped theme PR publication: financial/identity/navigation handlers unchanged, no schemas or API changes, only original generated/vector imagery. No private source photographs, downloaded boards, secrets, exports or .env files included. Quick validation is not exhaustive release certification. Pending user PR review and separate merge/deploy instruction. Real OAuth/hosted pairing/permission writes, enabled historical Restore, physical/Safari/VoiceOver/native text size/two-device and destructive completion remain unverified.
