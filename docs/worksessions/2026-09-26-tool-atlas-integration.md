# Tool Atlas integration — 2026-09-26

## State

Local branch `codex/tool-atlas-integration` merges the supplied `claude/tool-atlas` bundle head `6f7ff0f3` onto `main@9d43c120` in one merge commit (`8ead7e6c`). This includes the bundle's 80 commits (75 non-merge patches). It has not been pushed, merged into GitHub `main`, deployed, or tested with real household data. Risk: **High** because Record's ledger routing, month-close access, the shared/personal world boundary, and App navigation change.

## Reconciliation

Four files conflicted. `HarbourWorld.tsx` keeps current main's physical funicular/gondola boarding, ride offer and keyboard route while adding the Tool Atlas host panel and glass. `MountainPanel.tsx` keeps Atlas's Step in guide without restoring its retired Board and ride button; the physical station arrows remain the way to board. `house/navigation.ts` keeps current main's device-local return helpers and Atlas's names/targets. The ride focus test checks that combined behavior. Automatic merges in the scene runtime, flag, styles, package metadata and decision log were inspected.

Jonathan chose the Campfire **screen check for this merge**. The books close is not a hard two-person command lock; `closeBooksMonth` and `reopenBooksMonth` remain single-actor commands. D-302 records this explicitly. The existing Final Confirm boundary remains the authority for money movement.

## Verification on the merge

- `pnpm typecheck` passed (standalone and again inside the High-risk gate).
- Focused suites passed: 27/27 command fence, month-close door and Mine model tests; 59/59 Record, Mine UI and current ride tests; 84/84 App startup and month rehearsal tests.
- `fund-standing-book-dom` passed 18/18 on the merge and 19/19 on current main. The removed test covered the intentionally retired Fund ledge. Three failures in this suite appeared only during the four-worker High-risk run under severe memory pressure.
- `pnpm test --risk=high` was attempted. It selected 217 files and **breached its time budget** before completing its fast lane; the run was stopped after the Fund suite failures. It is not a passing gate. The host has 8 GiB of RAM and was heavily swapping. Rerun on a suitable runner, then use the exact result for merge readiness.
- The Tool Atlas Chromium acceptance spec was attempted for A5. Its setup timed out before any assertion because the fictional demo entry stayed on “Validating the local journal before entering…”. A separate rendered diagnostic reproduced that same stalled entry on `main@9d43c120` with a proper dependency install and loopback-only network. This is a baseline browser-harness/startup limitation on this host, not Atlas acceptance proof. The existing 59 screenshots are partial and predate the final fix pass.
- `git diff --check` passed; working tree clean after the merge commit. No hosted data, schema, credential, Production or deployment action was taken.

## Decision and next action

**No-go for GitHub main today.** The merge is available for review as one branch. It needs a completed High-risk gate and actual rendered acceptance at the named widths, themes and accessibility settings. Investigate the baseline demo-entry stall separately, then run the browser spec and visual checks against the merged commit. After those gates, push one PR for the combined change and review it before any Development deployment.

Budget delta (5): **+2 intended** — Record names and enforces its ledger, Bill paid remains Ours, and the month close has one Campfire UI door. Engagement delta (3): **+2 intended** — the same island and glass serve Ours and Mine, with the dock and tool search at home. These are implementation deltas, not live acceptance claims.
