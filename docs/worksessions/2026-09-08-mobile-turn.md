# Mobile B9 — Claude's Turn

- Status: LOCALLY VERIFIED; stacked draft PR follows
- Branch: codex/mobile-b9-turn
- Exact base/pre-implementation HEAD:9c2646547f82f89c74eb72b199f58121610f567d (B8, PR390)
- Sole writer root. Medium-High risk; Budget(5)+2; Engagement(3)+2.

Retain Claude's whole-month shape and replace tiny hover targets/nested horizontal scrolling with one date read-head and visible exact readout. Source authority: supplied instruments HTML lines719–721 and packet15.3/15.4. No plate exists for B9. Existing paper/card typography and source colors remain.

Independent financial findings: Level selects existing WalkPoint balances in canonical order, never recomputes fundWalk using selected date. Today can contain accepted balance and projected obligations; show separately. Empty days carry the last exact prepared value. Negative projections remain signed. Course selects existing operating/Kitty point pair through selected past/today date. Its aggregate reserve is drawn at tomorrow by coursePaths but is not a dated forecast; future exact-day readings must remain unavailable. Accepted future-dated events are not a forecast daily closing. Unopened/untied refuse numeric inspection; tied zero is valid. No financial writer or new forecast model.

Retain only date selection and rederive facts from current props. Source/scope/month replacement cancels active pointer state. Desktop and phone share source semantics; redraw phone geometry to fit full month without shrinking labels below10.5px. No new competing date handle in the Reach's shift-selection surface. Confirm/current Fund/Ask remain unchanged. Existing closed month remains readable, not a reconstructed historical snapshot.

Proof plan: same-day order and exact balances; today's actual plus scheduled; blank dates; negatives;28/29/30/31day endpoints; unopened/untied/zero; future Course/aggregate reserve refusal; source replacement duringdrag; native verticalscroll/horizontalreadhead/cancel/keyboard/focus; allCSSwidths320/390/720/1100/200%. Required Medium-High focused gate and independent financial/UX/verifier. Separate stacked draft PR; no merge/deploy/schema.

## Implementation and hosting decision

DateTurn is one native, named44px range with Previous/Next44px stops. It stores only the selected day. Keyed source/room/month replacement retires input and restores focus only within the same scope. Pointer cancel, lost capture, second pointer and Escape restore the starting day and suppress late native input. The first Escape inside the Ledge cancels only the drag; a second closes the sheet.

The newer Fold/Spread/Reach/Trust composition takes precedence over the older MonthSpread placement. The live phone control is inside standalone custodian SharedFundTrust's existing drawing and paperbox. Its date interval matches the existing chart exactly, including next month; the fictional September1–October8 view therefore has38 stops. Contributor Reach and its fallback receive no competing date handle. Classic Level and the older MonthSpread retain their current hosts; this slice creates no new phone Home or MonthSpread entrypoint. MonthSpread phone evidence is component evidence, not a newly reachable mobile route.

The live current Fund headline never changes during inspection. Today shows accepted Fund separately from any selected-source scheduled values. Future facts use the selected Trust lower/expected paths and stop at its source wall. Projected readings retain the original projection pill and warm, dashed paperbox. The Course carries exact prepared operating/Kitty pairs through today; its aggregate reserve no longer appears as an arbitrary tomorrow path. Future time is visibly undated, and individual accepted future events never become a daily closing forecast. Phone drawing fits the full month and retains payday timing marks with HTML axis labels.

## Evidence

- Focused final core/UI/Trust12tests passed4.04s: `/tmp/b9-focused3.log`. Existing MonthSpread40plus earlier core/Trust6 passed14.72s. Initial UI failures were harness errors (invalid proposal mutation and wrong story signature), repaired before final proof; no product failure hidden.
- All-main-CSS Playwright driver `/tmp/hearth-mobile-b9-evidence/verify.mjs` passed20layout/state cases:320/390/720/1100 across actual FundStage and legacy Course/Level, zero/empty/Personal, long text at200%body zoom, untied/loading/error. No horizontal document/course overflow or page errors. Inspected actual screenshots; original Fraunces/Figtree/Plex type and card ground retained. Body zoom does not prove the app currently permits native user zoom.
- `/tmp/hearth-mobile-b9-evidence/gesture.mjs` passed320/390 horizontal endpoint, Escape rollback, late native input suppression, touch vertical scroll200/197px, unchanged current headline. Reduced-motion contexts used.
- `/tmp/hearth-mobile-b9-evidence/sheet.mjs` passed320/390 actual FundLedge: first Escape restores day and keeps sheet; second closes and returns grip focus. No financial action issued.
- Financial, UX and source-verifier independent read-only reviews found no remaining source blocker. Native evidence supplied separately after review.
- All fixtures are fictional local Development components/prepared models. No physical phone, authenticated full-App browser, hosted, exhaustive or release proof. Existing native-zoom restriction remains an integration repair.

## Delivery

Separate stacked draft PR on B8. Implementation HEAD is the commit carrying this file, resolved by Git/PR; no self-referential fabricated SHA. No merge, deploy, hosted schema, secrets or Production operation. Next owner Codex continues the twelve original tweaks individually, preserving Claude's style and Final Confirm semantics.

## Final focused gate

`pnpm test -- --risk=medium-high --base=9c2646547f82f89c74eb72b199f58121610f567d --focus=test/turn-reading.test.ts --focus=test/turn-ui.test.ts --focus=test/month-spread.test.ts --focus=test/fund-trust.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason="Date inspection selects exact prepared balances and preserves current Fund, selected Trust sources, lifecycle isolation, startup and rehearsal"` passed139/139plus TypeScript/AI/diff in231.304seconds. Fingerprint`601cc33ce2be332b6c0456aed14f2d9252cf76eb98b81a5ec1f4f332fa641855`; no five-minute breach. Exact log`/tmp/b9-gate1.log`. Final documentation appended after gate; functional sources unchanged.
