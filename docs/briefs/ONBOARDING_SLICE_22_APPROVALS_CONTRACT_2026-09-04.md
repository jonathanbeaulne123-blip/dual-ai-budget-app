# Onboarding Slice 22 — approval contract

## Outcome

Each active household member can record only their own approval of one exact
first-plan or Ready digest. The other member must act independently. Approval
is a non-money Shared audit fact; it does not adopt a plan or complete setup.

## Authority

- `createdBy` and `memberId` must name the same active member.
- The accepted-write boundary independently binds the materialized approval to
  the authenticated acting member, exact command kind, household, and posted id.
- Typed chat can continue, pause, or reopen; it cannot create an approval.
- Fund-configuration consent remains in `HouseholdFundConfig.approvals`. This
  contract has only `proposal` and `ready` scopes.

## History and current authorization

- Every approval receives a new immutable id and remains append-only.
- A later digest never erases an earlier approval.
- `approvalsFor` returns only active-member records for the exact household,
  scope, and digest.
- `bothApproved` is true only when exactly two active household seats each have
  an approval for that same exact scope and digest.
- A stale digest remains auditable but cannot authorize a current proposal or
  Ready action.
- A same-id divergent record is a conflict; merge never chooses one silently.

## Continuity

Approvals travel only in the Shared envelope. Snapshot split/assemble, record
merge, compacted command payloads, and ordered command-event replay preserve
distinct approvals without loss. Malformed, extra-field, cross-household,
wrong-member, wrong-scope, missing, and hash-mismatched materialization fails
closed.

## Money and privacy boundary

An approval changes no transaction, journal entry, budget plan, recurrence,
Fund configuration or event, accepted-books hash, Personal envelope, provider,
or model state. The record contains only ids, scope, opaque digest, and approval
time. It carries no account, amount, estimate, job, token, email, or Personal
source fact.

## Kill criteria

- one member approves, replaces, or removes the other member's record;
- one approval satisfies both seats or crosses proposal/Ready scope;
- a stale digest authorizes a current action;
- replica order loses or changes an approval;
- a same-id conflict is resolved silently;
- chat text creates an approval;
- malformed command materialization reaches accepted state;
- Fund consent is duplicated in onboarding approvals;
- any money, plan, provider, Personal, or Production authority changes.
