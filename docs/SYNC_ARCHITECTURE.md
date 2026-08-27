# Hearth sync architecture — tiered plan

> **Accepted direction — D-149 (2026-08-26).** This file is the canonical sync plan. It supersedes snapshot-only Phase 2 wording, the 4-second live-pull target, and Packet 7’s “atomic CAS + outbox” framing as the *end state*. Those pieces remain **Tier 1 foundations**, not the finish line.
>
> **Household outcome:** when Bianca confirms a grocery on her phone, Jonathan’s open kitchen shows it in **100–500 ms** — as naturally as a text message — without either phone being the host, without silent loss, and without the model or widgets posting money.
>
> **Canon order:** Jonathan’s latest instruction → this file → [`CLOUD_CONTINUITY.md`](CLOUD_CONTINUITY.md) → [`DECISIONS.md`](DECISIONS.md) → [`ARCHITECTURE.md`](ARCHITECTURE.md) → [`HEARTH_ROADMAP.md`](HEARTH_ROADMAP.md).

---

## Explain like I'm 5 (ELI5)

Imagine the household budget is **two shared notebooks** on a **cloud fridge**:

1. **Shared notebook** — groceries, rent, bills everyone sees.
2. **Personal notebook** — your private shifts and goals; only you see yours on the fridge, but the cloud still keeps it safe for your other devices.

**Today:** Jonathan’s phone walks to the fridge every **4 seconds** and asks, “Did anything change?” If Bianca wrote “milk $6” three seconds ago, Jonathan might not see it until the next walk. Each update also mails **the whole notebook** — heavy and slow when the household has months of history.

**Target (Tier 1):** When Bianca writes “milk $6”, the fridge **rings Jonathan’s phone** within a blink (**100–500 ms**). Jonathan’s phone still checks the math locally (PGlite) before showing it — the fridge cannot trick him. When Jonathan writes back, one **librarian visit** updates **both notebooks at once** so they never disagree halfway.

**Later (Tier 2):** Instead of mailing whole notebooks, we mail **single confirmed lines** (“Bianca posted milk $6 at revision 42”). Phones rebuild the notebook from those lines. Two people can write different lines at the same time; the rules say how to combine them without erasing each other.

**Rules that never change:**

- Only a person tapping **Confirm** posts money. Hercules, weather, and widgets never write in the notebooks.
- If two people edit the **same line** differently, Hearth shows a **conflict sheet** — no silent “last phone wins.”
- If the cloud is unreachable, your phone keeps a **to-send pile** (outbox) and shares when it can.
- No phone is the “host.” Turning Jonathan’s phone off does not lock Bianca out.

---

## 1. Why we are reframing

| Problem today | Evidence | Tier that fixes it |
|---|---|---|
| Partner visibility lag up to **4 s** (8 s at scale) | `LIVE_PULL_INTERVAL_MS = 4_000` in `src/continuityLivePull.ts`; visibility-aware REST poll | **Tier 1** — Supabase Realtime push |
| Personal + Shared often **two network trips**; partial failure can leave scopes inconsistent | `pushSupabaseHousehold` sequential Shared then Personal; D-147 treats Personal fail after Shared CAS as pending | **Tier 1** — Migration **012** atomic SQL |
| Whole JSON snapshot transport on every confirm | D-145 slim outbox reduced local quota pain; hosted payload still full snapshot | **Tier 2** — command-log primary |
| Concurrent edits to the **same** money row still need explicit conflict | Disjoint shared rows auto-absorb (live-pull PR); same-base divergence → conflict sheet | **Tier 2** — append-only command convergence |
| Undo that restores whole snapshot can clobber partner work | `docs/worksessions/2026-08-25-live-pull-dual-use.md` item 5 | **Tier 2** — confirmation-scoped undo |
| 100 open kitchens on poll alone is chatty | Live-pull worksession scale table | **Tier 1** Realtime + **Tier 3** channel hygiene |

