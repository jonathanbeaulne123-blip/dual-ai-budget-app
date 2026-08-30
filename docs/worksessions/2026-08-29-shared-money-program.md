# Hearth worksession — Shared Money program

- **Status:** OPEN; SF-00 implemented and focused-verified
- **Opened:** 2026-08-29 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex coordinator; one implementation owner per packet
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/shared-money-program`
- **Baseline SHA:** `c7c2d56b84f069d8bffcecdbac8c8dcf72b9c405`
- **Head SHA:** local working tree; record the exact SHA in every packet handoff
- **PR or issue:** none
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** none for SF-00; later packets default to Development

## Household outcome

Turn Hearth's shared-ledger strengths into a safe, partner-backed Canadian joint-account program for Jonathan and Bianca: one shared operating account for bills and goals, private personal accounts, equal routine authority, and explicit guardrails.

## Budget delta (5)

SF-00 actual: `0`. Program potential: `+5` through stronger continuity, opening truth, shared obligations, settlement evidence, and eventually a regulated shared-money rail.

## Engagement delta (3)

SF-00 actual: `0`. Program potential: `+2` through a shared inbox, lightweight decisions, useful reminders, and a calm weekly money ritual.

## Verified baseline

Facts:

- Development Auth/RLS, atomic Shared+Personal sync, Realtime, QR invite, and owner revoke paths exist.
- Email/revoke/anon/wrong-household live smoke, device/session revoke, household leave/recovery, and opening truth remain incomplete.
- D-161 Household Fund is a virtual subledger, not held money. D-162 provider evidence is disabled and read-only.
- D-172 keeps collection autonomous but requires visible Confirm before current financial posting.
- The original workspace checkout had unrelated changes. This worksession uses a clean worktree at exact `origin/main`.

Inference:

- Hearth can reach a partner-backed account faster by completing its identity, continuity, and truth foundations before expanding financial authority.

## Scope

### In scope

- Canonical program, decision boundary, phase map, and Phase 0 implementation packets.
- Structural tests that prevent the program from silently weakening D-172 or misrepresenting the Fund.
- Subsequent implementation one packet at a time after its named prerequisites pass.

### Out of scope

- Production changes, provider activation, bank credentials, money movement, card issuance, legal claims, schema application, secrets, deployment, merge, or push.
- Treating roadmap text as evidence that a capability works.

## Acceptance evidence

- [x] D-174 records the direction and preserves current financial-write law.
- [x] One canonical program index defines phases, packets, dependencies, gates, and stop conditions.
- [x] SF-01 through SF-05 are independently executable from the exact baseline.
- [x] Structural tests enforce the most important safety statements.
- [x] Focused tests and the incomplete aggregate-gate result are recorded honestly.

## Plan

- [x] Isolate a clean worktree from current `origin/main`.
- [x] Complete SF-00 program canon.
- [ ] Execute SF-01 baseline reconciliation.
- [ ] Execute SF-02 membership completion.
- [ ] Execute SF-03 continuity completion.
- [ ] Execute SF-04 opening truth.
- [ ] Execute SF-05 fail-closed acceptance audit.
- [ ] Proceed to Phase 1 only after Phase 0 exit gates pass.

## Evidence log

- `git status --short --branch` in the original checkout showed unrelated edits and untracked files; no work was written there.
- Clean worktree created from `origin/main@c7c2d56b84f069d8bffcecdbac8c8dcf72b9c405` on `codex/shared-money-program`.
- `test/shared-money-program.test.ts`: 3/3 passed after correcting two test/packet wording mismatches.
- `node scripts/verify-ai-surface.mjs`: passed (41 required files and proof gate).
- `git diff --check`: passed.
- Aggregate `vitest run` produced no output or completion for more than three minutes and was terminated; it is not green.
- Direct TypeScript check reached environment/dependency errors in unchanged `test/evidence-local-harness.test.ts`: unresolved `miniflare` and a consequent implicit-`any`. The temporary worktree was using the original checkout's junctioned dependency store.
- Direct Vite production build passed: 355 modules transformed. Existing PGlite externalization/eval and chunk-size warnings remain.
- No network, provider, Supabase, household-data, secret, Production, push, merge, or deploy action is authorized by this worksession.

## Decisions

- Priority one, except hard safety blockers.
- Partner-backed Canadian joint account; shared bills and goals plus private accounts.
- Jonathan and Bianca are the first controlled users.
- Equal co-owner routine authority with configurable guardrails.
- In-app, Web Push, email, and SMS are eventual channels; consent and quiet-hour controls are mandatory.
- A future standing rule may execute only after both co-owners approve the exact version.
- A provider-settled event may auto-settle books only when it exactly matches a previously confirmed action or active dual-approved rule version. Everything else enters review.

## Remaining uncertainty

Banking partner, legal structure, AML/KYC allocation, safeguarding, dispute operations, insurance wording, rail availability, economics, and Production launch criteria require separate evidence and approval.

## Handoff

Next owner: independent SF-00 review, then the AI assigned SF-01. SF-02 is the first runtime packet. Work is local documentation plus a structural test on a clean branch. Nothing is pushed, merged, deployed, activated, or manually verified as a banking capability. Reconcile onto current `origin/main` and rerun the aggregate gate before review.
