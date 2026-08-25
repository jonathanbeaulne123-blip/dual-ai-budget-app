# Hearth worksession — Auth/RLS 006 path B

- **Status:** CLOSED — 006 applied live; smoke remaining
- **Opened:** 2026-08-25 (`America/Toronto`)
- **Closed:** 2026-08-25
- **Branch (docs):** `cursor/d123-006-applied-f375`
- **Risk:** Release residual until smoke
- **Decision owner:** Jonathan

## Completed

1. Empty Production household removed
2. Google Auth → `auth.users`
3. `008` applied
4. Bind + owner cleanup; empty Dev shells deleted
5. **`006` applied** — live proof `hearth_households_select`

## Remaining

- Kitchen smoke: Continue with Google, create/open, anon denial
- Invite email/QR chrome
- Bianca Google sign-in optional

## Handoff

Docs record applied. Do not call fully shipped until smoke verified. Rollback only on Jonathan’s explicit order via `docs/sql/009_rollback_006.sql`.
