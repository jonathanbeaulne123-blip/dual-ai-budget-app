> **Reference only — not a bible.** Snapshot of the Google Sheets / Apps Script era (`v0.0.31`, git `f2db836`, tag `sheets-v0.0.31`).
>
> Jonathan’s latest instruction, the live files in `docs/` (outside this folder), and the TypeScript app are current. Read this to see how the project moved, not as today’s product law.
>
> Apps Script source is not in the working tree. Recover it with `git show sheets-v0.0.31:Code.gs`.

# Roadmap

## Phase 0 — Ecosystem and verified baseline

Target: August 18–20, 2026

Status: Completed August 18, 2026. GitHub is private/canonical, development is on verified v0.0.25, and Data Health Check is clean.

- Initialize Git and canonical documentation.
- Install and prepare `clasp` without linking production.
- Connect the development Apps Script project.
- Reconcile local `v0.0.23` with the remote development source.
- Add an obvious development-environment marker.
- Establish repeatable syntax and baseline checks.
- Verify in-Sheet diagnostics and data-health output.

## Phase 1 — Full system review

Target: August 21–24, 2026

Status: Active. Operational work is tracked in the [September 1 Functional Test Build milestone](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/milestone/1).

- Inventory every sheet, menu action, dialog, calculation, and dormant table.
- Review financial meaning and data integrity.
- Review mobile usability and visual consistency.
- Reconcile all open `v0.0.23` findings against current development data.
- Produce a prioritized change backlog with acceptance tests.

Active review workstreams:

- [#1 Transaction Input end-to-end](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/issues/1)
- [#2 Tip Tracking and Add Shift end-to-end](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/issues/2)
- [#3 Dashboard usefulness, freshness, and mobile layout](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/issues/3)
- [#4 Cross-feature reliability and scale audit](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/issues/4)

## Phase 2 — Core test release

Target: August 25–September 1, 2026

Release gate: [#5 September 1 functional test build](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/issues/5).

- Stabilize Transaction Input.
- Stabilize Tip Tracking.
- Stabilize Dashboard behavior and freshness.
- Add deterministic test fixtures covering 12–24 months and at least 500 transactions per month.
- Run risk-based Claude and Gemini reviews.
- Produce the September 1 functional test build.

## Phase 3 — Planning, goals, and insights

Target: September 2–14, 2026

- Flexible monthly planning.
- Multiple forecast horizons and named scenarios.
- User-managed goals and progress bars.
- Shared-goal visibility and a decision on personal-goal privacy.
- Recurring transaction engine.
- Trailing-average and prior-year insights.

## Phase 4 — Bianca beta

Target: September 15–23, 2026

- Guided onboarding.
- Mobile usability testing.
- Real-data stress testing.
- Bug fixing and performance review.
- Confirm the dashboard answers the household's recurring questions.

## Phase 5 — October release

Target: September 24–October 1, 2026

- Feature freeze.
- Regression and data-integrity testing.
- Recovery and rollback rehearsal.
- Production release approval.
- Bianca-ready release by October 1.

## Later

- Canadian bank import adapters
- Multi-currency support
- Web/mobile notifications
- Database-backed mobile-friendly application
- Optional family/friend distribution
