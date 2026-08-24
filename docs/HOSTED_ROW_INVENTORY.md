# Hosted row inventory (do not delete)

The household Supabase project is off-limits to AI access. This file is an inventory of *possible* leftover hosted rows from the old implicit upload path (`syncHouseholdBooks` forced `linked: true` on boot, including demo / empty / unlinked households).

## What may exist

- Demo `catalogHousehold` snapshots uploaded because boot always published.
- Empty development households uploaded on first open.
- Unlinked kitchen copies that were rewritten to `linked: true` by transport.
- Duplicate snapshots for the same invite phrase if a phone published after a silent boot upload.

## What this file does not do

- It does not read the household project.
- It does not delete rows.
- It does not apply SQL.

## Jonathan decisions required

1. Inventory live `households` / `household_snapshots` on the household project (human or approved operator, not an AI session).
2. Keep or delete leftover demo/unlinked rows **only** after a recovery record exists.
3. Apply `002_snapshot_cas.sql` only after reviewing residual last-writer race.
4. Do not apply Auth/RLS until Auth users exist (see `docs/sql/rls_auth_ready.sql`).
