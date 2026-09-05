# Onboarding Slice 27 — lifecycle contract

## Outcome

Onboarding remains a starting point, not a permanent health gate. Once the shared record is complete, later Charter edits do not reopen it. A replacement member receives only a member-owned Ch. 1, live household-scope Ch. 2, and self-owned Ch. 8 cadence catch-up. Existing members remain in ordinary Hearth.

## State rules

- Completion wins over an older stopped replica and leaves no outstanding household gates.
- Development completion is rejected when the current household environment is Production; Production begins inactive.
- Stopped-incomplete resume re-probes each participating member against current canonical state. Ch. 2 always requires a new live observation. Invalid evidence receives a monotonic `invalidatedAt` marker so an old replica cannot resurrect it.
- Registry-version mismatch shapes to `repair`. Migration planning refuses any unknown chapter id rather than silently dropping it.

## Demo rules

- `seedDemoHousehold()` and `generateDemoSuite()` stamp deterministic Development-only completion metadata.
- The synthetic digest is distinct from a real Ready digest and has two current-seat Ready approvals.
- The Demo Suite creation boundary accepts that package only when provenance, environment, seat count, member chapter stamps, digest, and approvals all agree.
- Synthetic onboarding identity is excluded from the portable fixture hash just like root household identity; all financial and showcase facts remain covered.

## UX rules

- The member catch-up explicitly says the household is already set up and will not interrupt anyone else.
- Hercules states that he never posts money or confirms for the member.
- The catch-up uses `Not now`, never the shared `Stop setup for now` action.
- A missing live Ch. 2 result remains held up and pending; it never completes from cache.

## Boundaries

No transaction, journal, transfer, budget formula, schema, hosted row, Auth/RLS rule, provider/model call, secret, Production setting, push, merge, or deployment is part of this slice.
