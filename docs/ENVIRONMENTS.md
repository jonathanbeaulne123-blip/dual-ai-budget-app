# Environments

## Development

Default Development ledger scope. D-114 stores household replicas at `hearth:household:v2:development:<householdId>`, personal replicas at `hearth:personal:v2:development:<householdId>:<memberId>`, plus a catalog and active pointer. Legacy `hearth:v1:development` migrates automatically. D-114 defines the corresponding cloud-backed personal/household authority discovered after Google sign-in; D-117 prepares explicit hosted membership and Personal-scope rows. Demo data is fictional CAD. Switching the pill asks first and never crosses into Production.

## Production

Separate Production ledger scope with the same v2 replica keys under `production`. Legacy `hearth:v1:production` migrates automatically. Empty until Jonathan starts it. Cloud continuity must preserve this environment boundary.

These pills are **not** Cloudflare production versus preview. They are separate ledger environments on every device. Stay on Development until daily use moves to Production.

## Website (Cloudflare Workers)

The phone app is a static Vite build on Cloudflare Workers + Assets, project `hearth-books`.

Live URL: [https://hearth-books.jonathan-beaulne123.workers.dev/](https://hearth-books.jonathan-beaulne123.workers.dev/)

Join links use that origin (`/?join=cedar-lantern-maple`). SPA routing uses Wrangler `not_found_handling = single-page-application`. Do not add `/* /index.html 200` in `_redirects` — Workers rejects that as an infinite loop (API code 100324). `pnpm build` wipes `dist/` so a leftover `_redirects` cannot be uploaded.

Dashboard: [hearth-books Worker](https://dash.cloudflare.com/7dfdfbba3053d8b857cbc359e0761c00/workers/services/view/hearth-books).

The kitchen URL publishes from GitHub **`main`** in one click: merge the pull request, or GitHub → Actions → **Cloudflare Workers** → **Run workflow**. That job runs `wrangler deploy`, which is production. `wrangler versions upload` only creates a preview hostname (`https://<version>-hearth-books.…workers.dev`) and does **not** move the live URL.

GitHub Actions needs repo secret `CLOUDFLARE_API_TOKEN`. The account id is already in `wrangler.jsonc` (`7dfdfbba3053d8b857cbc359e0761c00`, not a secret). Paste the API token with **no wrapping quotes**. The workflow keeps only header-safe characters (it also strips quotes, newlines, a UTF-8 BOM, and a leading `Bearer `); Wrangler otherwise fails with Authorization header 6111 and the kitchen stays stale. An empty token fails the job. A green check on a pull request is only a Vite build, not a live publish.

Put the public Google web client ID in a GitHub Actions **variable** named `VITE_GOOGLE_CLIENT_ID` (and in Cloudflare **Build** variables if Workers Builds stays on). Vite bakes `VITE_*` at `pnpm build`. Runtime Worker bindings are too late. Never put a Google client secret, the Supabase secret key, or a database password in `VITE_` vars, Cloudflare, or GitHub.

HTML documents are `Cache-Control: no-store`. The Worker runs first so an old shell cannot sit on the phone. `POST /hercules/chat` is the Hercules talk endpoint. Allowed browser origins are the live kitchen, the exact `main-hearth-books…workers.dev` Git production alias, localhost, and eight-hex preview hosts for this Worker. Named lookalikes remain denied. Chat meters 60 requests per client IP per UTC day: `HERCULES_RATE` KV is durable across isolates; without it, bounded isolate memory prevents a missing-configuration bypass but is not a reliable global production counter. Missing IP metadata shares an `unknown` bucket. Chat is **not** stored on the Worker. **Third-party API keys are allowed** (D-045): `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` are Cloudflare Worker secrets (`wrangler secret put …` or the Worker dashboard). Never `VITE_` variables, never household rows, never a GitHub Actions secret that Vite would bake into the SPA. If those secrets are absent, Cloudflare Workers AI talks. Local `pnpm dev` proxies that path to the kitchen URL and falls back to the on-device purrsonality if the Worker is quiet.

If Cloudflare Workers Builds is still connected, production branch is `main` and the deploy command must be:

```text
rm -f dist/_redirects && npx wrangler deploy --assets=./dist
```

Not `wrangler versions upload`. Preview versions can exist; they are not the kitchen.

Account id for this Worker: `7dfdfbba3053d8b857cbc359e0761c00`.

## Hosted continuity (Supabase)

PGlite is each device's books engine. Current hosted code stores a household JSON snapshot in Supabase and reads it by invite phrase plus environment. D-114 changes the target: Google identity discovers explicit personal-ledger and household-ledger memberships, and the hosted service supplies durable continuity so another device never depends on this phone.

Boot, demo, empty start, Hearth Pass, and unlinked commits currently make **zero** household REST calls (D-110 containment). Invite → **Publish to the cloud** is still the legacy opt-in implementation, not the target product. D-114 replaces it with automatic post-sign-in sync through a durable outbox. Possible leftover rows from the old implicit uploader: [HOSTED_ROW_INVENTORY.md](HOSTED_ROW_INVENTORY.md). Do not delete them without Jonathan.

The migration also creates journal tables and trial-balance views. The app does **not** write those hosted journal tables. It upserts `households` and `household_snapshots` only. Hosted views over journal tables would read zeroes. Treat hosted Postgres as snapshot transport until a later writer exists (D-052).

Legacy hosted tables still use open RLS (`USING (true) WITH CHECK (true)` for ALL, including DELETE). The bundled publishable key can `GET`/`POST`/`PATCH`/`DELETE` those existing rows; the three-word phrase is not an API control. Migration 003 is applied: its new membership/personal tables are limited to Development by RLS and grant only `SELECT`/`INSERT`/`UPDATE`, but the browser-supplied Google subject remains a selector, not authentication. Through 2026-09-30 these rows are disposable Development data. Before meaningful October data, ship Google Auth, deny-by-default membership RLS, and the reviewed CAS/cutover. Migration 002 and the Auth/RLS packet remain unapplied; Production and destructive cleanup remain separate approvals.

On the phone, PGlite uses `idb://hearth-books-development` or `idb://hearth-books-production`. The household snapshot in IndexedDB was already split by pill.

Connect notes: database name is `postgres` (dashboard URIs that end in `/postgresz` are a typo). `db.tykhocwacaxwquhynkok.supabase.co` is IPv6-only. Schema apply uses the session pooler `aws-0-us-east-1.pooler.supabase.com:5432` as `postgres.tykhocwacaxwquhynkok`. The phone app never receives that password.

## Google household bridge (live on the kitchen)

The suite is in product scope (D-078). Opt-in extras (Drive, Contacts, Gmail, Sheets) still start as a ping until their Dual Course feature ships. See [GOOGLE.md](GOOGLE.md) and [STRATEGY.md](STRATEGY.md).

OAuth client IDs are public. Put a Google Cloud **Web** client ID in `VITE_GOOGLE_CLIENT_ID` (see `.env.example` and [GOOGLE.md](GOOGLE.md)). On the kitchen site that means a GitHub Actions **variable** of the same name so merge-time `pnpm build` bakes it. Authorized JavaScript origins must include `http://localhost:5173` and the Cloudflare Workers URL.

Do not put a Google client secret in `VITE_` vars, Cloudflare, or the repo. Hearth uses Google Identity Services in the browser. Access tokens stay on this phone under `hearth:v1:<environment>:google:<memberId>` (older Calendar tokens under `:gcal:` are migrated once). Development and production tokens stay separate. Disconnecting deletes that token on this phone.

The current household snapshot stores **who is linked** (email, Google subject, granted scopes), not the token. D-114 temporarily discovers Development membership from those embedded links and keeps Production discovery off. D-117 prepares durable identity-to-personal-ledger and identity-to-household membership outside the ledger snapshot; its migration remains unapplied. Default suite services are sign-in and Calendar; extra suite access remains opt-in.

Without a client ID, Calendar still works locally: the month board, ledger-spotted bills, and **Download .ics with alarms**. That fallback does not satisfy D-114 cross-device continuity. Google never posts money; phrases remain invitation/recovery aids.

## Sheets

Google Sheets is no longer the working tree. The last Apps Script snapshot is git tag `sheets-v0.0.31`. Docs from that era: [reference/sheets-era/](reference/sheets-era/).
