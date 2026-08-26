# Hearth worksession — Hercules picture-in-picture auto-load

- **Status:** OPEN
- **Opened:** 2026-08-26 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/hercules-pip-autoload`
- **Baseline SHA:** `aa3ff3a68dae55c8830f30c89fc47e932dd8ddcd`
- **Rebased onto:** `e768a6d960529a158d0e379962a80439e83b6463` (Hercules Pro synced-shift read repair)
- **Head SHA:** pending publication
- **PR or issue:** pending
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** Development Worker + packaged ChatGPT skill; no books, schema, secret, or household-data mutation

## Household outcome

Hercules automatically appears on the first user turn of each new Hercules Pro chat and immediately asks ChatGPT to stay beside the conversation in picture-in-picture. When the host declines or lacks that mode, he remains fully animated inline.

## Budget delta (5)

`0` — presentation timing and plugin instructions only. Accounting tools, grounding, OAuth, consent, and Confirm are unchanged.

## Engagement delta (3)

`+2` — Hercules feels present from the first answer and aims for the persistent beside-chat surface without an extra tap.

## Verified baseline

- Live resource v2 renders animated Hercules inline and reaches `Hercules is listening`.
- The widget requested PiP only after the GLB completed, when the optional ChatGPT bridge might not yet be ready.
- MCP/server and packaged-skill language said “near the start,” which allowed the model to perform an accounting read first.
- OpenAI documents PiP as appropriate for an ongoing activity, while the host retains presentation control.

## Scope

### In scope

- Make `summon_hercules` the mandatory first tool on the first user turn.
- Request PiP at widget boot, retry only while the bridge is absent, and keep one-tap/manual plus inline fallback.
- Version the MCP resource and script request so ChatGPT/browser caches cannot preserve the old startup behavior.
- Test, merge, deploy, refresh the connector, and verify a new first-turn chat.

### Out of scope

- Forcing ChatGPT to grant PiP, running tools before a person sends the first message, ledger behavior, migrations, credentials, Production data, and 3D art/rig changes.

## Acceptance evidence

- [x] Initialize and tool metadata require `summon_hercules` first.
- [x] Widget requests PiP before model completion and retains manual/inline fallback.
- [x] Focused/full tests, typecheck, build, and Wrangler dry run pass.
- [ ] Connected ChatGPT registers resource v3 and a new first-turn chat summons Hercules first.
- [ ] Live host either grants PiP or visibly preserves the animated inline fallback.

## Plan

- [x] Define host-safe PiP and first-turn behavior.
- [x] Implement instructions, immediate request, retry boundary, and cache version.
- [x] Verify and review.
- [ ] Push, merge, deploy, refresh, and live-test.

## Evidence log

- Official OpenAI UI guide: PiP is for ongoing activity that should stay visible while conversation continues; start inline and request more space only when needed; feature-detect optional extensions and keep a fallback.
- After rebasing onto `e768a6d`, `pnpm exec vitest run test/hercules-pro.test.ts test/hercules-companion-assets.test.ts test/visibility.test.ts` → 3 files / 22 tests passed.
- `pnpm test` → 89 files / 627 tests passed.
- `pnpm exec tsc --noEmit` → clean.
- `pnpm build` → succeeded.
- `pnpm exec wrangler deploy --dry-run` → succeeded with the expected Development bindings and paid-provider/Production flags disabled.
- `git diff --check` → clean.

## Decisions

- Auto-load begins on the first user message because a blank conversation has no model turn capable of invoking an MCP tool.
- PiP is preferred, not guaranteed. Hearth requests it immediately and never makes accounting usefulness depend on host presentation.
- Resource URI v3 plus `?v=3` on the stable public module creates fresh ChatGPT and browser cache boundaries without breaking existing v2 cards.

## Remaining uncertainty

- ChatGPT can decline or defer PiP for host/product reasons not controlled by the MCP server.

## Handoff

Codex owns this through live first-turn verification.
