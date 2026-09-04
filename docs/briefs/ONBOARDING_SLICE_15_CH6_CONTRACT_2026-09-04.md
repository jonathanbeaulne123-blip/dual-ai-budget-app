# Onboarding Slice 15 — Chapter 6 Household Fund contract

## Completion

Chapter 6 is complete only when:

1. the existing Household Fund configuration shapes successfully;
2. its custodian is an active member and agrees with the current Charter;
3. every active household member has approved the same current configuration
   revision on their own behalf; and
4. the evidence can cite active Shared operating accounts and the Fund's fixed
   custody rules without disclosing Personal account metadata.

One approval is pending. Approvals tied to different configuration revisions
are stale. A Charter/Fund custodian mismatch is blocked with
`Custody moves through the Fund, not the charter.`

## Authority

- `configureHouseholdFund` remains the only command that opens the Fund and
  seeds the custodian's approval of that exact revision.
- `approveHouseholdFundConfiguration` records only the acting member's approval
  of the exact revision they reviewed.
- Chat text, navigation, a rendered card, and elapsed time never approve.
- The approval command creates no transaction, Fund event, allocation, plan,
  balance, or money receipt.

## Privacy

The Shared record may say that the Fund is backed by its custodian's Personal
savings. It must not contain or project the account id, name, suffix, balance,
provider binding, or reconciliation detail. Operating accounts are active
Shared accounts only.

## Continuity

Configuration terms use one stable revision. Approval rows merge independently
by member and retain the newest approval for that member. If two devices
configure different revisions concurrently, neither revision's approval may be
silently reinterpreted as approval of the other.

## UX

Onboarding routes to the existing Household Fund panel. Bianca configures; the
other member initially witnesses. Once a configuration lands, a member missing
their current approval gets one explicit `I approve this Fund setup` action on
that surface. The review states plainly that approval records agreement and
does not move money.

## Kill criteria

- one member approves for the other;
- a stale approval becomes current after merge;
- a bare Fund configuration completes Chapter 6;
- a Personal backing-account fact enters Shared state or evidence;
- Fund projection changes because of an approval;
- UI copy implies a transfer, deposit, or journal post;
- onboarding forks a second Fund form or approval via chat.
