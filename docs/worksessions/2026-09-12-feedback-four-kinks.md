# Hearth worksession — four feedback kinks

- Status: IMPLEMENTED — local review passed; PR handoff pending
- Date: 2026-09-12 (America/Toronto)
- Owner and decision owner: Jonathan
- Implementation: Codex; UX audit: Claude; independent code/visual review: calendar_review
- Repository: jonathanbeaulne123-blip/dual-ai-budget-app
- Branch: codex/feedback-four-kinks
- Baseline: a0d76e99b9a0d1e31aafc618608fe4dcdb7ef100
- Risk: Medium-High
- Environment impact: none; no deployment or schema application

## Outcome and scope

One PR for F-005/F-006/F-003/F-004 across the main pages and all three themes. Reduced competing actions and explanatory prose; Calendar distinguishes type, ownership, status and connected spans; bracelet pairs are fixed background discoveries. Latest instruction supersedes the prior title bracelet cluster and one-PR-per-page requirements.

Budget delta (5): truthful receipt status and clearer financial navigation. Engagement delta (3): calmer controls, remembered optional disclosures and authored keepsakes.

Preserved drafts, privacy, command authority and Final Confirm. No recurrence schema changes, guessed Google privacy, random placement, full Play redesign, external-calendar writes or real household data.

## Verified baseline and changes

Claude audited 429db8ef; a0d76e9 differed only in runtime activation files. Independent source review confirmed the separate cash-flow pane, hidden desktop Add tab stops, extra Play nav child, redundant month-history entries and prominent title bracelet cluster.

- App/Home/Books/Plan/Together/Planner: one Calendar Home door, one Books history door, secondary Back and focus, contextual Play routes, shorter repeated prose.
- Calendar/presentation: receipt-backed completed occurrences and stable span lanes in a display-only model. Core board totals, projections and financial commands are untouched.
- Theme CSS/art: all three themes retain their scenes; bracelets move to lower background margins. Narrow tab sizing, readable Books close surface and Newfoundland personal contrast corrected.
- RememberedDetails stores only local open/closed presentation state. Google deep links still reveal and focus connections.

## Verification

Node PATH: `/Users/jonathanbeaulne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`.

- `pnpm build` passed, including workspace typecheck and Hercules Pro UI. Existing PGlite browser/eval and large-chunk warnings remain.
- Change-focused quick gate passed 48 files / 571 tests in 191.6 seconds, under the 300-second budget. This included full-App startup (81 tests), onboarding, Bianca mainline, calendar scope/Google/commands, Books and theme/copy contracts. An earlier interrupted environment run exceeded five minutes without a verdict and is not used as passing evidence. An earlier completed run exposed outdated Calendar tab assertions and Home copy over-budget; both fixed. A final clean-commit rerun is required before PR handoff and its exact SHA/result will be recorded in the PR.
- Added targeted evidence tests for received-income wording, stable overlapping runs, overflow, shared-account ownership, early matched payments, missing/reversed/duplicate receipt exclusion and Google calendar identity.
- Browser matrix: 198 layout cases across 320/390/720/1100/1440/1920 pixels, both scopes and all themes; 33 A/AA axe scans, no violations. See [evidence](../evidence/feedback-four/README.md).
- Actual month-history navigation and Back focus passed in both scopes and all themes. Calendar Dates/Cash flow passed throughout. Expanded Calendar day, keyboard month slider, appointment draft, medical log and bill draft cancellation passed in local Classic browser proof in both scopes.
- Independent review caught and verified fixes for malformed motion CSS, Calendar tab clipping, Back origin/focus and Books contrast; no remaining code or reviewed-image blockers.

Exact quick-gate command:

```sh
pnpm test -- --risk=medium-high --focus=test/calendar-presentation.test.ts --focus=test/calendar-kinds.test.ts --focus=test/page-worlds.test.ts --focus=test/copy-budget.test.ts --focus=test/navigation-one-route.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason="Calendar evidence and spans, navigation, three themes and preserved financial flows"
```

Browser: local Vite on port 5198, `node scripts/check-feedback-four.mjs`; `HEARTH_PROOF_SCOPE=personal` selects Personal, `HEARTH_PROOF_NESTED=1` selects expanded Classic Calendar checks. Put `HEARTH_ARTIFACTS_DIR` outside the checkout.

## Handoff and limits

Next owner: Jonathan for PR review. These are local synthetic-browser and focused regression results, not exhaustive-suite, physical-device, live Google, deployment or Production acceptance. No merge or deployment is authorized by this implementation step. Do not mark spreadsheet items live-complete before the eventual released behavior is verified.
