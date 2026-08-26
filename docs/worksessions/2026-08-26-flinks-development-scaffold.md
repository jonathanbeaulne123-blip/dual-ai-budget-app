# Worksession: Flinks Development scaffold (2026-08-26)

## Goal

Scaffold secure Flinks on the Cloudflare Worker without exposing provider identifiers to the browser.

## Files

| Area | Path |
| --- | --- |
| UI | `src/FlinksConnectPanel.tsx` |
| Client | `src/imports/flinksClient.ts` |
| Parser | `src/core/importInbox/flinks.ts` (`parseFlinksInbox`) |
| Worker | `workers/flinks.js` |
| D1 schema | `migrations/flinks/0001_connections.sql` |
| Config | `wrangler.jsonc`, `vite.config.ts` (`/bank/flinks` proxy) |

## Public Worker vars (non-secret)

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `FLINKS_ENABLED` (`true` only for the reviewed Development Worker)
- `FLINKS_ALLOW_PRODUCTION` (`false`)
- `FLINKS_API_BASE_URL` (fixed Toolbox origin)
- `FLINKS_CONNECT_BASE_URL` (fixed Toolbox iframe origin)
- `FLINKS_REDIRECT_ORIGIN` (fixed approved Hearth origin)

## Secret names only

- `FLINKS_SECRET_KEY`
- `FLINKS_API_KEY`
- `FLINKS_CONNECTION_ENCRYPTION_KEY`
- `FLINKS_DIGEST_KEY`
- `FLINKS_CUSTOMER_ID`

Never commit secret values.

## Verification

```bash
pnpm exec vitest run test/flinks-worker.test.ts test/flinks-client.test.ts test/flinks-connect-ui.test.ts test/import-flinks.test.ts test/import-triage.test.ts test/batch-import-ui.test.ts --maxWorkers=1 --testTimeout=30000
pnpm test
pnpm build
pnpm exec wrangler deploy --dry-run
```

## Open

Independent review: bearer/member scope, ownership-bound D1 encryption, exact iframe origin/window plus callback-state validation, provider deletion retry state, bounded provider responses, stable ID redaction, exact-cent parsing, scope-generation cancellation, and Final Confirm boundary.
