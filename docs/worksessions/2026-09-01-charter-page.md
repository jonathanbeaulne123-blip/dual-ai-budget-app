# Hearth worksession — Charter page and empty signature line

- **Status:** CLOSED; MERGED #275; KITCHEN PUBLISHED; LIVE HTTP UNVERIFIED (DNS NXDOMAIN)
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/charter-page-021f`
- **Baseline SHA:** `4074e657c94d68a4c2ad8cd67a269b8541b7ec90` (merged Charter slice 3)
- **Head SHA:** `e8f6a94fe643922ae7a5a8908c1ba88882ecd195` (rebased review head); merge `86da91c2fc16912c2f56dcf62d2dd53e2a8429be`
- **PR or issue:** merged [#275](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/275)
- **Risk:** High (presentation; sign/revoke only through existing Charter commands)
- **Decision owner:** Jonathan
- **Environment impact:** D-041 Development kitchen publication only; no Production, hosted-row mutation, schema, or secrets

## Household outcome

The household charter reads as a paper document. An unsigned line is the same rule and name as a signed one, with nothing added. The viewer may sign only their own line. The other person's blank line is silent.

## Budget delta (5)

`+1` — display of the existing Charter record. Sign and revoke reuse slice 2 commands. No posting, no second envelope.

## Engagement delta (3)

`+3` — the agreement is visible, patient, and never accusing.

## If they conflicted

Books win. No badge, nag, streak, or nav count on an unsigned line. Held copy never reads as a refusal.

## Verified baseline

Facts:

- Slice 1–2 on `main` through `effd7b3`; slice 3 founding UI is draft #271 at `e9b14d9`, not merged.
- `signatureLines` layout constants live in a pure view module so tests can assert the 260px rule.
- Plate 2 wins over packet where they disagree: custodian line includes “Hearth can't move it.”

Inferences:

- More → the charter opens the document when a charter exists, and the founding conversation when it does not.
- This branch starts from slice 3 so that wiring is coherent. It is not kitchen-live.

## Scope

### In scope

- `src/core/charterView.ts`
- `src/Charter.tsx` + `src/charter.css`
- More → the charter opens the page
- Focused tests

### Out of scope

- Held on Fund motions (slice 5)
- Register / Ask
- Slice 0 tokens
- Merge, deploy, schema, Production

## Acceptance evidence

- [x] `signatureLines` returns both members in stable order
- [x] Source fence: no pending / required / reminder / badge
- [x] Viewer A sees no prompt aimed at unsigned member B
- [x] Focused tests 39 passed; `pnpm check` on `53c0bcc` 1486 passed / 3 skipped
- [x] Visual 320 / 390 / 720 / ~1100

## Plan

- [x] View module
- [x] Document UI
- [x] App entry
- [x] Tests, check, PR

## Evidence log

- 2026-09-01: Jonathan ordered Charter slice 4. Branch from slice 3 `e9b14d9`.
- Focused 39 passed. `pnpm check` on `53c0bcc`: 1486 passed / 3 skipped; Vite 391 modules; Hercules Pro UI green.
- Books audit PASS. UX audit PASS WITH NOTES; sign/revoke min-width 44px after.
- Browser: More → document; Jonathan signed only his line; Bianca unsigned silent; viewports 320/390/720/~1100.

## Decisions

- Plate 2 copy for the custodian line.
- Escape closes the document (unlike founding).
- Sign link is only on the viewer's own unsigned line.
- More card after founding is only “The household agreement.” — no sign nudge.

## Remaining uncertainty

- Live HTTP and dark/forced-colors remain unverified because the canonical kitchen hostname returned DNS `NXDOMAIN` after the successful D-041 publication.

## Handoff

Merged #275 after #271, retargeted to `main`, rebased, and verified by Linux `pnpm check` (`1,534` passed / `3` skipped). D-041 Action `33486435990` published Worker version `33ce5c14-612c-4c79-87c3-d39219656c84`; do not call it live until the canonical hostname returns HTTP and the served bundle is inspected.
