# Hearth worksession — Harbour village shared decorating repair

- **Status:** CLOSED
- **Opened:** 2026-09-22 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `C:/Users/jonat/Documents/Codex/hearth-worktrees/harbour-village-decor`
- **Branch:** `codex/harbour-village-decor`
- **Baseline SHA:** `c71dc08940d4664762355b17cae116550b4f6639`
- **Head SHA:** local repair commit (amended after this record is finalized)
- **PR or issue:** none
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

Household members can explicitly preview and save independent shared settings for every Harbour room, with one bounded revision stream and no private or stale display reference becoming visible.

## Budget delta (5)

`0` — decoration commands cannot create, alter, or post money.

## Engagement delta (3)

`+2` — each room gains a recoverable, shared decorating choice.

## Verified baseline

The starting arrangement stored one setting across a list of rooms, decoded its own metadata with an incompatible snapshot parser, and had a duplicated early command return. The current command boundary authenticates an active household member before reaching Hearthside operations.

## Scope

### In scope

- Versioned shared room arrangement metadata and strict validation.
- Exact shared-art and mutually kept-memory eligibility.
- One CAS revision, latest revert, and the room editor's preview/acknowledgement/conflict behavior.
- Focused local tests and TypeScript verification.

### Out of scope

- Spatial runtime and scene rendering.
- Hosted data, schema, deployment, money commands, and Production.

## Acceptance evidence

- [x] Decoder and persisted metadata round-trip.
- [x] Per-room preservation, CAS and revert tests.
- [x] Revoked-reference and actor/no-money tests.
- [x] UI preview, cancel, save and conflict behavior.

## Plan

- [x] Inspect the rushed arrangement, contracts, command path, and fixture conventions.
- [x] Repair metadata and authenticated command integration.
- [x] Repair the editor and add focused tests.
- [x] Run the requested direct tests and TypeScript check.

## Evidence log

- Baseline checkout is clean at `c71dc08940d4664762355b17cae116550b4f6639`.
- `node node_modules/vitest/vitest.mjs run test/village-arrangement.test.ts --maxWorkers=1` passed: 4 tests.
- `node node_modules/typescript/bin/tsc --noEmit --pretty false` passed with no diagnostics.
- `git diff --check` passed; line-ending notices are non-mutating Windows Git notices.

## Decisions

- The metadata carries a complete ten-room snapshot. This makes a write atomic while allowing the editor to change only its selected room and preserve the other nine.

## Remaining uncertainty

- Browser scene rendering is owned by the parallel spatial-runtime work and is not claimed here.

## Handoff

Local repair is ready for the requested one commit. No PR, merge, deployment, hosted mutation, or Production action occurred.
