# The cellar's pay in glass, contribution banks and missing subscriptions — evidence (D-278–D-280)

**Setup.**
- Chromium 1194 (SwiftShader). Fictional Development books on the `composition=queen` proof page with `bills=1&cellar3=1&today=2026-09-12`.
- The fictional books hold:
  - a video club (not charged on the 5th, so it is **missing**)
  - a music app (charged $7 of $11 on the 3rd, so it is **smaller**)
  - Alex (fictional)'s pay on the 18th (still ahead, so **glass**)
  - Sam (fictional)'s pay on the 10th (arrived, so a **contribution bank**)
  - the Fund reconciled at $4,000, with Alex (fictional) as custodian
- The pages are driven into the cellar by the app's own two-tap gesture.

**Run.**
- Produced by `test/cellar-v3-layout.mjs` in one run: **22 records in `records.json`, 0 page errors**.
- **No page scroll** at any size or state (asserted on every capture).
- **axe:** no serious or critical rule hits inside the cellar with the missing card open (Classic, colour-contrast excluded as in the other queen proofs).

**Sizes.**
- Classic, Taylor and Newfoundland at 320×700, 390×844, 720×900 and 1100×800.
- 320×700 is the honest 320 and is measured without the chrome stand-ins. The 320×568 frame with stand-ins is the compromised one the earlier cellar evidence names; there, the room's acts cover the gate.
- The custodian's cellar ran in the **3D** room at every size (`roomWorld: "3d"`).
- The partner, agreed and reduced-motion pages use the flat world (`world=flat`), because SwiftShader sometimes never stands the Queen up on a second 3D page.
- On 320×700 the contribution bank was opened by the **keyboard** (focus, Enter), because the room's line overlaps the gate there (recorded in `picks`).

| Set | What it shows |
|---|---|
| `rail-missing-*` | The gate walked to the 5th with the rail's own keys, jars sized up to 364% with the size pane. The gate line names the mark: *A little windfall. Fictional video club — missing: not charged, Sep 5.* (asserted). The sub-line counts "1 of pay, in glass · 2 missing". No figure on the rail (asserted). |
| `missing-card-*` | The custodian opens the mark. Sparks fly once (animation asserted). "Not charged. Fictional video club wasn't charged for Sep 5 — $18.00 stayed in the water." Then "Roll the whole $18.00 into a goal kitty bank? Sam (fictional) confirms first.", with the goal picker and **Offer to roll $18.00**. |
| `smaller-card-*` | The music app: "came in $4.00 lower on Sep 3 — $7.00 instead of $11.00" (asserted). |
| `income-card-*` | Alex's glass on the 18th: "If all of your pay came in — about $1800.00 — the Fund could stand at $5500.00. Only a contribution moves money." With **Hide my pay from the jars** and **Include my private pay · this phone**. Short frames keep this line (the ordinary card's line is hidden there). |
| `contribution-card-*` | Sam's contribution kitty bank on the 10th: what Sam contributed since that pay day. |
| `partner-offer-*` | Sam's phone (`member=MEM-002`, `roll=offered`): "Alex (fictional) offers to roll $18.00 into Fictional trip to the shore", with **Yes, roll it / Not this one** (asserted). The top-bar stand-in always reads "Alex (fictional)"; that is the harness, not the app. |
| `roll-confirm-*` | Alex's phone after Sam's yes (`roll=agreed`): **Roll $18.00 into Fictional trip to the shore** opens the app's Confirm. The Confirm stands in the room, not inside the glass card. On the proof page the sheet's title renders large, exactly as the existing hammer's Confirm does there (`docs/evidence/queen-cellar/due-confirm-*`). |
| `rolled-*` | After Confirm: "Rolled $18.00 into Fictional trip to the shore through the Fund's rollover. It won't roll again." The mark shows ✓ (asserted). |
| `missing-card-reduced-*` | `reducedMotion: 'reduce'` and `data-motion="reduced"`: the sparks stand still (`animation-name: none`, asserted) and the water's waves stop. |

**Not shown.**
- Forced colours: the glass, the banks and the ghost become CanvasText on Canvas, the mark becomes Highlight, and the sparks hide. This is covered by CSS and was not captured.
- The mark after a late charge (it is gone) and the hide/show round trip are covered by `test/cellar-v3-ui.test.ts`.
- **Zoom state.** On the wide frames the harness's zoom-out (six presses back) lands at 89%, not 100%, because the size pane's steps above 225% are ×1.5. The cards there are shown at 89%.
