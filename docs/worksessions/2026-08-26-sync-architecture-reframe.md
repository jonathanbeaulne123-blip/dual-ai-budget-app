# Hearth worksession — Sync architecture reframe (D-148)

- **Status:** CLOSED (documentation)
- **Opened:** 2026-08-26 (`America/Toronto`)
- **Closed:** 2026-08-26
- **Owner:** Jonathan
- **Assignee:** Cursor Cloud Agent
- **Branch:** `cursor/sync-architecture-c04e`
- **Baseline SHA:** `4efe6dc` (`main`)
- **Risk:** Medium (planning only; no schema/code transport changes this PR)
- **Decision:** **D-148**

## Household outcome

Jonathan and Bianca get a written, slice-by-slice plan to see each other's confirmed money in **100–500 ms** instead of waiting up to 4 s — without silent loss, without either phone being host, and with paste-ready prompts for each implementation slice.

## Budget delta (5)

`+2` — atomic hosted writes and Realtime push protect money truth at household scale; command-log tier removes whole-snapshot overwrite class.

## Engagement delta (3)

`+2` — partner posts feel live; calm honest sync chrome; soft presence later in Tier 3.

## Deliverables

- [`docs/SYNC_ARCHITECTURE.md`](../SYNC_ARCHITECTURE.md) — master tiered plan, ELI5, gates, test matrix, migration numbering
- [`docs/briefs/sync/`](../briefs/sync/README.md) — 20 slice prompts (T1-S1 … T4-S4)
- [`docs/HEARTH_ROADMAP.md`](../HEARTH_ROADMAP.md) — Phase 2 rewritten
- [`docs/CLOUD_CONTINUITY.md`](../CLOUD_CONTINUITY.md), [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md), [`docs/README.md`](../README.md) — pointers + latency target
- [`docs/DECISIONS.md`](../DECISIONS.md) — D-148 row

## Verification

- Documentation-only PR; no product code changes
- Cross-links resolve within repo
- Slice order respects Phase 0 / D-147 foundations

## Next owner

**Cursor** — implement **T1-S1** (`docs/briefs/sync/T1-S1-atomic-continuity-rpc.md`) on disposable Development after Jonathan reviews D-148 plan.

## Uncertainty

- Migration 012 signature may adjust after Hercules Pro 011 review
- Realtime may require Migration 014 publication — propose during T1-S3
- Production Realtime remains gated until October Auth smoke

## Handoff

Not merged, not deployed. Documentation PR only.
