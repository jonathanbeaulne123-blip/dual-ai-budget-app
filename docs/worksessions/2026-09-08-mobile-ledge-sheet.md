# Hearth worksession — Claude's full Ledge

- **Status:** VERIFIED LOCALLY; draft PR preparation
- **Opened:** 2026-09-08 (`America/Toronto`)
- **Owner / decision owner:** Jonathan
- **Assignee:** Codex
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** codex/mobile-a3-ledge-sheet
- **Baseline SHA:** 565efd7b7f463f80c8c3a6b31730027ce6a9bcdb (A2, PR #373)
- **Head SHA:** baseline plus working changes
- **Risk:** Medium-High
- **Environment impact:** none; fictional local Development fixtures only

## Household outcome

Claude's paper Ledge expands through rest, half and full above the existing navigation in Shared and Personal. Half shows Level; full exposes the fixed six-slot board, the selected canonical stage and Arrange. Nothing posts through movement. The existing explicit command surfaces remain the posting path.

## Budget delta (5)

+3, the same Fund stages become reachable on the phone.

## Engagement delta (3)

+2, a thumb and keyboard entrance that keeps its place for the member's civil day.

## Scope and decisions

Jonathan said “just build it”, explicitly waiving G2's fortnight build gate. The packet's fixed 2×3 grid, 5px printed-stock corners, 3px selected pine edge and spoken-for ground take precedence over the older HTML's pill rail, 18px shell corners and curve ground. A2's inherited corners are corrected here. Navigation labels remain intact, including Personal Shift and Books.

FundBoard and FundStage are shared with OfficeWide. Existing library entries without chart models retain explicit routes to existing workspaces; this does not invent Seven days or Minutes chart models. The Level reuses one geometry kernel with a 344×148 phone ruler; accepted figures, paths, bands and evidence meaning remain unchanged. Week uses seven columns from360px and seven rows below360px. Inner vertical scrolling keeps the stage reachable with enlarged text or an on-screen keyboard; the rail remains a fixed two-by-three grid.

Independent money review reproduced a pre-existing queue scope bug: a callback reviewed in householdA executed against householdB after waiting. Because A3 exposes those callbacks, the slice necessarily hardens runKitchen with reviewed environment/household/member/view/generation checks before enqueue and execution. Same-desk revisions can advance; a Confirm already submitted keeps its captured client/actor/target. No new financial command or projection is introduced. Shared→Personal→Shared also advances the generation.

Focus verification also required excluding negative-tabindex and hidden descendants from the existing dialog's sequential focus trap. The scrim remains clickable without becoming a hidden tab stop.

## Acceptance evidence

- [x] Deterministic bounded detents; direct pointer tracking, cancellation and keyboard equivalents.
- [x] Six/eight slots, shared stage models and explicit existing action paths.
- [x] Scope invalidation, member/date selection memory, no motion writes.
- [x] Current browser matrix and stage overflow checks.
- [x] Focused Medium-High gate with startup/rehearsal canaries.

## Evidence log

Focused intermediate tests: 43 assertions pass across Ledge, queue scope, Level geometry and existing dialog. Independent financial review confirmed immutable async command targets. UX review found stage starvation, phone semantics, selection memory and corner/selection token issues; corrections are in verification.

Medium-High quick gate passed 146 assertions (112 fast,34 serial), TypeScript and AI surface in102.601 seconds; no five-minute breach. Fingerprint before evidence/documentation closure: `e31cb943419e6b46f55d8df497c06cbd891411b680ebc9338cc4913e3957ae64`. Exact command: `pnpm test -- --risk=medium-high --base=565efd7b7f463f80c8c3a6b31730027ce6a9bcdb --focus=test/fund-ledge.test.ts --focus=test/scoped-write.test.ts --focus=test/fund-rail.test.ts --focus=test/level-view.test.ts --focus=test/claude-ux-dialog.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason="Preserve canonical Fund stages and explicit posting through scoped queued commands, phone detents, keyboard focus and startup/rehearsal authority"`.

Actual-component Chromium proof:40 width/room/state cases at320/390/720/1100, plus32 phone library-entry cases at320/390. Empty, busy, offline and enlarged-text states passed; no page errors, horizontal content overflow or financial actions during selection/navigation. Pointer drag tracks directly, release selects Half, pointercancel collapses preview without action, keyboard focus traps/restores,300px viewport keeps the register action reachable, and widening to720 collapses after the resize render. Initial immediate resize snapshot preceded React's render; waiting for DOM removal confirms collapse. The phone board stays six slots. [Browser matrix](../evidence/mobile-a3/browser.json), [stage matrix](../evidence/mobile-a3/stages.json), [Level](../evidence/mobile-a3/390-level.png), [enlarged text](../evidence/mobile-a3/320-personal-large.png). Local scripts/full screenshots: `/tmp/hearth-mobile-a3-evidence`; fixture: ignored `artifacts/browser-evidence/mobile-a3` using actual App CSS and fonts. These are isolated component cases, not an authenticated full-App browser journey. Existing full-App startup canaries ran in jsdom.

Independent UX recheck reports all four findings repaired and no remaining blocker. Independent financial recheck reran13/13 scoped-write tests and reports no remaining blocker. The successful same-scope queue case advances accepted books before executing the waiting second settlement; both survive. Pre-fix independent synthetic probe posted the stale callback to householdB with reused member/account IDs; post-fix queue tests invoke no command after household/member/environment/view/generation changes. Dialog tests retain pre-existing React act-environment warnings; all six pass.

## Remaining uncertainty

No hosted, physical phone, authenticated two-device, exhaustive or Production proof. G3 actual clock-out tap measurements and G4 scenario review remain later program gates. No merge or deployment. The mobile program remains in progress.

## Handoff

Codex completes A3 evidence and its separate draft PR, then continues the authorized original mobile program.
