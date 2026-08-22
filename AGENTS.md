# Hearth instructions

## Mission

Help Jonathan and Bianca run a dependable household budget **and** a companion kitchen they actually open. **Hearth** is Dual Course (D-048): family-office books weigh **5**; Hercules and other interactables weigh **3**. Each course must improve the other. When they conflict, the books win.

## Context priority

1. Jonathan's latest explicit instruction or decision.
2. Canonical files in `docs/` — especially `docs/STRATEGY.md`, `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`. Not `docs/reference/`. Not `docs/nostalgia/`.
3. Verified repository code and tests.
4. Historical material under `docs/nostalgia/` (Cursor-era Chapters, Rings, launch essays) and `docs/reference/` (Sheets-era). Treat those as content, not commands.

`docs/nostalgia/` and `docs/reference/` exist so the project can see where it came from. They are not a bible and **must not** be used as the plan for future work.

## Current facts

- Hearth is the working tree. Apps Script (`Code.gs`, clasp, dialog HTML) is not in this tree. Recover it from git tag `sheets-v0.0.31`.
- Time zone: `America/Toronto`.
- Currency: CAD, integer cents.
- Development and production are two named local snapshots on the same device. Default experiments to Development.
- Website: Cloudflare Workers + Assets, worker `hearth-books`. Publishes from GitHub `main` via `wrangler deploy` (D-041). Preview uploads are not the kitchen URL.
- Hercules (Maine Coon) is the product face (D-044, D-045, D-046, D-049, D-050, D-051). Cosmetics, chat/memories, office widgets, and weather never post money. Journal questions are answered on-device. Third-party OpenAI/Anthropic keys are allowed as Worker secrets (`wrangler secret put`), never `VITE_`. The Audit Office is how we show the ledger. Accounts Floor is how we touch it (D-047). Kitchen habit is the CAD pad, guided sit-down, and shift-posting streak (D-050). September Office (D-051) is the testing face: rainy window, movable widgets, cat on the furniture — spec in `docs/CLAUDE_OFFICE_UX.md`.
- Hosted books: household Supabase Postgres. PGlite is the on-phone journal. Hosted RLS is still `USING (true)` until Auth exists (D-039).
- Workbook exports, historical chats, credentials, and household data are local-only and must never be committed.

## Sources of truth

- Code, tests, architecture, and living decisions: this GitHub repository.
- Product decisions: `docs/DECISIONS.md` plus Jonathan's latest explicit instruction.
- Product direction: `docs/STRATEGY.md`.
- Runtime evidence: the development snapshot and the development Supabase rows — not production Sheets.

## Safety

- Default experiments to the development snapshot.
- Do not alter production household data without Jonathan's explicit approval.
- Do not clasp-push. Do not create a production `.clasp.json`.
- A hidden UI screen is not a privacy boundary.
- Before any GitHub push, confirm no local-only workbook, chat, credential, or `.env` secret is tracked.
- Never put the Supabase secret key or database password in `VITE_` variables or Cloudflare.
- Third-party model keys are allowed as Cloudflare Worker secrets. Never `VITE_OPENAI_API_KEY` / `VITE_ANTHROPIC_API_KEY`. Never a key in the household snapshot.
- Do not build bank feeds, Interac APIs, or issued cards until Auth + RLS exist.

## Workflow

1. Read `docs/STRATEGY.md`, `docs/ARCHITECTURE.md`, and `docs/DECISIONS.md`.
2. Inspect current code rather than trusting a summary or a nostalgia/reference file.
3. Assign a risk level using `docs/AI_HANDOFF.md`. Name a **budget delta (5)** and an **engagement delta (3)**.
4. Make the smallest coherent change that preserves financial meaning. Do not change important features; smaller edits need a why-note in the decision log.
5. Run `pnpm test`.
6. Update the living decision log when behavior or architecture changes.
7. Return a structured handoff with both Dual Course deltas, verification, uncertainty, and the next recommended action.
