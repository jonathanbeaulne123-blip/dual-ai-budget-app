# Google account and household bridge

Google is Hearth's account-entry and recovery identity. The accepted target is simple: sign in on any device and see your personal ledger plus every household ledger you belong to, even when the old device is off. Google also connects Calendar and, when enabled, Drive, Contacts, Gmail, and Sheets. It is **not** a bank and **never** posts money.

## First-time entry choices

The empty-device screen exposes three focused paths instead of one ambiguous Continue button:

1. **Create household with Google** — sign in first, name the household/shared/Personal ledgers, then create the Google-owned cloud household and enter its shared ledger.
2. **Login with Google** — sign in, list the household memberships returned for that exact identity, then choose the household to open.
3. **Join with QR code** — mobile opens its rear camera and reads the existing Auth invite QR. Desktop explains that camera join is mobile-only. QR redemption still requires Google Auth; the QR is not a substitute identity.
Existing three-word codes and pasted Auth/legacy invite links remain supported for deep links, QR fallback, and compatibility, but are not advertised as another first-screen choice. Hearth has no three-letter-code protocol; do not invent one in UI copy or treat a short routing code as authentication.

The demo remains a secondary Development exploration path, not one of the three real-account choices.

The D-114 slice provides automatic Development household discovery and durable outbox replay alongside legacy phrase/`linked` transport. Migration 003 is applied, so D-117 dedicated hosted personal-ledger storage and server-side memberships are live in Development. Each device keeps its own token/session. Tokens never enter the ledger snapshot, outbox, or Git, and Development and Production stay separate. Atomic CAS and secured Production remain.

Related: [CLOUD_CONTINUITY.md](CLOUD_CONTINUITY.md), [DECISIONS.md](DECISIONS.md) D-032, D-040, D-043, D-114, D-117, [ENVIRONMENTS.md](ENVIRONMENTS.md), and [STRATEGY.md](STRATEGY.md).

---

## On the kitchen site

