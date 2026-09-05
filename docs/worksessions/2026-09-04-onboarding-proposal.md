# Hearth worksession — deterministic first-plan proposal

- **Status:** CLOSED; LOCAL HIGH-GATE + BUILD VERIFIED
- **Opened:** 2026-09-04 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/21-proposal`
- **Baseline SHA:** `5941d50f395ccbc7ed13c8fdfd5463b0a906628b`
- **Head SHA:** working tree
- **PR or issue:** none
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none; pure local projection over synthetic Development fixtures

## Household outcome

Hearth turns the two authored category guesses into one reproducible first-plan
proposal. It can only raise a category to a valid recurring-obligation floor or
eligible observed run rate; it never lowers or redistributes an amount.

## Budget delta (5)

`+2` — the accepted household inputs now produce a cents-exact first-plan
candidate whose source can be checked again before approval or adoption.

## Engagement delta (3)

`+1` — each person's guess remains visible as authored input while the household
gets one calm result. This core slice adds no rendered surface.

## Verified baseline

- Fresh isolated worktree started from clean
  `origin/main@5941d50f395ccbc7ed13c8fdfd5463b0a906628b`, after Slice 20 merged in
  PR #342.
- The no-diff quick gate passed diff hygiene, AI-surface verification, and
  TypeScript in 35.0 seconds with no selected tests.
- The current repository manual includes the accepted-capacity revision repair
  added by the Slice 0 reconciliation. The older Downloads copy does not.
- The manual's digest list required submission ids/revisions but its displayed
  proposal type did not carry them. The local contract snippet now names the
  minimal `ProposalSource` that its own digest and `ask.ts` source precedent require.
- No accepted capacity fact exists in the current household model, so the built
  proposal reports both capacity fields as `null` instead of inventing one.

## Scope

### In scope

- The pure deterministic proposal formula and reproducible source digest.
- Two authored estimate inputs with missing distinct from answered zero.
- Exact Shared recurring floors and eligible category run-rate raises.
- Current submission identity/revision and merged category-set binding.
- Explicit absent capacity and future capacity-revision digest binding.
- Permutation, stale, new-category, privacy, arithmetic, and source-fence proof.

### Out of scope

- Proposal editing UI, approval commands, plan adoption, accepted budget writes,
  transactions, journal rows, Fund events, contribution guidance, schema,
  hosted rows, Auth/RLS, providers, model calls, secrets, Production, push, PR,
  merge, deployment, or hosted-live proof.

## Acceptance evidence

- [x] Both estimates use a cents-exact half-up mean; one remains one; none is zero.
- [x] A valid Shared recurring obligation is a hard lower bound.
- [x] Run rate raises only after the existing minimum observation window.
- [x] Twenty input permutations produce the same ordered rows and digest.
- [x] Missing, zero, disagreement, stale revision, and newly added categories are defined.
- [x] Capacity amount and source revision are jointly absent or jointly digest-bound.
- [x] Personal recurrences do not enter the household floor.
- [x] The core source contains no forbidden comparison or adjustment vocabulary and no model call.
- [x] High quick gate, build, AI verification, and independent review are green.

## Plan

- [x] Verify current main, exact Slice 21 contract, and no-diff baseline.
- [x] Implement the pure source-carrying proposal and deterministic digest.
- [x] Add focused and adjacent formula/source/privacy tests.
- [x] Run final High gates, review the exact diff, and close the handoff.

## Evidence log

- Focused Slice 21 proof passed 13/13 tests.
- Slice 21 plus adjacent estimate, category, recurrence, and run-rate proof passed
  61/61 tests.
- The final High quick gate passed in 65.7 seconds: 44 fast tests plus 7
  serial PGlite proof tests, TypeScript, AI-surface verification, and diff
  hygiene. Fingerprint:
  `9756f0f3061c3bd8ed54cc05298a33e8906add974fddef99ddcfc11b4ddfc617`.
- Production build passed TypeScript, 470 Vite modules, Hercules Pro UI, and the
  no-`dist/_redirects` fence. Only the existing PGlite browser-external/eval,
  dynamic-import, and large-chunk warnings appeared.
- Independent High-risk review first found missing direct digest validation,
  incomplete two-seat provenance validation, unsafe maximum-cent averaging,
  and a non-cryptographic approval fingerprint. The repair recomputes the
  frozen formula before hashing, requires both exact source members, handles
  `Number.MAX_SAFE_INTEGER`, and uses browser-safe SHA-256. Re-review found no
  remaining P0-P2 blocker and matched boundary-length and Unicode digests to
  Node crypto.
- `pnpm check:windows` could not start because this macOS host has no `pwsh`;
  no Windows result is claimed.
- No component or stylesheet changed. There is no rendered browser surface in
  Slice 21, so viewport or live-browser UX proof is not applicable.

## Decisions

- D-221: the first plan is deterministic and floor-respecting.
- `buildProposal` carries the two current estimate submission ids/revisions and
  merged category ids because `proposalDigest` cannot reproduce those facts by
  rereading a later mutable household.
- Capacity remains absent until a separate accepted fact and revision exist.

## Remaining uncertainty

- The household model does not yet contain an accepted capacity fact. Slice 21
  makes that absence explicit; a later slice must not infer capacity from cadence,
  income history, account balances, or the Fund.
- Hosted two-account delivery and approval/adoption behavior belong to later
  slices and are not authorized here.

## Handoff

Local implementation and proof are complete. Push, PR, merge, deployment,
hosted mutation, and Production remain separate decisions.
