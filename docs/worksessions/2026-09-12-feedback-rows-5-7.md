# Hearth worksession — Feedback rows 5–7: one route, fewer words, colour that means something

- **Status:** OPEN (local implementation complete; awaiting push authorization and Codex review)
- **Opened:** 2026-09-12 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (Cowork session)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `claude/feedback-rows-5-7`
- **Baseline SHA:** `58cb1d75` (main after #451/#452)
- **Head SHA:** see `git log --oneline main..claude/feedback-rows-5-7`
- **PR or issue:** none yet — this session's git proxy has no push credential for the repository
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none (no schema, sync, Production, or real-household writes)

## Household outcome

Bianca opens Hearth and is not met by three routes to the same place, a paragraph under every heading, and a calendar where every chip is the same ink. Our Home loses the duplicate "Household tools" bar; the + means add; the Status Centre opens to what needs them and folds the rest; the phone desk shows what fits and says how much waits below. Explanations become one short line with a remembered "Why". The calendar reads by kind — glyph, edge and hue from one registry — with a legend that is also the filter, and multi-day plans draw as one run.

## Budget delta (5)

+0 in money meaning, by design: no command, posting path, projection, schema, sync or Hercules payload changed. Money-outcome, host-vs-peer and Development-openness sentences stay visible `line`s. The calendar changes are read-path only; ink/copper stay reserved for posted/scheduled.

## Engagement delta (3)

+3. Row 5 (Bianca, urgency 10): Our Home persistent chrome drops from ~11 controls to ~7 (secondary nav −3, + dial 6 → 4 verbs); the phone desk's below-fold objects are hidden at rest; the Status Centre folds seven groups. Row 6: 37 explainer paragraphs became lines or asides; always-visible prose on Calendar −28%, the Status Centre −11%, StatementSetup −18%, GoogleBridge −54%, QuickSamplePanel −61%. Row 7: fifteen kinds distinguishable by glyph *and* edge *and* hue in three worlds and both dark scenes.

## Verified baseline

Facts (read in code): `worlds.css:1190` reset every `.cal-title` to ink, making the per-kind hexes in `styles.css` unreachable; four of fifteen kinds had no edge; the legend listed eight kinds with no swatches and claimed member colours that were never drawn; `board.ts:303-306` fanned Hearth events per day with no span; `readGoogleCalendars` already fanned Google events across days (the plan's "truncation" claim was wrong for the live path and is corrected in the plan); 92% of long explainer text was always visible; `App.tsx:6669` rendered a three-button secondary nav in Our Home on every page; the + carried two navigation verbs; the Status Centre was one flat block with seven headings; `PhoneFold` kept below-fold objects visible and tabbable.

Inferred: control counts per surface (from component reads, not instrumented).

## Scope

### In scope

Rows 5, 6, 7 of the Hearth Feedback sheet, as planned in `docs/claude/FEEDBACK_ROWS_5_7_PLAN.md` and chosen by Jonathan ("all of it"; no Simple/Everything mode; Why aside).

### Out of scope

Hercules chat button density (row 12), Kitty Banks' own colour on Add/Books (the tokens exist; the surfaces are a follow-on), Plan's fifteen-section rail (already behind one disclosure), the Sitdown spelling inside stored transaction notes and core messages (data / engine strings), the three pre-existing failures noted below.

## Acceptance evidence

- [x] Every board kind has a registry entry; every layer is in the filter list; no two words share a glyph (`test/calendar-kinds.test.ts`)
- [x] Nine hue families max; none equals copper or ink in a light or a dark scene
- [x] Hearth 3-day event carries `span {index,length}`, clipped grids keep the length; Google all-day exclusive end and timed end crossing midnight resolve correctly; overlays carry span
- [x] Month legend lists only the kinds on screen; toggling a swatch hides the layer and is remembered per device; runs draw start / joined / end with the title said once per row; heavy days announce "heavy day"; member dot on shared surfaces
- [x] Copy budget fence: allow-list 68 → 31 and may only shrink; no `line` over 90 characters; per-file budgets on Calendar, Books, HouseholdHome, OfficePhone, HouseholdFundPanel, PlanStudio (`test/copy-budget.test.ts`)
- [x] Vocabulary fence: no PGlite / kitchen / snapshot / Sit-down in rendered component strings (`test/terms.test.ts`)
- [x] No secondary nav; + is four money verbs in both spaces named "Add money"; one tab vocabulary; phone fold hidden at rest and remembered; Status Centre folds open to Needs us and force open on attention (`test/navigation-one-route.test.ts`, `test/vision-v2-slice-1.test.ts`)
- [x] Browser evidence: Calendar in classic / taylor / newfoundland at 320 / 390 / 720 / 1100 plus reputation and George Street dark at 390 / 1100 — 16 captures, 0 horizontal overflow, 0 serious/critical axe hits, glyph contrast against the scene card ≥ 6.05:1, legend-as-filter and keyboard-opened Why aside exercised (`docs/evidence/calendar-kinds/`)
- [ ] Browser evidence for the Status Centre folds and the phone fold (jsdom only in this session)
- [ ] Physical phone, VoiceOver, Bianca's read

## Plan

- [x] Row 7: registry, tokens, kinds.css, spans, legend, member dot, heat mark
- [x] Row 6: Whisper primitive + whisper.css, copy-budget scanner and fence, daily and settings surfaces, terms registry and fence, Sitdown spelling on screen
- [x] Row 5: secondary nav retired, + add-only, StatusFold, PhoneFold as a fold, Books tab row dedupe, AppTab
- [x] Quick gate Medium, browser evidence, decision log, worksession, handoff
- [ ] Push / PR / Codex review / merge / deploy / live verification

## Evidence log

```
git checkout -b claude/feedback-rows-5-7  # base 58cb1d75
npx tsc --noEmit                          # clean at each commit
npx vitest run test/calendar-kinds.test.ts test/copy-budget.test.ts test/terms.test.ts test/navigation-one-route.test.ts   # 21 tests pass
pnpm test -- --risk=medium --focus=test/calendar-kinds.test.ts --focus-reason="rows 5-7: kind registry, spans, legend filter, whisper, one-route nav"
  → quick-gate-passed: 35 selected files (30 fast, 5 serial incl. app-startup-p1, five-boards-entry-app, month-rehearsal-mainline, onboarding-entry-integration, plan-system, proof-matrix),
    443 tests, 169.8 s, no time-budget breach, uiProofRequired=true
HEARTH_CHROMIUM=/opt/pw-browsers/chromium HEARTH_ARTIFACTS_DIR=docs/evidence/calendar-kinds node test/calendar-kinds-layout.mjs
  → 16 captures, 0 serious/critical axe rule hits, 0 page errors
node scripts/copy-budget.mjs --top=12      # always-visible prose per file, before/after in the handoff
```

Pre-existing failures on `main` at `58cb1d75`, unchanged by this branch and not fixed here: `test/batch-import-ui.test.ts` (confirmed batch write callback), `test/companion-office-update.test.ts` (Hercules.tsx source fence), `test/desktop-office.test.ts` and `test/office-phone.test.ts` (Office.tsx source fences).

## Decisions

D-245 (this slice). Narrows D-243's + verb set: navigation verbs leave the +, and its closed name is "Add money" in both spaces. Retires the Our Home secondary nav per Vision v2 §4.4.

## Remaining uncertainty

- Multi-day runs align across cells only when neighbouring days carry the run in the same chip row; a day with an extra earlier chip shifts the bar by one row. Span items are sorted first per day to make this rare; a true row-spanning layer is the follow-on.
- If urgency reorders the phone desk while focus is inside a folded object, the fold opens and focus is restored in the same tick; in a real browser the element may still be `visibility:hidden` for that tick. jsdom cannot show this.
- `poets` (Taylor, Books route) has a mid-grey paper on which no small text reaches AA, including its own muted ink; kind chips do not render on Books today, so nothing regresses, but the tokens should not be assumed AA there.
- Row 6 per-file reductions are measured on JSX text runs only (attributes and core message strings are not counted); the plan's "≥ 60%" acceptance target was not met on the daily surfaces — most remaining visible text there is labels and headings, not explanations.
- Stored transaction notes and core engine messages still say "Sit-down" / "PGlite"; the fence covers rendered component strings only.

## Handoff

Local branch only: **not pushed, not a PR, not merged, not deployed, not live verified.** Next owner: Jonathan to authorize push / PR (or fetch the bundle); Codex to audit D-245, the read-path span change in `board.ts` / `calendar/google.ts`, and the three new test fences; then Bianca's read on a phone.
