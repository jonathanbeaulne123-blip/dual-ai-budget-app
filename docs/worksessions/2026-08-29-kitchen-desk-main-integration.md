# Hearth worksession — Kitchen desk and current main integration

- **Status:** OPEN
- **Opened:** 2026-08-29 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex (GPT), single integration writer
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/kitchen-desk-integration`
- **Baseline SHA:** `4b2f40064b526541ef7a20d6e99fc99ca5647baa`
- **Integration merge SHA:** `f1daa78bfc1bfc7df3967b597f7af9e3675ff352`
- **Head SHA:** pending books/privacy repair commit
- **PR or issue:** UX source draft PR #244; new integration PR pending
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none; local code and synthetic Development verification only

## Household outcome

Jonathan and Bianca open one kitchen: Shared Home keeps the composed paper desk and Kitty Banks; Personal Books keeps the serious account floor; Shift keeps current-main envelopes, attendance, Evidence, Bibles, and capture-only companion registration inside the same paper room.

## Budget delta (5)

`+5` — accepted-books CAD, partner-personal denial, visible Confirm, and D-172 collection-only automation survive one integrated kitchen.

## Engagement delta (3)

`+2` — Shift mail and posted earnings inherit the existing cream-paper instruments without adding a second skin or Home furniture.

## Verified baseline

- Re-fetched `origin/main` on 2026-08-29: `4b2f40064b526541ef7a20d6e99fc99ca5647baa`.
- UX source: `ed708dc358ed808fbc5a9ec89b6c95bdb9a55a60`; shared merge-base `871e6607b4bc6a5d653f9e9bbcc9131f9a07dc65`.
- Fresh worktree and branch were clean before integration. The original dirty `codex/roadmap-site` checkout was not modified.
- Risk is High: ledger-mode presentation, Shift/Evidence/Auth boot, and decision-ID collision.

## Scope

### In scope

- Merge the UX lineage into current `main` while retaining current-main Shift/Evidence/Auth behavior.
- Preserve paper desk tokens, three-column breakpoint at `>=900px`, seals, Kitty Banks, Personal Books floor, and kind-coloured Calendar.
- Preserve D-167 blank-root recovery and D-166–D-172 privacy/Confirm boundaries.
- Renumber the kitchen-desk law from PR #244's D-165 to D-173 in living canon.
- Run both lineages' focused tests, full check, responsive/accessibility evidence, independent audits, and verifier.

### Out of scope

- Push, merge to `main`, deploy, hosted migration, secrets, Production, provider activation, real household data, or D-159 automatic posting.
- A new Home instrument, iPhone redesign, new Fund formula, or desk restyle.

## Acceptance evidence

- [x] D-165–D-172 preserved; kitchen desk is uniquely D-173.
- [x] Shared Home and Personal Books satisfy the packet's scope and privacy rules in focused and browser proof.
- [x] Shift retains posted earnings plus envelope/attendance/Evidence/Bible flow; Confirm remains the only money writer.
- [x] Blank household open cannot clear `#root`; companion labels remain concrete.
- [x] Focused tests, AI surface, TypeScript, and builds pass. Full pre-review-repair `pnpm check` is green with the required Windows runtime path.
- [x] 320 / 390 / 720 / about 1100 plus keyboard, focus, reduced-motion source, loading, empty, error, and offline test evidence is current.
- [ ] Independent books, privacy, UX, trust, and verifier reviews complete on the integrated SHA.

## Plan

- [x] Re-fetch and branch from exact current `origin/main`.
- [x] Merge the exact UX head without rebasing PR #244.
- [x] Resolve the six bounded conflicts according to the packet.
- [x] Verify and repair integration regressions only.
- [x] Commit the integrated tree, then run independent reviews on that exact SHA.
- [x] Close the initial books/privacy projection finding and UX touch-target note with tests.
- [ ] Re-run books/privacy/trust/verifier on the final exact SHA.
- [ ] Update evidence, handoff, and draft PR state.

## Evidence log

- 2026-08-29: merge produced six conflicts only: `docs/AI_HANDOFF.md`, `docs/DECISIONS.md`, `docs/HEARTH_ROADMAP.md`, `src/App.tsx`, `src/Hercules.tsx`, and `src/WorkShiftPage.tsx`.
- Resolution policy: UX wins Home/Books/Kitty/tokens; current `main` wins Shift/Evidence/attendance/boot/privacy labels; both export types retained.
- Focused integration gate: 10 files / 67 tests passed. Post-placement/breakpoint relevant gate passed after correcting one test fixture reference.
- Full aggregate: 1176 passed / 2 skipped / 2 failed. Windows `bash` absence was resolved in a focused rerun (`test/api.test.ts` 8/8). Unchanged rig sampling failed twice and passed on its third isolated run (`test/hercules-rig.test.ts` 10/10); source blobs match `origin/main`.
- Full aggregate with Git Bash and bundled Python exposed: 174 files passed / 1 skipped; 1178 tests passed / 2 skipped; build passed. This run preceded the privacy repair.
- Build: `tsc --noEmit`, Vite, Hercules Pro UI, and `_redirects` absence passed through Windows-equivalent commands.
- Browser: 1100 px three columns; 720 px one-column stack; 390/320 px OfficePhone; zero horizontal overflow or console errors; Shift mail follows Tip climate and posted earnings; keyboard focus outline is visible.
- Initial independent review: books and privacy failed the merge commit because Personal Audit/Ask/downloads read `booksHousehold`; UX passed the vibe lock with one P2 for Shift tab height. Repair routes every Books read/export surface through `booksPresentationFloor`, disables device-wide Power SQL on scoped floors, adds partner account/note/goal/reconciliation DOM/export canaries, and gives Shift tabs 44 px height. Focused repair gate: 5 files / 34 tests passed; TypeScript passed.
- Books re-review found one remaining accepted-snapshot loss path: Batch Import Confirm built its command from the partial review clone. The follow-up gives Batch Import separate scoped-read and accepted-write inputs and proves, in both ledger modes, that a hidden partner reconciliation survives the imported transaction.

## Decisions

- D-173 preserves PR #244's kitchen-desk product text; only the conflicting number and integration status change.
- Shift envelope notebook remains in Shift, after posted earnings/tip climate; no Evidence, coworker, or envelope furniture appears on Home or Personal Books.
- Books uses a presentation clone for reads and exports and the accepted snapshot for writes. Shared excludes all personal rooms; Personal includes shared rooms plus only the signed-in member's rooms.

## Remaining uncertainty

Current integrated test and visual evidence is pending. No claim from PR #244 or pre-merge `main` will be reused as current proof.

## Handoff

Next owner after green independent review: Jonathan. Local branch only until he decides whether to push or merge. No deployment or Production action is authorized.
