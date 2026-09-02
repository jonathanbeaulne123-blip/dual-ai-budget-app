# Hearth worksession — Clerk weekly durable stamp

- **Status:** OPEN
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `C:\Users\jonat\OneDrive\Documents\ChatGPT\Budget App`
- **Branch:** `codex/clerk-4-durable-stamp`
- **Baseline SHA:** `6918d29fdc9e5976b09e94705015c79837b2e988`
- **Head SHA:** local working tree
- **PR or issue:** none
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none; code and fictional Development fixtures only

## Household outcome

Each active household member can place their own calm weekly sticker. It survives close/reopen, offline acceptance, and two-device convergence; one sticker completes the weekly and the other line may remain blank. A sticker never moves money, approves a motion, or exposes work details.

## Budget delta (5)

`+2` — durable shared truth for the weekly ritual without changing any ledger fact or accepted-books hash.

## Engagement delta (3)

`+2` — asynchronous acknowledgement without requiring both people to attend or nagging the blank line.

## Verified baseline

- Fact: clean isolated worktree from `origin/main@6918d29fdc9e5976b09e94705015c79837b2e988`.
- Fact: the existing monthly `SitDownSession` owns financial Acts 1–3 and cannot safely hold weekly stamps.
- Fact: shared command-log materialization and compacting already carry bounded nonfinancial month-rehearsal facts.
- Inference: a separate append-only Shared fact with random ids is the smallest lossless stamp contract.

## Scope

### In scope

- Typed append-only weekly stamp fact and pure selectors.
- Member-self authority, Toronto week key, and one-stamp completion.
- Shared split/assemble/merge, command identity, bounded materialization, compacted replay, and Hercules redaction.
- Focused safety tests and a rebuilt Cursor Slice 4 handoff.

### Out of scope

- Clerk Slice 4 UI, route/goal-motion expansion, notifications, co-presence, schema or hosted-data changes.
- Money, Fund, Charter, monthly sit-down, model/provider, Production, push, merge, and deploy actions.

## Acceptance evidence

- [ ] Two devices independently stamp and convergence retains both facts.
- [ ] Only the acting active member can create their own stamp; duplicate self-stamps are refused.
- [ ] One stamp completes the week while other active-member lines remain blank.
- [ ] Shared and command-log continuity retain stamps; Personal and Hercules projections omit them.
- [ ] Tampered actor, command kind, content hash, and immutable same-id rows fail closed.
- [ ] A stamp changes no financial facts or financial audit hash.
- [ ] Focused tests, `pnpm check`, independent audits, and exact diff review pass.

## Plan

- [x] Verify exact clean baseline and conflicting monthly record.
- [ ] Implement and test the append-only stamp core.
- [ ] Run independent books/privacy audits and verification.
- [ ] Seal a local core commit and rebuild the Cursor handoff against it.

## Evidence log

- 2026-09-01: `origin/main` resolved to `6918d29fdc9e5976b09e94705015c79837b2e988`; isolated branch created from that exact commit.

## Decisions

- Weekly stamps are separate Shared facts, not fields on `SitDownSession`.
- Every accepted action creates a random `WSTAMP-` id owned by the acting member and canonical Toronto week.
- Distinct ids are append-only and additive. Concurrent duplicate facts for the same member/week remain preserved; presentation selects the earliest stamp.
- One valid stamp means complete. Blank partner lines are ordinary and silent.
- Stamps are deliberately absent from financial audit facts, Personal envelopes, Hercules/model projections, motions, and ledger commands.

## Remaining uncertainty

- Clerk Slice 4's proposed goal-deferral “place” action still lacks a command-backed motion contract. The revised packet will recommend a read-only other door.

## Handoff

Codex is the current writer. No PR, push, merge, deployment, hosted data, or Production change is authorized by this worksession.
