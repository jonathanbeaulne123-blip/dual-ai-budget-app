# Onboarding Slice 20 — Chapter 10 first estimates

## Outcome

Each active household member privately gives a first monthly guess for the
accepted household category set. A local draft is private. Explicit Submit
publishes that member's reviewed scope and any integer-cent answers. One
submission waits without revealing the other. Once both current submissions
cover the same current category set, Hearth reveals the two authored lists.

## Guess and scope boundary

- The required reassurance is byte-exact: `It's okay to guess. This is the
  first shape, not a promise; Hearth will learn from what actually happens.`
- Every submitted record carries the exact sorted accepted category ids the
  member reviewed. Category identity, not device time, establishes currency.
- A row omitted from an explicit submission means `Not estimated`.
- An included zero-cent row means `$0.00`; it is never treated as missing.
- A category-set change makes both older-scope submissions stale even when an
  offline device timestamp appears newer.
- Once either member begins Chapter 9 category work, estimates fail closed
  until Chapter 9 again has one valid accepted set.

## Privacy and presentation

- Draft values are component-local and keyed by household and active member;
  switching either scope destroys the unsent draft.
- Submit is the only moment a member's guesses join Shared household state.
- Before both valid Submit actions, a member sees a patient waiting state and
  no number from the other member.
- After both, each row remains labelled by author and category. The screen has
  no household total, total-versus-total comparison, percentage, ratio, rank,
  contribution split, or promise language.
- Invalid money copy marks, describes, and focuses the specific failing field.
- Chapter 10 uses the existing Plan route and one focused card. Hercules routes
  there; he does not collect amounts in chat.

## Continuity and evidence

Estimate submissions reuse the Slice 18 append-only Shared record and immutable
merge rules. Direct commands, the accepted-write boundary, and command-event
replay validate both the submitted row ids and exact accepted scope. Arbitrary,
private, stale, pending, wrong-household, or wrong-member materialization fails
closed. Chapter evidence remains empty until both current active members have
valid same-scope submissions; accepted evidence cites both submissions, the
current category submissions/merge, and every accepted category id.

## Money boundary

Draft, Submit, waiting, evidence, and reveal do not create or modify a budget
plan, transaction, journal line, Fund event, contribution, recurrence,
commitment, allocation, or approval. Estimates remain onboarding evidence for a
later proposal. Existing Final Confirm money authority is unchanged.

## Kill criteria

- a draft survives a household or member switch;
- any guess becomes Shared before explicit Submit;
- one submitted member can see the other member's values early;
- missing becomes zero or zero becomes missing;
- clock skew lets an old category scope complete the chapter;
- pending category work or an arbitrary category id passes command replay;
- a total, comparison, ratio, rank, promise, or contribution split is rendered;
- any budget, transaction, journal, Fund, contribution, or approval fact changes.
