# Environments

## Development

Default local snapshot `hearth:v1:development`. The top-bar pill reads Development. Demo data is fictional CAD.

## Production

Second local snapshot `hearth:v1:production`. Empty until Jonathan starts it. The pill reads Production.

## Sheets (main branch only)

The Google development Sheet and production Sheet remain on `main`. This branch does not clasp-push and does not store Script IDs.

## Hosted household

The books are PostgreSQL. On the phone that is PGlite. The shared copy is the Supabase project `tykhocwacaxwquhynkok` (`https://tykhocwacaxwquhynkok.supabase.co`, region us-east-1). Phrase-join reads `household_snapshots` by invite phrase. A Netlify blob is not required. Development and production on a phone remain local keys. Default experiments to development.

The books tables are live (verified 2026-08-21): `households`, `household_snapshots`, journal tables, and trial-balance views answer on the publishable key. Phrase lookup works. The API secret still cannot `CREATE TABLE`.

Next household step: open this branch of the app, More → Invite → **Publish to the cloud**, then the other phone types the three-word phrase.

The public Netlify site must be a build of this branch. The publishable key is the client key (safe in the browser bundle; never put the secret key or database password in Netlify `VITE_` vars). Optional Netlify env:

- `VITE_SUPABASE_URL=https://tykhocwacaxwquhynkok.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=` the `sb_publishable_…` key

Connect notes: database name is `postgres` (dashboard URIs that end in `/postgresz` are a typo). `db.tykhocwacaxwquhynkok.supabase.co` is IPv6-only. Schema apply uses the session pooler `aws-0-us-east-1.pooler.supabase.com:5432` as `postgres.tykhocwacaxwquhynkok`. The phone app never receives that password.
