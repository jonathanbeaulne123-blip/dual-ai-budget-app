# Onboarding Slice 18 — submission contract

## Outcome

Each active member can explicitly submit their own category choices and monthly
estimate cents for the household's first plan. The record carries only the
choice itself. It is not a posting, promise, approval, allocation, or statement
about either person's contribution.

## Authority and disclosure

- `createdBy` must identify the same active member as `memberId`.
- Draft state remains outside the Household. Only an explicit Submit command
  appends a Shared record.
- A category record contains ids only. An estimate record contains category ids
  and non-negative integer cents only.
- No Personal account, transaction, job, shift, rate, source row, note, or
  partner detail is accepted by the command or serialized in the record.

## History and convergence

- A member's first record has revision 1.
- Replacement appends a new id and next revision, then links the prior record
  through `supersededBy`; the input snapshot is never mutated.
- Current records resolve per member and kind.
- Replica merge preserves distinct rows. The Chapter 9 category view is the
  deterministic union of current member selections, ordered by category id.
- Estimate rows remain attached to their submitting member and are never folded
  across members.
- A zero-cent estimate is a present answer. A missing estimate is no row.

## Continuity

Submissions travel only in the Shared envelope. The current command-event path
binds materialized records to household, active actor, command kind, posted id,
and materialization hash. Wrong-member or malformed records fail closed.

## Money boundary

Submitting changes no transaction, journal entry, Fund event, balance,
recurrence, budget plan, or accepted-books hash. Later slices may derive and
review a proposal, but this slice creates no budget and grants no approval.

## Kill criteria

- one member can submit for another;
- a draft enters Shared state;
- a record carries Personal source facts;
- replacement rewrites or erases audit history;
- replica order changes the category union or loses one member's record;
- estimates from two people are collapsed into one record;
- missing is stored as zero;
- any money row or journal meaning changes;
- command-event replay accepts a wrong household or member.
