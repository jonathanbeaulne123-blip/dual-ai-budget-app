# T2-S1 — Command event schema (Migration 013)

**Tier:** 2 — Command-log primary  
**Depends on:** Tier 1 gates G1–G6  
**Risk:** High (protocol + schema)

## Goal

Append-only `continuity_command_events` table + `append_continuity_command` RPC with idempotency on `(household_id, environment, idempotency_key)`.

## Allowed scope

- Migration 013 SQL + RLS policies membership-bound
- Event payload: confirmation_id, identity_hash, base_revision, result_revision, bounded command result JSON
- pgTAP negative tests

## Forbidden

- Normalized journal tables (Tier 4)
- Production apply without approval

## Acceptance

- [ ] Append idempotent; duplicate returns same result_revision
- [ ] Non-member denied
- [ ] Event links to atomic snapshot bump in same TX (or documents ordering)

## Cursor prompt

```text
Implement T2-S1 from docs/briefs/sync/T2-S1-command-event-schema.md.

Author Migration 013: continuity_command_events table and append_continuity_command RPC with idempotency, membership guards, and Development-only gate. Add pgTAP/SQL tests. Do not wire client yet. Trust auditor review. Handoff with schema diagram.
```
