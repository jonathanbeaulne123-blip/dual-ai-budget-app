---
name: hearth-implement
description: Implement a bounded Hearth packet from an exact baseline and return a proof-backed handoff. Use for feature, fix, refactor, configuration, and documentation packets.
---

# Hearth implementation

1. Read `AGENTS.md`, `docs/AI_OPERATING_MODEL.md`, the packet, and linked current canon.
2. Record branch plus exact base/head SHAs.
3. Inspect current code and tests before accepting packet assumptions.
4. State household outcome, risk, Budget delta (5), Engagement delta (3), and expected proof.
5. Implement one coherent outcome. Expand only when correctness requires it; explain the expansion.
6. Run focused tests through `pnpm test -- --risk=<medium|medium-high|high> --focus=<test file> --focus-reason="<why it proves the change>"`. Record the elapsed time, change fingerprint, and any five-minute breach. Do not invoke the full lanes unless Jonathan explicitly requested them for this exact clean High/Release-risk SHA and the request has a recorded reference.
7. Invoke the relevant read-only auditors and the verifier.
8. Return the full `docs/AI_HANDOFF.md` contract, including exact commands/results, quick-versus-full evidence classification, and environment/data disclosure.
9. Never merge, deploy, mutate Production, apply hosted schema, or change secrets by default.
