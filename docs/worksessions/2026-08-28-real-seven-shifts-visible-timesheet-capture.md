# Hearth worksession — real 7shifts visible timesheet capture

- **Status:** ACCEPTANCE PROVED — ready for independent review
- **Opened:** 2026-08-28 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/d169-visible-schedule-capture`
- **Baseline SHA:** `d87e2dee28113542ae07005f3907cb425566f6f9`
- **Head SHA:** working tree
- **PR or issue:** none
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development evidence vault only

## Household outcome

Jonathan can select a visible 7shifts My Timesheets pay period and capture its employee-visible worked-time rows into his encrypted Development evidence vault without a company administrator token.

## Dual Course

- **Budget delta (5):** `+2` — approved clock-in/out and worked minutes can ground a later Shift review while Hearth job rules remain wage authority.
- **Engagement delta (3):** `+1` — one explicit action captures the visible pay period instead of retyping four punches.

## Scope and invariants

- Fixed positive projection: date, location, role, punch-in, punch-out, displayed breaks, approval, and hours.
- The wage column, unrelated DOM, cookies, tokens, storage, request headers/bodies, and other origins are excluded.
- One-use member-bound encrypted Development upload only.
- No automatic post, no provider call, no Production, no schema, no secrets, no push, no merge, and no deploy.

## Acceptance evidence

- [x] My Timesheets exposes selectable pay periods and visible closed punch rows.
- [x] Projection excludes the wage column and unrelated page content.
- [x] Parser produces worked-shift clock and worked-minute observations.
- [x] Real authenticated capture reaches hosted Development as `browser-structured` / `ready_to_review`.
- [x] Hosted result has four canonical shifts, four approved facts, complete date/start/end/worked-minute facts, and zero wage facts.
- [x] `Review facts` opens and focuses the extracted-facts panel before a 100-item capture history.

## Verification

- Focused proof: `pnpm exec vitest run test/evidence-extension.test.ts test/evidence-extraction.test.ts test/work-coworkers.test.ts` — 29/29 passed.
- Review UI proof: `pnpm exec vitest run test/evidence-review-ui.test.ts test/seven-shifts-evidence-ui.test.ts test/evidence-extension.test.ts test/evidence-extraction.test.ts` — 20/20 passed.
- `pnpm exec tsc --noEmit` passed.
- `git diff --check` passed with line-ending notices only.
- `pnpm check` verified the AI surface and reached 1103 passed / 2 skipped / 1 unrelated environment failure: the unchanged Windows `spawnSync bash ENOENT` assertion in `test/api.test.ts`. The chained build therefore did not start.
- Direct TypeScript, Vite production build, and Hercules Pro UI build passed afterward.
- Real hosted item: 978-byte encrypted `browser-structured` capture created `2026-08-29T01:18:31.947Z`, advanced to `ready_to_review`, and derived four distinct canonical shift records. Verification queried only counts/status; private times and labels were not reported.
- Jonathan's exported JSON was structurally verified as the same 978-byte versioned `punch` capture with exactly four `timesheets` rows; raw values were not printed or copied into the repository.

## Remaining uncertainty

- This proves one real pay-period presentation. Future 7shifts table/layout changes may require a new bounded fixture.
- Visible My Timesheets omits detailed tips and sales; those remain sourced from selected OCR/report evidence when visibly present.
- The companion is explicit one-use capture, not continuous background synchronization.

## Handoff

D-170 local implementation and real Development smoke are complete. Next owner is an independent reviewer of the exact dirty packet. Push, merge, and deploy remain separate decisions.
