# Onboarding Slice 11 — Chapter 2 household scope contract

This contract repairs the omitted file-scope and acceptance fields in the
Chapter 2 entry. The `_1` Hearth build, sequence, UX, and plate packet supplied
by Jonathan on 2026-09-04 is the current product authority. The earlier
`ONBOARDING_BUILD_MANUAL.md` is used only for the Chapter 2 intent and failure
list that the newer sequence delegates to.

## Goal

Prove that the current person has a live authenticated identity, the selected
household has exactly the two expected active seats, and the current
`(environment, householdId, memberId)` scope resolves exactly. The accepted
card names only the household, both member display names, and environment.

`auto-completable` means a passing live probe enables **Next**. It never means
advancing on probe arrival, a route change, or a timer.

## Read first

- `src/core/membershipAccess.ts`
- `src/auth/accountFlow.ts`
- `src/auth/supabaseSession.ts`
- `src/ledger/supabase.ts`
- `src/ledger/householdInvites.ts`
- `src/core/onboarding/evidence.ts`
- `src/core/onboarding/progress.ts`
- `test/shared-money-membership.test.ts`

## Create

- `src/core/onboarding/householdScope.ts`
- `src/onboardingHouseholdScope.ts`
- `test/onboarding-household-scope.test.ts`

## Modify

- `src/core/onboarding/evidence.ts`
- `src/core/commands.ts`
- `src/core/index.ts`
- `src/OnboardingChat.tsx`
- `src/OnboardingWitness.tsx`
- focused onboarding fixture and fence tests
- `docs/DECISIONS.md`
- `docs/AI_HANDOFF.md`

## Choreography

1. The UI adapter reads the cached Supabase session only to distinguish missing
   Auth from an offline cached identity.
2. While online, it refreshes the session if required, resolves that Google
   identity to the current member, lists active memberships, and queries
   `listHouseholdAccess()` for the exact selected household.
3. Multiple memberships are valid after an exact scope is selected. Without a
   selection, the adapter asks rather than choosing a household.
4. A generation guard binds the read to environment, household, member, and
   current session flow; a switch discards the result.
5. The adapter emits a transient sanitized observation containing only scope,
   member ids, and observation time. The pure evidence projector validates it.
6. A passing card enables Next. Pressing Next invokes a self-owned command that
   re-projects against the current Household, then writes `observedCompleteAt`,
   `probeEvidenceKey`, and acknowledgement to that member's Personal progress.

## Failure states

- missing Auth → blocked identity; no Next
- missing partner membership → named membership block; no Next
- multiple households without an exact selection → privacy-safe scope block;
  never pick the first result
- revoked current membership → membership block; no Next
- offline cached identity → local replica may remain readable, Chapter 2 stays
  pending, and the cached identity never completes it
- member, household, or environment switch mid-flow → discard the stale result,
  return to the current chapter, and carry no progress across scopes
- transient hosted read failure → say that nothing changed, offer **Try again**,
  and never blame either member or mislabel the failure as missing Auth

## Acceptance

- A valid live session, exact active membership, exact selected scope, and two
  matching live seats produce a household evidence card with non-empty source
  ids and no token, email, session id, device id, audit row, sibling-household
  id, or partner-Personal fact.
- Ordinary `recordChapterAcknowledgement` cannot satisfy Chapter 2.
- The accepted-probe command is self-owned, Personal-scoped, idempotent, posts
  no money, and revalidates current scope at commit time.
- Probe arrival alone never advances the chapter.
- Checking is neutral; a temporary hosted failure has a visible retry path that
  re-runs the complete live probe.
- Every failure state is reachable and tested; offline and stale reads never
  write completion.
- `evidence.ts` remains deterministic and imports no DOM, browser, component,
  command, or async adapter module.

## Do not

- Do not add Auth tokens, identity snapshots, roster caches, or selected-scope
  authority to `Household` or `Member`.
- Do not treat `Household.devices`, local member count, or Google Drive linkage
  as authenticated seat authority.
- Do not import browser state, React, Supabase, or async I/O into the core
  evidence projector.
- Do not guess among households, complete from cache, auto-advance, expose a
  sibling household, or carry an accepted observation across a scope switch.
- Do not change `App.tsx`, `Pairing.tsx`, schema, RLS, hosted rows, secrets,
  Production settings, or money commands for this slice.
