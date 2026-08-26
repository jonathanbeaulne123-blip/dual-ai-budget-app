# Hearth worksession — Auth membership as continuity authority

- **Status:** OPEN — S0 complete; S3 in progress
- **Opened:** 2026-08-26 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/auth-membership-authority-e279`
- **Baseline SHA:** `4082486e8aa094f368b15095f4367d116bf962c0` (`main`)
- **Head SHA:** (evolving)
- **PR or issue:** (draft after first push)
- **Risk:** High (Auth/RLS membership door; transport authority)
- **Decision owner:** Jonathan
- **Environment impact:** Development client + live anon probes (no schema paste; no Production)

## Household outcome

Google membership (Auth JWT + `continuity_memberships`) is the only automatic way household books reach the cloud. Phrase and `linked` remain recovery/routing aids, not publish authority. Live Create/invite smoke stays Jonathan-gated; revoke UI deferred (S4).

## Budget delta (5)

`+3` — fail-closed continuity authority; anon/phrase cannot read or publish household rows.

## Engagement delta (3)

`+1` — Continue with Google / invite chrome remain the normal door; fewer “Publish to the cloud” false paths.

## Verified baseline (S0)

### Facts

- Invite chrome (#105) and bind+QR (#106) are on `main`.
- Live anon probes (publishable key only) 2026-08-26:
  - `households` / `continuity_memberships` / `household_snapshots` SELECT → HTTP 401 permission denied
  - `hearth_bind_google_memberships` → HTTP 401 **permission denied for function** (function **exists**; anon EXECUTE revoked) → **010 is live**
  - `hearth_create_household` / `hearth_issue_invite` / `hearth_redeem_invite` / `hearth_revoke_member` → HTTP 401 permission denied for function (RPCs exist)
- Client still auto-transports Development snapshots when `linked===true` without membership JWT (`App.commitHousehold` unprojected branch + `pushSupabaseHousehold`).
- No revoke UI; `revokeHouseholdMember` client exists unused.

### Inferences

- `schema_migrations` id 10 not readable as anon; 010 liveness inferred from PostgREST function ACL, not the migrations table row.

## Scope

### In scope

- S0 inventory + live anon matrix evidence
- S3: membership-only automatic transport (D-143); legacy linked publish only via explicit recovery option
- Automated live anon denial smoke behind `VITE_SUPABASE_LIVE=1`
- Canon/worksession updates for 010 live + open smoke checklist

### Out of scope

- S4 leave/revoke chrome (follow-up)
- Jonathan-signed Create/invite/redeem kitchen smoke (S2 — needs your Google)
- Production continuity flag, schema apply, deploy, row deletes
- Onboarding / Hercules / batch import

## Acceptance evidence

- [x] S0 call graph + live anon matrix recorded
- [x] D-143: linked-only automatic commit transport removed; continuity identity required for push
- [x] Focused vitest green; full suite 636 pass / 2 pre-existing batch-import-ui SubtleCrypto fails (same as main)
- [x] Live anon smoke green with `VITE_SUPABASE_LIVE=1` (2/2)
- [ ] Jonathan Create/invite/redeem smoke (manual)

## Plan

- [x] Branch from current `main`
- [x] S0 inventory + anon probes
- [x] S3 code + tests + D-143
- [ ] Draft PR
- [ ] Pause for Jonathan S2 smoke / any product lock on legacy phrase share copy

## Evidence log

```text
curl anon households → 401 permission denied for table households
curl anon bind RPC → 401 permission denied for function hearth_bind_google_memberships
curl anon phrase snapshots → 401 permission denied for table household_snapshots
```

## Remaining uncertainty

Signed-in Create / invite redeem / Bianca second Google not run in this VM. Bulk-scan discovery fallback when membership tables missing remains in client for missing-table resilience.

## Handoff

Next owner after S3 push: Jonathan for signed-in kitchen smoke; Cursor continues S5 canon once smoke evidence exists.
