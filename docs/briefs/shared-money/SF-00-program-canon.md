# SF-00 — Program canon

**Target AI:** Codex coordinator or documentation implementer  
**Exact baseline:** `origin/main@54096553825bdaa331dca26c2dc963d754e1c583`
**Risk:** Release (direction); runtime impact none  
**Budget delta (5):** actual `0`, program potential `+5`  
**Engagement delta (3):** actual `0`, program potential `+2`

## Objective

Create one decision-complete, evidence-gated execution program for Hearth shared money without changing runtime authority.

## Required changes

1. Add D-174 with the locked product decisions and explicit preservation of D-172.
2. Add the canonical program index, worksession, Phase 0 packets, roadmap pointer, docs index pointer, and handoff.
3. Add structural tests for the safety boundary and packet completeness.

## Non-scope and invariants

No runtime, schema, provider, secret, data, Production, deploy, merge, or push change. The Fund is virtual. Current financial posting requires visible Confirm. Roadmap statements are not shipped evidence.

## Acceptance

- Every locked decision appears once in the canonical index.
- Phase 0 has exact, independently executable packets.
- Tests fail if the index implies current automatic posting or held deposits.
- `pnpm check` result and all environmental limitations are recorded.

## Commands

```text
git status --short --branch
pnpm exec vitest run test/shared-money-program.test.ts
pnpm check
```

## Handoff

Report exact SHA, changed files, test results, and all disclosures. Stop before push or merge.
