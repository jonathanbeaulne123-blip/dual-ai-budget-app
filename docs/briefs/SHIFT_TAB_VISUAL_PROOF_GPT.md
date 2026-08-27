# GPT prompt — Shift tab visual proof (D-152)

Paste the fenced block into GPT (or another visual/implementer agent). Code is already on branch `cursor/shift-tab-mobile-6319` at `84819c3`. Do **not** re-implement the tab unless screenshots show a real mismatch.

Cursor Cloud computerUse could not finish visual proof (`execution environment has become unreachable`). That is the only remaining gate before Jonathan reviews PR #213.

Related: [worksession](../worksessions/2026-08-27-shift-tab.md) · [handoff](../AI_HANDOFF.md) · draft PR https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/213

```text
You are finishing Hearth PR #213 — first-class Shift tab (D-152). Visual proof and packet close only.

## Authority (in order)

1. Jonathan's latest explicit instruction.
2. AGENTS.md, docs/CLOUD_CONTINUITY.md, docs/HEARTH_ROADMAP.md, docs/DECISIONS.md (D-152), docs/STRATEGY.md.
3. Current code on this branch — not docs/nostalgia/ or docs/reference/.

## Exact git facts

- Repo: jonathanbeaulne123-blip/dual-ai-budget-app
- Branch: cursor/shift-tab-mobile-6319 (keep cursor/ prefix and -6319 suffix)
- Base: origin/main @ 93df0ec1d31c245cdc213d204ab8185ad3bb38a5
- Head: branch tip of `cursor/shift-tab-mobile-6319` (PR #213). Last product commit is `84819c3ff238f8a8ec9167e37815fd077bdb4555` ("Keep climate copy honest and unship D-152 from STRATEGY."). Later commits on this branch are docs/handoff unless you found a visual bug.
- Draft PR already exists: https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/213
- Use ManagePullRequest / GitHub PR tools to update the existing PR. Do not open a second PR. Do not merge.

## Household outcome (already implemented)

Bianca and Jonathan open Shift from the phone bar. Punch, last shifts, Jobs, compressed report, and Hercules Shift Oracle glances live there. Add stays geometrically centered. Confirm still posts. The Shift tab never writes money.

- Risk: Medium
- Budget delta (5): +1
- Engagement delta (3): +2
- Decision: D-152 (Shift is first-class like Calendar D-040). Accepted on branch, not shipped.
- Dual path: Home Timesheet glance + in-place expand STAYS (OfficePhone / Office). Do not remove it.

## Forbidden

- Do not merge, deploy, touch Production, apply hosted schema, change secrets, or clasp-push.
- Do not Confirm / post money. Do not clock in just to fill a saucer. Fictional Development demo only.
- Do not call this shipped. Distinguish local / branch / PR / merged / deployed / live verified.
- Do not re-architect punch, postShift, Correct, or Save job.
- Do not "fix" climate rain for future days (today only; future = cadence).
- Do not change saucer fill to clock-in (posted dates only).
- Do not move STRATEGY to claim D-152 shipped.
- Do not invent UI screenshots. Capture the running app.

## What already shipped in code (do not redo)

Nav (all widths): grid-template-columns 1fr 1fr 1fr 56px 1fr 1fr 1fr
Home · Cal · Shift · [+] · Plan · Books · More
- Cal aria-label="Calendar"; Shift aria-label="Shifts"; min-width: 0
- FAB unchanged (52×52, margin-top: -18px)
- :focus-visible on .nav button and .tabs button

Shift page: src/WorkShiftPage.tsx
Panes Today (default) / Report / Jobs — Calendar-style pills, tab/tabpanel ARIA, roving tabindex, ArrowLeft/Right.

Today:
- analog clock via TimesheetBody + optional copper dashed preview whisker (analog-arc.preview, radius 37)
- caption like "Nights like this · $X–$Y · projection, not posted"
- punch actions unchanged
- 7 climate seals; tap shows INLINE caption only (does not speak Hercules)
- last shifts (initialVisible=3) with "Locked. Correct posts a reversal."
- 28 saucers (posted dates only)
- floor lamp from runTipOracle (≥4 tip shifts) p10/p50/p90 + dry-streak reserve
- copper Projection badges

Report:
- 2×2 paper tiles: Shifts / Hours / Take-home = Posted; Protect floor = Advice
- Still waiting + Open Calendar (never settles)
- Tax milk Educational 25%
- chips: This month / All time / Export .csv / Full breakdown

Jobs: existing WorkJobsCard. Removed from More.
More must NOT show Jobs / shift history / work report.

Hercules: HearthTab / HerculesSourceRoute include "shift".
Chips: Tonight? · Protect or chase? · Tax milk?
Home "Log shift" still opens Add.
Copper whisker is Shift-tab-only, not Home Timesheet (intentional).

Core: src/core/shiftGlance.ts — climate, saucers, live preview, report glance, chip talk.
Tests: test/shift-glance.test.ts
Copy: WorkShiftFlow.tsx says Shift → Jobs, not More → Jobs.

## Verification already done (do not discard)

- pnpm check green at fa7b8a3: 880 passed / 2 skipped; tsc + vite build green
- 0b1b2ee a11y + 84819c3 copy: focused test/shift-glance.test.ts 5 passed + tsc --noEmit
- Full pnpm check was NOT re-run on HEAD 84819c3 — re-run it if you touch code
- Books auditor: PASS WITH NOTES (no money kernel in diff; punch/Confirm unchanged)
- Privacy auditor: PASS WITH NOTES (chips still model-first D-104; idle herculesPageSurface can default members[0])
- UX auditor: PASS WITH NOTES; F-1 tab/tabpanel and F-2 .tabs :focus-visible fixed in 0b1b2ee
- Verifier: PASS WITH NOTES — do not merge until visual proof; STRATEGY overclaim was reverted in 84819c3

## Your job

1. Checkout cursor/shift-tab-mobile-6319 at the PR head (last product commit 84819c3 plus packet docs).
2. pnpm install if needed. pnpm dev → http://localhost:5173 (or 127.0.0.1:5173).
3. Development pill → Open the demo kitchen table → Bianca. Fictional data only.
4. Prove nav: Home · Cal · Shift · [+] · Plan · Books · More. Add centered. Cal/Shift aria-labels. Labels not clipped at 320px.
5. Shift Today: analog clock (no Fraunces hours hero), climate 7 seals, last shifts (3), scroll saucers + floor lamp. Tap a seal → copper caption. Punch actions present; do not Confirm.
6. Report: 2×2 tiles, Still waiting + Open Calendar (does not settle), Tax milk Educational.
7. Jobs: WorkJobsCard. Then More: no Jobs/history/report. Home: Timesheet/Shifts widget still exists.
8. Viewports 320, 390, 720, ~1100. Keyboard: Tab to Shift panes, ArrowLeft/Right, focus-visible pine ring.
9. Save screenshots/video under /opt/cursor/artifacts (or the environment's artifact dir). If prior design mocks exist (shift_today_punch_390.png, shift_today_trends_390.png, shift_report_390.png, shift_v2.css), use them as look-and-feel reference only. Source of truth is current WorkShiftPage + styles.css shift-* rules.
10. If visual shows a real mismatch with the locked layout (nav, panes, copper Projection, More empty of Jobs), make the smallest CSS/markup fix. Re-run focused tests + pnpm check. Do not expand scope.
11. Update:
    - docs/AI_HANDOFF.md (Shift section: exact commands, widths, screenshot names, remaining uncertainty)
    - docs/worksessions/2026-08-27-shift-tab.md (Head SHA, checkboxes, evidence log, status)
    - PR #213 body; set draft: false ONLY after visual proof is attached. Next owner Jonathan.
12. Dual Course stays budget +1, engagement +2. Not shipped.

## Known notes (not money FAILs — do not "fix" unless Jonathan asks)

- Climate rain drop is today only (cached Open-Meteo / fallback). Future days = cadence, not forecast.
- Demo Thursdays can be cadence-off; Tonight? may say "off the cadence."
- Saucer pill walks consecutive calendar days from latest posted date (same algorithm as shiftPostingStreak, member-filtered).
- Hercules Shift chips can still hit the model planner (D-104); draft is null; they do not post.
- archiveWorkJob on Shift is still unguarded run(...) (pre-existing catalog, not a journal write).

## Return

Structured docs/AI_HANDOFF.md fields, both Dual Course deltas, exact verification, uncertainty, data/environment disclosure, and next owner Jonathan. Include screenshot/video paths. Never merge.
```
