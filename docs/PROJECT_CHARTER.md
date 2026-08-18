# Project Charter

## Purpose

Build a flexible household budgeting system that helps Jonathan and Bianca enter transactions, understand income and tips, plan monthly spending, track goals, and receive useful forward-looking insights without requiring backend code changes for ordinary customization.

## Current outcome

Establish an efficient tri-AI development ecosystem, reconcile the current implementation, then complete a full functionality and visual review.

## Near-term product priorities

1. Transaction Input
2. Tip Tracking
3. Dashboard
4. Flexible monthly planning and scenarios
5. User-managed goals and progress tracking
6. Recurring transactions and actionable insights

## Users and scale

- Initial users: Jonathan and Bianca
- Possible later users: family and friends
- Expected volume: approximately 500 transactions per month
- Current platform: Google Sheets and Apps Script
- Long-term platform: mobile-friendly application
- Time zone: Toronto (`America/Toronto`)
- Currency: single-currency initially; multi-currency later

## Product principles

- User customization should be data-driven rather than implemented through code edits.
- Transactions remain the canonical ledger; summaries are derived outputs.
- Transfers are neither income nor expense.
- Ownership is explicit and supports variable amount or percentage splits.
- Forecasts support multiple horizons and scenarios.
- Forecast evidence may include trailing averages and prior-year period comparisons.
- Bank import architecture should remain possible, but integrations must not delay core reliability.
- Deterministic categorization is acceptable for the current phase.
- Dashboard alerts precede external notifications.

## Success milestones

### September 1, 2026

A functional development build in Sheets with tested Transaction Input, Tip Tracking, Dashboard behavior, and a dependable AI/repository workflow.

### October 1, 2026

A stable version Bianca can use with documented onboarding, tested core flows, clear development/production separation, and a reliable recovery path.

## Out of scope for the immediate milestone

- Production bank connections for all six major Canadian banks
- Multi-currency processing
- Public distribution
- Database migration
- Web/mobile notifications