**Non-goals (explicit):** bank feeds, Interac, issued cards, Sheets/clasp revival, service-role keys in the browser, silent last-writer-wins, or calling sync “shipped” before two-browser proof on disposable Development.

---

## 2. Design principles (law)

These survive every tier. A slice that violates one is **stop-ship**.

1. **PGlite is the accounting gate.** Every inbound bytes — poll, Realtime, or command — passes the same `acceptHouseholdWrite` / hash / environment / membership checks before display or persistence.
2. **Cloud is durable continuity; no device is host.** Offline outbox + push/pull are transport; neither replaces the other.
3. **Confirm is the money boundary.** Transport never invents journal rows.
4. **Fail closed on scope.** Environment, Google subject, member, household, and ledger scope must match at discovery, pull, push, and Realtime subscription boundaries (D-146).
5. **Atomic hosted writes.** Shared CAS + Personal envelope + membership touchpoints commit in **one SQL transaction** (Migration 012 pattern from 011).
6. **Honest sync UI.** Never “Saved to cloud” when outbox pending, Personal failed after Shared, or conflict blocked.
7. **Development first; Production gated.** Disposable Development through 2026-09-30; Production cutover requires Jonathan approval and October-grade Auth/RLS proof.
8. **Idempotent delivery.** Duplicate Realtime events, duplicate POSTs, and offline replay must not double-post money.
9. **Conflict is visible.** Same-row money divergence opens the conflict sheet; disjoint shared money may absorb quietly (current behavior retained until Tier 2 proves command-level interleaving).
10. **Books win (Dual Course 5:3).** Faster sync serves trustworthy books; it never trades audit trail for speed.

---

## 3. Tier overview

| Tier | Name | Target feel | Transport shape | Exit proof |
|:---:|---|---|---|---|
| **1** | Push-native continuity | **100–500 ms** partner visibility | Atomic SQL snapshot CAS + Realtime `postgres_changes` | Two-browser E2E; T1 fault harness green |
| **2** | Command-log primary | Same latency; **true interleaving** | Append confirmed commands; snapshot = materialized view | Deterministic interleaving suite; confirmation-scoped undo |
| **3** | Optimistic UX + presence | Feels instant; calm chrome | Optimistic pending states; soft presence; Realtime fallback poll | UX audit 320/390/720/1100; a11y + reduced motion |
| **4** | Normalized hosted journal | Efficient at year scale | Tenant-scoped journal rows; incremental pull | Accountant rebuild scenario; migration rehearsal |

**Dependency graph:**

```text
Phase 0 (identity, CAS client, outbox, RLS 006) ──► Tier 1 ──► Tier 2 ──► Tier 3
                                                      │                    │
                                                      └──────► Tier 4 (parallel research after T2-S3)
```

**Latency budget (Tier 1 target):**

| Segment | Budget | Notes |
|---|---:|---|
| Confirm → local PGlite accept | 20–80 ms | unchanged |
| Outbox enqueue | < 10 ms | D-145 slim |
| Shared+Personal atomic RPC | 50–150 ms | one round trip |
| Realtime propagation | 50–200 ms | Supabase region + websocket |
| Pull merge + PGlite validate | 20–80 ms | same reconcile path as today |
| **End-to-end partner visible** | **100–500 ms** | p95 on Development, two Toronto phones |

Poll at 4 s remains **fallback only** when Realtime disconnects (Tier 1-S3).

---

## 4. Tier 1 — Push-native continuity (100–500 ms)

**Goal:** Jonathan and Bianca see each other’s confirmed shared money within **100–500 ms** while both kitchens stay open, on disposable Development, with no new money semantics.

**Shipped foundations (do not re-litigate):** D-114 discovery/outbox, D-122 Shared CAS RPC, D-145 slim outbox, D-146 identity tuple, D-147 refuse-legacy + honesty, live-pull disjoint absorb, 006 membership-bound REST.

### Tier 1 gates (must pass before Tier 2 starts)

