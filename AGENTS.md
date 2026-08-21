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

## Cursor Cloud specific instructions

This branch (`cursor/hearth-rebuild-cfde`) is the Hearth rebuild: a Vite 7 + React 19 + TypeScript SPA. The books are PostgreSQL running as in-browser PGlite (WASM), so there is no separate database process to start locally. Standard commands live in `package.json` (`dev`, `build`, `test`); the quickstart is in `README.md`.

- Run the app in dev with `pnpm dev` (Vite on port `5173`). It is a browser SPA — "running" means opening `http://localhost:5173/` and clicking **Open the demo kitchen table** to load a fictional household. No login, no server, no external DB is required for the core flow.
- `pnpm install` prints `Ignored build scripts: esbuild` (pnpm 10 blocks postinstall scripts by default). This is harmless: Vite/Vitest/build/dev all work because esbuild ships prebuilt platform binaries via optional dependencies. Do not add `pnpm approve-builds` to setup — it is interactive.
- `pnpm build` emits benign warnings from PGlite (`__vite-browser-external` re-exports, `eval` usage, chunks >500 kB). These are expected for the PGlite WASM bundle and do not indicate a broken build.
- `pnpm test` (Vitest) is the full suite; it is CPU/time heavy (~20s) because `test/scale.test.ts` runs a 12×200 transaction fixture and several tests spin up PGlite/`node:sqlite`. There is no linter configured on this branch — CI only runs `pnpm test`.
- Supabase (`pnpm books:apply`) and Netlify functions are OPTIONAL cloud extras (hosted household copy + pairing). They need `.env` secrets (see `.env.example`) and are not required to develop or test the local app; tests mock `fetch`.
