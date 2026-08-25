# Hearth worksession — Auth/RLS 006 path B

- **Status:** OPEN — 006 NOTICE revision ready; awaiting green preflight + Jonathan paste approve
- **Opened:** 2026-08-25 (`America/Toronto`)
- **Branch:** `cursor/auth-rls-006-notice-f375`
- **Baseline SHA:** `9f50aae` (`main`)
- **Risk:** Release
- **Decision owner:** Jonathan

## Completed (Jonathan)

1. Empty Production household gone
2. Google Auth → `auth.users` (Jonathan Google identity)
3. `008` applied (`schema_migrations` id 8 at 2026-08-25 08:17 UTC)

## This packet

- 006 Production abort → NOTICE + ceiling 1
- `docs/sql/009_rollback_006.sql`
- Preflight/go-no-go text updated for ids `2,4,5,7,8`

## Still blocked until Jonathan

- Re-run preflight green
- Explicit “paste 006” approval
- Smoke after apply

## Handoff

Do **not** apply 006 until Jonathan says so after preflight.
