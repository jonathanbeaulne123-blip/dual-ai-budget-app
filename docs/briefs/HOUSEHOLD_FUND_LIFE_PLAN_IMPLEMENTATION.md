# Household Fund: decisions for the life we choose

Status: Development release authorized by Jonathan's 2026-09-11 instruction, “push merge and deploy”; candidate verification and hosted checks precede merge. Local evidence: 418 tests in 36 files, enabled build and twelve component journeys pass. Verification details are recorded in the linked worksession. High risk. Decision owner: Jonathan. Integration owner: Codex; independent read-only financial and privacy reviewers.

## Outcome and baseline

The four Plan lenses now have distinct decision journeys. They share a dated consequence engine, exact agreement contracts and the existing financial action authority. A person can connect a promise to evidence, rehearse a change, compare an alternative, learn why it matters and review the chosen action.

- Repository: `jonathanbeaulne123-blip/dual-ai-budget-app`.
- Implementation branch: `codex/fund-life-plan`.
- Base: `71ccc242bd44bed60ccc5eb8c8865ecd852f76c6`, verified `origin/main` at task start, including PR #433 and subsequent #434–#436 work.
- Authority: Jonathan's explicit implementation request, `docs/CLOUD_CONTINUITY.md`, and D-242. The vision document is unchanged.
- Why now: #433 established private drafts, immutable versions and independent agreement; the next useful step is making those agreements explain real choices.
- Budget delta (5): one evidence calculation for supported coverage, payments, reserves, dated capacity and purchase decisions.
- Engagement delta (3): four different rehearsals, contextual learning and private coaching, resumable shared decisions and practical responsibilities.

## Delivered journeys

| Surface | Working behavior |
|---|---|
| Protect | Choose a visible obligation, date, responsibility and current/expected funding basis. Rehearse late or reduced income, higher protected costs and an unexpected expense. See the first exposed commitment and open contextual Hercules recovery guidance or a reviewed action. |
| Prepare | Discover costs from visible accepted bills, Calendar estimates/events, last-year purchases and guided life prompts. Keep suggestions as hypotheses. Link an existing reserve goal, enter a target/range/deadline, calculate exact contributions on explicitly chosen paydays and apply this month's schedule to the private draft. |
| Build | Link an existing goal, target, time constraint and practical next step. Compare a smaller monthly contribution or later dates; edit the alternative and promote it into reviewed draft work. Existing goals and their accepted funding retain authority. |
| Everyday | Rehearse amount and date. Show the amount available, what remains, dependence on expected money and an explicit smaller amount/timing/reallocation choice. Already accepted future purchases reduce remaining flexibility. |
| Overview / Scenario Lab | Show current money, lowest dated capacity and its date, current versus projected Everyday flexibility, first exposure and unresolved assumptions. Compare working draft and an editable private alternative. |
| Bridge | Contribution, responsibility, constraint, goal and range/date offers retain deliberate disclosure and exact review. Shared recipients do not receive the private evidence behind the offer. |
| Learn | Explain, show visible evidence, provide a safe experiment and an optional understanding check. Selection considers the decision and learning history. Completion records remain explicit. |
| Reflection / History | Search visible evidence, preserve signed actuals, save version-bound outcomes and actor notes. Inspect immutable decisions, reasons, acknowledgements and reopening conditions. |
| Sitdown | Private preparation is saved separately. Shared stage checkpoints, chosen talking points, decisions and rhythm resume through existing continuity. Closure binds an independently acknowledged exact Plan. A closed Chapter remains closed until an explicit next Sitdown. |
| Fund shell | Shared Home connects to the active agreement; Our Money retains the financial surface; Our Path opens Plan; Together connects accepted next steps to the shared boards. Calendar, work and settings remain reachable. Personal navigation remains separate. |

## Numerical interface and meaning

`src/core/planProjection.ts` exports `projectPlan(household, input)` with member, scope, accepted revision, as-of date, through date and an explicit version/draft/scenario selection. It is pure and does not write accepted books. Invalid/stale/inaccessible evidence returns an unavailable result or a visible unresolved intention, never a fabricated safe amount.

The result carries intended amounts, signed matched actuals, historical goal progress, current backed reserves, remaining need, current/expected coverage, gaps, dated capacity, low points, first exposure, source revision and assumptions. UI, Plan read tools and purchase rehearsals use this same result.

Shared capacity reuses `prepareFundHorizon` and `foldFundMovements`. Personal capacity uses accepted cash accounts and the canonical journal; goal vaults remain separate. The normal Fund scenario horizon remains unchanged. Plan explicitly permits a horizon up to 366 inclusive days.

Coverage is an allocation within the Plan. It does not freeze bank money, contribute to the Fund or pay a bill. The aggregate current Personal cash/Fund capacity is the identified current-money source; dated expected money requires visible income evidence or a deliberately shared contribution offer.

Important conservation rules:

- Paid expenses reduce remaining need. Refunds and reversals retain signed effects; duplicates do not supply evidence.
- A transfer's two legs represent one economic movement. Reserve claims cannot reuse either leg as another principal. Current backing is distinct from historical saving and a completed goal purchase.
- One source/evidence item cannot silently complete two lines. Specific obligations receive attribution before category pools.
- A later accepted payment matched to an earlier commitment is reserved at the earlier date and removed from the later projected demand. It remains unpaid actual evidence until its recorded date.
- Explicit payday installments retain their amounts and the actual baseline when applied. A label-only edit preserves the schedule.
- Expected money remains dated and separate from current cash. Accepted future income replaces a matching assumption. Internal transfers do not create cash. Committed future Everyday purchases cannot be spent again.
- Purchase comparisons inspect capacity from the chosen date through the horizon, after existing commitments, and cap the answer by the unspent Everyday allowance.

