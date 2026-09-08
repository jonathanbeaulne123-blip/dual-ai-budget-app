# Hearth worksession — recorded cash and explicit availability assumptions

- Status: LOCALLY VERIFIED
- Owner / decision owner: Jonathan; assignee Codex
- Branch: codex/mobile-sc3-cash-availability
- Base:9c27a782511fe2c2e9f66bac91232fa75082c49d (SC02, draft PR380)
- Refreshed origin/main:6fb15c7a98f3336862bb743b836aa96a358a35b9
- Risk: High; Budget(5)+3; Engagement(3)+1
- Environment: local fictional accepted command fixtures only

## Outcome

Read owned active cash account capacity from accepted Personal books, with an explicit readiness marker. Missing Personal books remain unavailable; a validated empty envelope remains distinguishable. Shared horizon and own source digests cover the actual model reads beyond the accepted financial receipt's narrower hash.

No current source can establish verified remaining cash after Fund contributions, because those do not debit/identify the contributor account. An explicitly acknowledged available-cash assumption is therefore required; recorded capacity is never renamed available money. Goal savings are excluded. Known unpaid deferred tip-outs reduce member-wide net cash capacity once, including archived jobs. Immediate and paid tip-outs remain in account balances and are not subtracted again. Unknown legacy timing is declared. Future payments with undated paid counters refuse. Duplicate account aliases cannot create new capacity. Fixed elections conserve tranche and account amounts across all dated choices.

The public resolver recomputes sources rather than trusting UI arrays. No current Fund/Ask change, command, storage, fake contribution, schema or network operation. This stage supports fixed choices; SC04 forecast availability and SC05 explicit up-to composition follow. App scope/readiness threading is a later consumer task, not claimed here.

## Required evidence

46-dollar boundary, spent/reversed cash, duplicate accounts/elections, changed metadata/digests, other-member refusal, missing versus empty books, archived liabilities, immediate/paid deduction once, future-payment refusal, input immutability and zero network. Independent trust review and focused High quick gate.

## Independent review repairs

The initial quick gate passed81 assertions in185.726seconds, fingerprint`6d40cf8699b44651442231f7c72bc927f73e20c8565f340dc3f0f8d990746274`, with no breach. Review then identified missing source refusals; that earlier result is not final proof.

- Paid counters are undated and not linked to payment transactions. Reversal, duplicate marking or missing payment evidence can restore cash while leaving a paid counter. The resolver now requires a necessary aggregate match to recognized own manual tip-out expenses and refuses contradicted/missing evidence. This never becomes proof of source attribution; remaining cash still requires explicit acknowledgement.
- Known deferred cents remain reserved even if a legacy job link or paid counter is missing. Missing paid means no proven payment, not erased liability.
- A future shift reversal removed today's deferred liability before the future cash reversal. The real command-built regression failed pre-fix (source-review instead of source-remaining-unknown). Raw own shift reversal evidence is now checked for future dates, recognition and reversal chains before the undated Work reader.
- Strict availability dates, CAD-only capacity and every cumulative net-cash addition are validated.
- Independent final source review found no remaining blocker and reran20/20 cases. Final quick gate follows.

## Final local gate

High quick gate88 assertions, TypeScript, AI surface and diff hygiene passed in241.261seconds, no five-minute breach. Fingerprint before doc closure:`82dbe417c49b4e2629ffe99a3212681c17129cae1a8695a7814bc6b885ad3e59`.

Command:`pnpm test -- --risk=high --base=9c27a782511fe2c2e9f66bac91232fa75082c49d --focus=test/scenario-cash.test.ts --focus=test/fund-scenario-contract.test.ts --focus-reason="Keep historical receipts separate from current owned cash capacity, require explicit remaining-money assumptions, and conserve fixed elections across dates, liabilities and shared account aliases"`.

No UI or browser surface; no physical-device, exhaustive, hosted, merge or deployment claim. Next owner: Codex opens the separate draft PR then continues SC04 source-supported forecast availability and route cardinality. The App acceptance/readiness marker and all consumers remain subsequent work.
