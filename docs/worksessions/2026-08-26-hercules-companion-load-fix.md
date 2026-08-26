# Hearth worksession — Hercules companion cross-origin load repair

- **Status:** CLOSED — merged, deployed, connector refreshed, and visually verified
- **Opened:** 2026-08-26 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/hercules-companion-load-fix`
- **Baseline SHA:** `d2650440b9547996b7d728085b30bdb60abdf8e7`
- **Head SHA:** `cb77cad3ec3b11670428ed7985fd9bbe22bfbd0e`
- **PR or issue:** [#143](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/143)
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** Development Worker presentation assets; no ledger, schema, secret, or Production-data mutation

## Household outcome

Animated Hercules loads inside ChatGPT's sandbox. If the JavaScript module, WebGL renderer, or model cannot load, the card stops waiting and shows the static Hercules mark with an honest status.

## Budget delta (5)

`0` — this changes only the MCP Apps presentation resource and public static-asset headers. Books, reads, writes, OAuth, and Confirm are unchanged.

## Engagement delta (3)

`+2` — the promised living companion becomes visible, while failure remains useful instead of looking permanently unfinished.

## Verified baseline

- Fact: merged D-139 rendered the companion shell in ChatGPT but remained at `Waking Hercules…`.
- Fact: the HTML resource runs on an OpenAI sandbox origin while its module and GLB are served by the Hearth Worker origin.
- Fact: the Worker returned those public assets without `Access-Control-Allow-Origin`, so the browser could not load the cross-origin module.
- Inference: the GLB would meet the same cross-origin boundary after the module loaded.

## Scope

### In scope

- Add narrowly scoped cross-origin response headers to the three public companion assets.
- Version the MCP UI resource URI so ChatGPT does not reuse the broken resource document.
- Add independent module and model-load timeouts with a static fallback.
- Add focused tests, deploy the Worker after merge, refresh the connector, and visually verify a new summon.

### Out of scope

- Ledger facts, calculation tools, OAuth identity, write consent, migrations, secrets, Production continuity, and the 3D model's art or rig.

## Acceptance evidence

- [x] Focused MCP resource and asset-header tests pass.
- [x] Typecheck, build, full tests, and Wrangler dry run pass.
- [x] Exact public JS/GLB/SVG responses carry cross-origin headers; unrelated assets do not.
- [x] Refreshed ChatGPT card renders the 3D model and reaches `Hercules is listening`.
- [x] No credentials, rows, command authority, schema, or household data changed.

## Plan

- [x] Reproduce and identify the sandbox/Worker origin boundary.
- [x] Add URI v2, exact asset headers, and two-stage fallback.
- [x] Verify, review diff, and record evidence.
- [x] Push, merge, deploy, refresh, and visually verify.

## Evidence log

- `origin/main` at open: `d2650440b9547996b7d728085b30bdb60abdf8e7`.
- ChatGPT iframe shell: controls and plaque rendered; status remained `Waking Hercules…`; no 3D model or static fallback appeared.
- Cloudflare Static Assets guidance: when the Worker runs first, response headers may be attached in Worker code; public CORS example uses `Access-Control-Allow-Origin: *`.
- OpenAI MCP Apps guidance: exact resource/connect domains must be declared and a breaking UI change needs a new resource URI because the URI is the cache key.
- Focused: `pnpm exec vitest run test/hercules-pro.test.ts test/hercules-companion-assets.test.ts` → 2 files, 10 tests passed.
- `pnpm exec tsc --noEmit` → clean.
- `pnpm build` → passed; companion bundle and preserved-rig model emitted.
- `pnpm test` → 89 files, 622 tests passed.
- `pnpm exec wrangler deploy --dry-run` → passed with Assets + Workers AI bindings and paid-provider flags still false.
- PR #143 checks: Pages success, both test checks success, Workers Builds success, Supabase Preview skipped on the PR.
- Merge: `cb77cad3ec3b11670428ed7985fd9bbe22bfbd0e`; main Pages deploy and Workers Builds both succeeded.
- Connector refresh changed the registered template from `ui://hearth/hercules-companion-v1.html` to `ui://hearth/hercules-companion-v2.html`.
- Live ChatGPT proof: the iframe rendered the 3D model, exposed Pause, and reported `Hercules is listening` instead of `Waking Hercules…`.

## Decisions

- Public wildcard CORS applies only to the three non-sensitive presentation files, not the site or MCP endpoint.
- Keep existing filename versions; bump the MCP HTML resource URI to v2, which is the cache boundary ChatGPT uses.
- Eight seconds detects a missing module; twelve seconds detects a stuck model. Either failure preserves the tool result and shows Hercules statically.

## Remaining uncertainty

- ChatGPT picture-in-picture availability remains host-controlled. Inline animation and bounded static fallback are verified; the card's current host kept Hercules inline.

## Handoff

Complete. PR #143 is merged to `main`; the main Worker deployment succeeded; Hercules Pro is refreshed to the v2 template; live ChatGPT rendered animated 3D Hercules with `Hercules is listening`. Jonathan can keep playtesting the model framing and motion as a later aesthetic adjustment.
