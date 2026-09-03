# Hearth worksession — Register and Ask slice 11

- **Status:** SEALED — PR PREPARATION
- **Opened:** 2026-09-02 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `register/11-ceiling`
- **Baseline SHA:** `eb2a1a87c0b5f57eb414710e4e1e766d3ab92ccc`
- **Head SHA:** `42f606b622e80bb748ed4ac1268970e5c7871cff` (independently reviewed functional candidate)
- **PR or issue:** pending at local seal
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

The Charter ceiling restrains which Ask routes Hearth offers and how it orders them without changing a proposed amount, posting money, or erasing the underlying route record.

## Budget delta (5)

`+2`: the household's recorded ceiling now constrains an existing work projection, while Confirm and integer-cent books remain unchanged.

## Engagement delta (3)

`+2`: Ask calmly explains when a route crosses the household's own agreement and opens the existing other door when every route does.

## Verified baseline

- Fact: isolated worktree is clean on `register/11-ceiling` at exact `origin/main` SHA `eb2a1a87c0b5f57eb414710e4e1e766d3ab92ccc`.
- Fact: Charter ceiling values, Ask route generation, Ask presentation, and the current weekly Ask document already exist on the baseline.
- Fact: the primary `codex/roadmap-site` checkout is dirty and is not used for this slice.
- Inference: current weekly-document presentation must share the ceiling gate so current canon does not expose an offer that the main Ask correctly withholds.

## Scope

### In scope

- Charter-only hours-per-ISO-week and amount-per-month ceiling verdicts.
- Ceiling-aware deterministic route ordering.
- Per-route calm ceiling copy and the all-routes-over alternate-door state.
- The same presentation gate in the current weekly Ask document while retaining its route result.
- Deterministic tests, decision record, verification, local commit, branch push, and PR.

### Out of scope

- Default or invented ceilings, prompts to create a Charter, proposed-amount changes, automatic work or money commands.
- Schema, hosted data, Development/Production mutation, secrets, provider configuration, merge, deploy, or later Register/Ask slices.

## Acceptance evidence

- [x] No Charter and `none` Charter preserve prior route behavior with `none` verdicts.
- [x] A 24-hour weekly ceiling marks 15.5 hours within and 31 hours over.
- [x] ISO-week grouping judges a Sunday/Monday 12/8-hour split within a 16-hour ceiling.
- [x] Amount ceilings compare conservative route cents without trimming the proposal.
- [x] Clearing within-ceiling routes lead clearing over-ceiling routes, which lead non-clearing routes.
- [x] Every route over ceiling hides route drawings/offers, retains route records, and exposes the exact alternate-door copy.
- [x] Focused tests, full checks, diff hygiene, source fence, and independent review are green.

## Plan

- [x] Reconcile the dated Slice 11 packet with current canon and code.
- [x] Implement the pure ceiling verdict and ordering contract.
- [x] Integrate Ask and weekly-document presentation.
- [x] Add deterministic and UI/source-fence tests.
- [x] Run focused/full verification and independent review.
- [x] Seal exact evidence and commit the local candidate.
- [ ] Push and open the named PR; merge and deploy remain out of scope.

## Evidence log

- 2026-09-02: fetched current `origin/main`; created isolated branch/worktree at `eb2a1a87c0b5f57eb414710e4e1e766d3ab92ccc`; clean status confirmed.
- 2026-09-02: reconciled the manual's occupied decision id with current canon; next free canonical id is D-201.
- 2026-09-02: focused Ask/weekly verification passed: 5 files, 37 tests; TypeScript passed.
- 2026-09-02: `pnpm check:windows` passed AI-surface verification, 1,598 fast-lane tests with 2 skips, 154 serial books/PGlite tests with 1 skip, TypeScript, production build, and Hercules Pro UI build. Total: 1,752 passed, 3 intentional skips.
- 2026-09-02: post-accessibility-repair focus passed 16 tests and TypeScript. The repair added ceiling copy to the existing role-image accessible summary; it changed no route, money, or authority behavior.
- 2026-09-02: `git diff --check` passed; changed-file secret scan passed; only `.env.example` is tracked among environment files.
- 2026-09-02: local Chrome opened the Development demo at `http://127.0.0.1:5176/`. The seeded Ask was already covered, so this is startup/layout evidence only and is not claimed as an all-over ceiling screenshot.
- 2026-09-02: candidate `42f606b622e80bb748ed4ac1268970e5c7871cff` committed with an 11-file bounded diff.
- 2026-09-02: independent books review passed with no P0–P2 finding; fresh focused run passed 37 tests.
- 2026-09-02: independent privacy/fail-closed/UI review passed with no P0–P2 finding; fresh focused run passed 37 tests and the reviewer independently completed `pnpm check`.
- 2026-09-02: independent acceptance verification passed functionally; fresh 29-test run, ancestry, diff hygiene, and secret scan passed. Its only P2 was this worksession's stale pre-implementation status; this seal repairs that durable truth.

## Decisions

- Use ISO Monday week buckets for the hours ceiling; do not divide or average a route across its full horizon.
- Use the route's conservative `safeCents` for an amount ceiling.
- Preserve `AskRoutesResult.routes` when every route is over; presentation alone withholds the route offer.

## Remaining uncertainty

- P3: the weekly-document all-over branch has projection coverage and a direct simple render guard, but no state-driven rendered DOM assertion. The main Ask all-over branch has a rendered DOM assertion.
- Browser screenshots at 320/390/720/1100 and a manual reduced-motion pass were not collected. This slice adds no animation or responsive mechanism; existing horizontal scroll/focus behavior remains covered by the Ask UI suite.
- `routeCeilingVerdict` validates its `from` date; current Ask and weekly callers constrain the route to the target month's `throughDate`. A hypothetical direct cross-month caller is not separately tested.

## Handoff

Local seal: branch `register/11-ceiling`; functional candidate `42f606b622e80bb748ed4ac1268970e5c7871cff`; this evidence repair is documentation-only and follows it. The code is independently reviewed and ready to push and open the named PR after a fresh `origin/main` compatibility check. Nothing is merged or deployed; no hosted, Production, schema, provider, or secret mutation occurred. Next owner: Codex opens the PR and stops.
