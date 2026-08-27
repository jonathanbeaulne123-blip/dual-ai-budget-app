# Hearth worksession — T4-S1 tenant journal design

- **Status:** OPEN
- **Opened:** 2026-08-27 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/t4-s1-tenant-journal-design-403c`
- **Baseline SHA:** `4f6525b` (`main` after T3-S4 #205)
- **Head SHA:** (this branch)
- **PR or issue:** (draft PR)
- **Risk:** High (architecture — design only)
- **Decision owner:** Jonathan
- **Environment impact:** none (docs only; no hosted schema)

## Household outcome

Hosted journal facts will be keyed by `(environment, household_id, id)` so multi-tenant Postgres cannot collide bare device ids. No live transport change in this session.

## Budget delta (5)

`+2` — correct tenant identity is required before incremental hosted journal pull.

## Engagement delta (3)

`0`

## Verified baseline

- Tier 3 complete on `main` (T3-S1…S4); kitchen deploy after #205 Version `662114da-…`.
- T2-S3 client materialization on roadmap as shipped; hosted compact not proven.
- `001` bare PK refused as live transport (`ARCHITECTURE` / `SYNC_ARCHITECTURE`).
- Continuity composites proven in 003/013.

## Scope

### In scope

1. Design doc `docs/SYNC_TENANT_JOURNAL_DESIGN.md`
2. Canon pointers (roadmap, SYNC_ARCHITECTURE, handoff)
3. Independent architect + books review requests

### Out of scope

- Any `supabase/migrations` apply or new SQL packet apply
- Production / secrets / D-121 changes
- T4-S2 implementation
- Claiming year-scale Production readiness

## Acceptance evidence

- Design doc covers keys, RLS sketch, migration narrative, refusals, open questions
- No schema diff in PR
- books-auditor / ai-architect on the design

## Changed files (expected)

- `docs/SYNC_TENANT_JOURNAL_DESIGN.md`
- `docs/worksessions/2026-08-27-t4-s1-tenant-journal-design.md`
- `docs/SYNC_ARCHITECTURE.md`, `docs/HEARTH_ROADMAP.md`, `docs/AI_HANDOFF.md`, `docs/README.md` (pointers)

## Next owner

Jonathan — review; approve opening T4-S2 only when month-scale pain or explicit go-ahead.
