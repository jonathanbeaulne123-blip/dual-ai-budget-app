# Hearth Bugbot rules

Review against this file; ordinary `.cursor/rules/*.mdc` rules do not apply to Bugbot.

Report only actionable correctness, security, privacy, accounting, or regression findings with exact changed-line evidence.

Block when a change can:

- post money outside Commands or without visible Confirm;
- use non-integer CAD amounts or non-Toronto civil dates;
- unbalance double-entry or delete/overwrite posted history;
- restore an old whole-household snapshot over newer work;
- treat Supabase as the ledger instead of PGlite transport;
- cross Development and Production;
- send local, demo, unlinked, or partner-personal household data;
- weaken Auth, membership, RLS, origin, rate-limit, payload, or secret boundaries;
- fail open after books, identity, environment, or privacy validation;
- deploy, mutate hosted data/schema, or change secrets without explicit authority.

Require focused tests for changed invariants. Missing tests block money, privacy, environment, sync, RLS, or command-boundary changes.

Treat active branches and PRs as unshipped. Do not use museum folders as planning authority.
