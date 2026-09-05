# Worksession — Onboarding Slice 24: first plan

**Date:** 2026-09-05

**Branch:** `onboarding/24-ch11-plan`

**Base:** `origin/main@6056cceedebb9a4611e7f5c70c45c1105e562e4d`

**Risk:** Medium

**Environment impact:** local Development UI and deterministic command presentation only

## Goal

Deliver Chapter 11 as a calm, inspectable first-plan review: show both authored estimate sets without comparing the members, every recurrence and run-rate basis, the exact proposed cents, self-owned approvals, and an explicit atomic adoption action.

## Product deltas

- Budget delta (5): **+2** — the already-authoritative proposal and adoption boundary become legible before either member approves.
- Engagement delta (3): **+3** — Hercules turns the first plan into a warm shared ceremony with honest waiting, revision, failure, and completion states.

## Scope

- Add the pure Chapter 11 presentation projector and Plan surface.
- Route Chapter 11 from Hercules and prevent a premature Next action.
- Require a current-month adoption receipt and active matching plan rows for completion.
- Make estimate edits create a new proposal digest and visibly retire old approvals.
- Add focused contract, component, copy, responsive, and browser proof.

## Non-scope

- No new proposal formula or capacity field.
- No direct editing of computed proposal amounts.
- No Ask, route-planning, or work-time content.
- No journal, transfer, Fund, schema, provider, hosted-data, secret, Production, push, merge, or deploy change.

## Acceptance gates

- [x] Default first-run render names the absent run rate honestly.
- [x] Every proposed number shows its authored inputs, recurrence anchors, eligibility, basis, and exact result.
- [x] Each member controls only their own approval.
- [x] Editing warns first, creates a new submission revision/digest, and visibly resets current approvals.
- [x] Adoption is explicit, atomic, recovery-aware, and current-month evidence is fail-closed.
- [x] Four-breakpoint browser pass, keyboard pass, accessibility checks, focused tests, build, and Medium quick gate pass.

## Closeout

**CLOSED; LOCAL QUICK-GATE + BUILD + UX VERIFIED.** Implementation commit
`5730361d5ff214202c55eff5a951cc70a43d3006` is rebased onto current
`origin/main@6056cceedebb9a4611e7f5c70c45c1105e562e4d`.

- Slice 24 component proof passes 16/16. The six-file independent review lane
  passes 96/96, and the full 27-file onboarding suite passes 426/426 on the
  final code.
- The exact clean implementation SHA passes the Medium quick gate in 122.1 s:
  119 fast tests plus 7 serial PGlite proof tests, TypeScript, AI-surface
  verification, test discovery, and diff hygiene. The production build passes
  at 475 Vite modules plus Hercules Pro UI.
- Actual-component Chromium proof at 320, 390, 720, and 1100 px reports no
  horizontal overflow, no control below 48 px, no console or page errors, and
  zero scoped axe WCAG A/AA violations. Keyboard Enter opens the edit path;
  invalid input is visibly and programmatically tied to its field. Mobile and
  desktop screenshots were visually inspected. Temporary QA files were removed.
- Independent exact-SHA review reports no remaining P0-P2 finding. It drove
  current-plan approval binding, command-boundary month derivation,
  accepted-but-unsaved recovery copy, receipt provenance, visible recurrence
  arithmetic, and edit-field accessibility repairs.

Residual uncertainty: this is synthetic local Development proof, not a
full-repository, Windows, hosted two-account, deployment, or Production claim.
PowerShell is unavailable on this macOS host, so no Windows result is claimed.
Jonathan authorized push and merge after this proof. Deployment, hosted data,
schema application, secrets, and Production remain outside that authorization.
