# Hearth worksession — atomic onboarding budget adoption

- **Status:** CLOSED; LOCAL HIGH-GATE + BUILD VERIFIED
- **Opened:** 2026-09-05 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/23-adoption`
- **Baseline SHA:** `85bafffc4d39668fc1aed1dd0c90a080cfb58ea4`
- **Implementation SHA:** `119c30b0d6776dce6b9796d9c596f3a864dcb7d1`
- **PR or issue:** none
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none; synthetic local Development fixtures only

## Household outcome

The household's current exact first-plan proposal becomes one complete accepted
month plan only after both active members approve that digest. Retry reuses one
durable adoption receipt; partial or stale candidates leave the prior plan live.

## Budget delta (5)

`+4` — the first agreed monthly category plan now has an all-or-nothing,
receipt-backed Shared adoption boundary with stale, duplicate, and replay guards.

## Engagement delta (3)

`+1` — a future Chapter 11 surface can offer one honest Adopt/Retry action and
say “nothing changed” on failure. This slice intentionally adds no visible UI.

## Scope

### In scope

- Active-member, active-onboarding, current proposal, month, category, amount,
  and two exact-approval preflight.
- Atomic existing-row updates plus missing-row creation using budget-plan shape.
- Deterministic adoption/confirmation identity and duplicate receipt behavior.
- Exact plan-snapshot binding on proposal approvals, independent of device clock.
- Accepted-write revalidation and bounded Shared command materialization/replay.
- Per-command compacted receipt hash, historical time, audit, and identity proof.
- Later-plan last-write-wins preservation during older event replay.
- Focused no-journal/no-transfer/no-provider and forged-partial tests.

### Out of scope

- Chapter 11 presentation or approval controls; transactions, transfers, journal
  rows, Fund events, Personal facts, schema, hosted rows, Auth/RLS, providers,
  models, secrets, Production, push, PR, merge, deployment, or hosted-live proof.

## Acceptance evidence

- [x] Every current proposal row is applied in exact integer cents as one batch.
- [x] Stale digest, missing approval, wrong actor, inactive mode, and plan-set
  conflicts fail before accepted state changes.
- [x] A forged partial candidate is refused before persistence.
- [x] Retry reuses the deterministic accepted receipt and does not bump revision.
- [x] The compiled journal is deep-equal before and after adoption.
- [x] Shared command-event replay carries and validates the bounded plan rows.
- [x] Final High quick gate, build, AI verification, and independent review.

## Evidence log

- Clean `origin/main@85bafffc4d39668fc1aed1dd0c90a080cfb58ea4`
  no-diff High baseline passed TypeScript and AI-surface verification in 17.1 s.
- Focused Slice 23 proof passed 14/14 tests; the eight-file adjacent onboarding,
  command-runtime, and continuity set passed 95/95.
- The final High quick gate passed TypeScript, AI-surface verification, diff
  hygiene, and 75/75 selected fast plus serial PGlite tests in 32.810 s. The
  production build passed at 473 Vite modules plus Hercules Pro UI.
- The first adjacent run passed 100/101; one existing Personal-cloud-refusal UI
  assertion timed out at 31.6 s, then passed alone in 0.6 s without a code change.
- Independent High-risk review drove strict plan/Activity shaping, clock-safe
  plan-state approval binding, compacted receipt provenance, and stale retry-id
  repairs, then reported no remaining P0-P3 finding.
- `pnpm check:windows` could not run because PowerShell is unavailable on this
  macOS host. No Windows result is claimed.

## Decisions

- D-223: the first budget is adopted atomically and changes plan rows only.
- The accepted command receipt is the durable adoption fact; its confirmation id
  is derived from the approved month and proposal digest.
- Budget-plan materialization is Shared, bounded to posted plan ids, and guarded
  at both local acceptance and receiver replay.

## Remaining uncertainty

- Chapter 11 UI and its live browser proof belong to Slice 24.
- Hosted two-account delivery remains separate release evidence.
- A mixed historical command bundle whose exact earlier audit state cannot be
  reconstructed fails closed to the existing full-snapshot recovery path.
- Windows proof depends on a host with PowerShell.

## Handoff

Jonathan separately decides whether to push or open a PR. Slice 24 owns the
Chapter 11 surface and its live browser proof. Push, merge, deploy, hosted
mutation, and Production remain separate decisions.
