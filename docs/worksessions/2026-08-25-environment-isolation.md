# Hearth worksession — Environment isolation Phase 0

- **Status:** IMPLEMENTED; REVIEW REQUIRED
- **Opened:** 2026-08-25 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** dual-ai-budget-app
- **Branch:** `cursor/environment-isolation-f375`
- **Baseline SHA:** `a48d959` (`main`)
- **Head SHA:** (see commit on branch)
- **PR or issue:** (open on push)
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development client only; no hosted schema/secrets/Production mutation

## Household outcome

Bind every join, Hearth Pass, pull, persist, reconcile, and outbox replay path to the selected environment + household + invite tuple so adversarial mismatches fail closed without persistence or hosted REST side effects.

## Budget delta (5)

`+2` — fail-closed environment/household/invite binding on import, pull, persist, reconcile, and continuity outbox; blocks cross-pill or cross-household snapshot bleed.

## Engagement delta (3)

`0` — safety-only packet; no companion or onboarding UX change.

## Verified baseline

- Roadmap §1.3 marks environment isolation **STOP-SHIP** with proof = adversarial tests reject mismatched payloads without persistence or network.
- Partial checks existed (`pass.ts`, `recovery.ts` import, `supabase.ts` pull env filter) but were not centralized or complete on persist/outbox/invite mismatch.

## Scope

### In scope

- Central `environmentIsolation.ts` assertions
- Wire pass, pull, persist (`saveHousehold`), reconcile, outbox enqueue/flush
- Adversarial vitest matrix (`test/environment-isolation.test.ts`)

### Out scope

- Onboarding Update, Home UX, Hercules D-132/D-133, batch import UI, shift polish
- Two-client fault harness (follow-up)
- GitHub branch protection (separate packet)

## Acceptance evidence

- [x] `pnpm check` green (555 tests)
- [x] Adversarial tests: pass invite mismatch, pull env/invite/household mismatch, persist mismatch, reconcile mismatch, tampered outbox (zero fetch)

## Plan

- [x] Central binding module
- [x] Wire boundaries
- [x] Tests + handoff

## Evidence log

- `pnpm check` — 555 passed, build OK (2026-08-25)

## Decisions

- Persist binding uses explicit `operatingEnvironment` on `saveHousehold`; App passes selected pill on every save path.

## Remaining uncertainty

- Phase 0 checkbox stays open until Jonathan confirms this satisfies roadmap proof alongside two-device convergence work.
- `readRemoteSnapshot` legacy path still lacks environment query filter (CAS path is primary; legacy checks env after read).

## Handoff

Branch/PR ready for review. Not merged/deployed/live-verified.
