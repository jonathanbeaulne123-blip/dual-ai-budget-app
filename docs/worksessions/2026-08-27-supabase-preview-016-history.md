# Hearth worksession — Supabase Preview 016 history

- **Status:** OPEN
- **Opened:** 2026-08-27 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/supabase-preview-016-history-5958`
- **Baseline SHA:** `439384d69aaca63e9afab54a6adc4c669a603ed1` (`main`)
- **Head SHA:** (see latest commit)
- **PR or issue:** (draft after first commit)
- **Risk:** Low (history metadata; money meaning unchanged)
- **Decision owner:** Jonathan
- **Environment impact:** Development `supabase_migrations.schema_migrations` version string only. No household rows. No Production.

## Household outcome

GitHub Supabase Preview matches the local `016_reset_development_households.sql` file. Start from scratch behavior is unchanged.

## Budget delta (5)

`0`

## Engagement delta (3)

`0`

## Verified baseline

- Preview failed: `Remote migration versions not found in local migrations directory.`
- Hosted `supabase_migrations.schema_migrations` had `20260827072847` / `reset_development_households` from MCP `apply_migration`.
- Local file is `016_reset_development_households.sql`. Versions `001`–`008` and `010`–`015` already matched.
- `009` is rollback in `docs/sql/`, not a hosted history row.
- `public.schema_migrations` id 16 and `hearth_reset_development_households` were already live.

## Scope

### In scope

- Retag history `20260827072847` → `016`
- Filename contract test
- D-151 why-note

### Out of scope

- Re-applying 016 SQL
- Adding a `009` migration
- Calling Start from scratch
- Production

## Acceptance evidence

- [x] Hosted list_migrations includes `016` / `reset_development_households` and not `20260827072847`
- [ ] Focused tests
- [ ] GitHub Supabase Preview green after push

## Remaining uncertainty

Preview only re-runs on a GitHub push. Merge is required to clear `main`.
