# Hearth worksession — Phase 0 evidence, membership tuple, hash acceptance

- **Status:** IMPLEMENTED; PR READY
- **Opened:** 2026-08-26 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** dual-ai-budget-app
- **Branch:** `cursor/phase0-evidence-isolation-hash-c04e`
- **Baseline SHA:** `0029ee07201a403b7be6a3950795cf17af13e581`
- **Head SHA:** (see branch tip after push)
- **PR or issue:** (open on push)
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development client + living docs; no hosted schema/secrets/Production mutation

## Household outcome

Phase 0 can honestly check: Sheets-era archive evidence; environment + Google membership on automatic continuity boundaries; pulled/merged money requires PGlite/canonical hash acceptance (entry count alone never accepts). Also checks #62 salvage and hosted-row inventory as already shipped.

## Budget delta (5)

`+3` — fail-closed identity and books acceptance.

## Engagement delta (3)

`0` — safety and tracker hygiene.

## Verified baseline

- `main@0029ee0`
- Issues closed; env/invite isolation merged; Google membership and hash unity incomplete before this packet

## Scope

### In scope

- `docs/SHEETS_ERA_TRACKER_ARCHIVE.md`
- D-145 membership tuple + unified financial hash + accept verify + switch-ledger accept
- Roadmap Phase 0 checkbox updates

### Out of scope

- Live Hercules KV, branch protection, full optional-publish removal, WORKING_MEMORY full rewrite

## Acceptance evidence

- [x] Archive doc maps closed Sheets-era issues and superseded PRs
- [x] Adversarial Google subject / outbox identity tests — zero fetch
- [x] Same-count different amounts → projection-mismatch; `financialAuditHash` === PGlite hash
- [x] Roadmap Phase 0 boxes updated; `tsc --noEmit` green; focused tests green; full suite 641/643 (2 pre-existing batch-import SubtleCrypto)

## Evidence log

- `pnpm exec vitest run test/environment-isolation.test.ts test/hosted-transport.test.ts` — 22/22
- `pnpm exec tsc --noEmit` — clean
- `pnpm test` — 641 passed, 2 failed (`batch-import-ui` SubtleCrypto — pre-existing on main)

## Decisions

- D-145; phrase/Pass remain recovery without Google; D-144 left for open naming/outbox drafts

## Remaining uncertainty

- Hosted membership row presence still relies on Auth JWT/RLS when online; offline asserts local google.links
- Full WORKING_MEMORY drift remains a separate Phase 0 checkbox

## Handoff

Jonathan reviews PR. Not merged/deployed/live-verified.
