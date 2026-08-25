# Hercules living teacher

**Status:** implementation on `codex/hercules-living-teacher`; no deployment, schema, hosted row, secret, or Production mutation.

## Goal

Make Hercules feel like a living teacher without weakening the books: typed clickable source figures, useful food/spending/income/shift answers, exact shared-versus-personal scope, restored per-turn bubbles, and desktop-only fly/litter play.

## Verified history

- `38af6ef` replaced the help-desk dock with a compact floating bubble.
- `1dad3be` added a short chat history inside that bubble.
- `1055d56` retained the compact floating chat implementation.
- `6e8e40d` added attractive individual widget snippet bubbles, while ordinary chat turns remained plain rows in a transcript-like wall.

The implementation adapts the snippet language to ordinary chat turns. It does not revert request identity binding, model fallback, stored chat, grounded-figure clamping, or widget targeting.

## Contracts

- `HerculesGroundedFact` + `HerculesNumberSource` is the only clickable-number path.
- Household view: shared/both money and shifts, shared goals; member names are allowed only for those shared facts.
- Personal view: requesting member personal/both only. Another member's personal query is refused before aggregation or model transport.
- Food answer: groceries plan remaining plus cash-like, labelled as a projection rather than a promise.
- Named “overspend”: current shared week versus the same member's prior four-week weekly shared average.
- Fly pile: session-only. Mobile/reduced motion renders no fly/litter. Automatic positions cannot enter the litter rectangle.

## Risk and Dual Course

**Risk:** High — privacy scope and grounded financial explanation. Requires independent review before release.

**Budget delta (5): +2.** Figures disclose their exact books source; shared and Personal aggregates are explicitly scoped; food/spend/income/shift answers remain journal-derived.

**Engagement delta (3): +3.** Per-turn bubbles, clickable legitimacy cards, teacher voice, and desktop fly/litter play make the companion materially more alive.

## Verification

- Targeted Hercules/privacy/fly/provenance tests.
- Full `pnpm test`, TypeScript, AI surface check, and production build before handoff.
- No live Worker call is required or authorized for this branch.
