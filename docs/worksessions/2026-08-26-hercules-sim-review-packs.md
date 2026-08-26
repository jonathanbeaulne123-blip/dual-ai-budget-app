# Worksession — Hercules Sim + Review packs (D-138)

**Opened:** 2026-08-26  
**Closed:** 2026-08-26  
**Owner:** Cursor (Cloud Agent)  
**Risk:** High (forecast / scenario math; Pro announcement UX)  
**Mode:** Implementation  
**Baseline:** `main@cd3eb87` → head `90ae4a7`  
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
- Inventory: `docs/HERCULES_PRO_CAPABILITIES.md`; D-138 in decisions

## Verification

- Focused: `sim-review`, `hercules-pro`, `tip-science` green
- Full `pnpm check`: 609 pass; 2 known unrelated `batch-import-ui` SubtleCrypto failures on this VM

## Status

- Closed for implementation; awaiting trust review + Jonathan merge. Not deployed.