| Gate | Proof |
|---|---|
| G1 Atomic publish | Migration **012** applied Development; single RPC advances Shared revision **and** Personal envelope atomically |
| G2 Realtime wired | `@supabase/supabase-js` Realtime channel subscribed per active household; anon denied under 006 |
| G3 Poll demoted | 4 s interval runs only as reconnect/backoff fallback |
| G4 Two-browser | Playwright or manual: A posts → B visible ≤ 500 ms p95 (10 samples) |
| G5 No ack lie | Personal fail, conflict block, stale CAS never ack outbox |
| G6 Trust review | `hearth-trust-auditor` + `books-auditor` PASS on Tier 1 slices |

### Tier 1 slices

| Slice | Outcome | Prompt file |
|---|---|---|
| **T1-S1** | Migration **012** `publish_continuity_snapshot` — atomic Shared CAS + Personal + receipt metadata | [`briefs/sync/T1-S1-atomic-continuity-rpc.md`](briefs/sync/T1-S1-atomic-continuity-rpc.md) |
| **T1-S2** | Client uses single RPC; remove sequential two-trip push for Auth continuity | [`briefs/sync/T1-S2-client-atomic-push.md`](briefs/sync/T1-S2-client-atomic-push.md) |
| **T1-S3** | Realtime subscribe + event → reconcile; poll fallback + backoff | [`briefs/sync/T1-S3-realtime-subscribe.md`](briefs/sync/T1-S3-realtime-subscribe.md) |
| **T1-S4** | Push/pull race coordinator — dedupe, revision monotonicity, no double-merge | [`briefs/sync/T1-S4-push-pull-coordinator.md`](briefs/sync/T1-S4-push-pull-coordinator.md) |
| **T1-S5** | Two-browser E2E + fault harness (offline, stale, duplicate Realtime) | [`briefs/sync/T1-S5-two-browser-proof.md`](briefs/sync/T1-S5-two-browser-proof.md) |
| **T1-S6** | Sync freshness UI — actor, revision, quiet pending, Realtime disconnected honest | [`briefs/sync/T1-S6-sync-freshness-ui.md`](briefs/sync/T1-S6-sync-freshness-ui.md) |

### Tier 1 risks and mitigations

| Risk | Mitigation |
|---|---|
| Realtime delivers stale event before local outbox flush completes | T1-S4 coordinator: ignore `revision <= localTipRevision`; flush ack clears |
| RLS blocks Realtime for wrong member | Subscribe only after membership resolve; channel filter `household_id=eq.<id>`; pgTAP negative |
| Large snapshot over Realtime still heavy | Tier 1 still snapshot-based; Tier 2 reduces payload; T1-S3 triggers **pull one row** not full payload in event handler if payload omitted |
| Migration 012 diverges from 011 Hercules Pro | Reuse 011 transaction skeleton; separate RPC names; shared `hearth_private` helpers |
| Production premature enable | RPC returns `production-disabled` until October cutover packet |

---

## 5. Tier 2 — Command-log primary

**Goal:** Transport **confirmed command receipts** (small, ordered, idempotent) instead of whole snapshots. Snapshots become a **materialized view** rebuilt locally and periodically compacted hosted. True concurrent edits interleave without whole-notebook overwrite.

**Why Tier 2 follows Tier 1:** Realtime on snapshot rows proves push path and membership gates before we change the persistence contract. Atomic SQL (012) is reused inside command-append RPC.

### Tier 2 gates

| Gate | Proof |
|---|---|
| G1 Append-only hosted log | Migration **013** `continuity_command_events` with `(household_id, environment, idempotency_key)` uniqueness |
| G2 Materialized snapshot | Server or client can rebuild snapshot from log; hash matches PGlite acceptance |
| G3 Interleaving | Harness: A and B post disjoint + conflicting commands; convergence matches spec |
| G4 Undo safety | Confirmation-scoped undo never tombstones partner rows (supersedes whole-snapshot D-119 path) |
| G5 Compact bounded | Tombstones retained; compaction policy documented; audit export still possible |

### Tier 2 slices

