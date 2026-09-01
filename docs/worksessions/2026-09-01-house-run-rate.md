# Hearth worksession — Household Fund run rate

- **Status:** CLOSED
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `C:\Users\jonat\OneDrive\Documents\ChatGPT\Budget App`
- **Writer worktree:** `C:\Users\jonat\AppData\Local\Temp\hearth-register-4-run-rate`
- **Branch:** `codex/register-4-run-rate`
- **Baseline SHA:** `b7bdcf1db712f80e24054a7ebe6eee2abf5bdf3d`
- **Head SHA:** branch head recorded in the release handoff
- **PR or issue:** pending
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

Hearth waits for three complete weeks of actual Household Fund purchases before offering a monthly household-cost reading, states whether the evidence is provisional or settled, and never turns that reading into a person-level contribution instruction.

## Budget delta (5)

`+3` — the household gets an evidence-based monthly need and an observed low/high range without introducing another balance or allocation formula.

## Engagement delta (3)

`0` — this slice is a pure core projection with no interface or interaction.

## Verified baseline

- Clean isolated worktree at merged and deployed `main@b7bdcf1db712f80e24054a7ebe6eee2abf5bdf3d`.
- Register Slice 3 is merged; its purpose labels remain provenance only.
- Slice 4 depends on the merged Slice 2 register but adds no allocation or Ask arithmetic.
- The supplied manual calls its decision D-178, but current canon already assigns D-178 to UI Performance P2. This work uses a D-161/D-173 why-note instead of reusing the number.
- The supplied build manual and UX packet are implementation references for Jonathan's request, not independent authority to mutate hosted data, schema, secrets, or Production household data.

## Scope

### In scope

- Observe complete seven-day windows from the Fund opening date.
- Count only active net `purchase-funded` / `refund-funded` facts through the end of the latest complete window.
- Refuse every monthly extrapolation below three complete weeks.
- Annualise the observed weekly mean and derive low/high from the actual weekly minimum and maximum.
- Aggregate visible Shared purchases by category while redacting Personal or unavailable transaction provenance.
- Return only a household-level need suggestion with the exact confidence copy from the supplied manual.
- Export the pure projector and add focused tests plus a decision why-note.

### Out of scope

- Any person split, contribution target, fairness ratio, allocation, obligation, Ask, route, command, writer, UI/CSS, schema, hosted row, Auth/RLS, provider, secret, or Production household mutation.

## Acceptance evidence

- [x] One complete week returns `watching`, zero extrapolated monthly values, and no suggestion.
- [x] Five complete weeks return a provisional actual-spend reading, observed spread, category rows, and household suggestion.
- [x] Ten complete weeks return a settled reading.
- [x] Contributions, unfunded purchases, plans, and incomplete weeks cannot enter the cost calculation.
- [x] Refunds reduce the original funded position and Personal category provenance is redacted.
- [x] Malformed Fund facts fail closed before any early `watching` return.
- [x] No copy says `should contribute` or `you need to put in`.
- [x] Focused tests, full gate, TypeScript, builds, diff check, and independent financial/release reviews pass.

## Plan

- [x] Pin the exact merged Slice 3 baseline and open a separate writer worktree.
- [x] Implement the smallest pure run-rate projection and focused contract tests.
- [x] Run focused and full verification.
- [x] Obtain independent books and release reviews.
- [ ] Commit, push, PR, merge, deploy, and verify the exact live release under Jonathan's explicit authorization.

## Evidence log

- Baseline `main@b7bdcf1db712f80e24054a7ebe6eee2abf5bdf3d` was confirmed by `git ls-remote`; Slice 3 PR #276 and its Cloudflare production deployment passed before this worktree opened.
- Initial focused verification passed `40/40`. Independent books review found that the missing/malformed-config early return preceded the Fund integrity guard. Validation now runs first and two adversarial tests prove malformed facts cannot appear as a benign watching result.
- Repaired focused verification passed `41/41`; the first repaired full Windows gate passed AI surface verification, `221` test files with `1,522` tests (`2` files / `3` tests skipped), TypeScript, production Vite, Hercules Pro UI, and the redirect guard.
- Independent financial and implementation reviews returned PASS with no remaining P0/P1/P2 findings. Existing PGlite browser-build and React `act(...)` warnings remained non-failing and outside this slice.

## Decisions

- Observation age uses complete seven-day windows anchored to `householdFund.openedOn`; partial weeks never create or alter an annualised result.
- Net Fund cost is reconstructed from append-only purchase/refund lineage as of the observation cutoff. Contributions and other Fund movement are not household cost.
- Weekly minimum and maximum are the observed spread; no fixed confidence percentage is invented.
- Personal or unavailable transaction provenance is aggregated only as `Household purchase`.

## Remaining uncertainty

- No product uncertainty remains in this bounded core slice. The run-rate does not yet have a UI; later Register & Ask slices consume it.

## Handoff

Slice 4 implementation and local verification are complete. Jonathan explicitly authorized push, merge, and the ordinary GitHub-main kitchen deployment. Those release actions remain pending at this worksession close; no hosted-data action, schema action, secret change, or Production household mutation is part of the release.
