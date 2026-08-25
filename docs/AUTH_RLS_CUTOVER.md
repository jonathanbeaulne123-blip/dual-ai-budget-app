# Auth + membership RLS cutover (D-123)

> **Live Development status (2026-08-24):** 004 and 005 applied with Jonathan's approval; 30 disposable Development households and their cascaded membership/Personal rows deleted with Jonathan's confirmation. Verification: 0 Development households, 0 memberships, 0 Personal snapshots, and migration ids `[2,4,5]`.
> **Production:** one Production household remains untouched. **006 is not applied.** Its policies and grants are project-wide, so it cannot be called a Development-only change while Production shares this Supabase project.

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

Independent of Auth/RLS: Jonathan may still apply D-126 `007_household_timezone_iana.sql` (`pnpm books:apply:007` or SQL editor) whenever he wants hosted CHECK to accept non-Toronto IANA. That packet does not close the anon bridge.

1. Decide the project boundary: move Production to a separate Supabase project for a Development-only rehearsal, or explicitly approve a full shared-project cutover. The current 006 intentionally aborts while a Production household exists.
2. In the chosen project, enable the Google provider and add the kitchen's exact redirect URLs.
3. Deploy a Development build with `VITE_SUPABASE_AUTH_ENABLED=1`, the project URL, and the publishable key—never a secret/service-role key.
4. Have each intended member choose **Continue with Google** once so an `auth.users` identity exists.
5. Verify the 006 preflight query returns zero problems. No legacy Development membership remains after the approved cleanup, so new household creation must establish the first owner through `hearth_create_household`.
6. Apply 006 only within the project boundary approved in step 1.
7. Test two clean browser profiles: Create, email invite, QR invite, revoke, reconnect/offline outbox, own Personal visibility, other-Personal denial, anon denial, and wrong-household denial.
8. Keep the untouched Production household outside this cutover unless Jonathan explicitly approves it.

## Remaining live rehearsal requirements

- Rehearse 006 against a disposable PostgreSQL/Supabase clone; repository tests verify structure and pure behavior but are not a substitute for real RLS semantics.
- Verify provider redirect configuration and token refresh in two browsers.
- Decide whether Development and Production get separate Supabase projects. Shared project policies cannot isolate a migration by the row's `environment` value.
- Build the visible email/QR invitation screens; the RPC and URL contracts exist, but full invite chrome is not part of this repair.

## Secrets

The browser uses a publishable key plus the signed-in user's JWT. Never place database passwords, model keys, or a Supabase secret/service-role key in `VITE_*`. GIS tokens may remain for Calendar/Drive, but they are not the books credential.
