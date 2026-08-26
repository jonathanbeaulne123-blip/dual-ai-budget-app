# Hearth worksession — Hercules read-only reconnect fallback

- **Status:** OPEN
- **Opened:** 2026-08-26 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/hercules-readonly-reconnect`
- **Baseline SHA:** `3e29185`
- **PR:** pending
- **Risk:** Medium
- **Environment impact:** Development Worker OAuth only; no schema, secret, Production, or household-data mutation

## Household outcome

Hercules Pro still reconnects usefully when ChatGPT requests its full advertised scope but the member has left writing off. Hearth grants only `hearth.read`; it never turns writing on implicitly.

## Budget delta (5)

`0` — connection behavior only. No money command or calculation changes.

## Engagement delta (3)

`+1` — the default read-only companion no longer gets trapped behind an optional write-permission error.

## Acceptance evidence

- [x] Requested `hearth.read hearth.write` downgrades to `hearth.read` when both member write permissions are off.
- [x] Focused Hercules Pro tests pass (1 file / 8 tests).
- [x] TypeScript passes.
- [ ] PR/main CI, Worker deployment, reconnect, and PiP smoke pass.

## Boundaries

- OAuth may grant a narrower scope than requested.
- A member must still explicitly enable a ledger write permission and reconnect before any write tool can execute.
- No permission, journal row, cloud snapshot, migration, or Production setting is changed by this repair.

## Handoff

Codex owns this through the resumed first-turn Hercules smoke test.
