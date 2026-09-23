# Hearth worksession — Library and Pottery Studio

- Status: LOCAL REVIEW CANDIDATE — validation limitations recorded
- Opened: 2026-09-22 (America/Toronto)
- Owner and decision owner: Jonathan
- Integration owner: Codex; bounded read-only mechanics and visual reviewers
- Branch: codex/authored-interiors
- Baseline: aaf7867d (fresh origin/main, clean isolated checkout)
- Risk: Medium-High — interior navigation and creative selection; no money writer changes
- Environment impact: local fictional review only

## Household outcome
Two deeply authored, useful interiors in the actual app: a lamplit Library that opens the right ledger division and a Pottery Studio whose wheel, glaze bench and kiln carry the same selected piece. The harbour exterior and current authorities remain.

## Budget delta (5)
Improve access to exact existing book figures and original source tools; preserve projections, scope, Final Confirm and cloud acknowledgement. No new arithmetic.

## Engagement delta (3)
Replace anonymous interiors with crafted architecture, distinct room compositions, direct furniture interaction and clear working surfaces in Classic, Taylor and Newfoundland.

## Verified baseline
Live Chrome inspection reached the Cottage, Library and Standing Book. Source review found pottery station objects discarded by houseLifeRoute and studio selection returns routed to Together instead of Making. Making compass opens a generic studio instead of its room. These are presentation/continuity defects, not permission to change creative or money authority.

## Scope
Library and Kiln architecture, readable room controls, Standing Book presentation, pottery station and selection continuity, room-to-tool return. Distinct narrow/wide compositions. Existing optional walking stays available.

## Out of scope
Deployment, merge, native, hosted schema/services, private data export, exhaustive gates, old PR #501 recovery.

## Acceptance
- [x] Working room → selected tool → exact room return.
- [x] Shape → Paint → Kiln uses existing creative authority and preserves selection across reload.
- [x] Book divisions retain canonical figures and original controls.
- [ ] Three themes, narrow/wide, keyboard and reduced motion reviewed.
- [ ] Focused gate, type/build, independent review, honest measured evidence.

## Art direction
Classic Library: walnut, bottle-green cabinetry, brass, arched garden window, oxblood bound folio. Taylor Library: original archive/album construction using cream manuscript paper, black ink, charcoal cases and typewritten slips; references to official TTPD book-bound jacket and original reputation monochrome vocabulary, no copied photography or lyrics. Newfoundland Library: painted blue-green harbour joinery, merchant ledger, stone and seaward light.
Classic Studio: ochre plaster, terracotta tiles, turned wooden wheel and cobalt jars. Taylor Studio: album-making atelier, ink/cream storage and rose wax, paper swatch boards. Newfoundland Studio: outport workshop, shiplap, stone kiln, sea-glass glazes and oilcloth.

## Reference
https://store.taylorswift.com/products/the-tortured-poets-department-vinyl-bonus-track-the-manuscript (official reference; original interpretation in geometry/materials, no assets copied).

## Evidence log
- Actual-app browser, fictional household only: entered Library, opened Today, inspected canonical figures, returned to room, entered Making.
- Glaze bench opened directly with bench=paint. Explicitly created a piece, applied a sea-glass dip, selected pear body, reviewed revision 3 and fired it. Creative revision 4 was acknowledged. Cabinet showed Fired / revision 4 and reopened the same pear-shaped piece and paint. No ledger money command was executed by these actions.
- Desktop (1440px) and phone (390px) inspected in Chrome. Fixed duplicated headers, cramped return control and cabinet overlap; later phone header CSS has source review but needs a fresh screenshot.
- Independent mechanics/privacy review found and resolved missing bench/selection dependencies, invalid bench routes, extra return steps, camera-only bench leakage and mismatched furniture bounds.
- First focused pass: 63/64 tests passed; one 15s room-budget test timed out. 136.00s total. No timeout is counted as a pass.
- Standalone TypeScript completed without diagnostics. Quick gate TypeScript passed in 517.6s, exceeding its budget. Gate interrupted during discovery after approximately 12 minutes; not green.
- Required App-startup-inclusive run was stopped after approximately 10 minutes with overlapping act warnings and no completed summary; incomplete, not passed.
- Final candidate focused run: 7 suites / 70 tests passed in 34.35s. Covers room resources and doors, source fences, real Books divisions, route and creative selection, canonical creative UI, and month-rehearsal command sync. Exact reproduction command is in the review packet.
- Pre-final bounded run: 69/70 passed in 88.12s; only failure expected the deliberately removed legacy bank-only kiln heat label. Room recheck after correcting that assertion: 32/32 in 16.35s. Navigation/geometry recheck: 18/18 in 14.44s.
- Web bundle before final drawer/wardrobe correction: passed in 4m46s. Workspace TypeScript and Hercules UI build completed successfully. Final candidate web bundle passed in **1m59s** after the last source corrections.
- Final independent read-only review: phone drawer clipping corrected with bounded top/bottom and shrinking scroll region; wardrobe route clears studio bench while retaining selection. No remaining concrete blocker found in bounded source review. Large cabinet pagination is an explicit scale gap.
- Browser control later repeatedly timed out/detached. Complete all-theme/all-width, reduced-motion, screen-reader and physical-device acceptance remain open.
