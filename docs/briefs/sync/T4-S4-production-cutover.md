# T4-S4 — Production cutover

**Tier:** 4  
**Depends on:** Tier 1–3 Production gates, October Auth  
**Risk:** Release

## Goal

Reviewed migration, rollback, checksum, Jonathan-approved Production apply for normalized or command-log transport.

## Forbidden

- Agent applies Production without explicit Jonathan approval

## Cursor prompt

```text
Prepare T4-S4 from docs/briefs/sync/T4-S4-production-cutover.md. Cutover runbook only: migration order, rollback, verification queries, kill criteria. No apply. hearth-release-review. Handoff.
```
