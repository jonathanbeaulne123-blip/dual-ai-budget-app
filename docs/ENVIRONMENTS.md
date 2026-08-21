# Environments

## Development

Default local snapshot `hearth:v1:development`. The top-bar pill reads Development. Demo data is fictional CAD.

## Production

Second local snapshot `hearth:v1:production`. Empty until Jonathan starts it. The pill reads Production.

## Sheets (main branch only)

The Google development Sheet and production Sheet remain on `main`. This branch does not clasp-push and does not store Script IDs.

## Website (Cloudflare Pages)

The phone app is a static Vite build on Cloudflare Pages, project `hearth-books`. Expected URL after the first deploy: `https://hearth-books.pages.dev`. Join links use that origin (`/?join=cedar-lantern-maple`).

`main` is still the Sheets app, so Pages production branch is `cursor/hearth-rebuild-cfde` until Hearth is on `main`.

This agent cannot log into Cloudflare. One dashboard step creates the live site:

1. Open [Workers & Pages](https://dash.cloudflare.com/?to=/:account/pages) → Create → Pages → Connect to Git.
2. Authorize the private repo `jonathanbeaulne123-blip/dual-ai-budget-app`.
3. Project name `hearth-books`. Production branch `cursor/hearth-rebuild-cfde`.
4. Build command `pnpm build`. Output directory `dist`. Node `22`.
5. Deploy. Hard-refresh the phone on `https://hearth-books.pages.dev`.
6. More → Invite → **Publish to the cloud**. Bianca uses the phrase or the new join link.

Optional GitHub Actions deploy uses repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Without those secrets the workflow builds and prints these same steps. Never put the Supabase secret key or database password in Cloudflare or in `VITE_` vars. The publishable key is already a client fallback in the app.

The old Netlify site is rollback only. Leave it up until Bianca has joined once on Pages.

## Hosted household (Supabase)

The books are PostgreSQL. On the phone that is PGlite. The shared copy is the Supabase project `tykhocwacaxwquhynkok` (`https://tykhocwacaxwquhynkok.supabase.co`, region us-east-1). Phrase-join reads `household_snapshots` by invite phrase. A Netlify blob is not required. Development and production on a phone remain local keys. Default experiments to development.

The books tables are live (verified 2026-08-21): `households`, `household_snapshots`, journal tables, and trial-balance views answer on the publishable key. Phrase lookup works. The API secret still cannot `CREATE TABLE`.

Connect notes: database name is `postgres` (dashboard URIs that end in `/postgresz` are a typo). `db.tykhocwacaxwquhynkok.supabase.co` is IPv6-only. Schema apply uses the session pooler `aws-0-us-east-1.pooler.supabase.com:5432` as `postgres.tykhocwacaxwquhynkok`. The phone app never receives that password.
