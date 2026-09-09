# Hearth worksession — Plan worlds

- Status: PUBLISHED; owner/decision owner Jonathan; assignee Codex.
- Branch: `codex/worlds-plan`; verified baseline `6905022927401eb2d435b6d280ea8469bc812be0` (Calendar #415 merged).
- Risk: Medium-High; environment impact: none until separate release authorization.
- Authorization: Jonathan approved the workshop and instructed “finish this pr”. Publication only.

## Outcome and scope
Desktop gets wider Categories on the left and Kitty Banks above Sit-down on the right. Mobile retains its original single-column order. Compact and truthfully labelled budgeted net, explicit Actual / Budget labels, comfortable editing targets. One financial implementation, no APIs/schema/command changes.

Budget delta (5): less desktop scrolling, clearer financial labels, retained drafts/focus/scope/Confirm. Engagement delta (3): complete authored Plan scenes across all three themes and both scopes.

## Composition and provenance
- Classic: kitchen pinboard, cream pinned paper, coffee, trailing greenery and paper tabs; restrained wood/cork throughout the scroll.
- Shared Taylor / Fearless: champagne and honey-gold concert scrapbook leads, silver guitar, white boots, fringe, warm lights and stars. Storybook paper/ribbon details underneath.
- Personal Taylor / Debut: lake blue, turquoise, denim, ivory, daisies, butterflies and acoustic guitar. Blue-green washes connect upper/middle/lower margins.
- Shared Newfoundland / Signal Hill approach: sunny blue harbour, autumn gold shrubs, climbing coast, small houses and path.
- Personal Newfoundland / summit: open sky, stone lookout, distant fog, gulls and water. Simple generated Jonathan-on-cannon sticker in title card, using supplied IMG_1264.JPG as reference. Private reference photos remain unpublished.
- Official checks: https://tserasarchive.taylorswift.com/selftitled and https://tserasarchive.taylorswift.com/fearlesstv; album artwork https://www.taylorswift.com/wp-content/uploads/sites/2529/2024/12/debut-album.jpg and https://www.taylorswift.com/wp-content/uploads/sites/2529/2024/12/img-fearless-compressed.jpg; https://store.taylorswift.com/products/fearless-taylors-version-cd. Observed blue/green botanical debut and sepia gold Fearless materials; original ornament composition follows user boards images(6)/(5) and images(4)/(3)/(2), not copied collages, lyrics or logos.
- Localized movement uses existing pause/reduced-motion/focus/offscreen mechanisms; no financial rerenders.

## Verification plan
Baseline actual-page captures; normal/empty/long all6 theme/scope combinations at320/390/720/1100/1440/1920 plus breakpoint edges. Nested budget, bank and Sit-down flows; draft preservation, keyboard, targets, overflow, axe, zoom and motion. Focused repository gate and production build. Independent read-only review. Physical/Safari/VoiceOver/real OAuth/two-device acceptance not claimed.

## Evidence
Pending implementation.

## Implementation and observed results
- PlanArtwork/page-plan.css, PageWorld/SceneArtwork and page metadata compose all scenes. Original26KB generated cannon WebP,600×400, from image-generation run exec-b6cdb35f-3dfc-4d2b-a8ac-a7422961883a. Reference IMG_1264.JPG; generated image shipped, original remains private. Additional hike JPGs supplied in the workshop guide the scenery. HEIC/MOV were not additionally inspected during this implementation.
- Categories uses existing setBudget/onSave. Cancel/Escape restores editor-trigger focus and clears obsolete errors. Current actuals, budgets and amount arithmetic unchanged. Explicit receipt-line accessible names added to shared purchase sheet; Sit-down fact buttons expose expanded state. No command/schema/API changes.
- Same mounted components and phone DOM order throughout: summary → Categories → Sit-down → Kitty Banks. Desktop visual placement differs; keyboard traversal retains semantic order. No CSS order-driven data writes or remounting.
- Actual baseline all6 scenes captured390/1440. Normal/empty/long each passed48 viewport cases (320,390,719,720,1099,1100,1440,1920),144 total. Nested draft/error/expanded checks at320/390/720/1099/1100/1440; normal and long Shared contribution review/cancel; long Shared full-bank purchase draft/review/cancel; category/new-bank drafts; Sit-down facts. Axe at390/1440 and expanded desktop reported zero violations. Budget edit/remove44px, charm44×48px, visible keyboard focus,200%CSS zoom and page overflow passed. No hosted requests or live financial writes.
- Motion browser proof: persistent pause after reload, reduced motion, focus quieting and offscreen panel suspension (summit). All scene animations use the same scoped rules; other scenes covered by source review.
- Focused quick gate165tests passed (61fast,104serial), TypeScript/AI-surface/diff checks,104.516seconds, no time-budget breach. Bank confirmation and category draft node/focus survive all three theme previews without financial callbacks. App/rehearsal regression included. Quick evidence is not exhaustive-suite or release acceptance.
- Independent review found full-bank SVG sizing and phone title-art crop; both corrected. Purchase form now spans its bank card. Lower Newfoundland panels simplified to avoid repeating the whole harbour. Final presentation recaptures and production build recorded below.

### Exact commands
Runtime prefix: PATH=/Users/jonathanbeaulne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH. Workdir is the named worktree.

```sh
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --risk=medium-high --focus=test/plan-worlds.test.ts --focus=test/set-budget.test.ts --focus=test/kitty-banks.test.ts --focus=test/goal-funding-scope.test.ts --focus=test/goal-fill-ui.test.ts --focus=test/goal-purchase-ui.test.ts --focus=test/sitdown.test.ts --focus=test/page-worlds.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason='Plan columns and themes retain category drafts and focus, reviewed goal contributions, budget commands and full App continuity'
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never build
HEARTH_WORLD_PAGE=plan HEARTH_WIDTHS=320,390,719,720,1099,1100,1440,1920 node scripts/check-page-worlds.mjs
HEARTH_WORLD_PAGE=plan HEARTH_WORLD_STATE=empty HEARTH_WIDTHS=320,390,719,720,1099,1100,1440,1920 node scripts/check-page-worlds.mjs
HEARTH_WORLD_PAGE=plan HEARTH_WORLD_STATE=long HEARTH_WIDTHS=320,390,719,720,1099,1100,1440,1920 node scripts/check-page-worlds.mjs
HEARTH_WORLD_PAGE=plan HEARTH_SKIP_NESTED=1 HEARTH_ARTIFACTS_DIR=.artifacts/page-worlds/plan-final-layout HEARTH_WIDTHS=320,390,720,1099,1100,1440,1920 node scripts/check-page-worlds.mjs
```

Initial capture attempted during a TSX syntax error timed out; corrected before final proof. First purchase browser script incorrectly searched for a dialog before the inline draft's Review step; corrected to Review→Cancel→Not yet and reran all long scenes successfully. These failed setup/locator attempts are not counted as passes.

### Remaining acceptance limits
Physical devices, Safari, VoiceOver, native OS enlarged fonts, real OAuth and authenticated two-device flows were not exercised.200%CSS zoom is not native dynamic-type acceptance. Plan is synchronous once dashboard data is ready; global loading/recovery behavior was covered by focused App tests, not a new Plan-specific loading implementation. Mobile reading order/controls were checked; no claim of unchanged pixels. No merge/deploy/schema/Production action.

## Final presentation verification
Final header crop and lower-coast recapture passed42 actual-page cases across all6 scenes at320/390/720/1099/1100/1440/1920. Automated checks verified desktop columns and original single-column order below1100. Zero reported axe violations or page overflow; motion checks passed again. These presentation-only follow-ups came after the165-test gate and were followed by the production build (TypeScript, Vite54.49s, HerculesProUI), which passed. Existing PGlite browser-external/eval and large-chunk warnings remain.

[Desktop](../ux/page-worlds/plan-desktop.png) · [Full mobile](../ux/page-worlds/plan-mobile-full.png) · [Empty](../ux/page-worlds/plan-empty-desktop.png) · [Long](../ux/page-worlds/plan-long-desktop.png) · [Machine-readable evidence](../ux/page-worlds/plan-evidence.json). Expanded/error captures retain the pre-final decorative crop; financial forms and their final styles are unchanged. Fixed navigation appears partway down browser full-page screenshots; actual viewport tests checked the live controls separately.

Independent final source/visual review closed with no remaining concrete findings. Production build transformed638modules. PR publication recorded below.

## Publication
[PR #416 — Plan: desktop columns and complete themed scenery](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/416), implementation/evidence commit `c778362bf8d09f456d2565ea1cb7a355a5667d1f`, base `6905022927401eb2d435b6d280ea8469bc812be0`. This receipt adds no product changes. Hosted CI is reported separately from local validation. No merge or deployment.
