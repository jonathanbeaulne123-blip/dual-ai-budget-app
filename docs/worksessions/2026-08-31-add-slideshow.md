# Hearth worksession — Add cashpad prompt slideshows

- **Status:** OPEN
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `dual-ai-budget-app`
- **Branch:** `cursor/shared-ledger-story-aef7`
- **Baseline SHA:** `29d896c`
- **Head SHA:** (this packet)
- **PR or issue:** draft [#244](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/244)
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

Add is a series of unique cashpad prompts per mode (expense, income, shift, transfer). Confirm still posts. The speed dial sits slightly higher above `+`.

## Budget delta (5)

`+3` — calmer posting path, account tiles quote accepted books, Confirm remains the write.

## Engagement delta (3)

`+3` — unique ceremonies instead of one dense sheet.

## Verified baseline

- FAB speed dial already on this branch (`77842cc` / `ba752c2` / `29d896c`).
- Add was one scrolling sheet with mode tabs, pad, categories, Who, `<select>` account, note, then Post.
- Shift jobs Confirm (`WorkShiftWithSevenShifts`) and clock-in already existed.

## Scope

### In scope

- Lift speed-dial actions (`22px` above `+`).
- Four unique Add slideshows; category Add on the category slide; Books-floor account tiles; optional picture/note; Confirm last.
- Keep Who / date / Fund / location on Confirm details.
- Keep shift clock-in, 7shifts jobs Confirm, and no-job ceremony pads as slides.

### Out of scope

- Persisting receipt images in the journal.
- New money commands, OCR, bank feeds.
- Claude month-instrument; Codex merge onto `main`.
- Restyling Home seals / mosaic / Kitty Banks.

## Acceptance evidence

- [x] Focused tests
- [x] `pnpm test`: 1123 passed / 2 skipped; 1 pre-existing `hercules-pro` `this_week` empty (not this packet)
- [x] Browser proof: expense 5-slide walk, unique income/transfer/shift prompts, FAB lifted. Fictional Development demo as Jonathan. No money posted.

## Plan

- [x] Extract `AddSlideshow` and step model.
- [x] Wire App; lift FAB.
- [x] Check + visual + handoff.

## Remaining uncertainty

Picture is local preview only. 7shifts jobs path stays the existing Confirm ceremony inside the jobs slide.

## Handoff

Not merged, not deployed, not live.