| Slice | Outcome | Prompt file |
|---|---|---|
| **T2-S1** | Hosted command event schema + append RPC (no journal normalization yet) | [`briefs/sync/T2-S1-command-event-schema.md`](briefs/sync/T2-S1-command-event-schema.md) |
| **T2-S2** | Outbox stores command receipt refs + base revision (not full journal) | [`briefs/sync/T2-S2-slim-command-outbox.md`](briefs/sync/T2-S2-slim-command-outbox.md) |
| **T2-S3** | Materialized snapshot builder + periodic hosted compact | [`briefs/sync/T2-S3-materialized-snapshot.md`](briefs/sync/T2-S3-materialized-snapshot.md) |
| **T2-S4** | Realtime on `continuity_command_events` INSERT | [`briefs/sync/T2-S4-realtime-command-events.md`](briefs/sync/T2-S4-realtime-command-events.md) |
| **T2-S5** | Interleaving + conflict spec tests (same-row, reversal, personal scope) | [`briefs/sync/T2-S5-interleaving-harness.md`](briefs/sync/T2-S5-interleaving-harness.md) |
| **T2-S6** | Confirmation-scoped undo + D-124 restore rebase rules | [`briefs/sync/T2-S6-confirmation-scoped-undo.md`](briefs/sync/T2-S6-confirmation-scoped-undo.md) |

### Tier 2 command event (sketch)

```text
continuity_command_events (
  id uuid PK,
  household_id, environment, member_id,
  idempotency_key, confirmation_id, identity_hash,
  base_revision, result_revision,
  ledger_scope shared|personal,
  command_type, payload_json, -- bounded command result, not whole household
  created_at timestamptz
)
UNIQUE (household_id, environment, idempotency_key)
```

**Merge rule (high level):** apply events in `(result_revision, created_at)` order; catalog LWW on `updatedAt` unchanged; journal facts append-only; same `transactionId` + divergent amounts → `conflicts[]`.

---

## 6. Tier 3 — Optimistic UX, presence, and scale polish

**Goal:** Feels instant on phone and Office; calm honest chrome; soft presence (“Bianca is in the kitchen”); graceful Realtime disconnect; channel hygiene for larger households.

**Depends on:** Tier 1 Realtime path (Tier 2 optional for optimistic command refs).

### Tier 3 slices

| Slice | Outcome | Prompt file |
|---|---|---|
| **T3-S1** | Optimistic command states: pending → posted locally → cloud ack → partner visible | [`briefs/sync/T3-S1-optimistic-command-chrome.md`](briefs/sync/T3-S1-optimistic-command-chrome.md) |
| **T3-S2** | Soft presence rows (extends D-100) + Realtime optional presence channel | [`briefs/sync/T3-S2-soft-presence.md`](briefs/sync/T3-S2-soft-presence.md) |
| **T3-S3** | Background sync: focus/visibility reconnect, exponential backoff, offline badge | [`briefs/sync/T3-S3-background-sync-polish.md`](briefs/sync/T3-S3-background-sync-polish.md) |
| **T3-S4** | Scale envelope: multi-member channel policy, rate limits, Realtime vs poll table | [`briefs/sync/T3-S4-scale-envelope.md`](briefs/sync/T3-S4-scale-envelope.md) |

---

## 7. Tier 4 — Normalized hosted journal (long-term)

**Goal:** Year-scale households pull **incremental journal facts** instead of monolithic JSON. This is **research + gated migration**, not Phase 0/1 work.

### Tier 4 slices

| Slice | Outcome | Prompt file |
|---|---|---|
| **T4-S1** | Tenant-scoped journal identity design (composite keys, no global PK collision) | [`briefs/sync/T4-S1-tenant-journal-design.md`](briefs/sync/T4-S1-tenant-journal-design.md) |
| **T4-S2** | Incremental pull cursor + PGlite merge | [`briefs/sync/T4-S2-incremental-pull.md`](briefs/sync/T4-S2-incremental-pull.md) |
| **T4-S3** | Compaction, tombstones, export/rebuild | [`briefs/sync/T4-S3-compaction-retention.md`](briefs/sync/T4-S3-compaction-retention.md) |
| **T4-S4** | Production cutover + rollback rehearsal | [`briefs/sync/T4-S4-production-cutover.md`](briefs/sync/T4-S4-production-cutover.md) |

