# Hearth worksession — Auth discover bind + scannable QR

- **Status:** OPEN
- **Opened:** 2026-08-25 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/auth-discover-qr-f375`
- **Baseline SHA:** `913364c` (`main`)
- **Head SHA:** (update on commit)
- **Risk:** High (Auth membership door + invite UX)
- **Decision owner:** Jonathan
- **Environment impact:** Development (paste migration 010)

## Household outcome

Continue with Google rediscovers Jonathan’s Development household after 006 by binding `auth_user_id`. Partners scan a visible QR, land on `/join?invite=`, Continue with Google, and join without already owning a household.

## Budget delta (5)

`+3` — membership rediscovery and invite accept path after deny-by-default RLS.

## Engagement delta (3)

`+2` — scannable QR invite chrome; honest join copy.

## Verified baseline

- Post-006 discovery is `auth_user_id` only; “link Google once” cannot mint memberships.
- Invite deep link was stripped before OAuth and not persisted.
- Invite chrome shipped URL/copy only — no QR bitmap.

## Scope

### In scope

- Migration 010 `hearth_bind_google_memberships` + client call on empty discovery
- Pending invite sessionStorage across OAuth
- Scannable QR (`uqr`) on issued Auth invites
- Error copy fix; ops rebind SQL

### Out of scope

- Production continuity flag
- Onboarding Slice A
- Email delivery of invites

## Acceptance evidence

- [ ] Jonathan pastes 010 (or rebind SQL) and Continue with Google opens `HH-591c6905afd19707`
- [ ] Issued QR invite shows scannable code; join without prior household
- [ ] `pnpm check` green

## Handoff

Jonathan: paste `docs/sql/010_bind_google_memberships.sql` (or rebind packet), then hard-refresh kitchen after this PR deploys.
