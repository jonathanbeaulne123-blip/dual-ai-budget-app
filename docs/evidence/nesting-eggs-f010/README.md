# Nesting eggs + F-010 — local evidence

[PR #466](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/466), Development fixtures only. The application source is `c85c5b7df72ce12f3b475409b7c15bde451f5296`, based on main `1686ccc4a569c99b5a2d92ae8b311b83873e211d`. `f7f00c6` updates only the existing Home browser test selectors and its optional local Chromium path. The final interaction-probe change places its empty-background point clear of the grown King and also asserts a successful near-edge hit. Matrix fingerprints precede that probe-only change; application source is unchanged. Subsequent evidence/docs commits do not change application behavior.

## Measured checks

| Check | Result | Evidence |
| --- | --- | --- |
| High focused gate | 563 tests / 51 files; 83.164 seconds of 300; clean source SHA; no breach | [Gate](quick-gate.json) |
| Earlier unchanged-head gate | Same 563 tests passed; 465.831 seconds, budget breached under local contention | [Prior timing breach](quick-gate-prior-budget-breach.json) |
| Appointment posting regression | 20/20, 2.05 seconds | [Result](appointments.json) |
| Release build | App/workspace TypeScript, Vite and Hercules UI passed | [Result](build.json) |
| Primary surface matrix | 180 cases: Home, Plan, King, category, setup | [Results](surface-matrix.json), [source fingerprint](surface-source.json) |
| Active King studio matrix | 108 cases: Shape, Paint and Kiln | [Results](editor-matrix.json), [source fingerprint](editor-source.json) |
| Actual App Home flow | 21 theme/width cases plus 3 setup-route cases; no page errors or serious/critical Axe findings | [Results](actual-app-home.json) |
| Studio interactions | Retained King/Goal paint, refire, stop spin, off-pot rejection, chapter completion, exact door, return focus and both broken views | [Results](interactions.json) |
| GitHub on application + browser-test head | Test, confirmed-actions, Pages and hearth-books build passed; Supabase preview skipped | [Checks at f7f00c6](source-ci.json) |
| Private command authority | Personal design accepted; absent from Shared; old writer rejected | [Result](authority.json), [probe](authority-probe.mjs) |

The 180/108 matrices use Classic, Taylor and Newfoundland, Our Home and My Money, and 320/390/720/1100/1440/1920px. All cases have zero root/editor horizontal overflow and zero page errors. Selected Axe rules (contrast, button name, label, valid ARIA and hidden focus) run at 390/1100px with zero violations. The actual App flow additionally checks 719px, 44px Home button heights, goal selection, Review Fund assignment, return focus, Charter and Fund navigation. It uses broader WCAG 2 A/AA Axe tags and fails on serious/critical findings.

The local High gate includes all 81 startup regressions and the full month-rehearsal mainline suite. The prior budget breach is retained rather than reported as an under-budget pass. The build retains an existing chunk-size advisory. Some jsdom tests log its unsupported canvas context; real Chromium paint checks supply the rendering evidence.

## Selected screenshots

These are fictional books rendered by the real components; none are mockups or real household exports.

- [Classic Home, desktop](classic-household-1100-home-full.png)
- [Taylor Plan, phone](taylor-household-390-plan-full.png)
- [Newfoundland Personal nest, phone](newfoundland-personal-390-home-full.png)
- [Classic King paint controls, desktop](classic-household-1100-king-paint.png)
- [Taylor Personal King paint controls, phone](taylor-personal-390-king-paint.png)
- [King painted in Simple view](king-flat-paint.png) and [same paint in 3D](king-3d-paint.png)
- [Paid pot in 3D](broken-3d.png) and [Simple view](broken-flat.png)

Category props and crowns are original SVG/Three geometry. Scene colors, fonts and materials reuse the repository's current [scene map and reference provenance](../../PAGE_WORLD_REFINEMENT.md#reference-provenance) and [page-theme execution standard](../../briefs/PAGE_THEME_EXECUTION_STANDARD.md). The new motif sets are interpretations, not copied album artwork or personal memorabilia.

## Reproduce

Run the focused gate and build from the [handoff](../../briefs/NESTING_EGGS_F010_HANDOFF.md#how-to-verify). With the local dev server on port 5181, run each browser command sequentially so only one Hearth page is open:

```sh
OUT=/tmp/hearth-nest-proof node scripts/fixtures/kitty-studio/nest-proof.mjs
OUT=/tmp/hearth-nest-editor-proof ROUTES=king-shape,king-paint,king-kiln node scripts/fixtures/kitty-studio/nest-proof.mjs
OUT=/tmp/hearth-nest-interactions node scripts/fixtures/kitty-studio/nest-interactions.mjs
node test/home-feedback-layout.mjs
node docs/evidence/nesting-eggs-f010/authority-probe.mjs
```

The nest scripts accept `CHROME`; the actual App test accepts `HEARTH_CHROMIUM`. Without an override the App test uses Playwright's installed browser, as CI does. The matrix reuses results only when its source-content fingerprint matches. For the local runs, Chrome on macOS used headless mode and reduced motion. No hosted household or provider was connected. The App test blocks external and non-GET requests.

## Limits

This is local synthetic and focused-gate evidence, not deployment or exhaustive-suite acceptance. The actual App fixture intentionally lacks an accepted-books receipt and shows recovery; no financial Confirm was submitted. Authenticated two-device continuity, physical iPhone/Safari/VoiceOver, live offline/reconnect recovery and every possible brush/shape/GPU combination remain unverified. Pure/model tests cover empty catalogs, signed balances, receipt history and scope isolation; the screenshot matrices are populated fixtures. Enlarged text and unusually long labels were not part of a separate browser matrix. Reduced motion and stop-spin were browser-tested; wider atmosphere pause/offscreen behavior reuses existing surfaces and was not separately recertified.
