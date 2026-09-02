# Hearth worksession — Till Slice 3 custodian surface

- **Status:** CLOSED; MERGED #304; DEVELOPMENT KITCHEN PUBLISHED; LIVE HTTP VERIFIED
- **Opened:** 2026-09-02 (`America/Toronto`)
- **Closed:** 2026-09-02 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/till-3-surface-0c3a` (Cloud Agent git policy; packet asked for `till/3-surface`)
- **Baseline SHA:** `6f5dd56516d31c3f1892f4833a7e71ff31857142` (`origin/main` Slice 2 release seal)
- **Head SHA:** `300235628885d9f21b1680089174301aa3665141` (application + Confirm-click / scoped-spend follow-up)
- **PR or issue:** [#304](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/304) merged as `main@300235628885d9f21b1680089174301aa3665141`
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development kitchen published (D-041). Not Production.

## Household outcome

The Till is a reachable Shared presentation: Swipe first, real contribution conversation next, one always-true custody line, one current-month spend sentence, and a permanent door back to Shared Home. It is not a smaller permission tier and not a landing preference.

## Budget delta (5)

`+2`. The screen composes the sealed motion fold and canonical `monthSummary` without new arithmetic or authority.

## Engagement delta (3)

`+3`. The cardholder's primary act and current conversation fit on one calm, one-handed surface.

## Verified baseline

- Fetched `origin/main` was `6f5dd56516d31c3f1892f4833a7e71ff31857142`.
- `777dbcd1196670dbe7c2576fff8b0526cad27093` (PR #302 Slice 2 application) is an ancestor.
- `a2a55c6c95e2f5ae84d9fc523ee5072b47a9efc9` is an ancestor.
- `e426a4592dcd72870feb85642f3d0ab894e6dee8` (Slice 1 command/test seal) is an ancestor.
- Working tree started clean on `cursor/till-3-surface-0c3a`.
- Decision id **D-199**.
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
- [x] Independent books/privacy/verifier: PASS WITH NOTES; P3s repaired in `3002356`
- [x] Exact-head PR CI green; merged; live kitchen HTTP verified

## Plan

- [x] Prove Slice 2 ancestry from clean `origin/main`
- [x] Implement Till + route + tests
- [x] `pnpm check` and visual proof
- [x] Independent audits recorded; merge / Development kitchen verify

## Evidence log

- 2026-09-02: ancestry proof passed on `6f5dd56`. Branch created from detached `origin/main` as `cursor/till-3-surface-0c3a` (justified Cloud Agent prefix/suffix; not a reuse of `cursor/till-2-swipe-0c3a`).
- 2026-09-02: focused 45 + Bianca 12; `pnpm check` 1,736 passed / 3 skipped; Playwright 320/390/720/1100 with no overflow; Swipe sheet from Till; `#home` door. PR #304.
- 2026-09-02: books/privacy/verifier PASS WITH NOTES; Confirm-click and scoped-spend tests landed in `3002356`. Exact-head CI `33687055693` and `33687059654` passed. Fast-forward merge to `main@3002356`. Cloudflare Workers `33689372692` published Worker `a52acc66-b218-4c73-8d9a-2142b4a5a680`. Live `GET https://hearth-books.jonathan-beaulne123.workers.dev/` returned HTTP 200 / `Cache-Control: no-store`; `/assets/index-Bfi0OGDI.js` and `/assets/index-N-WQUmzo.css` contain Till copy and `.till`.

## Decisions

- D-199 records the Till as a reachable presentation, not a permission tier and not Slice 4 landing.
- Hercules presence maps Till → Home so Slice 3 does not invent companion copy or expand `HearthTab`.

## Remaining uncertainty

Post-merge main CI [`33689372691`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33689372691) was still running at kitchen verification. Slice 4 landing preference is not authorized.

## Handoff

Slice 3 application is merged and the Development kitchen is live HTTP verified. Stop before Slice 4. Not Production.
