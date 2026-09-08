# Hearth worksession — canonical Fund horizon

- Status: LOCALLY VERIFIED
- Owner / decision owner: Jonathan; assignee Codex
- Branch: codex/mobile-sc2-fund-horizon
- Base:4c070cf85b2e5d823a7eed19503093a5354922db (SC01, draft PR379)
- Origin/main last refreshed:6fb15c7a98f3336862bb743b836aa96a358a35b9
- Risk: High; Budget(5)+3; Engagement(3)0
- Environment: fictional local command-built fixtures only

## Outcome and boundary

Extract the exact existing future movement ordering/accumulation so monthly FundWalk and FundWalkWith outputs remain unchanged. Prepare a separate inclusive31-day horizon from one accepted anchor, enumerating every touched month, including Jan31–Mar2. October1 rent appears once. Old outstanding purchases carry at the anchor once; monthly clipped shortfall ties cannot detect their omission. Buffer amounts retain their month identity.

Refuse unsupported future settlements, kitty movements, refunds and reversals that affect undated position readers, even beyond the selected horizon. Refuse goal claims that cumulatively exceed the unchanged remaining target. No date promises, fake contributions or scenario elections in this slice. The separate horizon is not labelled as the monthly register or current Ask.

## Proof plan

Six pre-refactor command-built households and exact ordinary/what-if outputs captured before editing fundWalk (`test/fixtures/fund-walk-parity.json`). Deep output equality; accepted input unchanged; cross-month bills, middle-month inclusion, same-day canonical order, carried partial settlement, future fact refusals, goal exhaustion and month-specific buffers. Independent trust review and High change-focused gate. No UI or hosted change.

## Review and regression evidence

- Independent audit first passed27/27, then found a future goal-progress defect: a November contribution reduced the September goal claim through undated savedCents. A command-built pre-fix regression failed (`horizon` instead of refusal). The guard now checks active Shared goal recurrence identities before emission, including full claim suppression. Final independent29/29 passed with no remaining blocker.
- Mutation proof: reversing the shared same-day comparator made the focused case fail with[-5000,2000] instead of[2000,-5000]. Original comparator restored before verification.
- First quick gate failed TypeScript in94.095seconds on a test's optional fundEvents spread. The test now handles an empty optional array. Final gate follows.
- No UI, browser, physical-device, hosted, exhaustive, merge or deployment evidence is claimed. The horizon is neither spendable cash nor the current Ask.

## Final local gate

High quick gate67 assertions, TypeScript, AI surface and diff hygiene passed in162.870seconds; no five-minute breach. Fingerprint before doc closure:`ec952ce94c68faa929a9a715123784c99e04b49e3be1fe80b7cb33b778b58079`.

Command:`pnpm test -- --risk=high --base=4c070cf85b2e5d823a7eed19503093a5354922db --focus=test/fund-horizon.test.ts --focus=test/fund-walk.test.ts --focus-reason="Preserve exact existing monthly walks while folding one accepted anchor through every inclusive horizon month, conserving old claims, daily order and source identity without inventing future settlements"`.

Six frozen command-built fixture households retain exact pre-refactor ordinary and what-if outputs. New horizon fixtures prove168500−58600−165000=−55100throughOctober1. The monthly September output remains109900 and the accepted anchor168500. Next owner: Codex opens the separate draft PR, then SC03 accepted cash capacity and explicit availability assumptions.
