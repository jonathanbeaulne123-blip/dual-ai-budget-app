# PR #83 independent review and roadmap truth cleanup

**Status:** Follow-up implemented from current `main`. No merge, deploy, hosted schema, Worker secret, cloud row, or household data changed.

## Review outcome

PR #83 correctly scoped briefing aggregates, notices, the recent ledger excerpt, goals, shifts, and Hercules memories. Independent adversarial review found one material escape: `composeHerculesChatRequest` accepted a grounded answer that had already been calculated from the full household. Questions such as “show me the income statement” could therefore place a partner-personal derived total in `grounded` and `figures` even though the original direct-amount canary passed.

The follow-up rebuilds grounded copy and allowed figures from `householdForAiDisclosure` inside the outbound composer. The regression proves the full and member-scoped P&L differ, then requires the payload to use only the member-scoped answer and figures.

## Roadmap cleanup

- Records the merged #61/#63 salvages and merged #83 review state.
- Keeps #62's budget editor explicitly unshipped because it is absent from current `main`.
- Marks completed GitHub 2FA truthfully.
- Replaces stale pre-continuity language with the implemented D-114/D-117 Development path and its remaining CAS/two-device gap.
- Resolves the D-120 collision: Office keeps D-120; the merged PR #79 chat limiter is D-121.
- Removes the unimplemented claim that delayed replies are already invalidated; D-116 remains open.
- Replaces the trust-foundation “local/not pushed” handoff with merged PR #71 truth.

## Verification

- Focused Hercules/disclosure suites: **3 files, 31 tests passed**.
- Full serial repository suite: **53 files, 381 tests passed**.
- TypeScript `--noEmit`: passed.
- Production Vite build: passed with the existing PGlite browser-external/eval and chunk-size warnings.

## Dual Course

- **Budget delta (5): `+1`.** A partner-personal derived financial total can no longer ride to the model through grounded copy.
- **Engagement delta (3): `0`.** No visible Hercules or Office behavior is added; the same member-appropriate grounded answer remains available.
- **Why Dual Course holds:** the correction strengthens the books/privacy boundary without adding friction or a second command path.
