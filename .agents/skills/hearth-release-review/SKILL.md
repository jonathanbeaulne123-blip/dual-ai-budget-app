---
name: hearth-release-review
description: Run Hearth's final evidence and safety review before merging, deploying, switching daily use, or accepting High/Release-risk work. Do not deploy or mutate Production.
---

# Hearth release review

1. Read `AGENTS.md`, the worksession, handoff, and relevant living decisions.
2. Confirm exact base/head SHAs, branch, PR, and environment.
3. Inspect the complete diff and affected execution paths.
4. Run `git diff --check` and the change-focused quick gate when locally available. Run `pnpm check:full` only when Jonathan explicitly requested full verification for the exact clean High/Release-risk SHA and the request has a recorded reference; otherwise record full evidence as absent.
5. Verify CAD integer cents, double-entry balance, Commands plus visible Confirm, transfer/split/reconciliation/retry/duplicate/stale-undo/network-failure behavior, environment separation, Auth/RLS boundaries, and absence of secrets/exports/private artifacts.
6. Verify relevant phone/desktop/accessibility/loading/error/empty/offline evidence.
7. Compare the result with acceptance criteria and both Dual Course deltas.
8. Return `PASS`, `CONDITIONAL`, or `FAIL` with exact evidence, quick-versus-full classification, and required next action. Quick evidence alone cannot establish release readiness.

Never merge, push, deploy, apply a migration, run `books:apply`, or alter household data. Jonathan is the release decision owner.
