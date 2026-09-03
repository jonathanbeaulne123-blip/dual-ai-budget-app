# Hearth verification gates

D-202 separates routine feedback from exhaustive release evidence.

## Quick gate — default

Use this for Medium, Medium-High, and High-risk implementation and review:

```powershell
pnpm test -- --risk=medium-high --focus=test/example.test.ts --focus-reason="Direct proof for the changed module"
```

`pnpm test` and `pnpm check` are equivalent quick-gate entry points. The runner records the merge base, `HEAD`, clean/dirty state, and a SHA-256 fingerprint of the complete working change; checks every diff; verifies the AI surface and TypeScript; discovers related tests; runs changed tests; and adds checked-in mappings plus canaries for money/command and continuity/Auth/privacy changes. An unrelated changed test does not prove an executable-source change. Ordinary selected tests use at most four workers; selected D-170 PGlite/heavy fixtures remain serial.

If Vitest reports more than twelve transitive tests, the gate requires an applicable domain canary, a checked-in entry in `test/verification-focus-map.json`, or an explicitly focused test with a recorded reason, then trims the transitive expansion. It reports that trimming; it never silently calls the full lanes. UI changes also print that relevant browser, viewport, keyboard, and accessibility evidence must be recorded separately.

Five minutes is a measured soft SLA. At five minutes the active phase is allowed to finish, but the result is `time-budget-breached` and must not be described as meeting the quick SLA.

## Full gate — explicit owner request only

Full verification is valid only after Jonathan explicitly requests it for an exact High/Release-risk `HEAD`:

```powershell
$env:HEARTH_FULL_AUTHORIZED_BY = "Jonathan"
$env:HEARTH_FULL_AUTHORIZATION_REF = "user-request:YYYY-MM-DD-short-description"
$env:HEARTH_FULL_RISK = "high"
$env:HEARTH_FULL_REASON = "Requested after the named High-risk task"
$env:HEARTH_FULL_SHA = git rev-parse HEAD
pnpm check:full
```

`pnpm test:full` runs the complete D-170 fast plus serial test lanes. `pnpm check:full` additionally runs AI verification and the production build. The runner refuses missing authorization or its reference, Medium/Medium-High risk, an empty reason, a non-exact SHA, a SHA that does not equal `HEAD`, or any dirty tracked/untracked worktree content.

GitHub runs the quick gate once for a pull request and once after accepted work reaches `main`. Feature-branch pushes do not start a second copy of the pull-request gate. `.github/workflows/full-verification.yml` is manual dispatch, checks out the exact requested SHA, requires the repository-owner actor plus a same-repository issue/PR/comment authorization reference, fetches that record through GitHub, and verifies it was authored by the owner and explicitly names both `full verification` and the exact SHA. It also targets the `full-verification` environment; configure that environment with Jonathan as required reviewer before relying on it. Quick-gate success may be called **quick-gate verified**; without authorized same-SHA full evidence it is not **fully verified** or release-ready.
