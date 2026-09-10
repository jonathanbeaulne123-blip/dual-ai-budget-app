# Hercules slice 6 — integrated product acceptance

- Status: LOCAL CANDIDATE COMPLETE; selected tests recovered serially; standard concurrent gate and human acceptance remain open
- Owner and decision owner: Jonathan
- Assignee: Codex, sole writer; bounded read-only integration/privacy reviews
- Repository: dual-ai-budget-app
- Branch: codex/hercules-integration-acceptance
- Named reviewed predecessor / initial HEAD: c902c4d43e3ab744ba6c1cd36f919577ea6c52ff (slice 5, clean)
- Risk: High (companion identity, acknowledgement and App integration)
- Environment: local synthetic Development fixtures only

## Household outcome

A person can discover useful help after onboarding, continue a coherent conversation, control remembered preferences, dress Hercules, and return to ordinary budgeting without losing their place or confusing a draft with a confirmed save.

Budget delta (5): preserve exact financial Confirm, private scope, current-source navigation and truthful acknowledgements throughout the companion journey. Engagement delta (3): understandable help, recoverable conversation and memory, and an integrated dressing-room experience in Classic, Taylor and Newfoundland.

## Scope and proof

Audit the integrated surfaces against the approved living-companion plan; repair concrete interaction/privacy defects; add targeted integration and regression tests; exercise the actual App and isolated real-authority fixtures with synthetic data; retain reproducible acceptance runners and an actionable Bianca trial packet. Run the scoped High quick gate and builds. Review current screenshots rather than inheriting slice-5 visual proof.

No push, merge, deployment, schema, secrets, provider activation or real household mutation is included. Owner likeness approval, full compatible garment/pose review, physical phone/Safari/screen-reader use, live Gemini voice evaluation and authenticated two-device continuity cannot be certified by fixtures. Bianca's actual product trials remain distinct from automated proof and must never be marked complete without her results.

## Plan

1. Inspect conversation/memory, discovery routes, wardrobe and ordinary App integration.
2. Reproduce and fix concrete failures with focused regression coverage.
3. Run combined local journeys, accessibility/recovery and protected App/command canaries.
4. Record measured evidence, independent findings and remaining acceptance trials; commit the verified local slice.


## Implemented behaviour and independent review

- Private chat, memory controls and suggestion settings recover the original acknowledgement before retrying a mutation. Per-mount epochs reject old A→B→A receipts. The automatic-preference Undo is not recreated by a recovered receipt.
- Unsaved conversation and its retry metadata survive Shared/Personal switching within one mounted identity. Other members, households, environments, clear generations and unmount discard incompatible drafts. Retention removes whole receipt groups rather than cutting a user/reply pair.
- Rapid explicit preference corrections use the queued predecessor revision. Specific forget requests retain their conversation exchange, wait for their ordered CAS operation, clear stale Undo when confirmed and obey the same queue bound. A full queue says the request was not applied.
- Reply freshness compares local scoped source inputs, page, date and mode, excluding receipt/profile/transport-only changes. New books cancel an obsolete reply and unlock the composer; a previous conversation ACK does not interrupt a follow-up. The comparison key is neither sent nor persisted.
- Phone help uses the existing modal stack for initial focus, Tab containment, Escape and launcher restoration. Its own dialog pauses ambient movement while keeping the focused cat visible; other modals still suppress the rig. Desktop presents visible accessible help and grounded source buttons. Calendar bill sources select/focus the proper Bills entry on first mount and when Calendar is already open. Source navigation never executes an entry.
- Suggestions select at most one current card per capability; remaining records stay in the catalogue. This fixes three duplicate warnings occupying every recommendation slot. Comparison copy matches the actual month-to-month calculation.
- Provider-failure speech follows simple three-turn casual context, prioritizes distress, respects explicit explanation preferences, and gives specific guidance for confusion, entry, unsupported bank payment and missing payday. Outfit humour does not intercept a new rent concern. Fund is distinguished from the similarly named Fun category; Personal guidance directs the person to Shared.
- No new assets, provider dependency, model credentials, financial writer or hosted schema. Asset provenance and the complete room/catalogue remain slice 5's originals.

The two trust lenses (Books and privacy), UX audit and independent acceptance verifier reviewed the current diff read-only. Their findings drove the corrections above. No critical code finding remains from those reviews. Human acceptance is not inferred from their code review.

## Verification history and recovery

Initial focused tests reproduced the missing restored phone reply and caught fixture errors (mismatched synthetic household, Calendar label/empty recurrence and strict chat-request version). Those were fixed, not waived. Focused chat/memory/discovery/reply tests passed after correction; final files are included in the High gate below.

The first broad High quick gate passed **299 tests** (212 fast + 87 serial), TypeScript, AI-surface and diff checks in **396.978 seconds**. It breached the five-minute SLA during serial App tests. Its pre-final-correction fingerprint was `e290651f86b21fd3fadfbe6d4a97c7584097399a30058a9351962982595f1a3a`.