Live URL: [https://hearth-books.jonathan-beaulne123.workers.dev/](https://hearth-books.jonathan-beaulne123.workers.dev/)

### 1. Link your Google account

1. Open Hearth on your phone.
2. Tap **More**.
3. Open **Google household bridge**.
4. Next to your name, tap **Link**.
5. Pick **your** Google account and allow email, Calendar, and **Drive (Hearth-created files only)**. Drive consent is required at connection; saving any individual receipt remains optional.
6. Bianca does the same on **her** phone, with **her** Google account.

The same Google email cannot be linked to both people.

### 2. Continue with Google on any device

1. Open Hearth and choose **Continue with Google**.
2. Tap **Continue with Google**.
3. Sign in. Development discovers every hosted household snapshot containing that exact Google subject and asks which ledger to open when there is more than one.
4. Pulled books are validated in PGlite before Hearth opens them.
5. Work normally. Offline accepted writes retry on launch, focus, and reconnection.

Current limitations: Production discovery waits for Auth/RLS. Development keeps an open disposable fallback and still uses snapshot CAS rather than a hosted journal. Applied migration 003 provides hosted member Personal snapshots; the repaired client projects Personal transactions, shifts, and private goals out of the shared cloud snapshot and overlays only the signed-in member's Personal envelope. Supabase Auth bearer wiring exists behind `VITE_SUPABASE_AUTH_ENABLED=1`. Migrations 004/005 are applied, but Google provider configuration and project-wide cutover 006 remain incomplete. Because one Production household shares this Supabase project, a Development-only 006 rehearsal requires a separate project.

### 3. Extra calendar sync

1. Tap **Calendar**.
2. Tap **Google**.
3. Connect on this phone if the household shows you as linked but this phone has no token.
4. Tap **Write reminders to Google** when you want bill reminders at 9:00 Toronto.
5. Or tap **Download .ics with alarms** if this build has no Google client ID.

Google reminders are not ledger rows. **Mark paid** still confirms, then posts.

### 4. Security confirmation

After you are linked, these actions ask Google to confirm it is you first:

- Reset this environment
- Switch Development / Production
- Reload demo data
- Publish / sync / join / import a Hearth Pass / pull from the cloud

If you are not linked, or this build has no client ID, Hearth does not block those actions.

Tap **Confirm it is me** or **Sync Google now** on **More → Google household bridge** anytime you want an extra check.

### 5. Google suite

Required at connection: Google sign-in and narrow `drive.file`. Both **Continue with Google** (Supabase Auth) and the direct Google household bridge request it. Calendar is also on by default in the direct suite. `drive.file` does not grant Hearth access to unrelated Drive files.

Off until you turn them on (each shows a warning):

- Contacts — read names to match the household
- Gmail — read-only; never posts money from an email
- Sheets — read-only; not the old budget workbook. The books stay in Postgres

Then tap **Sync Google now**. Hearth will ask Google for the extra permission if it does not have it yet.

---

## Google Cloud (once per website)

The client ID is public. Never put a client secret in `.env`, Cloudflare, GitHub, or the repo.

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or pick a project.
3. APIs & Services → **Enable** at least:
   - Google Identity / People (userinfo)
   - Google Calendar API
   - Drive API, People API, Gmail API, Sheets API only if you will turn those on in Hearth
4. APIs & Services → Credentials → **Create credentials** → OAuth client ID → **Web application**.
5. Authorized JavaScript origins:
   - `http://localhost:5173`
   - `https://hearth-books.jonathan-beaulne123.workers.dev`
6. Copy the client ID into `.env` as `VITE_GOOGLE_CLIENT_ID=....apps.googleusercontent.com`.
7. OAuth consent screen: add the scopes Hearth requests (openid, email, profile, Calendar, and any extras you enable). Add Jonathan and Bianca as **test users** while the app is in testing. Gmail and Contacts are sensitive; Google will error until those users are listed or the app is verified.
8. For the live Worker, put the same `VITE_GOOGLE_CLIENT_ID` in **two** places (public client ID, never a client secret):
   - GitHub → Settings → Secrets and variables → Actions → **Variables** (this is what `pnpm build` on merge sees)
   - Cloudflare hearth-books → **Build** variables (only if Workers Builds is still connected; runtime Bindings / Variables are too late for Vite)
9. Merge to `main` (or Actions → Cloudflare Workers → Run workflow). Vite bakes the id at build time. A phone hard-refresh if an old shell is still sitting there.

Without a client ID, Calendar still works: month board, spotted bills, `.ics` with Toronto alarms.

---

## What the engine is

Call `withGoogle({ environment, memberId, services, stepUp?, fn })` whenever a Calendar/Drive/Contacts/Gmail/Sheets feature needs Google. Those suite integrations are call-when-needed. Ledger continuity is separate and automatic after sign-in, membership discovery, and local acceptance; it uses a durable outbox rather than Google Drive or Sheets.

Commands `linkGoogleIdentity`, `unlinkGoogleIdentity`, `touchGoogleConfirmation`, and `setGoogleServices` update the shared snapshot. They never call `postEntry`.

---

## Status (D-078)

Google is **live product**, not a parking lot. Identity and Calendar work today; D-114 expands identity into cross-device ledger discovery and recovery, while D-117 prepares explicit hosted membership and Personal scope. Baking `VITE_GOOGLE_CLIENT_ID` is no longer the backlog item. A local Vite build without the variable still gets the month board and `.ics`, but cannot satisfy the signed-in continuity promise.

Living pairs and refused list: [STRATEGY.md](STRATEGY.md) § Google Dual Course.

### Shipping now

Identity, Calendar overlay, bill reminders, Continue with Google, step-up on sensitive household actions, suite **ping**, **sit-down Drive workbook** (create a Sheet with `drive.file`, never edit an existing file; local download always works; D-087), **desk appearance** (`Hearth desk.json` for this Google identity; D-092), and optional per-receipt evidence in private `Hearth Receipts/YYYY/MM` with soft retry and explicit deletion (D-137; local branch, not deployed).

### Proposed next (in scope)

Do these as Dual Course features that call `withGoogle`. Do **not** add a Google widget to Home while the desk is being subtracted. Calendar is the Google manager. More remains link / opt-in / confirm.

1. **Visit and claim reminders** — same upsert as bills; quiet titles stay coded; never `postVisit`.
2. **Punch-clock busy** — optional timed block while `openShift` is live; wipe on abandon; never `postShift`.
3. **Gmail statement inbox** — read-only, on this phone, suggest a recurrence or Add draft; Confirm still posts. Mail bodies never enter the household snapshot. Bank PDF parsers still wait on Auth.
4. **Sheets import** — pick a spreadsheet, read a range, sanitize, same D-011 path as CSV. Read-only. Not the old budget workbook. No Sheets write-back.
5. **Contacts match** — suggest a member or practitioner. Not a phone backup.
6. **Hercules calendar chips** — overlay + month board, on-device. No Gmail in the model payload.

### Still not Google’s job

Google is not a bank. Tokens and mail/Drive/Contacts bodies stay off ledger snapshots. Phrase, join, and Hearth Pass may invite, bootstrap, export, or recover; they are not the normal ongoing access model. Google never posts money.
