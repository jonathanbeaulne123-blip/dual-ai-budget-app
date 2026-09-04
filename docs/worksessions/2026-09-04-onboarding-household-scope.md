# Hearth worksession — onboarding Chapter 2 household scope

- **Status:** LOCAL IMPLEMENTATION — REVIEW REPAIRED
- **Opened:** 2026-09-04 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/11-ch2-household`
- **Baseline SHA:** `e109708` (rebased 2026-09-04; no conflicts)
- **Head SHA:** uncommitted review repair over rebased Slice 11 commit `2b46c36`
- **PR or issue:** none
- **Risk:** Medium-High
- **Decision owner:** Jonathan
- **Environment impact:** Development code only; no hosted mutation

## Household outcome

Chapter 2 recognizes the selected household only after live Auth, active
membership, and the exact two-seat roster agree. Cached identity remains
read-only and pending. A person with several households is accepted after an
exact household is selected; Hearth never guesses which household they meant.

## Budget delta (5)

`+2`: live membership evidence and commit-time scope revalidation prevent a
local member shape or stale session from claiming household setup completion.
No amount, journal row, balance, or money command changes.

## Engagement delta (3)

`+1`: a passing probe presents a concise cited household card and enables Next;
failure copy stays calm and exact. Probe arrival never auto-advances.

## Verified baseline

- Clean worktree from fetched `origin/main@8ca2a9b`.
- The provided `_1` packet is the newest authority.
- The earlier onboarding manual's Slice 11 entry omits its own required scope,
  command, choreography, acceptance, and do-not fields.
- Current Auth and membership authority is asynchronous and absent from the
  synchronous Household shape; the existing evidence projector is deliberately
  pure.

## Scope

### In scope

- Repaired Slice 11 contract.
- Transient sanitized live probe adapter.
- Pure Chapter 2 observation validator and evidence projection.
- Self-owned accepted-probe progress command.
- UI gating and honest blocked copy.
- Six failure states, privacy, switch, and bypass tests.

### Out of scope

- Household/Member Auth cache fields, App/Pairing redesign, schema, RLS,
  hosted rows, Production, deployment, push, merge, and money behavior.

## Acceptance evidence

- [x] Valid exact selected scope with two seats is accepted.
- [x] Six specified failure states are reachable.
- [x] Offline cached identity never completes.
- [x] Mid-flow scope change discards the result.
- [x] Evidence contains no Auth token/email/session or partner-Personal fact.
- [x] Ordinary acknowledgement cannot bypass Chapter 2.
- [x] Accepted completion writes only the acting member's Personal progress.
- [x] Focused onboarding tests pass.
- [x] TypeScript passes.
- [x] Medium-High quick gate passes.

## Plan

- [x] Reconcile the newest supplied packet with current main.
- [x] Repair and record the missing contract.
- [x] Implement the pure/live split and typed command.
- [x] Add focused tests and update obsolete fixtures.
- [x] Run the Medium-High quick gate and diff hygiene.

## Evidence log

- New Chapter 2 suite: 5/5 passed in the first focused run.
- Combined focused onboarding run after fixture migration: 97/98 passed; the
  sole remaining failure was a second obsolete direct-acknowledgement fixture,
  subsequently migrated to accepted probe completion.
- `pnpm exec tsc --noEmit`: passed after implementation.
- Final application/test-tree Medium-High quick gate: `quick-gate-passed` in
  `63.462s`, fingerprint
  `76e0c23b37482ec896f5e54b534e9a34544a4ddd141fcfa1cd9219bfef5c5681`;
  11 fast files / 152 tests and the serial proof matrix / 7 tests passed,
  together with TypeScript, AI-surface verification, and diff hygiene. No SLA
  breach. The gate required separate UI proof because UI files changed. This
  evidence-note edit is documentation-only and follows that fingerprint.
- Focused conductor JSDOM proof: 28/28 passed, including the real Chapter 2
  no-Auth state with held-up copy and no Next button.

## Decisions

- D-209.
- Live authority remains transient. The Household remains a ledger snapshot,
  not an Auth/session cache.
- Multi-household membership is not itself ambiguous once the current scope is
  selected exactly.
- `auto-completable` enables Next; it does not auto-advance.

## Remaining uncertainty

- No signed-in hosted two-browser smoke or live responsive browser proof is
  claimed. The focused JSDOM conductor proof covers no-Auth blocking, Next
  removal, keyboard/focus behavior, witness non-action, and copy; a hosted
  signed-in visual smoke is release evidence and remains separate.

## Handoff

Codex owns local implementation and quick-gate proof. Stop before push, PR,
merge, hosted mutation, deployment, or Production change unless Jonathan gives
separate explicit authorization.

## Claude review (2026-09-04)

- **Integration:** stashed the working tree, fast-forwarded the branch from
  `8ca2a9b` to `origin/main@6ce2aa7` (two commits, `docs/OCTOBER_READINESS_MATRIX.md`
  and its test — no overlap with this slice's files), popped the stash. Zero
  conflicts.
- **Code review** against the repaired contract: `evidence.ts` stays pure
  (no DOM/window/`.tsx`/`commands.ts`/`onboardingHouseholdScope` import —
  asserted by an extended fence test); the live probe
  (`src/onboardingHouseholdScope.ts`) is the only module touching Auth/session/
  network and lives outside `core/`; `recordChapterAcknowledgement` now
  refuses `skip: "auto-completable"` chapters, closing the bypass;
  `recordObservedChapterCompletion` re-runs `evidenceFor` against the current
  Household at commit time (a switched `householdId` throws), writes only the
  acting member's Personal progress (verified: the partner's
  `onboardingProgress` stays `undefined`), and is idempotent on replay. No
  token, email, session id, or audit row appears in the evidence card or the
  live observation (asserted directly in the new test). Next only appears
  once evidence is `accepted`, and only a real button press calls the
  completion command — probe arrival alone never advances.
- **Verified independently** in a disposable clone (fresh `pnpm install`,
  not the shared worktree's `node_modules`) at the same `6ce2aa7` base with
  this slice's exact files overlaid:
  - `pnpm exec tsc --noEmit`: clean.
  - Focused suite (`onboarding-household-scope`, `onboarding-evidence`,
    `onboarding-conductor`, `onboarding-witness`, `onboarding-progress`,
    `onboarding-return`): 99/99 passed.
  - Full `test/onboarding*`: 267/267 passed.
  - `git diff --check`: clean.
  - Quick gate at `--risk=medium-high --focus=test/onboarding-household-scope.test.ts`:
    `quick-gate-passed` in 53.75s, fingerprint
    `478713aa015edeaaa220e661efffe2eac048f5fbd4aeb32025e52b2c82f85866`; 11 fast
    files / 152 tests and the serial proof matrix / 7 tests passed, with
    TypeScript, AI-surface verification, and diff hygiene. Matches the
    fast/serial counts from the original local run. The gate again flagged
    that UI changed and browser/viewport/keyboard/accessibility proof is
    still separate — unchanged from the prior disclosure.
- **Two disclosed gaps, not blocking, worth Jonathan's attention:**
  1. The six failure-state copy keys had no dedicated Appendix E lines for
     "offline cached identity" or "multiple households" (`copy.ts` was out of
     scope for this slice), so those two reasons are shown through the
     existing `blocked.identity` / `blocked.privacy` text ("I can't see both
     of you in this household yet." / "I can't use that here."). Accurate
     enough to hold the chapter, but not written for those exact situations —
     a future slice may want dedicated lines.
  2. `useHouseholdScopeProbe` is wired from `OnboardingChat.tsx` with no
     `selectedHouseholdId`, so it defaults to the already-loaded household —
     the "multiple households, ask which" state is fully built and tested at
     the probe/evidence layer but has no picker UI to reach it yet, since
     `App.tsx`/`Pairing.tsx` are out of scope for this slice by contract. A
     person with two real households won't see a chooser until that UI
     exists.
- **Not re-run:** `pnpm test:books` (heavy PGlite/miniflare lane) and
  `pnpm check:windows` (needs `pwsh`) — neither touches onboarding and both
  were out of budget for this review pass.
- Committed locally on `onboarding/11-ch2-household` after this review. Not
  pushed, no PR opened, no merge, no deploy, no Supabase/schema/RLS/Production
  change — per the handoff, stopping here for Jonathan's explicit
  authorization.

## Codex review repair (2026-09-04)

- Rebasing onto `origin/main@e109708` completed without conflict; the new
  lifecycle-authority tests remain green beside the Slice 11 tests.
- Removed the local `Household.google` precondition. The Auth JWT-scoped hosted
  membership row now resolves the current member before the exact household
  access roster is checked.
- Added `probe-failed`, a visible **Try again** action, and hook-level retry
  coverage. Unknown RPC/network failures no longer masquerade as missing Auth
  or a missing partner.
- Checking renders the calm Chapter 2 task rather than an Auth error. Revoked
  current access has self-directed copy; missing-partner copy still names the
  missing partner only.
- Live UX QA used the real `OnboardingChat` component with synthetic adapters:
  success, checking, retry-to-success, revoked current access, missing Auth,
  missing partner, offline cache, and unresolved multi-household scope. It was
  inspected at 320x760, 390x844, 720x900, and 1100x900. No horizontal overflow;
  primary controls were 48 px high and the stop control 44 px; focus moved
  Hercules → primary action → stop and wrapped in both directions; retry kept
  focus when it became Next; blocked updates exposed a polite status region;
  forced-colors stayed legible; reduced-motion computed to zero-duration; text
  contrast was 17.16:1 ink/card, 6.16:1 pine/card, and 5.17:1 muted/paper.
- The browser pass caught and fixed misleading `configuration` provenance:
  Chapter 2 now says **The household** / **From live household access.** It also
  added calm, exact offline and multi-household guidance.
- Verification after repair: TypeScript passed; focused repair/lifecycle suite
  167/167; all onboarding tests 273/273; `git diff --check` clean. The final
  Medium-High quick gate is run against the amended exact tree before handoff.