After the final queue/copy corrections, a repeated-forget UI regression exceeded its 15-second timeout with four workers. The run passed 212 other fast tests, failed that test and did not reach serial tests; elapsed **422.868 seconds**, SLA breached, fingerprint `e0b194003aacf6dcaa7c61f4637d67a37f64fc4c6c21a72a13cbe8eb398a7986`. The unchanged product regression passed alone: all 10 private-chat tests, 31.64 seconds total, repeated-forget case **362 ms**. This is evidence of host contention, not a reason to weaken the assertion.

The file is now explicitly registered as a host-timing-sensitive serial integration test in both package lanes and their registry test. One intermediate gate caught the missing registry declaration (221 tests passed, one lane-contract test failed; 166.428 seconds, no SLA breach). Correcting that declaration and retaining an explicit **15,000 ms** limit on the repeated-forget test passed both files: **11 tests in 5.13 seconds**. No exhaustive lane was invoked. The final gate below includes the registry checks.

The 200% phone-text pass exposed focus leaving the dialog in all six theme/view cases. Wiring the existing dialog controller fixed that failure; a follow-up review caught and fixed the resulting own-modal animation suppression. The shared modal observer now optionally excludes an owned ref without ignoring other modals. Targeted modal/chat/lane coverage passed 19 tests in 16.14 seconds. The desktop caption also needed a higher internal stacking level and the full 96 px launcher width to remain visible without wrapping into a narrow column over the portrait. The narrower-window rehearsal then exposed a genuine stale-position defect (right edge 1107.97 px in a 1100 px viewport); resize now clamps the launcher within viewport and navigation bounds. Its proof waits for the animated landing to become hit-testable before measuring; an immediate first sample failed while a subsequent unchanged run passed all nine cases.

The wardrobe resize rehearsal closes correctly and restores the phone Drawer after the original desktop opener unmounts. An initial proof assertion incorrectly required the vanished desktop opener; it now accepts the actual responsive fallback as well as the unchanged opener. This was a proof correction, not a product change.

The initial browser matrix passed 72 cases with zero scoped axe violations, horizontal overflow or page errors. It preceded the final suggestion-diversity/label adjustments and is superseded by the rebuilt-bundle result below.

The final standard quick gate passed diff, AI-surface and TypeScript (**82.270 s**) but failed its concurrent test phase: **225 passed, 4 timed out**, plus two worker `onTaskUpdate` RPC timeouts. The four failures were three existing `hercules.test.ts` cases and one `hercules-tools.test.ts` case, each exceeding the unchanged 15-second limit. It did not reach the three serial files. Total **298.383 seconds**, no five-minute SLA breach; fingerprint `25859de68825d42f5aba09c5713fb2b20b9a6fa9e167e816c5506be0b3ed311b`, 25 selected files (22 fast, 3 serial). Log: `/tmp/hercules-s6-quick-complete.log`. The same selected set is recovered below with one worker, preserving all assertions and each lane's original timeout. This is separate recovery evidence, not a successful standard quick gate. No global runner policy was weakened to obtain a pass.

Final recovery passed **all 327 tests in the same 25 selected files**: 229 tests / 22 originally-fast files in **83.63 seconds** with one worker, then 98 tests / 3 serial files in **128.93 seconds**. Total Vitest recovery duration **212.56 seconds**. All four concurrently timed-out cases passed unchanged. App startup/review/reload canaries (80), private chat (11) and the authority proof matrix (7) passed. Logs: `/tmp/hercules-s6-fast-serial-recovery.log` and `/tmp/hercules-s6-serial-recovery.log`. This supports a local candidate, while a passing standard quick gate remains required before a later release decision. No source or test assertion changed after the fingerprinted gate; subsequent edits only record evidence and clarify the acceptance packet.

## Final local browser and build evidence

- Final Vite application build passed in **76 seconds**, followed by the Pro UI build. Existing PGlite externalization/eval, mixed-import and bundle-size warnings remain; these are not a new clean-warning claim.
- Rebuilt actual-App matrix: **72 cases**, 3 themes × 2 views × 6 widths (320, 390, 720, 1100, 1440, 1920) × help/memory and wardrobe launcher. Zero horizontal overflow, scoped axe violations or page errors. All six theme/view journeys opened the actual Transfer Add flow and returned, and routed help to Hercules outfits. This does not prove every catalogue route or submit financial Confirm.
- Desktop invitation: **9 cases**, three themes at 1100/1440/1920; full-width caption above portrait, inside viewport, hit-testable and opening help. Narrowing after 1920 is included. Short-viewport acceptance is separate.
- Phone at 200% text: **6 cases**, all themes and views at 320; zero overflow/scoped axe violations/page errors, Tab stayed in the dialog. Current phone fix was built and measured before the final desktop-only caption/resize repair; the final matrix also exercises the phone after that repair.
- Current 3D fitting room at 200% text/320: no horizontal overflow, slate swatch selected, 40 Tabs contained, Escape closed the room and restored the responsive Drawer, no page errors. This independently tests text/focus in the room, not all garment/pose or physical-device combinations.
- Screenshots inspected include Classic/Taylor desktop invitations, Newfoundland Personal phone help, phone memory at 200% and the enlarged 3D fitting controls. All are synthetic demo content.

