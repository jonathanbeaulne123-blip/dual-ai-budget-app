# Hearth worksession — living pages across three worlds

- Status: OPEN — implementation, no merge or deployment
- Owner / decision owner: Jonathan
- Assignee: Codex, with independent read-only reference and UX reviewers
- Repository: dual-ai-budget-app
- Initial branch: codex/worlds-01-home
- Verified base: origin/main `12dce380749725fb11aa68140899648b78d29ff6`
- Risk: Medium-High presentation; no financial writer changes
- Environment: isolated local synthetic Development verification

## Household outcome

Eight page PRs: Home, Plan, Calendar, Books, Till, Shift, More, Entry/onboarding. Each includes Classic, Taylor and Newfoundland and both supported scopes. Publish stacked PRs, without merge/deployment.

## Budget delta (5)

Funds and goals receive clear visual emphasis while existing urgent facts, authoritative amounts, mobile instrument behavior, drafts and Final Confirm stay intact.

## Engagement delta (3)

Whole-page authored scenery, album/place-specific materials, pausable motion, accessible playful charms and a bottom-of-Home scrapbook.

## Decisions and scope

Jonathan approved implementation on 2026-09-09. Supplied photographs are private illustration references only. No original photos, album artwork, credentials or household data enter the repository. Bianca chooses scrapbook photos later. Remove fictional ticket requirements. Rose sequins reference the supplied dress; orange/mint Showgirl references official rollout. No photo-management feature or new persistence schema.

## Acceptance evidence

Each page: actual-App normal/empty/long/expanded states, all themes and scopes, 320/390/720/1100/1440 widths, keyboard/44px/contrast, paused/reduced/offscreen motion, focused gate and build. Browser evidence does not certify physical devices or authenticated cross-device restoration.

## Evidence log

- Main fetched and clean isolated worktree created from `12dce38`.
- Implementation and validation results will be appended per PR.

## Handoff

Codex owns implementation and PR publication. Jonathan owns review and any later release instruction. No release is authorized by this packet.

## PR 1 — Home

- New whole-page illustration/margins, era LED bracelet, accessible charms and single closing manual scrapbook. Funds/goals retain their financial implementation and receive authored framing. Ticket removed; reference photos remain private.
- Final quick gate: 128 tests, TypeScript/AI/diff, 69.616s; no five-minute breach. Command: `pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --risk=medium-high --base=12dce38 --focus=test/page-worlds.test.ts --focus=test/mobile-appearance.test.ts --focus=test/appearance-provider.test.ts --focus=test/phone-fold-ui.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason="Home gallery navigation, route-aware offscreen observation, LED colours and existing financial draft/Fund invariants."`
- Production build passed. Final Vite rebuild after visual correction: 16.57s, existing large-chunk warning; Hercules Pro UI build passed. No deployment.
- Browser: `node scripts/check-page-worlds.mjs` with `HEARTH_WORLD_STATE=normal|empty|long`; 18 actual-App combinations × five widths. 390px axe and 200% CSS enlargement, gallery keyboard navigation, Fund full expansion/Escape focus return, pause/reduced-motion checks. [Review image](../ux/page-worlds/home.png), [machine-readable evidence](../ux/page-worlds/home-evidence.json).
- Initial screenshot pass exposed local Vite filesystem denial for linked PGlite assets, repaired in the untracked local server by allowing the exact dependency directory. Fresh normal proof waits for books readiness. Initial heading bracelet overlap repaired by keeping named bracelets in the closing scrapbook. Independent observer findings fixed with element-bound observation and individual margin visibility.
- Browser results are installed Chrome with local synthetic books and network fencing; physical devices, Safari and authenticated account restoration remain unverified. Actual photo selection remains with Bianca.
