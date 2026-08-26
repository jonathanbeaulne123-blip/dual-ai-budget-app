# Worksession: Flinks Connect sandbox (2026-08-26)

## Scope

Recover secure Development Flinks Connect on current `main` (D-148). Flinks supplies import inbox evidence only; Confirm still posts money.

## Architecture

1. `FlinksConnectPanel` uses the exact Supabase session bearer.
2. Worker stores encrypted provider state in D1 (`FLINKS_DB`).
3. Iframe callback accepts only the expected Flinks iframe origin and exact iframe window; the Worker validates the callback URL and one-time state.
4. Worker completes the session, verifies Development membership scope, fetches the selected CAD account, and returns HMAC-redacted inbox rows.
5. `parseFlinksInbox` normalizes exact-cent evidence on-device.
6. `BatchImport.appendRows` stages rows; `prepareImportRows` runs account-scoped category autofill from PR #160.

## Retired path

- `/flinks/sync`
- `localStorage["hearth.flinks.loginId"]`
- `test/fixtures/flinks-demo.json`

## Owner actions before live Dev use

- [x] Bind D1 `hearth-flinks-development` as `FLINKS_DB` with database id `f01c81bd-db36-4715-a484-8f2f3bdad2a3`.
- [x] Apply the reviewed D-148 schema remotely. Five incompatible PR #160 demo rows remain recoverable in `flinks_connections_legacy_pr160`; the active table starts empty.
- [x] Configure all five Worker secrets: `FLINKS_CUSTOMER_ID`, `FLINKS_API_KEY`, `FLINKS_SECRET_KEY`, `FLINKS_CONNECTION_ENCRYPTION_KEY`, `FLINKS_DIGEST_KEY`.
- [x] Re-review the security/privacy gate and prepare Cloudflare version `1d296d03-7776-4d72-add1-217dc718e377` without assigning traffic.
- [ ] Merge only after GitHub CI and the Cloudflare PR check are green; `main` auto-deploys.

## Privacy/security re-review

Result: **PASS WITH NOTES for disposable Development use only.** The reviewed implementation requires an exact Supabase bearer and active member tuple before D1 access; binds AES-GCM ciphertext to environment, auth user, household, member, connection, and key version; validates the exact iframe origin and window plus a one-time callback state; limits selected accounts to CAD; disables account identity and KYC; bounds request/provider sizes and row counts; uses 10-second polling leases; returns only HMAC identifiers and exact-cent evidence; keeps pending rows non-postable; and retains provider-deletion retry state. Scope-generation cancellation prevents a delayed A→B→A response from entering the wrong ledger. Final Confirm remains the only posting boundary.

Production remains blocked. Server-side attestation that the callback `loginId` was issued for the exact Connect session is a Production follow-up, as is explicit disposition of the five preserved legacy encrypted demo rows.

## Status

Implementation branch only. Not merged or Production-ready. D1 is bound and migrated; all five required secrets exist in the prepared Cloudflare version. Preview smoke reports `sandbox-configured`, and `/flinks/sync` returns `410`. Production traffic is unchanged until merge/deploy approval.
