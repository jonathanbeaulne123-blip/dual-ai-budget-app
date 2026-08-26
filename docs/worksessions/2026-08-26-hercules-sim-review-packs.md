# Worksession — Hercules Sim + Review packs (D-142)

**Opened:** 2026-08-26  
**Closed:** 2026-08-26  
**Owner:** Cursor (Cloud Agent)  
**Risk:** High (forecast / scenario math; Pro announcement UX)  
**Mode:** Implementation  
**Baseline:** rebased onto `main` after D-138–D-141; decision ID **D-142**  
**PR:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/140

## Goal

Ship Jonathan's accepted three packs on top of D-137 Shift Oracle:

1. **Household Cash Cinema** — 13-week forward cash ribbon (tips floor/typical + wages + bills + card mins).
2. **What-If Desk** — named unposted scenarios vs baseline.
3. **Year-in-Review / Season Replay** — posted historical story.

Also:

- Full inventory of Hercules Pro calculations and features.
- Hercules Pro **must say which tool it used** on every successful answer.

## Dual Course

- Budget (5): +3 — forward cash + scenarios + year story without posting.
- Engagement (3): +2 — cinema/war-room language + tool transparency.

## Non-goals

- Bank feeds / Plaid.
- Silent money posts from Pro or in-app Hercules.
- Schema / Production / deploy without Jonathan.

## Landed

- `src/core/simReview.ts` + tools `cash_cinema`, `what_if_desk`, `year_review`
- Wired through `herculesTools.ts`, `workers/site.js`, `workers/herculesPro.js`
- Pro MCP `usedTool` + `I used \`tool\`.` answer prefix; skill updated
- Inventory: `docs/HERCULES_PRO_CAPABILITIES.md`; D-142 in decisions (renumbered after main claimed D-138–D-141)
- Coexists with D-140 `shift_year_simulation` / `explain_shift_simulation` and D-139 companion

## Verification

- Focused: `sim-review`, `hercules-pro` after merge-conflict resolution
- Pro `tools/list` = **67**

## Status

- Closed for implementation after conflict resolution; awaiting trust review + Jonathan merge. Not deployed.
