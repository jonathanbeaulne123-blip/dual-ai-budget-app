# Environments

## Development

Default local snapshot `hearth:v1:development`. The top-bar pill reads Development. Demo data is fictional CAD.

## Production

Second local snapshot `hearth:v1:production`. Empty until Jonathan starts it. The pill reads Production.

## Sheets (main branch only)

The Google development Sheet and production Sheet remain on `main`. This branch does not clasp-push and does not store Script IDs.

## Website (Cloudflare Workers)

The phone app is a static Vite build on Cloudflare Workers + Assets, project `hearth-books`. The GitHub check is **Workers Builds: hearth-books**. The live URL is the `*.workers.dev` link on that deployment (not the old Netlify URL). Join links use that origin (`/?join=cedar-lantern-maple`).

`main` is still the Sheets app, so the Workers production branch is `cursor/hearth-rebuild-cfde` until Hearth is on `main`. `wrangler.toml` serves `./dist` as a single-page app. It is not a Pages `pages_build_output_dir` project.

This agent cannot log into Cloudflare. If a build already exists:

1. Open the [hearth-books Worker](https://dash.cloudflare.com/7dfdfbba3053d8b857cbc359e0761c00/workers/services/view/hearth-books).
2. Settings → Build → Production branch → `cursor/hearth-rebuild-cfde`.
3. Build command `pnpm build` (also in `wrangler.toml`). Node `22` if the dashboard lets you pin it.
4. Retry deployment. A good log installs `vite`, `react`, and `@electric-sql/pglite`, then uploads `dist/`.
5. Open the `*.workers.dev` URL → More → Invite → **Publish to the cloud**.

If the build log only installs `@google/clasp` and then says `Command "build" not found`, Cloudflare cloned **`main`**. That branch is the Sheets app and has no `pnpm build`.

Optional GitHub Actions deploy uses repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Without those secrets the workflow builds and prints these same steps. Never put the Supabase secret key or database password in Cloudflare or in `VITE_` vars. The publishable key is already a client fallback in the app.

The old Netlify site is rollback only. Leave it up until Bianca has joined once on the Workers URL.

## Hosted household (Supabase)

The books are PostgreSQL. On the phone that is PGlite. The shared copy is the Supabase project `tykhocwacaxwquhynkok` (`https://tykhocwacaxwquhynkok.supabase.co`, region us-east-1). Phrase-join reads `household_snapshots` by invite phrase. A Netlify blob is not required. Development and production on a phone remain local keys. Default experiments to development.

The books tables are live (verified 2026-08-21): `households`, `household_snapshots`, journal tables, and trial-balance views answer on the publishable key. Phrase lookup works. The API secret still cannot `CREATE TABLE`.

Connect notes: database name is `postgres` (dashboard URIs that end in `/postgresz` are a typo). `db.tykhocwacaxwquhynkok.supabase.co` is IPv6-only. Schema apply uses the session pooler `aws-0-us-east-1.pooler.supabase.com:5432` as `postgres.tykhocwacaxwquhynkok`. The phone app never receives that password.