Reports: `final-report.json`, `invitation-report.json`, `text200-report.json`, `wardrobe-access-report.json` under `.artifacts/hercules-slice-6/`. Final build/browser console logs are `/tmp/hercules-s6-build-complete.log`, `/tmp/hercules-s6-browser-complete.log`, `/tmp/hercules-s6-invitation-complete.log`, `/tmp/hercules-s6-access-verified.log`, `/tmp/hercules-s6-wardrobe-access-verified.log`.

## Reproduction

Working directory: `/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/hercules-living-companion-plan`.

Use the configured runtime:

```sh
export PATH=/Users/jonathanbeaulne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/jonathanbeaulne/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH
```

Start the local preview in a separate terminal after the build: `pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never exec vite preview --host 127.0.0.1 --port 5193 --strictPort`.

Build and local browser proof (preview is bound to localhost 5193):

```sh
node scripts/companion/dialogue-rehearsal.mjs
VITE_HERCULES_DRESSING_ROOM=1 pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never exec vite build
node scripts/build-hercules-pro-ui.mjs
node scripts/companion/invitation-proof.mjs
node scripts/companion/browser-integration.mjs
node scripts/companion/browser-access.mjs
node scripts/companion/wardrobe-access.mjs
```

Final scoped gate (no exhaustive lane):

```sh
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never check:quick -- --base=c902c4d43e3ab744ba6c1cd36f919577ea6c52ff --risk=high --focus=test/hercules-companion-profile.test.ts --focus=test/hercules-companion-continuity.test.ts --focus=test/hercules-wardrobe-continuity.test.ts --focus=test/hercules-chat-providers.test.ts --focus=test/hercules.test.ts --focus=test/hercules-tools.test.ts --focus=test/hercules-rig-chat-triggers.test.ts --focus=test/hercules-wardrobe-ui.test.ts --focus=test/appearance-companion.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus=test/ledger-confirmation-review.test.ts --focus-reason="Final companion integration, private recovery and focus, serial queue regression, current source navigation and protected App/Confirm/wardrobe compatibility"
```

Serial recovery of exactly the selected test scope (same 15-second fast default and existing 30-second serial lane; the queue case explicitly stays 15 seconds):

```sh
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never exec vitest run test/appearance-companion.test.ts test/claude-ux-dialog.test.ts test/command-contract.test.ts test/command-runtime.test.ts test/hercules-calendar-integration.test.ts test/hercules-chat-providers.test.ts test/hercules-companion-continuity.test.ts test/hercules-companion-profile.test.ts test/hercules-discovery-ui.test.ts test/hercules-discovery.test.ts test/hercules-integration-acceptance.test.ts test/hercules-memory-controls.test.ts test/hercules-reply-context.test.ts test/hercules-rig-chat-triggers.test.ts test/hercules-tools.test.ts test/hercules-wardrobe-continuity.test.ts test/hercules-wardrobe-ui.test.ts test/hercules.test.ts test/ledger-confirmation-review.test.ts test/month-rehearsal-mainline.test.ts test/test-lanes.test.ts test/verification-policy.test.ts --maxWorkers=1
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never exec vitest run test/app-startup-p1.test.ts test/hercules-private-chat-ui.test.ts test/proof-matrix.test.ts --maxWorkers=1 --testTimeout=30000
```

Generated reports/transcripts/screenshots are in ignored `.artifacts/hercules-slice-6/`. Runners and setup instructions are committed under `scripts/companion/`. Browser requests outside localhost are blocked; Hercules endpoints return 503. The demo and authority tests use synthetic fixtures. No private household export, user chat content or secret is included.

## Acceptance boundaries and next owner

The local 24-script/30-turn text rehearsal asserts no household mutation and records actual local replies. Its empty catalogue does **not** instantiate every script's target setup or prove UI actions. State-specific discovery, private authority and conversation regressions are separate suites. Human warmth/distinctiveness/clarity/continuity scores remain unfilled.

Bianca's six actual product trials, live Gemini scoring, owner likeness/full compatible garment-pose acceptance, physical phone/Safari/VoiceOver and authenticated two-device recovery remain open. Local browser emulation and mocked provider chains are not those results. Independent compatible chat/discovery/wardrobe presentation rollback remains a later release gate; the room flag defaults off.

Next owner: Jonathan for [the product trials](../briefs/HERCULES_BIANCA_ACCEPTANCE.md); Codex can implement any resulting bounded repair from this branch. Keep this a local branch until a separate release instruction, and rerun the standard scoped quick gate on an uncontended host before advancing toward release. A later PR must reconcile with then-current main and retain the compatible private-envelope writer. Production, schema, provider consent/classification and real-household mutations are outside this packet.
