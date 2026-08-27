# Hearth worksession — Onboarding Slice A foundation

- **Status:** OPEN
- **Opened:** 2026-08-27 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor Cloud Agent
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/onboarding-foundation-d129-4857`
- **Baseline SHA:** `001fa6c4ac31ebf305bc5168b52f7495afbbe721` (`main`)
- **Head SHA:** (in progress)
- **PR or issue:** (pending)
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** Development client only; no hosted schema, secrets, or Production

## Household outcome

Reusable onboarding coordinator and interaction primitives so Hercules-led first-run teaching (D-128/D-129) can later attach real scenes without contaminating books.

## Budget delta (5)

`0` — no money commands, Practice stays ephemeral, Confirm boundary untouched.

## Engagement delta (3)

`+2` — foundation for the guided kitchen that members actually open.

## Verified baseline

- D-128 and D-129 accepted on `main`.
- `docs/ONBOARDING_PART2_STORYBOARD.md` and Slice A prompt present.
- No `src/core/onboarding/` on baseline.
- No `data-onboarding-id` anchors yet.

## Scope

### In scope

- Pure registry/types/validation
- Coordinator reducer/state machine
- Target contract + minimal anchors
- Focus/interaction lock, geometry, route-plan abstraction
- Ephemeral PracticeSession + stub copy-to-draft
- Progress store interface + local test adapter
- Skip + More → Replay behind foundation flag
- Focused tests + handoff

### Out of scope

- Financial scenarios / opening-balance command
- Final Hercules copy polish
- Hosted progress schema / migrations
- Worker/Auth/RLS/deploy changes
- Full chapter storyboard content

## Acceptance evidence

- [ ] Registry rejects invalid ids/combos
- [ ] Eligibility / skip / replay / completion identity proofs
- [ ] Arbitrary clicks/timers cannot advance
- [ ] Practice destroy proves no Household mutation
- [ ] `pnpm check` green
- [ ] No migration/provider/hosted work

## Plan

- [x] Branch from current `main`
- [ ] Implement `src/core/onboarding/*`
- [ ] Wire flagged shell + anchors
- [ ] Tests + check
- [ ] PR for GPT review

## Evidence log

- Baseline: `main@001fa6c`
- Head: `00b49fb` (pre-check docs tip may advance)
- `pnpm exec vitest run test/onboarding-foundation.test.ts` → 15 passed
- `pnpm check` → 897 passed / 2 skipped; build green
- PR: https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/216

## Decisions

- D-153 records Slice A foundation behind `VITE_ONBOARDING_FOUNDATION`.

## Remaining uncertainty

Scene content and Hercules walk animation remain Slice B+. Flag defaults off.

## Handoff

GPT review on PR #216; Jonathan merge/deploy only after review. Not shipped.
