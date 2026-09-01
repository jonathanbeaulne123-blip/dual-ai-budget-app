# Hearth worksession — Charter page and empty signature line

- **Status:** OPEN
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/charter-page-021f`
- **Baseline SHA:** `e9b14d907b6e15b7243df97b09c8d964117981a8` (Charter slice 3 founding conversation, draft #271)
- **Head SHA:** (see latest commit on the branch)
- **PR or issue:** (opens with this slice)
- **Risk:** High (presentation; sign/revoke only through existing Charter commands)
- **Decision owner:** Jonathan
- **Environment impact:** none — fictional Development demo; no Production, hosted mutation, schema, or secrets

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

- [ ] `signatureLines` returns both members in stable order
- [ ] Source fence: no pending / required / reminder / badge `!`
- [ ] Viewer A sees no prompt aimed at unsigned member B
- [ ] Focused tests + `pnpm check`
- [ ] Visual 320 / 390 / 720 / ~1100

## Plan

- [ ] View module
- [ ] Document UI
- [ ] App entry
- [ ] Tests, check, PR

## Evidence log

- 2026-09-01: Jonathan ordered Charter slice 4. Branch from slice 3 `e9b14d9`.

## Decisions

- Plate 2 copy for the custodian line.
- Escape closes the document (unlike founding).
- Sign link is only on the viewer's own unsigned line.

## Remaining uncertainty

- Slice 3 is still an unmerged draft; this branch depends on it.

## Handoff

Draft PR. Not merged, not kitchen-published, not live.
