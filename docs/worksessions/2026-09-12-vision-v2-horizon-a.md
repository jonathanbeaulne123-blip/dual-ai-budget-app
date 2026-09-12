# Hearth worksession — Vision v2 Horizon A (A1–A12)

- **Status:** OPEN — local branch, quick gate (High) passed, browser evidence captured
- **Opened:** 2026-09-12 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (UX, Hercules, accessibility; non-money Chapter objects)
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `claude/vision-v2-slice-1` (continues slice 1; one branch for Horizon A)
- **Baseline SHA:** `ecf936ac` (main, #447)
- **Head SHA:** see git log
- **PR or issue:** none — this session's git proxy has no push credential for the repository
- **Risk:** High (new Shared-envelope collections, Household Home recomposition, Sitdown consolidation, navigation change). No command posts money; no PGlite or hosted schema change; no Auth/RLS change.
- **Decision owner:** Jonathan — "complete A1–A12" (2026-09-12), after accepting Decisions 1, 2, 3 with a centred + on the Personal bar
- **Environment impact:** none until deployed (Development only)

## Household outcome

Bianca opens Our Home and sees, in order: the Home's name, one sentence about the Fund, this month's Chapter with its next small Move, what is coming, what is growing, what each of them is waiting on, and three doors. Rent-day rituals, a Lesson, and a monthly Sitdown that closes one Chapter and opens the next exist as real objects. More is gone; the status bar names the space and opens the Status Centre. The + says what the couple can do here.

## Budget delta (5)

Neutral. No posting path changed. The Chapter system is non-money (empty `postedIds`, excluded from `financialAuditFacts`, blanked in Hercules disclosure). The old three-act flow that moves leftover money is unchanged in behaviour and now lives in the Fund as "Close the month" with its own Final Confirm. `fundPulse()` and the Sitdown brief are pure reads.

## Engagement delta (3)

Strongly positive. The living loop exists: Chapter → Ritual → Move → Win → Memory, Our Rhythm, a Sitdown brief, a pulse-first Hercules greeting, mode labels, comfort controls, and three authored theme expressions of Home.

## Verified baseline

Facts at `ecf936ac`: two Sitdowns (`PlanStudio` stages and `SitDownGuide` three acts); Household Home = Personal office + stacked panels; personal nav six items incl. More; no Chapter/Ritual/Move/Win objects; four lens lessons; `PLAN_CURRICULUM` unreferenced; `Appearance` = theme + atmosphere + two accessory flags; Hercules greeting per tab from `herculesPageBrief`.

## Scope — what shipped on the branch, by item

- **A1** Names / Fund tab — slice 1 (see its worksession).
- **A2** Status Centre replaces More: `kitchenPrimaryNav("personal")` = Home · Calendar · Work · Books · Plan; `.nav[data-ledger-nav="personal"]` grid `1fr 1fr 1fr 56px 1.5fr 1.5fr` keeps the + exactly centred; the status bar (`SyncFreshnessStatus`) always renders with the space name and opens the Status Centre; household secondary nav reads "Status Centre"; the More page is headed Status Centre and grouped (Needs us · Household · Your Hearth · Appearance and comfort · Sources and continuity · Privacy, devices, and sharing · Help and transparency) with a Hercules capability map. Existing ids (`hearth-sync-help`, `hearth-health-review`, demo-suite hooks) unchanged.
- **A3** Household Home: `src/HouseholdHome.tsx` + `src/household-home.css` behind `householdHomeV2Enabled()` (default on; `VITE_HOUSEHOLD_HOME_V2=0` rolls back). The Office remains reachable under Home as collapsed "instruments" so the Bianca mainline regression (which mounts the Office) stays green; the Month-One rehearsal access renders inside the Chapter area (Chapter 1).
- **A4** `fundPulse()` consumed on Home; `presenceLines()` presence strip (facts only; no totals).
- **A5** Adaptive + — slice 1.
- **A6** One Sitdown: `PlanStudio` stages renamed to the eight steps (Arrive together · Close the previous Chapter · Orient to shared reality · Learn one useful thing · Make the shared decisions · Turn the decision into a Ritual · Look ahead · Open the next Chapter); `SitdownBriefCard` at step 1; `ChapterClose` at steps 2 and 8; `RitualForm` at step 6; `ModeLabel` (Private preparation / Shared with both of you); `SitDownGuide` retired as a Plan surface and mounted in the Fund tab as "Close the month" (V2 only). Hercules's plan brief no longer says "three acts".
- **A7** Chapter system v1: `src/core/chapters.ts` — `Chapter`, `Ritual`, `Move`, `Win` (Memories are kept Wins), six foundation definitions, shapers/mergers, and eleven commands (`openChapter addRitual recordRitualHeld setRitualState offerMove respondToMove completeMove recordWin keepWinAsMemory dismissWin closeChapter`) registered with `memberId` binding. Wired: `Household`/`SharedEnvelope` types, `ensureHouseholdShape`, `splitForSync`, `assembleHousehold`, server/client merge, `IMPORT_FIELD_POLICY` (`exact`), `householdForAiDisclosure` (blanked). Not added to `financialAuditFacts` (by design) nor to `commandMaterializationFacts` (see uncertainty).
- **A8** Our Path: `ChapterRoom` leads the household plan tab; Plan Studio is titled as a room beneath. The Kitty room stays mounted inside Plan Studio's goals content (a second mount would duplicate state).
- **A9** Lessons: `CHAPTER_LESSONS` (7) with couple skills; `chapterLesson()`; `CURRICULUM_BY_CHAPTER` re-keys all twelve `PLAN_CURRICULUM` modules to foundation/expansion Chapters (asserted by test).
- **A10** Comfort: `src/theme/comfort.ts` + `ComfortControls` — Quiet expression, celebration intensity, motion, haptics, sound; device-local (`hearth:comfort:v1:<env>`), applied as root data attributes; never account data.
- **A11** Hercules: pulse-first greeting on household Home (`herculesPageSurface`); "Private — only you see this conversation" label in the chat header.
- **A12** Housekeeping: D-239 collision resolved (`D-239-INVITE`); `PLAN_CURRICULUM` re-keyed (no longer dead); the concurrent quick gate passed twice this branch (Medium 141 s; High 158 s) — the "failing concurrent gate" debt did not reproduce; `PersonalLedgerFolio.tsx` kept (covered by `ledger-story-dom.test.ts`).

### Out of scope (Horizon B)

Expense Bridge, Bring into My Money, Seen/In discussion states, Bridge privacy dashboard, coverage ladder, tradeoff map, what-changed diff, decision notebook, fairness sandbox, responsibility map, Fund landing recomposition and Calendar fold-in, Kitty story fields, reorientation after absence, leaving review, pause agreement, Chapters 2–6 deeper content, two-device Sitdown.

## Acceptance evidence

- [x] `tsc --noEmit` clean; `pnpm build` passes.
- [x] Focused: `vision-v2-chapters` (13), `vision-v2-slice-1` (10).
- [x] Sweep: `app-startup-p1`, `five-boards-entry-app`, `month-rehearsal-mainline`, `ledger-import-parity`, `ledger-story-ui`, `continuity-auth-reconnect`, `onboarding-entry-integration`, `plan-system`, `sitdown`, `kitchen`, `fab-speed-dial` — 167 tests pass serially.
- [x] Quick gate, risk High, focus `vision-v2-chapters`: **passed**, 157.6 s of 300 s, no breach; 41 files (35 fast / 6 serial), 518 tests.
- [x] Browser evidence (`test/household-home-layout.mjs`, fictional fixture only): Home, Our Path, Comfort × Classic/Taylor/Newfoundland × 320/390/720/1100 — 36 captures, 0 horizontal overflow, 0 serious/critical axe hits, 0 page errors, keyboard reaches the pulse first. Representative PNGs in `docs/evidence/household-home/`.
- [ ] Physical devices, VoiceOver, authenticated two-browser continuity of Chapter objects, and Jonathan's product review remain open.

## Evidence log

- `npx tsc --noEmit` → clean (repeated after each item).
- `npx vitest run test/app-startup-p1.test.ts test/five-boards-entry-app.test.ts …` → 11 files, 167 tests passed.
- `pnpm test -- --risk=high --focus=test/vision-v2-chapters.test.ts …` → quick-gate-passed; base `ecf936ac…`, head `213763e5…`, fingerprint `dfea049a…d105`; typescript 41.3 s, vitest-fast 29.4 s (374 tests), vitest-serial 78.3 s (144 tests); `uiProofRequired: true`.
- `pnpm build` → built in 14.5 s.
- `HEARTH_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome node test/household-home-layout.mjs` → 36 captures, 0 serious/critical, 0 errors (after fixing `aria-prohibited-attr` on the growing-steps span → `role="img"`, and `html-has-lang` in the proof harness).

## Decisions

- D-244 (this worksession). Decision 2's centred + is satisfied with 3 | + | 2 and `1.5fr` right tabs; alternatives remain open.
- Chapter objects are Shared-envelope, non-financial collections (Decision 6 accepted by "complete A1–A12").
- The Office stays under Household Home as collapsed instruments rather than being removed, to keep the Bianca mainline regression green and preserve every existing instrument. Removing it is a later decision once Home has lived on real data.
- Comfort settings are device-local, not account data, so no hosted appearance write changes.

## Remaining uncertainty

- **Ledger sync v2 command events do not carry Chapter facts.** `commandMaterializationFacts` was left unchanged (it is the trust-reviewed replay hash). Chapter writes travel through the Shared snapshot envelope; in a pure event-replay materialization they would be absent until the next snapshot publish. Codex should add `chapters/rituals/moves/wins` to the materialization facts with a trust review before Development deployment, or confirm the snapshot path suffices for the pilot.
- `PlanHerculesSession.rhythm` text still exists beside Ritual objects; the Sitdown step 6 form writes Rituals, the old field is untouched.
- `fundPulse()` freshness maps from `syncFreshnessDisplay.tone`/`transportMode`; review on real Development sync states.
- Hercules's private label is static; a Shared-mode label appears only in the Sitdown's shared chat.
- No physical-device or VoiceOver pass.

## Handoff

Local only on `claude/vision-v2-slice-1` — not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan (push/PR authorization; product review of Home on real Development data); Codex (trust review of the new Shared collections, materialization facts, and D-243/D-244).
