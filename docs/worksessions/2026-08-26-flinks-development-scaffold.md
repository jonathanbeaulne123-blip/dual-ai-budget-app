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
- `FLINKS_INSTANCE` (default `toolbox`)
- `FLINKS_DEMO` (default `true`)
- `FLINKS_CONNECT_REDIRECT_PATH`

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

Independent review: bearer/member scope, D1 encryption, iframe origin/state validation, provider deletion, ID redaction, Final Confirm boundary.
