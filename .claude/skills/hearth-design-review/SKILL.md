---
name: hearth-design-review
description: Design, implement, or review Hearth UI and Office work using Dual Course, accessibility, mobile/wide behavior, and visual verification.
effort: high
---

Work on: $ARGUMENTS

1. Establish current branch, commit, PR, task state, and relevant living spec.
2. State household job, Budget delta (5), Engagement delta (3), and risk.
3. Inspect current code and tests; an assignment packet is not proof of implementation. When mapping or adding tap targets, consult `docs/BUTTON_INVENTORY.md`, then verify labels in `src/`.
4. Keep, reshape, or refuse each material idea with a concrete reason.
5. Implement the smallest coherent version that creates the household outcome. Explain justified expansion.
6. Use fictional Development/demo data.
7. Verify relevant states at 320px, 390px, 720px, and approximately 1100px, including keyboard, focus, contrast, reduced motion, and Add/Confirm clearance.
8. Run focused tests, then `pnpm check`.
9. Delegate a final read-only review to `hearth-ux-auditor`.
10. Return the complete `docs/AI_HANDOFF.md` contract and literal delivery state.
