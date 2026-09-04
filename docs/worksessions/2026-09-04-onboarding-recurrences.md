# Hearth worksession — onboarding Chapter 7 regular money

- **Status:** CLOSED; LOCAL QUICK-GATE + BUILD + UX VERIFIED
- **Opened:** 2026-09-04 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `onboarding/16-ch7-recurrences`
- **Baseline SHA:** `912ac532c4e9f2fe1d21e6b37f1e51294ee4fa03`
- **Head SHA:** working tree
- **PR or issue:** none
- **Risk:** Medium (repository quick-gate classification)
- **Decision owner:** Jonathan
- **Environment impact:** none; local Development fixtures only

## Household outcome

Hercules brings the household's rent or equivalent and one other regular item
onto the real Calendar as standing facts. The chapter recognizes existing
valid Shared recurrences without duplicating them and cannot post an occurrence.

## Budget delta (2)

`+2` — two cited regular-money anchors now feed onboarding evidence without a
new financial model or a new posting path.

## Engagement delta (3)

`+3` — the routed Calendar lesson uses soft, explicit language for reminder,
standing fact, and posted occurrence; either person can contribute, while a
pause after each third item keeps the setup humane.

## Scope

### In scope

- A pure Chapter 7 validity probe and household evidence projector.
- Exact minimum, deduplication, Personal exclusion, and acknowledgement gates.
- Direct Hercules routing to the existing Calendar Bills pane.
- Standing-fact form and confirmation language with all posting affordances
  suppressed while Chapter 7 is current.
- Six-minute registry guidance and pause after every third recurrence.
- Focused command, evidence, journal-equality, source-fence, copy, UI, and
  responsive accessibility proof.

### Out of scope

- Posting or auto-posting an occurrence, changing recurrence arithmetic,
  creating a second Calendar/form, changing obligations, adding a schema or
  hosted row, Auth/RLS, provider work, secrets, Production, push, PR, merge, or
  deployment.

## Acceptance evidence

- [x] Rent/equivalent plus one other valid Shared recurrence completes.
- [x] Existing evidence is read without adding or duplicating a row.
- [x] Personal and malformed candidates fail closed.
- [x] Evidence includes label, cadence, amount, and next date per recurrence.
- [x] Acknowledgement creates no posted id, transaction, or journal delta.
- [x] Chapter projector cannot import the posting command or browser/component code.
- [x] Real Calendar and recurrence form render in standing-fact-only mode.
- [x] 320 / 390 / 720 / about 1100 px, keyboard, focus, and overflow pass.
- [x] Medium quick gate and production build pass.

## Evidence log

- Baseline quick gate passed AI-surface, TypeScript, and selected tests. Its
  soft time-budget reporter produced an implausible duration compared with the
  measured wall time; timing is guidance and not a correctness failure.
- The finished slice rebased cleanly onto current `origin/main@912ac53`, the
  cross-tab revision-stall repair, before its final exact-head checks.
- Focused Slice 16 and adjacent recurrence/onboarding suite passed 99/99.
- Live actual-component browser pass covered pending, accepted, and three-item
  pause states at 320/390/720/1100 px, plus Bianca's conductor and Jonathan's
  contributor views. No horizontal overflow occurred; routed controls were at
  least 44 px; focus opened on the Hercules line; Tab looped through Next, add,
  stop, then Next; reduced motion removed transitions and animations. The pass
  caught and repaired 37 px touch targets, contradictory empty-state posting
  copy, a distracting due warning, and an occurrence-advancing Skip control.
  Temporary QA files were removed. Two console messages came only from the
  temporary Vite harness hot-reloading its root and are absent with that harness.
- Final Medium quick gate passed AI-surface, TypeScript, diff hygiene, 78 fast
  tests, and 7 serial financial proof tests. Production build passed 461
  modules plus Hercules Pro UI; existing PGlite browser-external/eval and
  chunk-size warnings remain.

## Decisions

- D-215 reserves the distinction between a standing recurrence and a posted
  occurrence for Chapter 7.

## Remaining uncertainty

- Hosted two-device continuity proof is release evidence and is not authorized
  by this local slice.

## Handoff

Local implementation and verification are complete. Push, merge, and
deployment require a separate instruction.
