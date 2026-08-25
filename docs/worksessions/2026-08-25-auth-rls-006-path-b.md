# Hearth worksession — Auth/RLS 006 path B

- **Status:** OPEN — 006 still unapplied; Production continuity client ready behind flag
- **Opened:** 2026-08-25 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/auth-rls-006-path-b-f375`
- **Baseline SHA:** `220908e` (`main`)
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** shared project `tykhocwacaxwquhynkok` (Dev + one Production household); no hosted SQL applied this packet

## Household outcome

Close the open anon household REST door with deny-by-default membership RLS, without stranding the Production household or lying about sync state.

## Budget delta (5)

`+3` readiness — Production continuity client + SELECT bridge packet; door still open until 006

## Engagement delta (3)

`0`

## Jonathan locks in force

- Path **B** (2026-08-25): explicit full shared-project cutover permission in principle
- Q1–Q5 Auth product locks remain (D-123)
- Independent trust audit: **no-go to apply 006**; Conditional GO for Production continuity prerequisite with safeguards

## Verified findings

1. 006 Production-count abort will fire while the Production household exists.
2. Open INSERT on Production memberships via publishable key is unsafe — rejected.
3. Client now implements Production continuity behind `VITE_PRODUCTION_CONTINUITY=1` (off by default).
4. Production discovery is membership-scoped only; no bulk snapshot scan.
5. Shared continuity pushes publish projected payloads on RPC and legacy paths.
6. Production membership INSERT from the client is refused; privileged seed template required.
7. Revert-to-last-sync remains Development-only.

## Scope this session

### In scope

- Read-only preflight SQL
- Production continuity client (flagged)
- SELECT-only `008` migration (unapplied)
- Privileged seed/extract template
- Honest runbook updates
- Do **not** apply 006, 008, or seed SQL

### Out of scope

- Applying 006 / 008 / seed
- Enabling Google Auth provider
- Revising 006 Production abort to NOTICE (next after green preflight)
- `009_rollback_006.sql` rehearsal clone

## Acceptance evidence

- [x] Trust audit recorded
- [x] `docs/sql/006_preflight_readonly.sql` shipped
- [x] Production continuity client + tests
- [x] `008_production_continuity_select.sql` + seed template
- [ ] Jonathan runs preflight and pastes results
- [ ] Jonathan exports Production, fills seed template, approves apply 008 + seed
- [ ] Google Auth + bind + 006 NOTICE revision + rollback + apply 006

## Evidence log

- Focused vitest: continuity-policy, production-continuity, continuity, hosted-cas, supabase — 29 passed
- 006 **not** applied

## Handoff

**STOP before apply of 006.** Next owner: Jonathan.

1. Run `docs/sql/006_preflight_readonly.sql`
2. Export Production locally
3. Approve apply of `008_production_continuity_select.sql`
4. Fill `docs/sql/008_seed_production_owner_TEMPLATE.sql` and approve run
5. Configure Google Auth; then revise 006 Production guard + `009_rollback_006.sql`; rehearse; apply 006
