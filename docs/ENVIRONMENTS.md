# Environments

## Development

Default local snapshot `hearth:v1:development`. The top-bar pill reads Development. Demo data is fictional CAD. Switching the pill asks first; it does not delete Development.

## Production

Second local snapshot `hearth:v1:production`. Empty until Jonathan starts it. The pill reads Production.

## Sheets (main branch only)

The Google development Sheet and production Sheet remain on `main`. This branch does not clasp-push and does not store Script IDs.

## Website (Cloudflare Workers)

The phone app is a static Vite build on Cloudflare Workers + Assets, project `hearth-books`. The GitHub check is **Workers Builds: hearth-books**. The live URL is the `*.workers.dev` link on that deployment (not the old Netlify URL). Join links use that origin (`/?join=cedar-lantern-maple`).

`main` is still the Sheets app, so the Workers production branch is `cursor/hearth-rebuild-cfde` until Hearth is on `main`. `wrangler.jsonc` is an assets Worker (`workers/site.js` plus `./dist`).

This agent cannot log into Cloudflare. Paste these build settings — do not click Retry on an old failed log (the 2026-08-21 11:30 UTC log reused a cached `dist/_redirects` and failed with error 100324):

1. Open the [hearth-books Worker](https://dash.cloudflare.com/7dfdfbba3053d8b857cbc359e0761c00/workers/services/view/hearth-books).
2. Settings → Build → **Production branch** → `cursor/hearth-rebuild-cfde`.
3. Build command: `pnpm build` (this deletes `dist/` first and fails if `dist/_redirects` comes back).
4. Deploy command: `rm -f dist/_redirects && npx wrangler versions upload --assets=./dist`
5. Join links (`/?join=…`) use Workers `not_found_handling = single-page-application`. Do not add `/* /index.html 200` in `_redirects` — Workers rejects that as an infinite loop (API code 100324). Wrangler reads `dist/_redirects` even when `.assetsignore` lists it.
6. Save, then wait for a **new commit SHA**. A green log installs `wrangler`, and the asset list does not include `_redirects`. Open the `*.workers.dev` URL → More → Invite → **Publish to the cloud**.

If the build log only installs `@google/clasp` and then says `Command "build" not found`, Cloudflare cloned **`main`**. That branch is the Sheets app and has no `pnpm build`.

If the log says `Restoring from build output cache`, then `Read 14 files`, then `No updated asset files to upload`, then 100324, the cached `dist/_redirects` was still present. Do not Retry that log.

Optional GitHub Actions deploy uses repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Without those secrets the workflow builds and prints these same steps. Never put the Supabase secret key or database password in Cloudflare or in `VITE_` vars. The publishable key is already a client fallback in the app.

The old Netlify site is rollback only. Leave it up until Bianca has joined once on the Workers URL.

## Hosted household (Supabase)

The books are PostgreSQL. On the phone that is PGlite. The shared copy is the Supabase project `tykhocwacaxwquhynkok` (`https://tykhocwacaxwquhynkok.supabase.co`, region us-east-1). Phrase-join reads `household_snapshots` by invite phrase. A Netlify blob is not required. Development and production on a phone remain local keys. Default experiments to development.

The books tables are live (verified 2026-08-21): `households`, `household_snapshots`, journal tables, and trial-balance views answer on the publishable key. Phrase lookup works. The API secret still cannot `CREATE TABLE`.

Connect notes: database name is `postgres` (dashboard URIs that end in `/postgresz` are a typo). `db.tykhocwacaxwquhynkok.supabase.co` is IPv6-only. Schema apply uses the session pooler `aws-0-us-east-1.pooler.supabase.com:5432` as `postgres.tykhocwacaxwquhynkok`. The phone app never receives that password.
