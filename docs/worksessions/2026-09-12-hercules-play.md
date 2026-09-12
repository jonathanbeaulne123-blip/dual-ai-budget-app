# Hearth worksession — Hercules Play

- Status: OPEN — local implementation verified; full-plan acceptance remains open
- Opened: 2026-09-12 (America/Toronto)
- Owner / decision owner: Jonathan
- Assignee: Codex
- Branch: codex/hercules-play
- Baseline: 02a5539 (fresh origin/main)
- Risk: High
- Environment impact: local implementation and synthetic Development verification only

## Household outcome
Implement the approved dedicated 3D Play destination, shared authored displays, private dressing and portraits, banks, discoveries, six playable milestone objects, and three complete themes.

## Budget delta (5)
Visible shared goal progress and direct existing planning/review flows; no new financial writer.

## Engagement delta (3)
A generous character studio and persistent household gallery with replayable discoveries.

## Verified baseline
Clean isolated worktree created after fetching origin/main. Current main already has nine wardrobe collections, advanced shelf navigation and an authored dressing room. Preserve these newer improvements; add the approved eighteen pieces to the original six collections.

## Plan
- [x] State contracts, commands, compatibility and focused tests
- [x] Shared 3D room and Play navigation
- [x] Portraits, displays, banks and creative tools
- [x] Six toys, twelve discoveries and wardrobe additions
- [ ] Theme, browser, accessibility and recovery verification

## Evidence log
Planning reference b56e5f1 was not used as implementation base.

## Boundaries
No deployment, hosted schema application, Production activation, real financial mutation or spreadsheet edits. Read-only independent investigations; one writer in this checkout. Physical devices, authenticated hosted continuity and willingness-to-pay trials require measured evidence before being claimed.

## Verified local result

- Final High-risk quick gate passed: 498 tests in 39 files, TypeScript, AI surface and diff checks; 110.048 seconds, no final time-budget breach. An earlier TypeScript run exceeded five minutes and failed a display-image union type; the final run resolves that defect. One intermediate App Calendar failure during source changes passed in isolation and in the final complete App startup suite.
- Three-theme browser matrix: 47 cases, no axe A/AA violations, horizontal overflow or page errors. Browser screenshots use synthetic fixtures and reduced motion.
- Activity checks: camera/contact sheet, three puzzle arrangements, theatre storyboard, projector cycling, lantern export, lost-acknowledgement recovery and second-member shared placement pass.
- Forced graphics failure with enlarged root font retains gallery/placement controls; zero recorded axe violations or page errors.
- Vite production build and Hercules Pro UI build pass. Final Vite build took 10.43 seconds. Existing dependency eval/externalized-node and large-chunk warnings remain; no new hosted build is claimed. Play CSS, page and Three scene are separate lazy chunks. The build retained local proof output intentionally and is not a deployment artifact.

## Commands

Runtime PATH prepended with the bundled Node runtime. Dependency management was disabled for the linked local node_modules with `--config.manage-package-manager-versions=false --config.verify-deps-before-run=never`.

```
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --risk=high --focus=test/hercules-play.test.ts --focus=test/hercules-wardrobe-continuity.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus=test/storage-replicas.test.ts --focus-reason="Final Play authority, App routes, scoped storage and Plan evidence compatibility"
node scripts/play/serve.mjs --build-only
node scripts/play/proof.mjs
node scripts/play/activities.mjs
node scripts/play/fallback.mjs
node node_modules/vite/bin/vite.js build --emptyOutDir false
node scripts/build-hercules-pro-ui.mjs
```

## Changed surfaces and next owner

Core Play contracts/command, portrait-aware wardrobe contracts, shared/personal continuity, capability negotiation, App/Together/Status Centre navigation, existing dressing room, lazy room renderer, eighteen assets, original procedural theme shells, tests and local proof scripts. See `docs/features/HERCULES_PLAY.md` and `docs/evidence/hercules-play`.

Next owner: Jonathan for product/art direction and separate hosted testing/release scope; Codex for any resulting corrections. Full acceptance remains open for authenticated devices, physical performance and accessibility trials, garment fit review, all-state theme art acceptance and participant product-value testing. Local evidence does not justify closing the full approved plan.