## Conversation, agreement and continuity

Plan opens the existing `HerculesPresence` and `HerculesActionPanel`, carrying ledger, member, month, selection, line, horizon and current purchase/disruption context. There is no second Plan chat implementation or generic command dispatcher.

Typed Plan changes and alternatives use existing command paths. Reviews bind exact source facts and refresh after relevant changes. Plan acknowledgement is independent and digest-bound. Money actions retain editable review, Final Confirm, receipt and recovery.

Private coaching preferences are explicit strings the person can add, edit or forget. They are included only in that member's private Plan preparation and omitted from Shared facilitation, partner reads and partner/shared envelopes. Ordinary finite conversation preferences retain their existing routing. Shared Hercules receives only grounded Shared context and the bounded Shared conversation.

Optional additive fields extend existing Plan lines, scenarios, outcomes, Sitdown records and tasks. No second ledger or database migration is introduced. `planDecisionVersion: 1` capability negotiation prevents older clients from silently dropping the new decision data during command replay; new-data commands refuse an authority lacking that capability. Old Plan digests without extension fields retain their existing representation.

## Education sources

The small initial lesson set is original product instruction supported by maintained Canadian primary sources, with Canada jurisdiction and a 2026-09-11 review date. Source pages were opened and checked during implementation:

- [FCAC: Making a budget](https://www.canada.ca/en/financial-consumer-agency/services/make-budget.html): include goals, compare results and revise assumptions when circumstances change.
- [FCAC: Setting up an emergency fund](https://www.canada.ca/en/financial-consumer-agency/services/savings-investments/setting-up-emergency-funds.html): distinguish foreseeable occasional costs from unexpected emergencies.

This is an initial contextual lesson set, not a claim of comprehensive financial education or autonomous life coaching. Future content changes need another source review.

## Visual and interaction evidence

The reproducible fictional fixture mounts the actual Plan, goals and private conversational components. It blocks external network requests and serves no household export. The synthetic member switch is not authenticated partner proof.

`node test/plan-life-layout.mjs` starts its own temporary Vite server and exercises all four lenses, alternatives, lessons, Bridge review, Sitdown resumption and the full Hercules composer in these combinations:

| Theme | Personal phone | Shared phone | Personal desktop | Shared desktop |
|---|---|---|---|---|
| Classic Hearth | 390 px | 390 px | 1440 px | 1440 px |
| Taylor's Scrapbook | 390 px | 390 px | 1440 px | 1440 px |
| Newfoundland | 390 px | 390 px | 1440 px | 1440 px |

All twelve journeys pass, with axe checks on each lens, keyboard focus, at least 44 px control height and no horizontal overflow. Additional widths 320/720/1100/1920 pass overflow checks. The themes retain their own composition/material rules. Plan uses document scrolling, a mobile consequence strip with integrated Hercules, and clearance for the fixed navigation and Fund grip/return variables. The isolated fixture does not prove the real physical Fund grip or VoiceOver experience.

`test/plan-studio-layout.mjs` remains a compatibility entrypoint to the current journey suite. `node scripts/serve-plan-life-proof.mjs` opens the same fictional fixture manually at `http://127.0.0.1:5184/life-proof`.

## Acceptance and remaining gates

Local automated evidence covers financial conservation, scope/privacy, UI/Hercules equality, private drafts, stale review rejection, scenario/Bridge CAS, independent synthetic acknowledgements, durable checkpoint/envelope roundtrips, capability negotiation and command replay. The worksession records exact commands and final results.

Some situations deliberately require review: uncertain withdrawn goal backing, repeated claims on the same goal, Shared daily recurrence horizons that exceed the existing obligations enumeration, and unsupported future Fund settlement/goal/reversal evidence. These do not receive a confident purchase allowance. Build uses existing savings goals; new debt amortization and autonomous work optimization are not introduced.

The approved architecture follow-ons remain independent Personal identity and generalized custody. General wellbeing or relationship products are outside this initial money/shared-life scope.

PR #433's following acceptance gates remain open: two authenticated partners on independent browsers, actual provider follow-ups and sleeping-client activation, full replay/restore acceptance, physical accessibility and Jonathan/Bianca independently explaining the consequences. Local fixtures do not close those gates. Production readiness and meaningful October data controls remain separate.

## Release handoff

The existing Development workflow already supplies `VITE_PLAN_SYSTEM_V2=1`; preserve it when releasing this implementation. Plain local builds omit that opt-in, so the worksession also records a build of the enabled Plan and Hercules assets.

Jonathan explicitly authorized push, merge and Development deployment on 2026-09-11. Current `origin/main` remains the recorded base at release start. Review D-242 and the worksession, complete candidate and hosted checks, and record the resulting PR, merge and Worker version. Schema application and Production activation are outside this authorization. A presentation-only rollback does not remove the new-data compatibility requirement: do not replace an authority with a pre-capability writer once extension data has been accepted.

Expected handoff: exact head/base, scoped test and build evidence, browser matrix, material unresolved findings, and separately stated Development release versus Production readiness. Local evidence artifacts are ignored and contain fictional data only; no credentials, private exports or chats belong in a commit.

[Implementation worksession](../worksessions/2026-09-11-fund-life-plan.md)
