# Google household bridge

Google is how Jonathan and Bianca prove who they are on Hearth and how Hearth talks to Calendar (and, if you turn them on, Drive, Contacts, Gmail, and Sheets). It is **not** a bank. It **never** posts money. The three-word phrase, join link, and Hearth Pass still join a new phone.

Tokens stay on **this phone**. The shared household only remembers who is linked (name, email, Google id). Development and Production keep separate tokens.

Related: [DECISIONS.md](DECISIONS.md) D-032, D-040, D-043. [ENVIRONMENTS.md](ENVIRONMENTS.md). [STRATEGY.md](STRATEGY.md).

---

## On the kitchen site

Live URL: [https://hearth-books.jonathan-beaulne123.workers.dev/](https://hearth-books.jonathan-beaulne123.workers.dev/)

### 1. Link your Google account

1. Open Hearth on your phone.
2. Tap **More**.
3. Open **Google household bridge**.
4. Next to your name, tap **Link**.
5. Pick **your** Google account and allow email (and Calendar if asked).
6. Bianca does the same on **her** phone, with **her** Google account.

The same Google email cannot be linked to both people.

### 2. Continue with Google on this phone

1. If the household is already on the phone and Hearth asks **Who is using this phone?**
2. Tap **Continue with Google**.
3. Sign in. Hearth matches that email to the linked person.

If nobody has linked that email yet, choose yourself first, then complete step 1.

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

### 5. Optional Google suite

Default on: Google sign-in and Calendar.

Off until you turn them on (each shows a warning):

- Drive — only files Hearth creates
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

Call `withGoogle({ environment, memberId, services, stepUp?, fn })` whenever a feature needs Google. It is not a background daemon. It refreshes the token on this phone, asks Google again when `stepUp` is true, then runs `fn`. `syncGoogleSuite` pings each household-enabled service.

Commands `linkGoogleIdentity`, `unlinkGoogleIdentity`, `touchGoogleConfirmation`, and `setGoogleServices` update the shared snapshot. They never call `postEntry`.

---

## Status (D-078)

Google is **live product**, not a parking lot. Jonathan confirmed the kitchen integration works. Baking `VITE_GOOGLE_CLIENT_ID` is no longer the backlog item. A local Vite build without the variable still gets the month board and `.ics`.

Living pairs and refused list: [STRATEGY.md](STRATEGY.md) § Google Dual Course.

### Shipping now

Identity, Calendar overlay, bill reminders, Continue with Google, step-up on sensitive household actions, opt-in suite **ping**.

### Proposed next (in scope)

Do these as Dual Course features that call `withGoogle`. Do **not** add a Google widget to Home while the desk is being subtracted. Calendar is the Google manager. More remains link / opt-in / confirm.

1. **Visit and claim reminders** — same upsert as bills; quiet titles stay coded; never `postVisit`.
2. **Punch-clock busy** — optional timed block while `openShift` is live; wipe on abandon; never `postShift`.
3. **Gmail statement inbox** — read-only, on this phone, suggest a recurrence or Add draft; Confirm still posts. Mail bodies never enter the household snapshot. Bank PDF parsers still wait on Auth.
4. **Sheets import** — pick a spreadsheet, read a range, sanitize, same D-011 path as CSV. Read-only. Not the old budget workbook. No Sheets write-back.
5. **Drive close pack** — upload the generated pack as a Hearth-created file (`drive.file` only). Never crawl their Drive. Never posts.
6. **Contacts match** — suggest a member or practitioner. Not a phone backup.
7. **Hercules calendar chips** — overlay + month board, on-device. No Gmail in the model payload.

### Still not Google’s job

Google is not a bank. Tokens and mail/Drive/Contacts bodies stay off the hosted snapshot until Auth. Phrase / join / Hearth Pass still join a phone. Google never posts money.
