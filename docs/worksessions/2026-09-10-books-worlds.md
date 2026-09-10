# Hearth worksession — Books themes

- Status: COMPLETE — implementation and validation; publication tracked by the branch PR
- Owner / decision owner: Jonathan
- Assignee: Codex, one writer; independent read-only Books inventory/review
- Repository: dual-ai-budget-app
- Branch: codex/worlds-books
- Baseline: origin/main `2e113f69d03872eddc22ac461378a0f3e33f6c55`, verified clean before branch creation
- Risk: Medium (presentation and interaction accessibility)
- Environment impact: local synthetic Development proof only; publication authorized, merge/deployment separate

## Household outcome
Complete Shared and Personal Books in Classic, Taylor and Newfoundland. Existing page layout, route entry, financial components, authority and confirmations remain intact. Household Fund is only the existing nested Books pane, not a separate Fund redesign.

## Budget delta (5)
Preserve readable amounts, availability, scope, drafts and financial workflows. Solid reading surfaces separate scenery from controls.

## Engagement delta (3)
Authored whole-scroll clip art: Classic bound ledger/coffee/plants; reputation newsprint with essential gold and red snakes; TTPD warm monochrome manuscripts/candles; working harbour boats/ropes; Merchant Tavern dining materials and scallops replaces Personal Battery.

## Verified baseline
Initial before captures in `.artifacts/books-before` used another local preview checkout and are historical visual context only, not exact-base evidence. The mismatch was caught in visual review. All implementation acceptance uses a dedicated server on 5194 from this checkout, with its Books module and REFINED_PAGES verified. Local-only Vite allowlist config permits the shared dependency symlink; it is not shipped. Read-only reviewer inventoried Books, Fund, Activity, imports and audit panes.

## Scope and acceptance
Theme metadata, original SVG artwork, scoped CSS, shared scene heading, decorative Books divider, browser evidence and documentation. No financial APIs, schema, hosted data, layout restructuring or reference-photo publication.
Phone: separate title art composition and modest section ornament. Desktop: page-length scenery in existing outer canvas; solid cards and labelled paper sections. Gentle snake/leaf/water/steam motion, individual offscreen suspension and persistent pause/reduced/focus quieting.

- [x] Normal, sparse and long actual pages across six combinations at 320/390/719/720/1100/1440/1920
- [x] Nested Books/Fund/audit, loading/error, contrast/focus/44px/zoom/overflow
- [x] Focused quick gate, TypeScript, production build
- [x] Independent diff and screenshot review; PR publication

## Sources and interpretation
User supplied TTPD swatch and three moodboards (reference only). No board wording/lyrics, portraits or photos shipped. All artwork is original SVG clip art.
Official TTPD packaging: https://store.taylorswift.com/products/the-tortured-poets-department-vinyl-bonus-track-the-manuscript — book-bound jacket, handwritten material and ghosted white discs support manuscript/ivory direction.
Official reputation: https://store.taylorswift.com/products/reputation-album-snake-hoodie and https://store.taylorswift.com/products/reputation-album-snake-ear-cuff — wraparound snakes, metallic treatment and gold-tone jewellery. Gold/red colour pairing and newspaper composition specifically requested from user's boards.
Merchant sources: https://www.themerchanttavern.ca/ and https://www.themerchanttavern.ca/private-room — observed plated food, blue glasses, cream/wood/brass and framed coastal decor. Scallops explicitly requested; composition is an interpretation, not an exact menu dish claim.

## Evidence log
Initial real-Books reconciliation draft test: 2 passed. Initial current-branch capture identified mobile art clipping and insufficient reading-surface contrast; both corrected before acceptance recapture.

## Remaining uncertainty
Browser proof does not certify physical devices, Safari, VoiceOver or authenticated two-device financial flows.

Font provenance: https://github.com/google/fonts/tree/main/ofl/unifrakturmaguntia — unmodified UnifrakturMaguntia-Book.ttf, 88,508 bytes, with OFL.txt. Official reputation archive: https://tserasarchive.taylorswift.com/reputation. TTPD archive was unavailable; official packaging above used instead.

### Final checks
- Change-focused Medium quick gate passed: 154 tests across 11 files green; TypeScript, AI surface and diff checks passed. Elapsed 358,066ms (5m58s), above the 300,000ms soft target in the serial Vitest phase. Receipt: `docs/ux/page-worlds/books/quick-gate.json`.
- Production `pnpm build` passed, including TypeScript, Vite and Hercules UI packaging. Existing PGlite browser-external/eval and large-chunk warnings remain. Final CSS-only follow-ups passed a Vite asset rebuild (46.85s); Hercules UI packaging was rerun afterward. The quick-gate receipt predates only these scoped CSS and browser-harness refinements.
- Initial quick gate had two timing failures in online Personal Confirm tests. The acceptance failure reproduced on untouched base `2e113f69`; waiting for sync immediately before Confirm passed both baseline tests. Five test-only lines add call-through readiness observation; no production financial logic or original assertions changed. The complete final gate then passed.
- Empty and long-content runs: six combinations each, seven widths, zero axe violations and no page errors/overflow. Loading/error run: twelve combinations, five widths, zero axe violations or unexpected page errors.
- Independent review checked all six full-page compositions and expanded screenshots. Corrections: independent phone art, solid reading sheet, associated account labels, readable Fund/Wallet headings, TTPD table labels and solid account tiles, explicit mobile focused-entry quieting.

- Final visual follow-up also fixed unbroken account Activity currency, solid TTPD account tiles and readable audit table labels. The first four complete normal combinations passed before the last narrowly scoped CSS fixes; Newfoundland and affected account surfaces were then recaptured. Receipts retain the verification boundary explicitly.

- Final accepted normal proof: all six combinations passed; 16 Shared and 14 Personal expanded states per scene, plus four corrected account replays. Final pause/reload, focus quieting, reduced motion and offscreen suspension passed. TTPD account currency was visually rechecked and remains unbroken.
- OFL license text is included with line endings/trailing whitespace normalized; the font binary is unmodified.

## Superseded visual evidence
Jonathan rejected this first visual treatment after PR publication. Its behavior findings remain historical evidence, but its screenshots and visual acceptance claims are superseded by `2026-09-10-books-composition-revision.md`. Current screenshots and receipts in the Books evidence directory belong to that revision.
