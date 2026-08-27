# T4-S1 — Tenant-scoped hosted journal identity (design)

**Status:** Design only — **no schema apply**, no Production, no live transport change.  
**Branch:** `cursor/t4-s1-tenant-journal-design-403c`  
**Base:** `main` @ `4f6525b` (after T3-S4 #205)  
**Risk:** High (architecture)  
**Depends on:** T2-S3 client materialization proven (roadmap `[x]`); hosted compact and month-scale pain remain open.

## Household outcome

When Hearth eventually stores journal facts in hosted Postgres for year-scale kitchens, every money and catalog row is unique **inside** `(environment, household_id)`, never via a bare global `id` primary key. Jonathan and Bianca’s Development and Production books cannot collide with another household’s `TXN-…` / `JE-…` strings.

## Dual Course

- **Budget delta (5):** `+2` — correct tenant keys are a prerequisite for incremental journal pull without false merge or cross-household collision.
- **Engagement delta (3):** `0` — research only; no interactable.

## Refusals (non-negotiable)

1. Do **not** populate `001_hearth_books.sql` normalized tables as live transport under today’s bare `id TEXT PRIMARY KEY` contract.
2. Do **not** treat hosted journal as a second books authority that bypasses PGlite `acceptHouseholdWrite`.
3. Do **not** silent-LWW on same transaction / journal entry id.
4. Do **not** apply migrations, touch Production, or change secrets in this slice.
5. Do **not** claim 100-person or year-scale Production readiness from this design.

---

## 1. Why 001’s global PK fails as multi-tenant transport

| Layer today | Identity | Why it works / fails |
|---|---|---|
| PGlite (`src/ledger/schema.ts`) | Bare `id` PK per table | One active household per device DB; truncate on switch (`engine.ts`) |
| Device command ids | `TXN-…`, `JE-…`, `MEM-…` via `nextId()` | Entropy is local; collision across households is possible in a shared DB |
| Hosted `001` tables | Same bare `id` PK | **Unsafe** if many households share one Postgres — two kitchens can emit the same `TXN-…` |
| Continuity membership / personal / command-log | `(environment, household_id, …)` composites | **Proven** grammar (003, 013) |

**Canon:** `docs/ARCHITECTURE.md` Scale note and `docs/SYNC_ARCHITECTURE.md` §7 refuse promoting 001 as transport until this design passes review.

---

## 2. Proven composite grammar to copy

Already live on Development:

```text
(environment, household_id)                              -- tenant root; 012 CAS; advisory locks
(environment, household_id, member_id)                    -- membership; personal snapshots
(environment, household_id, idempotency_key)              -- command events (013)
(environment, household_id, result_revision, created_at)  -- event order
```

**Asymmetry to fix later (not blocking this design):** Shared `household_snapshots` still uses physical PK `household_id` only (001/002), while queries and RPCs filter `(household_id, environment)`. Personal and command-log are already composite. T4 migration should either rekey Shared snapshots to `PRIMARY KEY (environment, household_id)` or document an invariant that household ids never collide across environments.

---

## 3. Proposed hosted journal keys

Natural device string ids stay (`TXN-…`, `JE-${tx.id}`, `${entry.id}-L01`, `PL-…`, `MEM-…`). Uniqueness becomes **tenant-scoped**.

### 3.1 Fact tables (money path)

```text
journal_entries
  PRIMARY KEY (environment, household_id, id)
  -- id remains JE-…

journal_lines
  PRIMARY KEY (environment, household_id, id)
  UNIQUE (environment, household_id, entry_id, line_no)
  FOREIGN KEY (environment, household_id, entry_id)
    REFERENCES journal_entries (environment, household_id, id)
  FOREIGN KEY (environment, household_id, account_id)
    REFERENCES chart_accounts (environment, household_id, id)
  -- every money-graph FK carries the tenant prefix (never bare REFERENCES chart_accounts(id))

source_transactions
  PRIMARY KEY (environment, household_id, id)
  -- id remains TXN-… / SHF-… as today
  -- inbound FKs from lines/shifts similarly tenant-scoped
```

Carry forward 001 money CHECKs (Toronto `date_key`, non-negative exclusive debit/credit, CAD cents) under the new composite keys.
### 3.2 Catalog (minimum for rebuild)

```text
members, categories, chart_accounts, shifts, goals, …
  PRIMARY KEY (environment, household_id, id)
  -- chart_accounts also UNIQUE (environment, household_id, code)
```

### 3.3 Optional surrogate

A `row_uuid UUID DEFAULT gen_random_uuid()` column is allowed for Realtime/row replica identity (013 style). It is **never** the money identity. Money identity remains command/journal ids + `financialAuditHash`.

### 3.4 Households root

**Preferred (explicit choice):** keep `households.id` globally unique in practice (`HH-…` random) **and** add `UNIQUE (environment, id)` or migrate to `PRIMARY KEY (environment, id)` when Shared snapshot is rekeyed. Do not leave “env is only a column” undocumented.

---

## 4. Side-by-side key comparison

| Object | 001 / PGlite today | Continuity 013 | T4 hosted journal target |
|---|---|---|---|
| Journal entry | `id` PK | n/a (in payload / materialize) | `(environment, household_id, id)` |
| Journal line | `id` PK | n/a | `(environment, household_id, id)` + unique `(…, entry_id, line_no)` |
| Command event | n/a | UUID PK + unique `(env, hh, idempotency_key)` | unchanged transport |
| Personal snapshot | n/a | PK `(env, hh, member_id)` | unchanged envelope |
| Shared snapshot | PK `household_id` | CAS by `(hh, env)` | rekey debt → `(env, hh)` |

---

## 5. RLS sketch (design only — mirror 006 / 013)

- **REVOKE** direct INSERT/UPDATE/DELETE on journal tables from `anon` and `authenticated`.
- **GRANT SELECT** to `authenticated` only.
- **Shared facts:** `is_active_member(household_id, environment)` and visibility ≠ partner-personal.
- **Personal facts:** `member_id = own_member_id(household_id, environment)` (same spirit as `continuity_command_events` personal SELECT and personal snapshots).
- **Writes:** SECURITY DEFINER RPCs only (append / compact / rebuild projection) — never PostgREST table writes from the kitchen SPA.
- **Production:** fail-closed until T4-S4 + Jonathan approval (same posture as 012/013 Development gates).
- **Do not** weaken Auth below deny-by-default 006.

---

## 6. Migration path (narrative — not this PR’s SQL)

```text
Today (proven sync path)
  continuity_command_events (013)
  + Shared/Personal snapshots (012/003)
  → client materializeSnapshotFromEvents
  → PGlite acceptHouseholdWrite

T4 projection (research)
  Replay events in (result_revision, created_at) order
  → INSERT into composite-keyed journal_* tables
  → Verify financialAuditHash (or debit/credit + counts) vs snapshot tip

T4-S2
  Incremental pull cursor (environment, household_id, seq|revision|id)
  → merge into PGlite through the same accept gate

T4-S3
  Compaction, tombstones, snapshots as checkpoints not sole history

T4-S4
  Production cutover + rollback rehearsal (Jonathan-approved)
```

**Never:** dual-write 001 bare-PK tables from the browser as a second ledger.

---

## 7. Dependency honesty

| Gate | Status |
|---|---|
| T2-S3 client rebuild + hash match | Roadmap `[x]`; golden tests in tree |
| Hosted server-side compact | Documented only — **not** proven |
| Month-scale JSON pain | Observational trigger — not required to finish this design |
| Tier 3 UX/scale | Complete (T3-S1…S4 on `main`) |

---

## 8. Open questions (for ai-architect + books-auditor)

1. Rekey Shared `household_snapshots` to `(environment, household_id)` in the same era as journal tables, or keep as envelope-only with a uniqueness invariant?
2. Should `households` PK become `(environment, id)` or stay global `id` + env column?
3. Personal journal rows: separate tables vs `ledger_scope` / visibility column with RLS — prefer separate for blast-radius?
4. Surrogate UUID on every journal line: required for Realtime, or revision-cursor pull enough for T4-S2?
5. When does month-scale JSON pain justify starting T4-S2 implementation?

---

## 9. Acceptance (this slice)

- [x] Composite key diagrams for entries, lines, source_transactions, catalog
- [x] Side-by-side 001 vs 013 vs T4 keys
- [x] RLS sketch (shared vs personal; write-via-RPC)
- [x] Migration narrative snapshot → command-log → projection → incremental pull
- [x] Named refusals (001 transport, global PK, second ledger, no apply)
- [x] Dependency statement (T2-S3 client proven; hosted compact open)
- [x] Open questions listed
- [x] No migration SQL applied

## Next owner

Jonathan — review design; independent books + architect pass; then decide whether to open T4-S2 or wait for month-scale pain.
