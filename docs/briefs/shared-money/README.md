# Shared Money program

This is Hearth's canonical execution index for becoming a partner-backed Canadian joint-account company. It extends [HEARTH_ROADMAP.md](../../HEARTH_ROADMAP.md); it does not replace it. Capability claims remain evidence-gated.

## Locked product contract

- First controlled users: Jonathan and Bianca.
- Priority: first, except a hard safety, privacy, legal, continuity, or money-truth blocker.
- Product: one partner-backed shared operating account for bills and goals, beside private personal accounts.
- Authority: equal co-owners for routine use, with configurable limits, freezes, and high-risk dual approval.
- Channels: in-app, Web Push, email, and SMS, each separately consented and revocable.
- Automation: standing rules may eventually execute only after both co-owners approve the exact rule version.
- Settlement: only an exact provider event matching a confirmed action or active approved rule version may settle automatically. Unmatched, duplicate, late, reversed, or ambiguous events go to review.

## Current law

D-172 remains the current financial-write boundary. Nothing in this program authorizes background ledger posting, provider activation, bank credentials, money movement, Production mutation, or card issuance. D-161's Household Fund remains a virtual operating subledger. D-162 remains disabled, read-only provider evidence. A later decision and Release packet must explicitly authorize any change.

## Five planes

1. **Evidence:** imports, receipts, provider events, provenance, duplicate detection.
2. **Attention:** inbox, assignments, decisions, reminders, quiet hours, escalation.
3. **Books:** accepted double-entry truth, opening balances, obligations, reconciliation, close.
4. **Rail:** partner-held account, co-owner authority, transfers, bill pay, cards, disputes.
5. **Notification:** consented in-app, push, email, and SMS delivery with no sensitive lock-screen leakage.

No plane may impersonate another. A notification is not approval. Evidence is not an accepted book entry. A virtual Fund is not held money. A provider callback is not automatically trustworthy.

## Phases and exit gates

| Phase | Outcome | Exit gate |
|---|---|---|
| 0. Trust foundation | Membership, continuity, opening truth, and fail-closed proof are complete. | SF-01–SF-05 green; independent privacy/books verification. |
| 1. Shared Money Inbox | One triage surface for bills, imports, evidence, and decisions. | Every item has provenance, status, owner, scope, and idempotent action. |
| 2. Consent and coordination | Assign, comment, request, approve, decline, and revoke without surveillance. | Independent identities; private-by-default person data; coercion-safe exit. |
| 3. Notification fabric | Timely, consented, quiet, deduplicated notifications across four channels. | Delivery receipts, preferences, redaction, escalation, and opt-out proof. |
| 4. Cash intelligence | Forecast, bill risk, buffers, contribution proposals, and weekly review. | Advice is explainable; no invented balances or automatic writes. |
| 5. Obligations and settlement | Bills, subscriptions, reimbursements, and settlement matching become first-class. | Exact arithmetic, lifecycle, reversal, dispute, and reconciliation proof. |
| 6. Partner and compliance | Select the Canadian account/rail partner and operating model. | Signed responsibility matrix, counsel review, unit economics, incident runbooks. |
| 7. Partner-backed joint account | Jonathan and Bianca operate real shared money in a controlled pilot. | KYC/AML, disclosures, safeguarding/insurance wording, limits, support, reconciliation. |
| 8. Smart automation | Dual-approved standing rules execute inside bounded authority. | Versioned consent, dry run, caps, pause/revoke, exact settlement, anomaly hold. |
| 9. Cards | Shared-balance physical/virtual cards with per-card controls. | Authorization, fraud, disputes, replacement, chargeback, and ledger proof. |
| 10. Pilot and scale | Expand from household alpha to invited Canadian households. | Reliability, support, loss, complaint, retention, and accessibility thresholds. |
| 11. Family expansion | Optional dependants/caregivers with purpose-built roles. | Separate safety, consent, age, estate, and abuse-risk review. |

## Packet index

Phase 0 is executable now:

- [SF-00 — Program canon](SF-00-program-canon.md)
- [SF-01 — Baseline reconciliation](SF-01-baseline-reconciliation.md)
- [SF-02 — Membership completion](SF-02-membership-completion.md)
- [SF-03 — Continuity completion](SF-03-continuity-completion.md)
- [SF-04 — Opening truth](SF-04-opening-truth.md)
- [SF-05 — Fail-closed acceptance audit](SF-05-fail-closed-acceptance-audit.md)

Later phases receive packets only after the preceding exit gate is evidenced. Do not create code from a phase headline.

## AI execution contract

For every packet:

1. Verify the exact baseline and read only current canon and current code.
2. Open or update the named worksession. Use one writer per checkout.
3. Implement only in-scope behavior; preserve all invariants and kill criteria.
4. Add adversarial tests before calling the happy path complete.
5. Run focused tests, then `pnpm check`; report environment failures separately from code failures.
6. Record network, data, MCP, schema, secret, and environment effects.
7. Obtain an independent books/privacy review for Medium or higher financial work and Release review for launch-affecting work.
8. Stop before push, merge, deployment, provider activation, remote migration, secrets, Production, or real-money testing unless Jonathan explicitly authorizes that exact action.

## Program measures

Primary household measures: accepted-book accuracy, unmatched-item age, bills paid on time, emergency buffer, review completion, notification usefulness, partner participation, reversals/disputes, and support burden. Relationship quality may be studied with consent, but must never be claimed as an app-caused outcome without direct evidence.

## Kill criteria

Stop the affected phase if Hearth exposes partner-personal data, makes consent coercive, creates unilateral hidden authority, labels virtual funds as deposits, posts unmatched provider activity, loses idempotency, cannot reconstruct the books from provider evidence, or lacks a safe separation/recovery path.
