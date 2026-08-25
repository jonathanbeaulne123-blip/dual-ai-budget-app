# Auth + membership RLS cutover (D-123)

> **Live Development status (2026-08-25):** 004, 005, D-126 `007`, and SELECT bridge `008` applied. Empty Production household deleted. Google Auth provider live; at least one Google `auth.users` identity exists. **006 is not applied.** Path B NOTICE revision (Production ceiling 1) is in the migration file awaiting Jonathan’s paste approval after a green preflight re-run.

## Goal

Before meaningful October data, a Google-authenticated person can reach their own Personal replica and the households they belong to from any device. Anonymous, revoked, unaffiliated, and cross-environment callers are denied. No phone has to remain online.

## Jonathan product locks (2026-08-24)

| Q | Decision |
|---|---|
| **Q1** | **A — Supabase Auth Google provider** supplies `auth.uid()` |
| **Q2** | Owner/member. Create makes the creator owner; Join makes the invited person a member; only owners invite/revoke |
| **Q3** | Email invite or QR invite; a three-word phrase is not authentication |
| **Q4** | No household REST for anon |
| **Q5** | Development only after review and explicit approval; Production separately |

## Why this is three migrations

| Order | File | Purpose | Locks users out? |
|---|---|---|---|
| 004 | `supabase/migrations/004_auth_rls_prepare.sql` | Adds Auth bindings, roles, hashed one-time invitations, and a safe legacy-owner claim | **Applied**; it deliberately leaves the temporary Development bridge open |
| 005 | `supabase/migrations/005_snapshot_cas_hardening.sql` | Repairs live 002 with an advisory transaction lock and rejects non-advancing writes; compacted offline revision jumps remain valid | **Applied** |
| 006 | `supabase/migrations/006_auth_rls_cutover.sql` | Preflights every binding/owner/shared payload, then closes anon access and exposes bounded authenticated RPCs | **Not applied**; this is a project-wide cutover |

The already-applied 002 file is history. Its repair is forward migration 005; do not edit/reapply 002 and pretend the live database changed.

## What the client now supports

- `src/auth/supabaseSession.ts` implements feature-flagged Google OAuth session storage, refresh, and bearer-token REST headers. Secret/service-role keys are refused.
- `src/App.tsx` uses the authenticated token for discovery, background replay, and commits when `VITE_SUPABASE_AUTH_ENABLED=1`.
- Shared snapshot publishing removes Personal transactions, shifts, and private goals. The signed-in member's Personal envelope stores those rows separately.
- New households use `hearth_create_household`; shared updates use authenticated `publish_household_snapshot`.
- Direct client writes to households, shared snapshots, memberships, invitations, and normalized journals are denied after cutover. Only the member's own Personal snapshot permits direct insert/update.

## Ownership and invitation safety

- Existing owners are not guessed. After 004 binds exact Google provider subjects, one already-bound member explicitly claims a legacy household that has no owner. The function cannot promote an arbitrary user/member pair.
- New household creation and first-owner assignment occur in one locked transaction and fail if the household already exists.
- An owner invites a specific existing household member slot. Tokens are stored only as SHA-256 hashes, expire, and can be redeemed once.
- Email redemption must match the Google identity email; QR redemption still requires Google sign-in.
- A member cannot promote, revoke, or rewrite membership rows directly.

## Cutover preflight

006 aborts before changing policies unless:

1. 004 and 005 are recorded as applied.
2. No Production household remains in the shared project. This guard makes accidental Development-only application impossible because policies and grants are global.
3. Every active membership is bound to `auth.users`.
4. Every represented household has exactly one active owner.
5. Shared snapshots contain no Personal transactions, Personal shifts, or private goals.

Because the checks occur before policy replacement inside one transaction, a failed preflight leaves the temporary Development bridge in place.

## Acceptance matrix after 006

| Actor | Shared household | Own Personal | Other Personal | membership/invite writes | DELETE |
|---|---|---|---|---|---|
| anon | deny | deny | deny | deny | deny |
| authenticated, no membership | deny | deny | deny | bounded Create/Redeem RPC only | deny |
| owner, matching environment | read + CAS RPC | read/write | deny | bounded Invite/Revoke RPC | deny |
| member, matching environment | read + CAS RPC | read/write | deny | redeem only | deny |
| wrong environment or revoked | deny | deny | deny | deny | deny |

## Next cutover runbook (006 not performed)

Independent of Auth/RLS: D-126 `007_household_timezone_iana.sql` is **applied** (2026-08-25). Hosted CHECK allows nonempty IANA; the app kernel still requires Toronto for books civil (Q2 C). That packet does not close the anon bridge.

**Path B lock (Jonathan 2026-08-25):** full shared-project cutover is approved *in principle*. Live preflight the same day: migrations `2,4,5,7`; empty Production household with Personal 0/0/0; zero memberships; zero `auth.users`. Jonathan then ordered delete of that empty Production household, Google Auth setup, apply of SELECT bridge `008`, and **postpone** of the 006 Production-abort NOTICE/apply until those three finish.

**Client readiness (branch packet):** Production discovery/transport is implemented behind `VITE_PRODUCTION_CONTINUITY=1` (off by default). Named policy `hostedContinuityAllowed` gates App + transport. Production never bulk-scans snapshots and never mints membership rows from the publishable key. Shared pushes with a continuity identity always publish the Personal-stripped projection (RPC and legacy). Unprojected phrase/`linked` transport stays Development-only. Revert-to-last-sync stays Development-only.

**Mandatory sequence now (Jonathan)**

1. ~~Delete empty Production household~~ — done (already absent)
2. ~~Configure Google Auth~~ — done (`auth.users` has Google identity)
3. ~~Apply 008~~ — done (`schema_migrations` id 8)
4. Re-run [`sql/006_preflight_readonly.sql`](sql/006_preflight_readonly.sql) (expect green with 0 households)
5. Review path B NOTICE revision in `006_auth_rls_cutover.sql` (ceiling 1) and [`sql/009_rollback_006.sql`](sql/009_rollback_006.sql)
6. **Only after explicit Jonathan approve:** paste `supabase/migrations/006_auth_rls_cutover.sql` in the SQL Editor
7. Smoke Create / email / QR / revoke / anon denial / wrong-household denial on Auth-enabled kitchen

**Client readiness:** Production discovery/transport remains behind `VITE_PRODUCTION_CONTINUITY=1` (off by default). Kitchen Auth door is live via `VITE_SUPABASE_AUTH_ENABLED=1`.

## Remaining live rehearsal requirements

- Rehearse 006 against a disposable PostgreSQL/Supabase clone; repository tests verify structure and pure behavior but are not a substitute for real RLS semantics.
- Verify provider redirect configuration and token refresh in two browsers.
- Visible email/QR invitation chrome is in flight on `cursor/auth-invite-chrome-f375` (RPC client + More/Welcome wiring). Signed-in issue/redeem smoke still needs Jonathan’s Google session.
- Confirm PITR / backups on the shared project before apply.
## Secrets

The browser uses a publishable key plus the signed-in user's JWT. Never place database passwords, model keys, or a Supabase secret/service-role key in `VITE_*`. GIS tokens may remain for Calendar/Drive, but they are not the books credential.
