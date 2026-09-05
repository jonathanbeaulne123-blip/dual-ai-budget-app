# Onboarding Slice 23 — atomic budget adoption contract

## Outcome

Two active household members approve one exact current first-plan proposal.
One active member then adopts every proposed category amount for that month as
one accepted command. The command changes budget plans only.

## Authority and freshness

- `memberId` and `createdBy` must identify the same active household member.
- Household onboarding must still be active for the confirmed two-seat roster.
- The proposal is rebuilt at adoption from the current accepted category,
  estimate, recurrence, and eligible run-rate facts.
- The requested month and digest must match that rebuilt proposal exactly.
- Both active members must have self-owned `proposal` approvals for that exact
  digest. Old approvals remain history and authorize nothing current.
- When an accepted plan row already exists, each approval also binds the exact
  current plan catalog with SHA-256. A later edit invalidates that authority
  even when an offline device clock is earlier or equal.
- The accepted-write boundary independently repeats these checks against the
  previous accepted household before persistence or transport.

## Atomic plan change

- Every proposal category receives exactly one active plan row for the requested
  month and an exact non-negative integer-cent amount.
- Existing active rows keep their identities and receive the approved amount;
  missing rows use the existing budget-plan seed shape.
- Existing target-month rows outside the approved category set and duplicate
  active category rows fail closed for review.
- No unrelated plan can be added, removed, or changed.
- The command builds on a clone. Any preflight, construction, acceptance, books,
  persistence, conflict, or transport failure leaves the previous accepted
  household live with its full plan batch unchanged.

## Exactly-once receipt and recovery

- `ONB-ADOPT-{monthKey}-{proposalDigest}` is the deterministic adoption identity
  and accepted command confirmation id.
- A retry after an ambiguous or interrupted commit reuses that identity.
- If the accepted receipt already exists, the command is a no-op and the books
  boundary returns the same receipt and revision.
- Offline/cloud-backed refusal, stale hosted revision, and transport ambiguity
  retain the existing command-runtime and durable-outbox behavior. A new
  adoption identity is never invented for Retry.
- Bounded Shared command materialization includes only the changed plan rows.
  Receiver replay validates actor, month, digest, approvals, complete row set,
  materialization hash, and accepted-time proposal sources before adoption.
- Compacted delivery carries a per-command receipt hash over identity, audit,
  revision, accepted time, scope, and posted ids. Unprovable mixed history fails
  closed to full-snapshot recovery.

## Money and privacy boundary

The command adds no transaction, transfer, shift, journal entry, Fund event,
Personal fact, provider call, credential, schema, hosted row, or Production
authority. Budget plans remain Shared planning facts. `acceptHouseholdWrite` and
the existing PGlite/cloud acknowledgement policy remain the only acceptance
boundary; Final Confirm money-posting behavior is unchanged.

## Kill criteria

- one member or stale approvals can authorize adoption;
- a changed proposal, month, category set, or amount is accepted;
- any partial plan batch reaches accepted state;
- retry creates a second receipt, revision, or plan row;
- an existing plan is overwritten without two exact approvals;
- replay accepts a forged actor, row set, digest, or materialization hash;
- later catalog edits are overwritten by an older replay event;
- the journal, Personal scope, provider surface, schema, or Production changes.
