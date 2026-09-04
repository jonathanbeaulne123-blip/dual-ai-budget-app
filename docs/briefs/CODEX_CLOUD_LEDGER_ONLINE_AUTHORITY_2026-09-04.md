# Codex packet — cloud-ledger online authority and subsecond proof

## Goal

Turn D-208's shared-only launch wording into the truthful runtime contract already implied by Hearth's cloud authority: every mutation of an authenticated cloud-backed household, whether presented in Personal or Shared view, commits only after isolated PGlite validation and atomic cloud acknowledgement. Prove one-phone write to peer-phone accepted visibility below one second, retaining the stricter 500 ms p95 / 100-event Development gate.

## Canon refs

- `AGENTS.md`
- `docs/CLOUD_CONTINUITY.md`
- `docs/SYNC_ARCHITECTURE.md`
- `docs/SYNC_PILOT.md`
- `docs/DECISIONS.md` D-208
- `docs/VERIFICATION.md`
- `docs/worksessions/2026-09-04-cloud-ledger-online-authority.md`

## Base branch / PR / commit

- Repository: `jonathanbeaulne123-blip/dual-ai-budget-app`
- Branch: `codex/cloud-ledger-online-authority`
- Base: `origin/main@8ca2a9b91208922967f91c1ab2fd9841f647ae21`
- Prior implementation: merged PR #323, application head `27004fdd326349dfeba999d181f52496e7f520f5`

## Household outcome

Jonathan and Bianca can trust the same rule everywhere in a cloud-backed household: offline means accepted books remain readable but nothing changes; online Confirm validates locally, commits atomically to the cloud, then advances this device and reaches the other open kitchen through Realtime in under one second.

## Risk and reviewers

- Risk: **Release** (`sync`, `money`, `privacy`, `Auth`, `deploy`).
- Required read-only review: books/money integrity, Auth/privacy/scope, latency/recovery, and final release evidence.
- Jonathan is release decision owner.

## Dual Course

- Budget `+5`: one cloud-authoritative commit boundary for Personal and Shared scopes.
- Engagement `+2`: fast truthful completion and calm offline read-only behavior.

## Why now

Jonathan explicitly chose the online-authoritative model and required a live under-one-second cross-device result. The merged implementation already gates commits by cloud linkage, but its public contract still says “shared,” leaving Personal behavior and rollback configuration ambiguous.

## Allowed scope

- Runtime names and gate inputs that express cloud-backed household authority.
- Development build flag and rollback compatibility.
- Offline/Auth/cloud/pending/paired-read copy.
- Focused App and pure-policy regressions for Personal and Shared views.
- Existing Realtime/command/outbox/diagnostic performance repair required to pass 500 ms p95.
- Living canon, worksession, release evidence, and exact Development build verification.

## Forbidden scope

- Production continuity or Production data.
- Schema/migration/RLS/provider/secret changes.
- Destructive Development cleanup.
- A second financial writer, UI-only authority, bypass of PGlite, or local-only cloud-backed commit.
- Partner-Personal disclosure or diagnostic payload widening.

## Invariant laws

1. Confirm and typed commands remain the only money writers.
2. Every inbound/outbound candidate crosses environment, household, member, scope, canonical hash, CAD, double-entry, idempotency, and PGlite checks.
3. Active PGlite, visible household, durable device snapshot, and Saved state advance only after authenticated atomic cloud acknowledgement in Development launch mode.
4. Ambiguous delivery preserves its exact marker and staged candidate; conflicts never silently republish a rejected local candidate.
5. Shared and signed-in Personal cloud generations are adopted as one stable pair.
6. Cached accepted books remain readable offline; local-only households make no automatic hosted request.
7. Production continuity remains refused.

## Acceptance criteria

- Pure policy and App integration prove both Personal and Shared cloud-backed mutations refuse offline before local advancement.
- Missing/wrong Auth, incomplete pair, pending marker, response loss, cloud refusal, duplicate, conflict, restart, reconnect, and scope switch remain fail-closed and retry-safe.
- Peer Realtime uses command-log-first PGlite acceptance; poll is honest fallback only.
- Diagnostics remain bounded and contain no amount, merchant, note, email, token, or raw identifier.
- Exact clean candidate passes the Release quick gate, Jonathan-authorized full verification, independent reviews, hosted exact-SHA checks, and a clean-run live diagnostic with exactly 100 candidate/painted/valid-clock Shared events, zero excluded/invalid samples, and `latency.p95Ms <= 500`.

## Exact commands

Use the current repository mappings and record replacements when files move:

```sh
pnpm exec vitest run test/online-required-sync.test.ts test/app-startup-p1.test.ts test/continuity-command-realtime.test.ts test/continuity-coordinator.test.ts test/continuity-command-interleaving.test.ts test/sync-pilot-diagnostics.test.ts --maxWorkers=1 --testTimeout=30000
pnpm test -- --risk=high --focus=test/online-required-sync.test.ts --focus=test/app-startup-p1.test.ts --focus=test/continuity-command-realtime.test.ts --focus-reason="Cloud-backed Personal and Shared commits require cloud acknowledgement and retain subsecond command-Realtime acceptance"
git diff --check
```

After an exact clean commit, use `docs/VERIFICATION.md` with:

```text
HEARTH_FULL_AUTHORIZED_BY=Jonathan
HEARTH_FULL_AUTHORIZATION_REF=user-request:2026-09-04-online-only-subsecond-sync
HEARTH_FULL_RISK=release
HEARTH_FULL_REASON=Jonathan requested perfect sync and an under-one-second two-phone result for this exact Release-risk change
HEARTH_FULL_SHA=<exact HEAD>
```

## Browser, offline, and error proof

- Personal and Shared view at phone and wide widths retain cached accepted content while offline.
- Confirm stays open or recoverable with an announced read-only reason; zero active/durable mutation occurs.
- Online cloud refusal and response loss never claim Saved.
- Realtime disconnect shows fallback honestly and heals without duplicate application.
- Two separate Google accounts in one Development household supply the final 100-event diagnostic.

## Network, data, and secrets

- Only disposable Development household mutations explicitly created for the live proof are allowed.
- Never print or commit tokens, emails, raw ids, `.env` contents, or Personal rows.
- No schema, migration, secret, provider, Production, or unrelated household mutation.

## Expected return handoff

Return exact base/head, changed behavior, full changed-file list, quick/full/hosted/live commands and results, 100-sample p95, identity/ledger scopes, hosted mutations, offline/outbox behavior, Production refusal, residual risks, rollback, and next owner.
