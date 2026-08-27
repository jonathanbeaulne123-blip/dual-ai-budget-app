# T2-S1 handoff — Migration 013 `continuity_command_events`

- **Status:** OPEN (schema + RPC + contract tests; no client wiring)
- **Branch:** `cursor/t2-s1-command-events-7270`
- **Baseline:** D-148 T1-S1/S2 (`012_publish_continuity_snapshot.sql` + client atomic push)
- **Risk:** High (protocol + schema)
- **Decision owner:** Jonathan

## Household outcome

Confirmed commands can append to a hosted **command log** instead of relying on whole-snapshot transport alone. Each append is **idempotent** on `(environment, household_id, idempotency_key)` and bumps Shared + Personal snapshots **in the same SQL transaction** via `publish_continuity_snapshot` (012).

## Dual Course

- **Budget (5):** +2 — append-only log + atomic snapshot bump; partner-personal events hidden by RLS
- **Engagement (3):** 0 — transport only; no UI change this slice

## Schema diagram

```text
continuity_command_events
├── id (uuid PK)
├── environment, household_id, member_id  → continuity_memberships FK
├── idempotency_key                       → UNIQUE per household+env
├── confirmation_id, identity_hash
├── base_revision → result_revision
├── ledger_scope shared|personal
├── command_type, payload_json (bounded ≤64KiB)
└── created_at (timestamptz)

append_continuity_command(...)
  1. membership + Development guards
  2. idempotent read OR insert event row
  3. publish_continuity_snapshot(...)  ← same TX; rolls back event on failure
  4. return { ok, duplicate, result_revision, event_id, snapshot }
```

## RLS

| Action | Rule |
|--------|------|
| SELECT shared events | active household member |
| SELECT personal events | own `member_id` only |
| INSERT/UPDATE/DELETE | denied — RPC only |

## Files

| File | Change |
|------|--------|
| `supabase/migrations/013_continuity_command_events.sql` | Table + `append_continuity_command` |
| `test/continuity-command-events.test.ts` | SQL contract tests |
| `package.json` | `books:apply:013` |
| `scripts/apply-supabase-migration.mjs` | Post-apply verification |

## Forbidden (this slice)

- Client outbox wiring (T2-S2)
- `VITE_CONTINUITY_COMMAND_LOG=1`
- Production apply without approval

## Verification

```text
pnpm exec vitest run test/continuity-command-events.test.ts test/publish-continuity-snapshot.test.ts
```

Apply (Jonathan):

```text
SUPABASE_DB_PASSWORD=… pnpm books:apply:013
```

Requires Migration **012** applied first.

## Next owner

**T2-S2:** slim outbox to command refs; flush calls `append_continuity_command` behind feature flag.
