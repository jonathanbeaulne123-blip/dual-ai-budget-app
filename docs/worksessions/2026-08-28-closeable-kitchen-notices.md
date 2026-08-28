# Hearth worksession — Closeable kitchen notices

- **Status:** CLOSED — release review passed on current `main`; merged locally for authorized push
- **Opened:** 2026-08-28 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor (Grok)
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/closeable-kitchen-notices-560d`
- **Baseline SHA:** `efbe5ed5118b0e6c2c942d318dd4e9643eb163d1` (`origin/main` at integration)
- **Integrated merge SHA:** `5533ac3` on `codex/merge-safe-2026-08-28`
- **PR or issue:** [#232](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/232)
- **Risk:** Low–Medium (copy/UX; no money write, no schema)
- **Decision owner:** Jonathan
- **Environment impact:** none (UI copy only; Development demo)

## Household outcome

When Google is signed in but not linked to the person on this kitchen, or when PGlite has no acceptance receipt, the kitchen shows a small closeable chip that names the problem and 1–2 fix steps — not a full-width red wall.

## Budget delta (5)

`+1` — Jonathan can act on a blocked bank connect or books copy instead of staring at an unexplained error.

## Engagement delta (3)

`+1` — notices match the sync chip: compact, dismissible, not a wall of red.

## Verified baseline

**Facts**
- Highlighted Import copy came from `workers/flinks.js` (`This Google account is not linked to that Hearth member.`) when `continuity_memberships` has no exact Google + household + member match.
- Red banner under Assets came from `src/ledger/engine.ts` (`PGlite has no acceptance receipt for this snapshot revision. Nothing was discarded.`) when `audit_revisions` has no receipt; App fail-closes and does not re-ingest.
- Sync freshness (`.sync-freshness`) is the size language: compact chip, action, not a wall. It had retry, not ×.

**Inferences**
- The signed-in Google is the wrong account for the member currently on this kitchen, or More → Google household bridge was never Linked next to that name.

## Scope

### In scope

- Humanize engine/worker strings to 1–2-step copy
- Compact closeable `KitchenNotice` (× + optional Open More / Reload)
- Wire Books status, Flinks/7shifts errors, App/welcome/Add, and other `.danger` paragraphs

### Out of scope

- Changing Worker refuse-closed membership checks
- Silently rebuilding PGlite on a missing receipt
- Merge, deploy, Production, schema, secrets

## Acceptance evidence

- [x] Google mismatch copy names Link in More
- [x] PGlite receipt copy names Reload / Sign out; still fail-closed
- [x] Notices are small, closeable, and do not post money
- [x] Focused tests on current main: 8/8 passed; TypeScript and production build passed
- [x] Full `pnpm check` reached 1,026 passed / 2 failed / 2 skipped; both failures are unchanged baseline checks outside this diff (`companion-office-update` source matcher and Windows `bash` availability)
- [x] `git diff --check`, AI-surface verification, and tracked-file/secret hygiene passed

## Plan

- [x] Map copy
- [x] Wire KitchenNotice
- [x] Focused tests + check
- [x] Handoff + draft PR

## Remaining uncertainty

The GitHub `main` publish workflow may still need to complete after push. Linking Google is the real fix for the Import notice; copy only explains it.

## Handoff

Jonathan authorized merging and pushing all safe work. Codex integrated the exact reviewed branch onto current `main`; the remaining action is the guarded push and workflow observation. No schema, secrets, household data, or Production ledger mutation is part of this packet.
