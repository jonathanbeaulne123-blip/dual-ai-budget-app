# Auth + membership RLS cutover (D-123)

> **Status:** unapplied readiness packet on `cursor/auth-rls-packet-4ffb`.  
> **Do not apply** until Jonathan reviews this packet.  
> GPT owns live migration `002` CAS apply/smoke on a separate runway.

## Goal

Before meaningful October data: a Google-authenticated person reaches only their personal ledger and intended household/environment rows. Anonymous and unaffiliated callers are denied.

## Jonathan product locks (2026-08-24)

| Q | Decision |
|---|---|
| **Q1** | **A — Supabase Auth Google provider** → `auth.uid()` |
| **Q2** | **Owner / member.** Owners alone invite and revoke. **Create** → owner. **Join** → member. |
| **Q3** | **Email invite or QR invite** (not phrase-as-Auth-door). |
| **Q4** | **No household REST for anon.** |
| **Q5** | **Apply 004 to Development once reviewed.** Production separate. |

## Artifacts

| Path | Role |
|---|---|
| `supabase/migrations/004_auth_rls_cutover.sql` | Executable cutover SQL — **DO NOT APPLY** until review |
| `src/ledger/authRlsPolicy.ts` | Pure policy + invite contract for tests |
| `src/auth/supabaseSession.ts` | Client session sketch (no service_role; not live until apply) |
| `test/auth-rls-policy.test.ts` | Matrix + invite redeem proofs |
| `docs/sql/rls_auth_ready.sql` | Legacy sketch (superseded) |

## Technical spine

1. Extend `continuity_memberships` with `auth_user_id`, `role`, `revoked_at`.
2. `household_invitations` for `email` | `qr` (token URL `/join?invite=…&env=…`).
3. Helpers `hearth_is_active_member` / `hearth_is_household_owner` / `hearth_jwt_email`.
4. Replace open policies; **REVOKE** household tables from `anon`.
5. RPCs: `hearth_establish_owner_membership`, `hearth_issue_invite`, `hearth_redeem_invite`, `hearth_revoke_member`.
6. If CAS function from 002 exists: revoke anon `EXECUTE`, grant authenticated only. Member-guard inside CAS body is a follow-up once both 002 and 004 are live.

## Client cutover (after apply)

1. Configure Google provider in Supabase Auth (redirect URLs for the kitchen).
2. Kitchen uses Supabase session JWT for PostgREST (`src/auth/supabaseSession.ts`).
3. Welcome **Create** → insert household + `hearth_establish_owner_membership`.
4. Welcome **Join** → redeem email or QR via `hearth_redeem_invite` while signed in.
5. Owners issue invites (email address or show QR of `join_path`).
6. GIS tokens may remain for Calendar/Drive; they are not the books REST credential.

## Acceptance matrix

| Actor | households / snapshots | continuity_* | invitations | DELETE |
|---|---|---|---|---|
| anon | deny | deny | deny | deny |
| authenticated, no membership | deny (except create-owner RPC path) | deny | deny | deny |
| owner, matching env | allow | allow; personal = own only | issue/revoke/select | deny |
| member, matching env | allow | allow; personal = own only | no issue/revoke | deny |
| wrong environment | deny | deny | deny | deny |
| revoked | deny | deny | deny | deny |

## Secrets and keys

- Kitchen client may use the publishable/`anon` key only as the PostgREST entry key; after cutover, household tables are revoked from `anon` and the session JWT is the door.
- Never put `service_role` or database passwords in `VITE_` or the kitchen bundle (`src/auth/supabaseSession.ts` refuses secret-shaped keys).
- Third-party model keys stay Worker secrets only.

## Non-scope

- Applying SQL before review approval  
- Production apply  
- Bank / Interac / cards  
- Hercules KV  
- Full Welcome UI wire-up of email/QR chrome (follow-up after apply)  
- Re-body of `publish_household_snapshot` with member check (follow-up after 002+004)

## Review → apply (Q5)

1. Independent trust review of `004_auth_rls_cutover.sql`.  
2. Jonathan approves.  
3. Apply **004 to Development only**.  
4. Configure Supabase Google Auth.  
5. Smoke Create / email invite / QR invite / revoke / anon denial.  
6. Production apply is a **separate** approval.
