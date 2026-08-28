# Hearth worksession — Closeable kitchen notices

- **Status:** OPEN (draft PR)
- **Opened:** 2026-08-28 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor (Grok)
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/closeable-kitchen-notices-560d`
- **Baseline SHA:** `9cc1f67` (`origin/main`)
- **Head SHA:** see git after this packet
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
- [x] Focused tests + `pnpm check` (980 passed / 2 skipped at `6c58daa`)

## Plan

- [x] Map copy
- [x] Wire KitchenNotice
- [x] Focused tests + check
- [x] Handoff + draft PR

## Remaining uncertainty

Live kitchen still shows the old walls until this PR is merged and deployed. Linking Google is the real fix for the Import notice; copy only explains it.

## Handoff

Next owner: Jonathan — review [#232](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/232). Not merged, not deployed, not live.
