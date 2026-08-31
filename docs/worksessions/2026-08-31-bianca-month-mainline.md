# Hearth worksession — Bianca Month mainline catch-up

- **Status:** OPEN — local catch-up verified; server-authority, Gemini, and authenticated-phone gates pending
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** Hearth
- **Branch:** `codex/bianca-month-one`
- **Baseline SHA:** `1d82a57976af006d0fcf8683d6920a6277738e40`
- **Recovery ref:** `codex/bianca-month-one-pre-main-20260831`
- **Risk:** High
- **Decision:** D-182
- **Environment impact:** Development only

## Household outcome

Bianca's four-week rehearsal stays inside the Hearth Jonathan and Bianca actually use. Later edits to the current App, financial commands, books, and continuity cannot silently leave the trial month on a stale parallel path.

## Dual Course delta

- **Budget (5): `+5`.** The rehearsal continues to prove opening truth, real accepted receipts, exact checkpoints, reconciliation, and close through the authoritative books.
- **Engagement (3): `+3`.** Bianca's weekly ritual opens the same current surfaces, copy, and interaction flow as ordinary household use.

## Scope

### In

- Rebase the isolated Bianca Month branch onto current `origin/main` while preserving a recovery ref.
- Keep Bianca Month as a projection over the ordinary `App`, Add/Books/Fund routes, command boundary, PGlite books, and continuity.
- Carry non-money rehearsal progress through D-180 command-event materialization without adding financial IDs or changing financial hashes.
- Add permanent full-App and two-device command-sync regressions.
- Renumber the collided local decision from D-168 to D-182 and update canon.
- Run focused, full, build, visual, and independent verification.

### Out

- Push, merge, deploy, hosted schema or data mutation, secrets, providers, Production, real household entry, Gemini transmission, and authenticated-phone proof.

## Acceptance

- [x] Branch is based on current `origin/main@1d82a57`; the former head has a recoverable named ref.
- [x] An active Bianca rehearsal mounts inside the actual current `App` and opens the current income Add slideshow.
- [x] Rehearsal start/progress replays to a partner device through current command events.
- [x] Rehearsal commits keep `postedIds: []` and do not change the financial audit hash.
- [x] Receiver rejects wrong-kind, Personal-scope, changed-participant, nonparticipant, and materialization-hash-mismatched rehearsal events; actual compacted payload is covered.
- [x] Canon states that app, route, command, books, shape, continuity, and PGlite edits must preserve the mainline regressions.
- [x] Focused and full repository verification, build proof, and responsive UI proof are recorded.
- [x] Independent review is recorded: no P0/P2; compaction/Personal/tamper coverage fixed; server-authority limitation remains an explicit gate.
- [ ] Gemini review follows only after Jonathan approves that external transmission.
- [ ] Two authenticated Development phones prove hosted continuity and independent sign-off when authorized.

## Evidence log

- 2026-08-31: fetched current main at `1d82a57976af006d0fcf8683d6920a6277738e40`, created `codex/bianca-month-one-pre-main-20260831`, and rebased the working branch. The only conflict preserved both current synthetic-fixture merge and rehearsal command-receipt merge.
- 2026-08-31: post-rebase focused rehearsal/opening/continuity/App/Add run passed **57/57 across nine files**; TypeScript passed.
- 2026-08-31: after adding current App and D-180 command-event contracts, the focused materialization/App run passed **30/30 across five files**; TypeScript passed.
- 2026-08-31: expanded current-main focused verification passed **83/83 across 14 files**; AI-surface verification passed.
- 2026-08-31: the full repository run passed **1,326 tests / 3 skipped**. The sole failure is the unchanged native-Windows `spawnSync bash ENOENT` in `test/api.test.ts`; it is outside Bianca Month behavior.
- 2026-08-31: TypeScript, the Windows-native Vite production build, Hercules Pro UI build, and the no-`dist/_redirects` assertion passed. The literal `pnpm build` wrapper still cannot start on Windows because it begins with Unix `rm`.
- 2026-08-31: local browser proof exercised the active rehearsal at 320, 390, 720, and 1100 px with ordinary Hearth navigation, no horizontal overflow, preview-only future week, visible keyboard focus, and no browser warnings/errors.
- 2026-08-31: independent acceptance verification found no P0-P2. Books/trust review found a command-kind/compaction boundary; receiver authority checks, materialization hashing, actual compaction coverage, Personal stripping, and tamper tests were added and re-reviewed. The reviewer confirmed P2 closed and retained the server-authority limitation below.
- 2026-08-31: post-hardening verification passed **1,319/1,319** product tests outside `test/api.test.ts`; that environment-sensitive file passed **8/8** with the bundled Git/Python paths. Combined result: **1,327 passed / 3 skipped / 0 failed**. Final AI-surface, TypeScript, Vite production, Hercules Pro UI, and no-`dist/_redirects` checks passed.

## Remaining uncertainty

- Local command-log replay proves the current event contract, not authenticated hosted transport on two real phones.
- The client materialization SHA detects corruption but is not a server authority signature. An authenticated participant with a deliberately compromised client could recompute it; closing that requires separately authorized server-side validation/signing work.
- The final exact local commit is pending.

## Handoff

Keep one writer in the isolated worktree. Do not push, merge, deploy, transmit to Gemini, or touch hosted/Production state without Jonathan's separate action-time approval.
