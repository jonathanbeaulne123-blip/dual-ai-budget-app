# Realtime two-phone smoke — Development kitchen (D-149 T1 G4)

> **Purpose:** Prove Tier 1 push-native continuity: Device A confirms money, Device B sees it via Realtime within **≤500 ms p95** — faster than the 4 s poll fallback.
>
> **Not the same as** [`AUTH_INVITE_SMOKE.md`](AUTH_INVITE_SMOKE.md) (QR invite / discovery). Run this **after** both phones are in the same household.
>
> **Not Production.** Development disposable data only.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Kitchen URL | https://hearth-books.jonathan-beaulne123.workers.dev |
| Environment pill | **Development** on both devices |
| Migrations | **012** (atomic push), **014** (Realtime publication on `household_snapshots` + `continuity_personal_snapshots`) |
| Build flag | `VITE_CONTINUITY_REALTIME=1` on deployed kitchen (CI default since #175) |
| Two signed-in members | Same household, different Google accounts / phones |
| Both kitchens open | Same household loaded; B watching ledger (Audit Office or recent activity) |

Verify Migration **014**:

```sql
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('household_snapshots', 'continuity_personal_snapshots');
```

Expect **2 rows**. Apply from `supabase/migrations/014_realtime_publication.sql` if missing.

---

## Procedure (manual)

1. Hard-refresh both phones (clear stale shell).
2. Open the **same Development household** on A (owner) and B (partner).
3. On **Device A**, post a balanced Confirm (small shared expense is fine — e.g. $4 groceries).
4. On **Device B**, watch for the new row **without** waiting a full 4 s poll cycle.
5. Repeat ~10 posts; note whether B consistently sees updates in **under half a second** (Realtime ring) vs the old 4 s walk.

### Pass criteria (Tier 1 gate G4)

- [ ] B sees A’s shared post **before** 4 s poll would explain it (target **≤500 ms p95** over ~10 samples)
- [ ] Row amounts and accounts match PGlite on both devices (no silent corruption)
- [ ] Sync chrome does not claim “synced” while outbox is pending after offline (spot-check optional)

Automated harness: `test/continuityTwoClientHarness.test.ts` (merged via T1-S5 / PR #179) covers offline outbox, stale CAS, duplicate Realtime in CI.

---

## Recorded pass — Jonathan, 2026-08-27

| Step | Result |
|---|---|
| Migration **014** | Applied (Realtime publication live) |
| Kitchen build | `VITE_CONTINUITY_REALTIME=1` |
| Two-phone latency smoke | **Passed** — A posts → B visible **≤500 ms p95** |
| Related smokes | D-150 QR invite two-device smoke passed 2026-08-26 (separate front door) |

**Evidence type:** live Development kitchen, two real devices, disposable hosted rows.

**Tier 1 gates after this pass:**

| Gate | Status |
|---|---|
| G1 Atomic publish (012) | ✅ Applied Dev |
| G2 Realtime wired | ✅ |
| G3 Poll demoted | ✅ (fallback only) |
| G4 Two-browser latency | ✅ **Jonathan manual pass 2026-08-27** |
| G5 No ack lie | ✅ (D-147 + tests) |
| G6 Trust review | Open before calling Tier 1 “closed” |

**Still open before T2:** G6 auditors, T1-S6 freshness UI (optional), merge T2-S1 after rebase.

---

## Related canon

- [`SYNC_ARCHITECTURE.md`](SYNC_ARCHITECTURE.md) — D-149 tier plan
- [`briefs/sync/T1-S5-two-browser-proof.md`](briefs/sync/T1-S5-two-browser-proof.md) — slice spec
- [`AUTH_INVITE_SMOKE.md`](AUTH_INVITE_SMOKE.md) — invite/discovery smoke (run first)
