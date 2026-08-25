# Hearth worksession — Auth/RLS 006 path B

- **Status:** OPEN — blocked on Production continuity + live preflight
- **Opened:** 2026-08-25 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/auth-rls-006-path-b-f375`
- **Baseline SHA:** `220908e` (`main`)
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** shared project `tykhocwacaxwquhynkok` (Dev + one Production household)

## Household outcome

Close the open anon household REST door with deny-by-default membership RLS, without stranding the Production household or lying about sync state.

## Budget delta (5)

`+4` target — authenticated continuity for both environments

## Engagement delta (3)

`0`

## Jonathan locks in force

- Path **B** (2026-08-25): explicit full shared-project cutover permission in principle
- Q1–Q5 Auth product locks remain (D-123)
- Independent trust audit (this session): **no-go to apply 006 as-written today**

## Verified findings (code + canon; live rows unconfirmed)

1. 006 Production-count abort will fire while the Production household exists.
2. Even if that abort is revised for path B, owner preflight fails if Production has **zero** `continuity_memberships` rows (expected: 003 + client are Development-scoped).
3. Production shared snapshots likely still contain Personal rows (client never projected them out for Production).
4. Closing anon REST before a Production client write path exists bricks Production cloud: `App.tsx` / `supabase.ts` gate transport and member projection to Development only.
5. Rollback after 006 is partial — needs a rehearsed `008_rollback_006.sql` and a captured `pg_policies` snapshot first.

## Scope this session

### In scope

- Read-only preflight SQL packet for Jonathan to run
- Honest cutover runbook update (path B + blockers)
- Do **not** apply 006

### Out of scope until Jonathan chooses next

- Applying 006
- Hand-editing Production membership/payload in SQL editor
- Enabling Google Auth provider (Jonathan / dashboard)
- Full Production continuity client implementation (recommended next engineering packet)

## Acceptance evidence

- [x] Trust audit recorded
- [x] `docs/sql/006_preflight_readonly.sql` shipped
- [ ] Jonathan runs preflight and pastes/results back
- [ ] Jonathan picks next engineering step (see Handoff)

## Plan

- [x] Independent trust read of 006 + client
- [x] Preflight packet
- [ ] Interrupt Jonathan — do not apply
- [ ] After green preflight + Production client path: revise 006 Production guard as named NOTICE, rehearse on clone, write rollback SQL, then apply

## Evidence log

- Trust auditor: no-go; Production client gap; membership/payload preflight likely fail
- Preflight file: `docs/sql/006_preflight_readonly.sql`

## Remaining uncertainty

Live Production row counts (memberships, personal payload) — need Jonathan’s SQL Editor output.

## Handoff

**STOP before apply.** Jonathan: run the preflight SQL and choose:

1. **Pause 006** — first ship Production continuity on the client (recommended), then return to 006  
2. **Proceed anyway sequence** — only after preflight is fully green AND Production client path ships AND rollback SQL exists  
3. **Revisit path A** — separate Development Supabase project for 006 rehearsal
