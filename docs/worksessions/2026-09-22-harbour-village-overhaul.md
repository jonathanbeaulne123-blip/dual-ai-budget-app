# Hearth worksession — a village worth spending time in

- **Status:** COMPLETE locally; owner visual acceptance and publication remain separate
- **Opened:** 2026-09-22 (`America/Toronto`)
- **Closed locally:** 2026-09-23 (`America/Toronto`)
- **Owner / decision owner:** Jonathan
- **Assignee:** Codex integration; bounded architecture and shared-decoration agents in separate checkouts
- **Repository:** dual-ai-budget-app
- **Branch:** `codex/harbour-village-overhaul`
- **Baseline / initial HEAD:** `05b812eece5d119d6781dedb3503efdceebcce55`, verified GitHub main
- **Verified implementation HEAD:** `651161f241755975a8dddd355c099ec0c6de4e14`; the subsequent handoff commit changes this document only
- **PR:** [#526 — Rebuild Little Harbour as a connected seven-building village](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/526), draft for owner visual/device acceptance
- **Risk:** Medium-High — spatial routing, interaction and shared cosmetic metadata
- **Environment:** local fictional Development preview only

## Household outcome

A complete compact, cozy, expressive harbour village with distinct seven-building architecture, connected floors and doors, pleasurable walking and immediate quick travel. The coastal home contains Kitchen, Loft/Kitty Banks, Cellar/bill jars and Atlas nook. The separate brick-and-stone Fund bank houses the Queen. Library, Glasshouse, Pottery Studio, Hercules Cottage and Boathouse complete the village, with gardens, square and outdoor campfire.

## Dual Course

- **Budget (5):** clearer access to existing household tasks, exact readings and existing review/Confirm. No financial formulas or posting authority change.
- **Engagement (3):** exploration, direct object play, shared life and curated personalization.

## Verified baseline

The original checkout is dirty at `fd1b27d4`; preserve it. Main contains authored Library and Studio interiors plus walk-feel/moves. Only Library, Cottage and Kiln currently have world placements. Other rooms live at the origin. Root and implementation agents each have one isolated checkout based on the exact baseline above. No prior tests are new evidence.

## Accepted decisions

1. Cozy playable harbour village; destinations about 5–15 seconds apart.
2. Walking/direct control plus persistent quick travel; adaptive roof/wall cutaways.
3. All three forms of fun: playful objects/discovery, decorating, and Bianca/Hercules.
4. Coastal storybook home with connected unique rooms; warm bank with Queen hall.
5. Hands-on rooms (Loft, Cellar, Studio, Hercules) emphasize actual 3D manipulation. Information-heavy desks/books use readable panels at the object.
6. Fully furnished curated defaults and two arrangements per principal room. Shared furnishings/displays, personal themes/camera/motion/sound.
7. Either member explicitly previews/saves; latest arrangement revert with revision conflict protection.
8. Busy, expressive atmosphere; deliberate phone and desktop compositions; accessible still/flat equivalents.
9. Use small focused agents where they reduce duplicated context or improve independent quality; one writer per checkout.

## Boundaries

Existing financial/creative acceptance and scope visibility remain authoritative. No hosted schema, secrets, Production data, push, merge or deployment. Legacy routes and source tools remain reachable. Shared decorating uses non-money Hearthside metadata and eligible references, never copied private media. Existing themes are preserved.

## Implementation and acceptance

- [x] Unified building/room definitions, route compatibility, local floors, entrances and stairs.
- [x] Seven authored buildings with distinct silhouettes, cutaways and furnished interiors.
- [x] Walk/quick-travel, interrupted input, tool return and route/history compatibility.
- [x] Direct interactions, shared decoration preview/save/revert, scoped artwork displays.
- [x] Browser walkthroughs on phone/desktop, keyboard/reduced-motion/flat fallbacks.
- [x] Focused tests, current quick gate, production bundle, independent UX/trust review.
- [x] Resource/frame measurements on repeated room cycles; physical-device gaps recorded below.

## Evidence log

Initial: GitHub main verified with `git ls-remote origin refs/heads/main`; clean isolated worktrees created. Managed worktree tool could not resolve OneDrive ownership, so per-command `safe.directory` was used without changing global configuration.

### Implemented experience

- A compact village square joins seven actual building footprints. The Home has a broad porch, dormers and connected Kitchen, Loft, Cellar and Atlas nook. The Bank has a stone portico, parapet, copper crown and Queen hall with teller and consultation desks. The Library has a reading turret; Glasshouse a transparent framed canopy; Studio a skylight and brick chimney; Cottage a small domestic silhouette; Boathouse weatherboards and roof vents.
- Twelve physical destinations share real door gaps, rotated world placement, local floor heights and internal stairs. The waterfront campfire sits at the shore instead of overlapping the fountain. Ground planting respects the paths and clearing. Bounded obstacle-avoiding tap routes complement manual steering and persistent quick travel.
- Tools select their existing content independently of where they were opened. Bank Books opens the Standing Book and returns to the same body/camera location. Physical addresses require Household scope; missing or Personal scope cannot infer village authority. Existing legacy routes remain available.
- Room playthings, an outdoor bell/dance spot, a boat, gulls and local Hercules provide cosmetic activity. The Loft shows every bank, including a partial final row; phone framing keeps the banks visible. Cellar fittings retain the existing bill rail and exact readings.
- Shared room arrangements provide local preview, explicit save/cancel and latest-revision revert through the existing non-money command path. Remote revision conflicts preserve the draft. Both rendering and editing revalidate display references: revoked titles are hidden, and removing unavailable displays is explicit. Unchanged other rooms are preserved; a changed room cannot introduce revoked references.
- The three themes remain available. App and device reduced-motion settings are honored. Flat mode provides all destinations and tool routes. Phone controls have practical touch targets; editor Escape restores focus to Arrange room. Scene streaming, one renderer owner and idempotent teardown remain in place.

### Automated verification on the implementation HEAD

Final D-202 quick gate passed in **280.074 seconds**, within its 300-second budget. **91 selected test files / 890 tests passed**: fast lane 82 files / 758 tests; serial lane 9 files / 132 tests. Diff check, AI surface check, TypeScript and discovery passed. This is the repository's current `pnpm test` gate, not the separately requested exhaustive suite.

```powershell
$env:pnpm_config_verify_deps_before_run='warn'
pnpm test -- --base=05b812eece5d119d6781dedb3503efdceebcce55 --risk=medium-high --focus=test/village-command.test.ts --focus=test/village-arrangement.test.ts --focus=test/village-routes.test.ts --focus=test/village-runtime-camera.test.ts --focus=test/harbour-walk-everywhere.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason="Seven-building village with route origins, shared cosmetic CAS and no-money proof, physical traversal and required App startup canaries"
```

Gate fingerprint: `1388d6f053e2540d9691898d8e41d32b8a4ead7640a6330834d676993bedafba`. The gate reported `workingTreeClean: false` because the running preview held an untracked `.village-preview.err` stderr log; implementation files were already committed at the exact SHA above. Automatic approval review blocked optional server-restart/log cleanup, so the working preview and its local untracked log were preserved. This does not represent an uncommitted source change.

Production bundle validation passed on the same implementation SHA: workspace Worker TypeScript, Vite build (**17.37 seconds**), Hercules Pro UI build and absence of `dist/_redirects`. The Windows-safe equivalent runs the existing build components directly:

```powershell
node --max-old-space-size=6144 node_modules/typescript/bin/tsc -p workers/workspace/tsconfig.json --pretty false
node node_modules/vite/bin/vite.js build
node scripts/build-hercules-pro-ui.mjs
```

Vite still reports its existing large-chunk advisory (largest App chunk approximately 3,367 kB minified). Some startup tests emit jsdom's unsupported canvas diagnostic while their assertions pass. These are not claimed as warning-free results.

### Browser acceptance performed

The loopback review at `http://127.0.0.1:4190/__review?member=MEM-001&seed=demo` uses fictional Development books and real local commands, with no hosted services.

- Visited all twelve destinations: square, Bank, Kitchen, Loft, Cellar, Atlas nook, Library, Glasshouse, Studio, Cottage, Boathouse and waterfront. Visually checked the distinct exteriors and room cutaways.
- Walked to the Bank through its actual door. Walked from the square to the waterfront and back; the campfire is by the sea and the return lands outside its clearing. The movement suite covers doorway entry/exit, local floor heights, the outdoor shore bound and the waterfront hysteresis.
- Used the connected Home controls from Kitchen to Loft and Atlas nook. Opened Bank Books, then Put it back, and observed the exact saved body position return. The route suite covers twelve canonical physical addresses and 96 tool/origin combinations.
- Saved Bank arrangement revision 2, reverted to revision 3, and cancelled a separate plants preview. Checked the phone editor and Escape/focus return. Command/UI tests cover stale revisions, remote conflicts, revoked display eligibility, preservation of other rooms, and no money effects.
- Activated the Studio wheel and observed its play response. Checked the twelve-destination All tools menu, flat Bank/Books navigation and app reduced-motion setting; restored the preview's motion preference and Classic theme after theme checks.
- Tested browser sizes 320x760, 390x844, 720x920, 1100x850 and 1440x1000 across selected views. Observed Classic, Newfoundland and Taylor themes. This was not every room at every size in every theme. No horizontal page overflow in the narrow Glasshouse check; the final phone Loft view exposes both fictional banks. Browser console error query returned none.

### Resource evidence and independent review

Six Library visits, five Bank visits and five Cellar visits were sampled at 390x844/lite after the final source changes, without code reloads during the sequence. Draw counts for those room compositions remained **54 / 226 / 67**. Most texture samples were **3 / 4 / 5**; the final Library return had 4. After the initial Library shader warmup, sampled render averages were **0.83–1.93 ms** in this desktop browser.

Geometry allocations varied with streamed residents and first render: Library 50–174, Bank 196–280, Cellar 140–156. Later samples fell to Bank 198 and Cellar 146; this did not show a monotonic per-loop increase. A targeted independent lifecycle review found no concrete unmatched rendered geometry. These counters are short local samples, not a long-session leak certification or a physical-phone GPU benchmark.

Bounded agents contributed architecture, interior/travel reference checks, cosmetic command repair and independent review. One writer per checkout was maintained. Final reviews found and led to repairs for revoked display-title exposure, remote CAS conflict classification and unscoped village addresses. Root also resolved phone framing, roof interference, tool/physical-origin separation and waterfront placement, then reran the final gate. All concrete review findings are resolved in the implementation SHA.

## Remaining uncertainty

- Jonathan's subjective visual/play acceptance remains open.
- Real phone GPU/frame pacing, long sessions, offline transitions and the complete room/theme/viewport cross-product have not been accepted on physical devices.
- Shared command conflict behavior is covered locally; live two-device presence, reconnect and concurrent shared-decoration acceptance remain release checks. No hosted or Production experiment occurred.
- Exact-head CI and release acceptance remain separate from the passing local evidence. The branch is published as draft PR #526; no merge or deployment occurred. The existing large-chunk advisory remains.

## Handoff

**Outcome:** the local overhaul and its selected verification are complete. Budget delta (5): clearer access to unchanged household tools and financial meaning. Engagement delta (3): seven distinctive buildings, connected rooms, more pleasant travel, tactile play and shared room decoration.

**Next recommended action:** Jonathan explores the complete fictional Development preview, especially the Home rooms, Bank and outdoor walk between buildings. Address his visual/play feedback and the named device/continuity gaps before a separately authorized merge and deployment. The original dirty OneDrive checkout is preserved.

**PR publication — 2026-09-23:** Jonathan explicitly requested creation of the PR. Current GitHub main was reverified at the original baseline above, with no rebase required. All 29 outgoing commits were checked for sensitive paths and credential-like additions; none were found. The branch was pushed and draft PR #526 opened against main. The local preview stderr log remains untracked and was not sent. This follow-up updates handoff documentation only; implementation remains the tested `651161f2`. No merge, deployment, secrets, hosted schema or Production change occurred.
