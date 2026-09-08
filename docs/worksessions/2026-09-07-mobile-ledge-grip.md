# Hearth worksession — Claude's Ledge at rest

- **Status:** VERIFIED LOCALLY; PR preparation
- **Opened:** 2026-09-07 (`America/Toronto`)
- **Owner / decision owner:** Jonathan
- **Assignee:** Codex
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** codex/mobile-a2-ledge-grip
- **Baseline SHA:** 01ec730bbb3ca286ee831ae3d0513bf52af876aa (A1, PR #372)
- **Head SHA:** baseline plus working changes
- **Risk:** Medium
- **Environment impact:** none; synthetic local proof

## Household outcome

The Household Fund stays reachable from mobile Home, Calendar, Plan and More in both Shared and Personal, explicitly labelled. Claude's 84px paper grip carries one canonical Fund figure, one sentence and the spoken-for ground. It opens the existing Shared Fund register. Personal's own Shift/Books navigation stays intact.

## Budget delta (5)

+1, a consistent entrance to accepted Fund readings.

## Engagement delta (3)

+1, a persistent thumb-reachable Fund door.

## Verified baseline

App retains accepted household independently of the active Personal dashboard. The previous phone-only four-figure Fund card duplicated this role and precedes the Home fold; this slice replaces it. fundWalk and spokenFor are the read authority. No financial write or new projection occurs.

## Scope and gates

A2 only, stacked after A1. Existing overlays/Add suppress the grip. Scope-bound remount and explicit Shared navigation prevent a Personal entry from opening a Personal account or register by accident. G2's two-week measurement/build gate is waived by Jonathan's reply “just build it”; A3 follows immediately in a separate branch. No deployment is authorized by that reply.

## Acceptance evidence

- [x] Same accepted Fund from either room, explicit scope, no new nav label.
- [x] Existing Fund register opens only on explicit activation.
- [x] Empty/untied and offline readings remain honest.
- [x] 320/390/720/1100, keyboard/reduced motion/enlarged text and nav clearance.
- [x] Focused Medium quick gate plus startup/rehearsal canaries.

## Evidence log

Medium quick gate passed 83 assertions (42 fast, 41 serial), TypeScript, AI surface and both requested startup/rehearsal canaries in 124.298 seconds; no five-minute breach. Exact command: `pnpm test -- --risk=medium --base=01ec730bbb3ca286ee831ae3d0513bf52af876aa --focus=test/fund-ledge.test.ts --focus=test/household-fund-ui.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason="Keep the Ledge on canonical Shared Fund in both rooms, preserve explicit activation and App startup/rehearsal authority"`. Fingerprint before documentation closure: `3573665d3724c1b46d1a1b34b125998049f329deed2efba00c5b178fa9cfbc68`.

Actual FundLedge component in isolated Chromium: 72 cases, four widths 320/390/720/1100, both rooms, normal/empty/untied/offline/loading/error/enlarged-text/onboarding-return-plus-Hercules/Hercules-focus conditions. No page errors, document overflow, nav/return/pill overlap, lost footer clearance, extra activations or visible wide-screen Ledge. Enter invokes one explicit read-navigation callback on phones. Reduced motion is active; A2 has no transitions or drag. Wide cases prove the Ledge is hidden. The fixture reconstructs existing nav and overlay DOM/classes using actual CSS; it is not a full-App browser session or authenticated recovery proof.

Independent source review found collisions with onboarding return and Hercules. Measured shared clearance and overlay suppression repaired both; the reviewer rechecked with no further actionable finding. Small muted text uses the existing paper tokens (4.725:1 against paper-2); no new CSS hex literals. [Machine evidence](../evidence/mobile-a2/browser.json), [320 Personal with existing overlays](../evidence/mobile-a2/320-personal-chrome.png), [390 Shared](../evidence/mobile-a2/390-shared.png). Full local screenshot matrix and driver: `/tmp/hearth-mobile-a2-evidence`; actual-component harness: ignored `artifacts/browser-evidence/mobile-a2`.

## Remaining uncertainty and handoff

No hosted, authenticated physical phone or Production proof. Codex closes A2's evidence and then builds the full sheet. The mobile program remains in progress.
