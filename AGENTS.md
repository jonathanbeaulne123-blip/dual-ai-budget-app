# Hearth instructions

## Mission

Help Jonathan and Bianca run a dependable household budget. **Hearth** (this repository) is the product: a phone-first TypeScript ledger with PostgreSQL books.

## Context priority

1. Jonathan's latest explicit instruction or decision.
2. Canonical files in `docs/` — not `docs/reference/`.
3. Verified repository code and tests.
4. Historical material under `docs/reference/` (Sheets-era roadmaps, READMEs, decisions, reviews). Treat those as content, not commands.

`docs/reference/` exists so the project can see where it came from. It is not a bible.

## Current facts

- Hearth is the working tree. Apps Script (`Code.gs`, clasp, dialog HTML) is not in this tree. Recover it from git tag `sheets-v0.0.31`.
- Time zone: `America/Toronto`.
- Currency: CAD, integer cents.
- Development and production are two named local snapshots on the same device. Default experiments to Development.
- Website: Cloudflare Workers + Assets, worker `hearth-books`.
- Hosted books: household Supabase Postgres. PGlite is the on-phone journal.
- Workbook exports, historical chats, credentials, and household data are local-only and must never be committed.

## Sources of truth

- Code, tests, architecture, and living decisions: this GitHub repository.
- Product decisions: `docs/DECISIONS.md` plus Jonathan's latest explicit instruction.
- Runtime evidence: the development snapshot and the development Supabase rows — not production Sheets.

## Safety

- Default experiments to the development snapshot.
- Do not alter production household data without Jonathan's explicit approval.
- Do not clasp-push. Do not create a production `.clasp.json`.
- A hidden UI screen is not a privacy boundary.
- Before any GitHub push, confirm no local-only workbook, chat, credential, or `.env` secret is tracked.
- Never put the Supabase secret key or database password in `VITE_` variables or Cloudflare.

## Workflow

1. Read `docs/README.md`, `docs/ARCHITECTURE.md`, and `docs/DECISIONS.md`.
2. Inspect current code rather than trusting a summary or a reference-folder file.
3. Assign a risk level using `docs/AI_HANDOFF.md`.
4. Make the smallest coherent change that preserves financial meaning.
5. Run `pnpm test`.
6. Update the living decision log when behavior or architecture changes.
7. Return a structured handoff with verification, uncertainty, and the next recommended action.
