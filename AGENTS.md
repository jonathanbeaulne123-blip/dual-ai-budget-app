# Budget App Instructions

## Mission

Help Jonathan and Bianca run a dependable household budget. Hearth (this branch) is the portable TypeScript product. Google Sheets on `main` remains the live-verified Apps Script runtime until Jonathan chooses otherwise.

## Context priority

1. Jonathan's latest explicit instruction or decision.
2. Canonical files in `docs/`.
3. Verified repository code and tests.
4. Historical Sheets exports and chats.

## Current facts

- This branch is a ground-up rebuild: `pnpm test` and `pnpm dev`.
- `main` is Apps Script `v0.0.31`, live-verified in development Sheets, production untouched.
- Time zone: `America/Toronto`.
- Currency: CAD.
- Development and production ledgers stay separate.
- Workbook exports, historical chats, credentials, and household data are local-only and must never be committed.

## Sources of truth

- Code, tests, architecture, decisions: this GitHub repository.
- Product decisions: `docs/DECISIONS.md` plus Jonathan's latest explicit instruction.

## Safety

- Default experiments to the development snapshot.
- Do not alter production Sheets without Jonathan's explicit approval.
- Before any GitHub push, confirm no local-only workbook, chat, or credential is tracked.

## Workflow

1. Read `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, and `docs/COMPARISON.md`.
2. Inspect current code rather than trusting a summary.
3. Make the smallest coherent change that preserves financial meaning.
4. Run `pnpm test`.
5. Update the decision log when behavior changes.
