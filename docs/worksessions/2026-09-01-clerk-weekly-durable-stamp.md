# Hearth worksession — Clerk weekly durable stamp

- **Status:** CLOSED — locally verified and handed off
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `C:\Users\jonat\OneDrive\Documents\ChatGPT\Budget App`
- **Branch:** `codex/clerk-4-durable-stamp`
- **Baseline SHA:** `6918d29fdc9e5976b09e94705015c79837b2e988`
- **Head SHA:** core `9f74cb780fed8a1a595a2dd791f510545a85570d`; handoff documentation follows locally
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

- [x] Two devices independently stamp and convergence retains both facts.
- [x] Only the acting active member can create their own stamp; duplicate self-stamps are refused.
- [x] One stamp completes the week while other active-member lines remain blank.
- [x] Shared and command-log continuity retain stamps; Personal and Hercules projections omit them.
- [x] Tampered actor, command kind, content hash, and immutable same-id rows fail closed.
- [x] A stamp changes no financial facts or financial audit hash.
- [x] Focused tests, `pnpm check`, independent audits, and exact diff review pass.

## Plan

- [x] Verify exact clean baseline and conflicting monthly record.
- [x] Implement and test the append-only stamp core.
- [x] Run independent books/privacy audits and verification.
- [x] Seal a local core commit and rebuild the Cursor handoff against it.

## Evidence log

- 2026-09-01: `origin/main` resolved to `6918d29fdc9e5976b09e94705015c79837b2e988`; isolated branch created from that exact commit.
- 2026-09-02: focused stamp/continuity/outbox/monthly regressions passed; the final stamp file contains 6 tests.
- 2026-09-02: `pnpm check:windows` passed: fast lane 218 passed / 1 skipped files and 1,490 passed / 2 skipped tests; serial lane 18 passed / 1 skipped files and 145 passed / 1 skipped tests; total 1,635 passed / 3 skipped. AI verification, TypeScript, all PGlite/books lanes, and the 401-module build passed.
- 2026-09-02: independent books/sync and privacy reviews raised actor/delta/duplicate-history findings; exact-delta acceptance, Google-member enqueue/flush binding, strict duplicate failure, Toronto date binding, and historical inactive-member replay closed them. Final reviews found no supported-client blocker.
- 2026-09-02: `git diff --check` passed with line-ending notices only; changed-path sensitive-file scan passed.

## Decisions

- Weekly stamps are separate Shared facts, not fields on `SitDownSession`.
- Every accepted action creates a random `WSTAMP-` id owned by the acting member and canonical Toronto week.
- Distinct ids are append-only and additive. Concurrent duplicate facts for the same member/week remain preserved; presentation selects the earliest stamp.
- One valid stamp means complete. Blank partner lines are ordinary and silent.
- Stamps are deliberately absent from financial audit facts, Personal envelopes, Hercules/model projections, motions, and ledger commands.

## Remaining uncertainty

- Clerk Slice 4's goal-deferral “place” action still lacks a command-backed motion contract. The revised packet makes the other door read-only.
- The hosted RPC authenticates membership but does not inspect stamp JSON; a deliberately forged direct authenticated RPC remains outside the supported-client proof and needs a separate server-hardening packet before that stronger claim.
- Live hosted two-device use remains release evidence; no network or Production mutation was performed here.

## Handoff

Cursor may implement only the bounded packet in `docs/briefs/CURSOR_CLERK_SLICE_4_WEEKLY_HANDOFF_2026-09-02.md` from core `9f74cb780fed8a1a595a2dd791f510545a85570d`. The core and packet remain local. No PR, push, merge, deployment, hosted data, or Production change was performed.