**Refusal until Tier 2 proves command semantics:** populating `001_hearth_books.sql` normalized tables as live transport (see ARCHITECTURE scale note).

---

## 8. Cross-tier test matrix

Every tier adds rows; none delete prior proofs.

| Scenario | Tier 1 | Tier 2 | Tooling |
|---|---|---|---|
| A posts shared, B open | ≤ 500 ms visible | same | two-browser / Playwright |
| A offline, B posts, A reconnect | outbox + pull | command replay | fault harness |
| Same txn edited both sides | conflict sheet | conflict sheet | deterministic IDs |
| Disjoint shared txns | quiet absorb | event interleave | merge tests |
| Personal scope isolation | member overlay | personal events only | privacy auditor |
| Duplicate Realtime delivery | idempotent merge | idempotent append | injected dup events |
| Realtime down | poll fallback ≤ 4 s | same | disconnect test |
| Personal fail mid-push | no ack (012 atomic prevents) | n/a | supabase.test.ts |
| Wrong Google subject | zero fetch | zero fetch | D-146 tests |
| Restore/undo | whole-snapshot risk documented | confirmation-scoped | undo tests |

---

## 9. Migration numbering

| Migration | Purpose | Tier | Status |
|---|---|:---:|---|
| 002 | Shared snapshot CAS | pre-T1 | **Applied** Development |
| 003 | Membership + Personal scope | pre-T1 | **Applied** |
| 011 | Hercules Pro atomic write (prototype) | pre-T1 | Not applied; pattern donor for 012 |
| **012** | `publish_continuity_snapshot` atomic Shared+Personal | **T1-S1** | **Applied** Development (2026-08-26) |
| **013** | `continuity_command_events` append log | **T2-S1** | **Code on branch** — Dev apply via paste / `pnpm books:apply:013` ([`SYNC_COMMAND_LOG_APPLY.md`](SYNC_COMMAND_LOG_APPLY.md)) |
| **014** | Realtime publication (`supabase_realtime` ADD TABLE) | **T1-S3** | **Applied** Development (2026-08-26); flag on in CI build |

Jonathan approval required before any `pnpm books:apply` or Production apply.

---

## 10. Rollout sequence (recommended)

```text
1. T1-S1 + T1-S2 (atomic RPC + client)     ── Development apply 012
2. T1-S3 + T1-S4 (Realtime + coordinator)  ── feature flag VITE_CONTINUITY_REALTIME=1
3. T1-S5 (two-browser proof)               ── gate: enable Realtime default Dev
4. T1-S6 (freshness UI)
5. T2-S1 → T2-S5 (command log + harness)   ── flag VITE_CONTINUITY_COMMAND_LOG=1
6. T2-S6 (undo) + Tier 3 polish
7. Tier 4 research packet when month-scale JSON hurts
```

**Kill criteria (any tier):** halt hosted sharing and preserve outbox if interleaving tests fail, Realtime bypasses PGlite acceptance, or cross-member disclosure appears.

---

## 11. Packet index (paste-ready prompts)

All slices live under [`docs/briefs/sync/`](briefs/sync/). Each file includes: goal, baseline, allowed scope, forbidden actions, acceptance tests, risk, handoff fields, and a **copy-paste Cursor prompt**.

