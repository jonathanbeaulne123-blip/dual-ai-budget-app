# Hearth worksession — Till Slice 3 custodian surface

- **Status:** OPEN
- **Opened:** 2026-09-02 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/till-3-surface-0c3a` (Cloud Agent git policy; packet asked for `till/3-surface`)
- **Baseline SHA:** `6f5dd56516d31c3f1892f4833a7e71ff31857142` (`origin/main` Slice 2 release seal)
- **Head SHA:** `5567f30f8f7304a3adccd790f4dbd84ec29fafb8` (proof-doc commit may follow)
- **PR or issue:** [#304](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/304)
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development (D-041 kitchen publish after merge). Not Production.

## Household outcome

The Till is a reachable Shared presentation: Swipe first, real contribution conversation next, one always-true custody line, one current-month spend sentence, and a permanent door back to Shared Home. It is not a smaller permission tier and not a landing preference.

## Budget delta (5)

`+2`. The screen composes the sealed motion fold and canonical `monthSummary` without new arithmetic or authority.

## Engagement delta (3)

`+3`. The cardholder's primary act and current conversation fit on one calm, one-handed surface.

## Verified baseline

- Fetched `origin/main` is `6f5dd56516d31c3f1892f4833a7e71ff31857142`.
- `777dbcd1196670dbe7c2576fff8b0526cad27093` (PR #302 Slice 2 application) is an ancestor.
- `a2a55c6c95e2f5ae84d9fc523ee5072b47a9efc9` is an ancestor.
- `e426a4592dcd72870feb85642f3d0ab894e6dee8` (Slice 1 command/test seal) is an ancestor.
- Working tree started clean on `cursor/till-3-surface-0c3a`.
- Next free decision id on current canon is **D-199**.
- Packet `kitchen.ts` path is stale; navigation stays in `ledgerExperience.ts` + `App.tsx`.

## Scope

### In scope

- `src/Till.tsx`, `src/till.css`, `test/till.test.ts`
- Till route/tab contract; quiet Shared Home door; `#till` / `#home` hash fallback
- Move the temporary Home `I spent something` control onto Till
- Share `FundContributionMotionCard` without a second motion fold
- Living canon: D-199, this worksession, handoff, architecture/roadmap index

### Out of scope

- Slice 4 `landingSurface` / default takeover / preference field
- Camera, OCR, receipt, notes, account picker
- Command/Fund arithmetic, schema, Auth, Worker, bank, secrets, Production
- Editing sealed Slice 2 `swipe.ts` / `Swipe.tsx` behavior

## Acceptance evidence

- [x] Exact DOM order and required copy
- [x] Swipe and 10-second strip on Till
- [x] Empty motions omit the section
- [x] Confirm vs Hold Fund projection inherited
- [x] `monthSummary` spend line
- [x] Empty and offline copy
- [x] Real `see everything` link
- [x] Source fences; no landing preference
- [x] Focused tests + `pnpm check` (1,736 passed / 3 skipped)
- [x] Visual 320 / 390 / 720 / ~1100

## Plan

- [x] Prove Slice 2 ancestry from clean `origin/main`
- [x] Implement Till + route + tests
- [x] `pnpm check` and visual proof
- [ ] Independent audits recorded; merge / Development kitchen verify

## Evidence log

- 2026-09-02: ancestry proof passed on `6f5dd56`. Branch created from detached `origin/main` as `cursor/till-3-surface-0c3a` (justified Cloud Agent prefix/suffix; not a reuse of `cursor/till-2-swipe-0c3a`).
- 2026-09-02: focused 45 + Bianca 12; `pnpm check` 1,736 passed / 3 skipped; Playwright 320/390/720/1100 with no overflow; Swipe sheet from Till; `#home` door. PR #304.

## Decisions

- D-199 will record the Till as a reachable presentation, not a permission tier and not Slice 4 landing.
- Hercules presence maps Till → Home so Slice 3 does not invent companion copy or expand `HearthTab`.

## Remaining uncertainty

Live Worker version and kitchen asset hashes are unknown until after D-041 publish.

## Handoff

Cursor implements and, per Jonathan's 2026-09-02 instruction, merges and publishes the Development kitchen when proof is green. Stop before Slice 4. Not Production. Not shipped until merged and live HTTP verified.
