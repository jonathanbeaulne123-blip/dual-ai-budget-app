# Hearth worksession — Register slice 9 Ask panel

- **Status:** REVIEW CORRECTIONS VERIFIED; EXACT-HEAD RE-REVIEW OPEN
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/register-9-confirm`
- **Baseline SHA:** `6918d29fdc9e5976b09e94705015c79837b2e988`
- **Head SHA:** _pending_
- **PR or issue:** local candidate; no remote action yet
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development client and ordinary shared command continuity; no hosted mutation during implementation

## Household outcome

Jonathan can read this month's Fund Ask on his wide desk, open `Raise it`, and see a small confirmation whose action says `Move Halifax to next month`. Confirming advances only the exact Halifax monthly standing-order date (September 30 to October 30 in the canonical case), so the September Ask falls from `$340.00` to `$40.00`. Bianca's default surface never receives the panel. No money, contribution, Fund event, balance, or saved amount moves.

## Budget delta (5)

`+3` — the existing register becomes an actionable, exact planning choice without creating a second allocator or moving cash.

## Engagement delta (3)

`+2` — the dead control becomes a calm two-step choice that names the actual consequence. No streak, ring, score, celebration, or work instruction.

## Verified baseline

Facts:

- `origin/main@6918d29` contains the current Charter/continuity baseline but not the draft Ask panel from PR #288.
- The reviewed Ask panel code was integrated into this isolated branch without stacking draft PR #285 or merging stale docs.
- `MonthObligation` already identifies the exact recurrence used for each goal claim; the contribution register previously discarded that identity.
- `skipOccurrence` advances recurrence time without posting money, but ordinary command-event materialization previously omitted recurrence changes.

Inference:

- A narrow guarded planning command can reuse the existing recurrence meaning, but the exact recurrence must remain attached to the alternative and protected through command-event replay.

## Scope

### In scope

- `src/core/askView.ts` geometry and panel fold
- `src/Ask.tsx` + `src/ask.css`
- `OfficeWide` placement on Jonathan's desk
- Exact recurrence identity through month obligation → register → Ask alternative
- A stale-safe non-custodian shared-goal planning command
- Bounded recurrence command-event materialization and replay integrity
- Focused UI, command, PGlite, idempotency, and second-device tests
- D-161/D-173 why-note (no new D-number)

### Out of scope

- Register drawing / kitchen wiring of Slice 8
- Metronome (slice 10)
- Any transfer, goal contribution, Fund writer, or new obligation formula
- Till, metronome, OfficePhone placement, or a general recurrence redesign
- Hosted schema/data, secrets, Production, push, deploy, or merge before action-time approval

## Acceptance evidence

- [x] Figure, sentence, payday line, routes or refusal, other door, watching caveat in that order
- [x] Covered `$0.00` pine; routes and door hidden
- [x] `Raise it` mutates nothing; it opens a focused small Confirm
- [x] Confirm reads `Move Halifax to next month` in the canonical case
- [x] Command advances only the selected September 30 recurrence to October 30; no money facts change
- [x] Stale/wrong/custodian requests fail closed; duplicate receipt does not advance twice
- [x] Exact recurrence reaches a second device through a hash-verified shared command event
- [x] Ordinary PGlite ingest stores October 30 with zero source transactions and journal entries
- [x] Focused tests and `pnpm exec tsc --noEmit`
- [x] Full Windows check and rendered viewport/accessibility proof
- [x] Visual proof at 320 / 390 / 720 / ~1100
- [x] Cancel returns keyboard focus to `Raise it`; success and stale removal return focus to the Ask panel
- [x] Real compacted payload replays one Ask move behind another shared command; two same-recurrence moves fail closed to snapshot recovery
- [ ] Independent audits and release review

## Plan

- [x] Integrate the reviewed Ask drawing and presentation fold
- [x] Add exact recurrence identity and the named confirmation
- [x] Add guarded command, idempotency, PGlite, and command-event replay
- [x] Complete broad tests and rendered review
- [ ] Independent verification and release review
- [ ] Stop for Jonathan's action-time approval before push/merge/Development deploy

## Evidence log

- `pnpm exec tsc --noEmit` — PASS.
- Focused `vitest` (Ask panel, alternatives, goal move, materialization, Month rehearsal, Held): 31 passed; the serial Ask/PGlite file separately passed 6.
- Canonical goal move proof includes September 30 → October 30, Ask `$340.00` → `$40.00`, no money rows, one-receipt replay, second-device apply, and PGlite recurrence persistence.
- `pnpm check:windows` — PASS: AI surface verified; fast lane 1,496 passed / 2 skipped; serial books lane 146 passed / 1 skipped; TypeScript, Vite production bundle, Hercules Pro UI build, and redirect guard passed. Total: 1,642 passed / 3 intentionally skipped.
- Temporary fictional component harness at 320 / 390 / 720 / 1100 — exact Confirm wording, automatic focus, minimum 44px controls, no page overflow, `$340.00` → `$40.00`, door removed after success, and no browser warnings/errors. Harness files were removed after proof.
- First independent reviews found two bounded proof gaps: cancelled confirmation focus and the production compacted-event path. Both are repaired. Focused Ask UI/core tests now pass 15/15 with TypeScript; exact-head full gate and re-review follow.

## Decisions

Placement and the command both require an active non-custodian member because Till slice 4 is absent. The command reprojects the current month Ask and requires the same goal id, recurrence id, and claim date before advancing one monthly cadence. Recurrence replay uses the existing bounded `materializationHash`; accepted-books financial hash semantics remain backward-compatible.

## Remaining uncertainty

Independent exact-head re-review and release review remain open. The viewport proof used a fictional component harness rather than the signed-in kitchen because the local browser's household had no open Fund. Real authenticated two-phone timing remains part of the wider continuity pilot, not a claim of this local command-event test.

## Handoff

Next owner is independent books/trust and UX/privacy review, followed by the final release reviewer. This is local only: no branch push, PR update, merge, deployment, hosted row, schema, secret, or Production mutation has occurred. After a PASS, Codex must stop for Jonathan's action-time approval before push, merge, and Development deployment.
