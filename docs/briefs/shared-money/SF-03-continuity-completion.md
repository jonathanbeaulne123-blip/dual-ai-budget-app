# SF-03 — Continuity completion

**Target AI:** sync/ledger implementer  
**Baseline:** accepted SF-02 head  
**Risk:** Release  
**Deltas:** budget `+3`; engagement `+1`

## Outcome

Accepted Shared and Personal commands converge across two devices without a host phone, silent loss, duplicate posting, scope leakage, or false success.

## Tasks

1. Close the remaining in-memory atomic Shared+Personal proof and command-log two-device smoke.
2. Model offline create/edit/remove, simultaneous disjoint writes, same-object conflict, stale replay, revoked-member replay, reconnect, and provider-independent retry.
3. Ensure every command has stable identity/idempotency and every conflict preserves both recoverable facts.
4. Add device-independent restore and recovery proof from a fresh device while the old device is offline.
5. Keep Production Realtime and any higher authority off.

## Invariants

One accepted command, one durable result; no last-writer silent deletion; Personal stays member-scoped; Shared never absorbs partner-personal; PGlite validates before activation; uncertain restore is named recovery, not success.

## Acceptance

- Two-browser synthetic scenarios converge to the same canonical hash.
- Duplicate/reordered delivery changes accepted books at most once.
- Revoked identities cannot flush queued writes.
- Fresh-device restore works with both original devices off.
- Failure states are actionable and never celebratory.

## Verification

Deterministic interleaving tests, local PGlite proofs, Development smoke, offline browser proof, 390/720/1100 px recovery UI, then `pnpm check`. Record latency as evidence, not a guarantee.

## Stop conditions

Money loss, duplicate acceptance, scope leak, environment mix, uncertain-success UI, or need for Production testing blocks completion.
