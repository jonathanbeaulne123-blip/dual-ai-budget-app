# New-household ledger naming

**Status:** Merged to `main` as [PR #77](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/77). No hosted schema, hosted rows, Production data, or secrets changed.

## Outcome

- **Start our household** opens a three-name setup instead of immediately creating the default household.
- The setup names the household, its shared ledger, and one selected member's Personal ledger.
- Users select the Personal-ledger owner by member name; raw member ids are never requested.
- Names live in the shared household snapshot as `ledgerNames`, appear in the view switch and Ledger page, and travel through cloud/device envelopes.
- Legacy snapshots receive deterministic defaults without rewriting money.

## Verification

- Full serial suite: **48 files, 355 tests passed**.
- Focused naming/storage/sync/continuity proof: **23 tests passed**.
- Previously timing-sensitive unrelated files: **36 tests passed** when rerun serially.
- TypeScript `--noEmit`: passed.
- Production Vite build: passed with the existing PGlite and chunk-size warnings.

## Dual Course

- Budget delta (5): **+1** — users can distinguish multiple household and Personal books without relying on internal ids.
- Engagement delta (3): **+1** — the first household feels owned and recognizable from its first screen.

## Remaining boundary

This names the two ledger views; it does not rename members, accounts, or Google identities. Each additional member receives a safe default Personal-ledger name until a later rename surface is added.
