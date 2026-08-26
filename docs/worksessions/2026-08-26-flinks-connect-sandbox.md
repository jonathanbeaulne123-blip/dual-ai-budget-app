# Worksession: Flinks Connect sandbox (2026-08-26)

## Scope

Recover secure Development Flinks Connect on current `main` (D-148). Flinks supplies import inbox evidence only; Confirm still posts money.

## Architecture

1. `FlinksConnectPanel` uses the exact Supabase session bearer.
2. Worker stores encrypted provider state in D1 (`FLINKS_DB`).
3. Iframe callback accepts only the expected Flinks iframe origin.
4. Worker completes the session, verifies Development membership scope, fetches the selected CAD account, and returns HMAC-redacted inbox rows.
5. `parseFlinksInbox` normalizes exact-cent evidence on-device.
6. `BatchImport.appendRows` stages rows; `prepareImportRows` runs account-scoped category autofill from PR #160.

## Retired path

- `/flinks/sync`
- `localStorage["hearth.flinks.loginId"]`
- `test/fixtures/flinks-demo.json`

## Owner actions before live Dev use

1. Create/bind D1: `wrangler d1 create hearth-flinks-development` then update `database_id` in `wrangler.jsonc`.
2. Apply migration: `wrangler d1 execute hearth-flinks-development --file=migrations/flinks/0001_connections.sql`.
3. Set Worker secrets: `FLINKS_CUSTOMER_ID`, `FLINKS_API_KEY`, `FLINKS_SECRET_KEY`, `FLINKS_CONNECTION_ENCRYPTION_KEY`, `FLINKS_DIGEST_KEY`.
4. Request independent security/privacy review before merge/deploy.

## Status

Implementation branch only. Not merged. Not deployed. Not Production-ready.
