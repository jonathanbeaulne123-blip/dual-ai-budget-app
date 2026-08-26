# T1-S1 handoff — Migration 012 `publish_continuity_snapshot`

- **Branch:** `cursor/sync-architecture-c04e`
- **Risk:** High (hosted money transport SQL)
- **Status:** IMPLEMENTED — migration authored + contract tests green; **hosted apply pending** (no DB password in agent env)

## Household outcome

One SQL RPC atomically CAS-advances Shared `household_snapshots` and upserts the member Personal envelope, eliminating the “Shared succeeded, Personal failed” split state (D-147 gap). Client wiring remains **T1-S2**.

## Dual Course

- **Budget (5):** +2 — atomic hosted write protects money truth at transport boundary
- **Engagement (3):** +1 — prerequisite for 100–500 ms Realtime Tier 1

## Deliverables

| File | Change |
|---|---|
| `supabase/migrations/012_publish_continuity_snapshot.sql` | New RPC + helpers |
| `test/publish-continuity-snapshot.test.ts` | 8 contract tests |
| `package.json` | `books:apply:012` |
| `scripts/apply-supabase-migration.mjs` | Post-apply verification for 012 |

## RPC signature

`publish_continuity_snapshot(p_household_id, p_expected_revision, p_name, p_timezone, p_currency, p_environment, p_invite_phrase, p_linked, p_revision, p_last_committed_at, p_payload, p_snapshot_hash, p_member_id, p_personal_payload, p_confirmation_id DEFAULT '', p_identity_hash DEFAULT '')`

## Behavior summary

- Authenticated + `is_active_member` + `own_member_id` match
- Development-only until October cutover
- Shared payload must pass `payload_is_shared`
- Personal envelope validated (transactions, shifts, goals, contributions, purchases; no commandReceipts)
- Advisory lock + `FOR UPDATE` on households/snapshots
- Stale revision → conflict, no partial write
- Duplicate (same revision + hash): ack without Personal overwrite; heal missing Personal row only; `personal-payload-mismatch` if Personal diverges
- Advance path: households + household_snapshots + continuity_personal_snapshots + membership touch in one TX

## Verification

```text
pnpm exec vitest run test/publish-continuity-snapshot.test.ts  → 8 passed
pnpm test  → 666 passed, 2 pre-existing batch-import-ui SubtleCrypto fails
pnpm books:apply:012  → blocked (no SUPABASE_DB_PASSWORD in agent env)
```

## Auditors

- **privacy-auditor:** PASS WITH NOTES (personal SQL scoping extended per books review)
- **books-auditor:** P1 fixes applied (goals scope + duplicate Personal semantics)

## Apply (Jonathan or agent with password)

```bash
SUPABASE_DB_PASSWORD=… pnpm books:apply:012
```

Or paste `supabase/migrations/012_publish_continuity_snapshot.sql` into Supabase SQL Editor (Development project).

## Next owner

**Cursor — T1-S2:** wire `src/ledger/supabase.ts` to call `publish_continuity_snapshot` instead of sequential Shared CAS + Personal POST.

## Uncertainty

- Live RPC smoke with Auth JWT not run until 012 applied hosted
- `hearth_create_household` create path still separate Personal POST until T1-S2 extends create flow
