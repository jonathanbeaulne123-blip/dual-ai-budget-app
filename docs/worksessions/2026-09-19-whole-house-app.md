# Hearth worksession — the whole house becomes the app

- Status: PR HANDOFF — user-facing testing owned by Jonathan; acceptance remains open
- Opened: 2026-09-19 (America/Toronto)
- Owner and decision owner: Jonathan
- Integrator: Codex
- Repository: dual-ai-budget-app
- Branch: codex/whole-house-app
- Baseline: 4de2b28ea9663f635c3c769eef35617602b8f7ef (current main, refreshed 2026-09-19)
- Risk: High
- Environment impact: local web implementation and fictional validation only

## Outcome and authority

Jonathan explicitly approved implementing the complete whole-house plan in the real app, superseding the earlier standalone-only restriction. Personal and Household both use the house. Personal Together contains private wishes, making and memories; sharing creates a reviewed copy. Direct furniture interaction is primary, personal-avatar walking optional, and Hercules independent. The recording of From Plans to Memories V2 and Bloom V2 is the visual reference.

Budget delta (5): truthful, continuous object references and readable accepted facts with unchanged money authority. Engagement delta (3): connected architectural rooms, personal growth, meaningful making and kept history.

## Scope

One world owner; four rooms and twelve levels; three authored themes; distinct phone/desktop compositions; scoped history/draft return; Bloom Queen customization; existing real Books/Planner/Calendar/Plan/pottery/Hercules authorities; Personal life documents and reviewed sharing; stable correction-aware geography; funded, free and private journeys.

No deployment, service/provider activation, hosted schema application, live household mutation, Production or native work. PR #501's old recovery and acceptance are not resumed. Tests here prove the new changed candidate only.

## Work ownership

Root is the only writer in this integration checkout. Bounded Personal authority, Journey geography and house geometry slices use separate worktrees; root reviews and integrates their commits. No competing full builds or gates.

## Delivery and evidence

- [x] Owner-bound Personal life contracts, reviewed copies and exact-revision paths implemented.
- [x] Four-room/12-level navigation, scoped drafts and contextual return integrated into the actual app.
- [x] Three authored theme treatments and phone/desktop room compositions delivered for review.
- [x] Funded, free and private journeys exercised through fictional local commands; detailed limits in the packet.
- [x] Bounded independent privacy/financial and visual/accessibility reviews recorded.
- [x] High gate, required App/command regressions and web build run; failures and timing breach retained.
- [ ] Full green within-budget High gate.
- [ ] Full user-facing acceptance; Jonathan explicitly took this over at handoff.
- [ ] Hosted continuity, physical-device, native or release acceptance; not authorized here.

## Evidence and handoff

The web build passed on `7fac9972` in **212.809s**. TypeScript passed in **78.418s**. The change-focused High gate passed **1,512 tests** and failed **one Chapter browser assertion** that read fields before React committed a household remount; the actual App startup subset passed **83/83**. The gate exceeded its **300s budget**, taking **775.209s** wall time. It remains failed. The Chapter test now uses bounded polling for the actual remounted DOM; this final test-only correction was independently reviewed and was not rerun after Jonathan requested immediate PR handoff. The application trees (`src`, `workers`, `scripts`, `public`) are identical to the built/tested candidate. No full green gate is claimed. See the adjacent evidence JSON for exact hashes and outcomes.

The [durable review brief](../briefs/WHOLE_HOUSE_REVIEW_2026-09-19.md) and [exact evidence](../briefs/WHOLE_HOUSE_REVIEW_EVIDENCE_2026-09-19.json) describe the source and limits. The local packet is `/Users/jonathanbeaulne/Downloads/Hearth_Whole_House_App_Review/`; preview is http://127.0.0.1:4186/__review. Accepted fictional state survives review-server restart.

Jonathan requested wrapping up and creating a PR for a second opinion. No more broad/local UI test loops are part of this handoff. PR #501’s old recovery/activation remains parked. Publishing the branch and opening the PR does not authorize merge, hosted activation, deployment, Production or native work.
