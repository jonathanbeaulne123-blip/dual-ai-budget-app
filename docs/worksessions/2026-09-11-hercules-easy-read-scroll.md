# Hercules Easy Read scroll repair

Jonathan reported Easy Read cannot be clicked and does not move with chat. Base: 9abee76b7c00722f9d3fd0e834b8e5220c42ffdd. The mobile toggle was an extra grid child outside the conversation scroller, breaking the expected close/portrait/body rows (and short-viewport close/body layout). Desktop also placed it outside the scroller.

Move Easy Read into the conversation content in both layouts; group onboarding toggle and content in one scrolling section. Keep the existing mode persistence, typography, 44px target, composer and close behavior. Budget (5): no changes to review or money authority. Engagement (3): a reachable reading control that moves with chat. Risk Medium; existing confirmed-chat gates apply.

Verification: synthetic real-browser checks across three themes at 390x500 and 1440x1000 verify click on/off, an exact 80px movement with chat scroll, return/re-click and visible composer. Existing private chat tests retain pending/ACK and privacy assertions, with a toggle regression. No external provider or ledger writes in browser proof. Physical keyboard/device acceptance remains unclaimed. Corrective Development release continues the authorized UX fixes; no schema or Production work.
