---
name: hearth-verify
description: Independently verify a Hearth change before it is called complete, merged, or released.
disable-model-invocation: true
---

# Hearth verification

1. Inspect the complete diff against its named base.
2. Map every acceptance criterion to current evidence.
3. Re-run focused tests; do not copy older results.
4. Run `pnpm check`.
5. For UI work, verify 320px, 390px, 720px, and about 1100px plus keyboard, focus, reduced-motion, loading, empty, error, and offline behavior.
6. For money or hosted-data work, invoke both read-only trust auditors.
7. Confirm no secrets, household exports, museum planning, or Production action.
8. Report passes, failures, unsupported claims, exact commands/results, and residual risks.
