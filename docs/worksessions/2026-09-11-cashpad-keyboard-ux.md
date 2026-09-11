# Hearth worksession — CashPad and keyboard entry

- Status: IMPLEMENTED — draft PR
- Opened: 2026-09-11 (America/Toronto)
- Owner and decision owner: Jonathan
- Assignee: Codex; Claude web design consultation
- Repository: dual-ai-budget-app
- Branch: codex/cashpad-keyboard-ux
- Baseline: e7bc415fc6e9399d2618632a88255c26774bc376
- Risk: Medium-High
- Environment impact: UI; Development verification only

## Household outcome
Make laptop entry possible through ordinary typing and make the phone CashPad smaller, rounded and reachable. Improve form navigation and apply useful patterns to Hercules.

## Budget delta (5)
Exact decimal editing, explicit zero for shifts, invalid-input blocking and focused review reduce entry mistakes without creating a financial writer.

## Engagement delta (3)
Compact desktop entry, softer scene-specific phone surfaces and multiline Hercules writing reduce interaction effort.

## Design evidence and decisions
Jonathan requested Claude. Consulted the signed-in Claude web app in “Redesigning CashPad and long-form UX for Hearth”. Claude proposed decimal editing, one scroll owner, named steps, review Change navigation, keyboard focus, viewport clearance and a multiline composer. The design was assessed against current code; its older PGlite authority wording does not override CLOUD_CONTINUITY.

Primary-source competitor research:
- [YNAB keyboard shortcuts](https://www.ynab.com/whats-new/keyboard-shortcuts-the-fastest-way-to-ynab): visible keyboard hints and contextual navigation.
- [Monarch CommandK](https://help.monarch.com/hc/en-us/articles/38610714553108-CommandK-Search-Bar-and-Shortcuts): searchable navigation and shortcuts. A global palette is optional and is not added in this patch.
- [GOV.UK check answers](https://design-system.service.gov.uk/patterns/check-answers/) and [error summary](https://design-system.service.gov.uk/components/error-summary/): prefilled editing, return to review and focused errors.

Implemented choices: desktop defaults to decimal typing; mobile keeps the familiar cents keypad with an explicit hint and a Type amount alternative. Preserve the Fund pull tab and existing draft persistence. Amount Enter is local to the input and only advances the current step; no document-wide Enter. Guided review jumps return to review after editing. Full form has section navigation and one final posting control. Hercules has multiline writing and review-heading focus, with Enter to send / Shift+Enter for newline matching existing chat sending. No automatic final confirmation.

## Scope
CadPad and its existing callers, AddSlideshow, shared scene styling, Hercules composer/review focus, focused regression tests and synthetic browser evidence. No schema, Google integration, financial commands, provider model, new artwork or household data changes.

## Acceptance evidence
Results below. Browser fixtures are synthetic and do not establish physical iOS/Android keyboard or authenticated cloud proof.

## Handoff
Implementation complete and prepared for a draft PR. Not merged or deployed. Jonathan owns release.

## Verification results
- TypeScript and AI surface checks passed in the focused quick gate.
- Focused gate: 130 fast tests passed; serial group had 93 passes and one timing-sensitive Personal cloud-acknowledgement failure while browser checks ran concurrently. Total gate 238 seconds, within the five-minute budget. The failed test passed alone, then the complete startup group passed 81/81 without concurrent browser load. No authority code was changed to accommodate the test.
- Follow-up command: `pnpm exec vitest run test/app-startup-p1.test.ts test/hercules-private-chat-ui.test.ts test/hercules-action-ui.test.ts test/add-slideshow.test.ts --maxWorkers=1 --testTimeout=30000` — 107/107 passed in 44.47 seconds.
- `node scripts/check-cashpad-ux.mjs`: 36 actual-App synthetic cases passed, all three themes and both scopes at 320, 390, 720, 1100, 1440, 1920px. No document overflow or page errors. Confirm cleared the fixed navigation. Six focused CashPad WCAG A/AA scans returned zero violations. Decimal invalid/valid keyboard advancement and full-form navigation were exercised. Evidence: `/tmp/hearth-cashpad-ux/evidence.json` and screenshots (local only).
- Updated stale copy assertions in Calendar and Hercules habit tests to match already-shipped wording; retained their no-write assertions. Updated Swipe's amount-label assertion for explicit CAD units.
- Independent read-only review caught and verified fixes for entered zero, invalid Shift values surviving presentation switches, and composer shrinking after send. No remaining concrete regressions reported.

## Release review
CONDITIONAL: implementation and focused regression evidence are ready for a draft PR. The combined quick gate is not described as a clean pass; the failed startup group has a complete passing retry. Physical mobile keyboards, screen-reader device behavior and authenticated continuity are not newly certified. No exhaustive suite, deployment, schema or Production changes. This is a new page UX PR under PAGE_THEME_EXECUTION_STANDARD; earlier releases in this conversation remain separate.

- Short-screen follow-up: `HEARTH_TEST_WIDTHS=320 HEARTH_TEST_HEIGHT=568 HEARTH_ARTIFACTS_DIR=/tmp/hearth-cashpad-short node scripts/check-cashpad-ux.mjs` — all six theme/scope cases passed, including scrolling Confirm above navigation.
