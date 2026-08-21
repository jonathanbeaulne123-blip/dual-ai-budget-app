# Environments

## Development

Default local snapshot `hearth:v1:development`. The top-bar pill reads Development. Demo data is fictional CAD. Switching the pill asks first; it does not delete Development.

## Production

Second local snapshot `hearth:v1:production`. Empty until Jonathan starts it. The pill reads Production.

These pills are **not** Cloudflare production vs preview. They are two ledgers on the same phone. Stay on Development until daily use moves to Production.

## Website (Cloudflare Workers)

The phone app is a static Vite build on Cloudflare Workers + Assets, project `hearth-books`.

Live URL: [https://hearth-books.jonathan-beaulne123.workers.dev/](https://hearth-books.jonathan-beaulne123.workers.dev/)

Join links use that origin (`/?join=cedar-lantern-maple`). SPA routing uses Wrangler `not_found_handling = single-page-application`. Do not add `/* /index.html 200` in `_redirects` — Workers rejects that as an infinite loop (API code 100324). `pnpm build` wipes `dist/` so a leftover `_redirects` cannot be uploaded.

Dashboard: [hearth-books Worker](https://dash.cloudflare.com/7dfdfbba3053d8b857cbc359e0761c00/workers/services/view/hearth-books).

The kitchen URL publishes from GitHub **`main`**. Cloudflare Workers Builds production branch must be `main`. Merging a PR does not update the phone until that Worker rebuilds.

GitHub Actions can also publish when repo secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` exist. If they are missing, the Cloudflare workflow still builds, skips Deploy, and warns. A green check is not proof the live URL moved. Never put the Supabase secret key or database password in Cloudflare or in `VITE_` vars. The publishable key is already a client fallback in the app.

Account id for this Worker: `7dfdfbba3053d8b857cbc359e0761c00`.

## Hosted household (Supabase)

The books are PostgreSQL. On the phone that is PGlite. The shared copy is the Supabase project `tykhocwacaxwquhynkok` (`https://tykhocwacaxwquhynkok.supabase.co`, region us-east-1). Phrase-join reads `household_snapshots` by invite phrase.

The books tables are live: `households`, `household_snapshots`, journal tables, and trial-balance views answer on the publishable key. The API secret still cannot `CREATE TABLE`. RLS is still open (`USING (true)`) until Auth exists.

Connect notes: database name is `postgres` (dashboard URIs that end in `/postgresz` are a typo). `db.tykhocwacaxwquhynkok.supabase.co` is IPv6-only. Schema apply uses the session pooler `aws-0-us-east-1.pooler.supabase.com:5432` as `postgres.tykhocwacaxwquhynkok`. The phone app never receives that password.

## Google Calendar (optional)

OAuth client IDs are public. Put a Google Cloud **Web** client ID in `VITE_GOOGLE_CLIENT_ID` (see `.env.example`). Authorized JavaScript origins must include `http://localhost:5173` and the Cloudflare Workers URL.

Do not put a Google client secret in `VITE_` vars, Cloudflare, or the repo. Hearth uses Google Identity Services in the browser and stores access tokens only in `localStorage` under `hearth:v1:<environment>:gcal:<memberId>`. Development and production tokens stay separate. Disconnecting a person deletes that token on this phone.

Without a client ID, Calendar still works: the month board, ledger-spotted bills, and **Download .ics with alarms** (America/Toronto, 24-hour and morning-of VALARM). Google never posts money.

## Sheets

Google Sheets is no longer the working tree. The last Apps Script snapshot is git tag `sheets-v0.0.31`. Docs from that era: [reference/sheets-era/](reference/sheets-era/).
