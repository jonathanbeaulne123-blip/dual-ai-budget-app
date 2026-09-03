# Hearth worksession — Register and Ask slice 11

- **Status:** OPEN
- **Opened:** 2026-09-02 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `register/11-ceiling`
- **Baseline SHA:** `eb2a1a87c0b5f57eb414710e4e1e766d3ab92ccc`
- **Head SHA:** `eb2a1a87c0b5f57eb414710e4e1e766d3ab92ccc`
- **PR or issue:** pending
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

- [ ] No Charter and `none` Charter preserve prior route behavior with `none` verdicts.
- [ ] A 24-hour weekly ceiling marks 15.5 hours within and 31 hours over.
- [ ] ISO-week grouping judges a Sunday/Monday 12/8-hour split within a 16-hour ceiling.
- [ ] Amount ceilings compare conservative route cents without trimming the proposal.
- [ ] Clearing within-ceiling routes lead clearing over-ceiling routes, which lead non-clearing routes.
- [ ] Every route over ceiling hides route drawings/offers, retains route records, and exposes the exact alternate-door copy.
- [ ] Focused tests, full checks, diff hygiene, source fence, and independent review are green.

## Plan

- [x] Reconcile the dated Slice 11 packet with current canon and code.
- [ ] Implement the pure ceiling verdict and ordering contract.
- [ ] Integrate Ask and weekly-document presentation.
- [ ] Add deterministic and UI/source-fence tests.
- [ ] Run focused/full/visual verification and independent review.
- [ ] Seal exact evidence, commit, push, and open the named PR.

## Evidence log

- 2026-09-02: fetched current `origin/main`; created isolated branch/worktree at `eb2a1a87c0b5f57eb414710e4e1e766d3ab92ccc`; clean status confirmed.
- 2026-09-02: reconciled the manual's occupied decision id with current canon; next free canonical id is D-201.

## Decisions

- Use ISO Monday week buckets for the hours ceiling; do not divide or average a route across its full horizon.
- Use the route's conservative `safeCents` for an amount ceiling.
- Preserve `AskRoutesResult.routes` when every route is over; presentation alone withholds the route offer.

## Remaining uncertainty

- Exact responsive visual evidence remains to be collected after the deterministic contract is green.

## Handoff

Pending implementation. The branch is local only; nothing is merged, deployed, or manually verified.
