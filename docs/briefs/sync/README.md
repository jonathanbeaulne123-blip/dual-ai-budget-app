# Sync architecture slice prompts

**Master plan:** [`docs/SYNC_ARCHITECTURE.md`](../../SYNC_ARCHITECTURE.md) (D-148)

Paste-ready implementation prompts for the tiered sync reframe. Execute in order within each tier unless a worksession explicitly parallelizes with isolated contracts.

| Tier | Slices | Start when |
|:---:|---|---|
| 1 | T1-S1 … T1-S6 | Phase 0 identity/CAS/outbox gates satisfied (D-146/D-147) |
| 2 | T2-S1 … T2-S6 | Tier 1 gates G1–G6 green |
| 3 | T3-S1 … T3-S4 | Tier 1 Realtime default on Development |
| 4 | T4-S1 … T4-S4 | Tier 2 materialized snapshot proven; month-scale JSON pain observed |

Each file ends with a **Cursor prompt** block to copy verbatim.