| Order | File | One-line outcome |
|:---:|---|---|
| 1 | [T1-S1-atomic-continuity-rpc.md](briefs/sync/T1-S1-atomic-continuity-rpc.md) | One SQL TX for Shared CAS + Personal |
| 2 | [T1-S2-client-atomic-push.md](briefs/sync/T1-S2-client-atomic-push.md) | Client single-trip push |
| 3 | [T1-S3-realtime-subscribe.md](briefs/sync/T1-S3-realtime-subscribe.md) | Websocket push replaces primary poll |
| 4 | [T1-S4-push-pull-coordinator.md](briefs/sync/T1-S4-push-pull-coordinator.md) | Race-free reconcile |
| 5 | [T1-S5-two-browser-proof.md](briefs/sync/T1-S5-two-browser-proof.md) | E2E latency + fault proof |
| 6 | [T1-S6-sync-freshness-ui.md](briefs/sync/T1-S6-sync-freshness-ui.md) | Honest freshness chrome |
| 7 | [T2-S1-command-event-schema.md](briefs/sync/T2-S1-command-event-schema.md) | Append-only command log |
| 8 | [T2-S2-slim-command-outbox.md](briefs/sync/T2-S2-slim-command-outbox.md) | Outbox carries refs not journals |
| 9 | [T2-S3-materialized-snapshot.md](briefs/sync/T2-S3-materialized-snapshot.md) | Rebuild snapshot from log |
| 10 | [T2-S4-realtime-command-events.md](briefs/sync/T2-S4-realtime-command-events.md) | Realtime on small events |
| 11 | [T2-S5-interleaving-harness.md](briefs/sync/T2-S5-interleaving-harness.md) | Convergence proofs |
| 12 | [T2-S6-confirmation-scoped-undo.md](briefs/sync/T2-S6-confirmation-scoped-undo.md) | Safe dual-use undo |
| 13 | [T3-S1-optimistic-command-chrome.md](briefs/sync/T3-S1-optimistic-command-chrome.md) | Instant-feel UI |
| 14 | [T3-S2-soft-presence.md](briefs/sync/T3-S2-soft-presence.md) | Who's in the kitchen |
| 15 | [T3-S3-background-sync-polish.md](briefs/sync/T3-S3-background-sync-polish.md) | Reconnect/backoff |
| 16 | [T3-S4-scale-envelope.md](briefs/sync/T3-S4-scale-envelope.md) | 10–100 member policy |
| 17 | [T4-S1-tenant-journal-design.md](briefs/sync/T4-S1-tenant-journal-design.md) | Long-term schema |
| 18 | [T4-S2-incremental-pull.md](briefs/sync/T4-S2-incremental-pull.md) | Incremental fetch |
| 19 | [T4-S3-compaction-retention.md](briefs/sync/T4-S3-compaction-retention.md) | Retention/export |
| 20 | [T4-S4-production-cutover.md](briefs/sync/T4-S4-production-cutover.md) | Production migration |

---

## 12. Relationship to other canon

| Doc | Change |
|---|---|
| [`HEARTH_ROADMAP.md`](HEARTH_ROADMAP.md) | Phase 2 sync rows replaced by Tier 1–2 checklist |
| [`CLOUD_CONTINUITY.md`](CLOUD_CONTINUITY.md) | Latency target + pointer here |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Sync section references tier plan |
| [`briefs/CURSOR_NEXT_PACKETS.md`](briefs/CURSOR_NEXT_PACKETS.md) | Packet 7 superseded by this index |
| [`worksessions/2026-08-25-live-pull-dual-use.md`](worksessions/2026-08-25-live-pull-dual-use.md) | Historical; poll superseded as primary |

---

## 13. Open product questions (resolve during T1-S1 review)

1. **Personal envelope on every push:** always bump Personal revision even when only Shared money changed? **Recommendation:** yes — keeps member overlay monotonic and simplifies Realtime filter to one household channel + personal member channel.
2. **Production Realtime:** ship Tier 1 Development-only until October Auth smoke complete? **Recommendation:** yes.
3. **Realtime payload:** send full row vs `revision` only? **Recommendation:** revision-only event triggers existing pull-by-id path to avoid huge websocket frames (T1-S3).

---

*Decision: **D-149**. Worksession: [`worksessions/2026-08-26-sync-architecture-reframe.md`](worksessions/2026-08-26-sync-architecture-reframe.md).*
