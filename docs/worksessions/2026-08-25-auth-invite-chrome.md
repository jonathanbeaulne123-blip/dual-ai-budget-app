# Hearth worksession — Auth kitchen smoke + invite chrome

- **Status:** OPEN
- **Opened:** 2026-08-25 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/auth-invite-chrome-f375`
- **Baseline SHA:** `5c910606ac2da723f55321dd40be2f317738df12` (`main`)
- **Head SHA:** `714d0472818d1b56e107d8d6079e25428d2e775f`
- **PR or issue:** (draft after push)
- **Risk:** High (Auth/RLS membership door + kitchen chrome)
- **Decision owner:** Jonathan
- **Environment impact:** Development (live project already has 006 applied; this packet is client chrome + smoke evidence)

## Household outcome

After 006, Jonathan can prove anon denial and the Auth Google door on the live kitchen, and owners can issue email/QR one-time invites from More → Invite while joiners redeem `/join?invite=&env=` after Continue with Google.

## Budget delta (5)

`+3` — membership door moves from phrase-as-authority toward hashed one-time Auth invites; anon REST stays denied.

## Engagement delta (3)

`+1` — Welcome/More invite chrome teaches email/QR without changing Hercules.

## Verified baseline

- `main` at `5c91060` includes 006 NOTICE + rollback packet; docs PR #104 still open for “006 applied” canon.
- Live project `tykhocwacaxwquhynkok`: anon `SELECT` households/memberships → HTTP 401 permission denied; anon `hearth_issue_invite` → 401.
- Kitchen welcome shows Continue with Google and redirects to Google → Supabase project (full Google password smoke still needs Jonathan).

## Scope

### In scope

- Auth invite URL parsers (hex-safe)
- `hearth_issue_invite` / `hearth_redeem_invite` client
- PairingCard Auth invite chrome; WelcomeJoin redeem path; App boot `/join?invite=`
- Focused tests + smoke evidence for anon denial + OAuth door

### Out of scope

- Onboarding Slice A
- Enabling `VITE_PRODUCTION_CONTINUITY`
- Applying or rolling back hosted SQL
- Full QR bitmap library
- Bianca second-browser redeem (needs real second Google)

## Acceptance evidence

- [x] Anon denial against live REST
- [x] Kitchen Auth door reaches Google OAuth
- [ ] Owner issues email/QR on signed-in kitchen (Jonathan)
- [ ] Joiner redeems invite (second Google / Jonathan assist)
- [ ] `pnpm check` / focused tests green on branch

## Plan

- [x] Sync main; open branch
- [x] Implement invite client + chrome
- [ ] Tests + check
- [ ] Draft PR + handoff

## Evidence log

- `curl` anon households → 401 `permission denied for table households`
- Computer-use: welcome Continue with Google → accounts.google.com for `tykhocwacaxwquhynkok.supabase.co`

## Remaining uncertainty

Full Create/post/sync and invite redeem require Jonathan’s Google session on the kitchen.

## Handoff

Next owner: Jonathan for signed-in smoke; Cursor continues invite PR until green checks.
