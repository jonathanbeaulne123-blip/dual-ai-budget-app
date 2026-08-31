# Hearth worksession — Hercules provider marker release

- **Status:** OPEN — RELEASE REVIEW
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `C:\Users\jonat\OneDrive\Documents\ChatGPT\Budget App - Hercules Provider Marker`
- **Branch:** `codex/hercules-provider-marker`
- **Baseline SHA:** `b44396912823b62c4f6bde025f7e0699651f330d` (`origin/main`)
- **Reviewed implementation SHA:** `94cb69521cc2bba38eaf3395952b4717bb6356b4` (includes the sanitizer-truthfulness fix and regression; later release-record commits are documentation-only)
- **PR or issue:** none
- **Risk:** Release — GitHub `main` and Development kitchen deployment
- **Decision owner:** Jonathan
- **Environment impact:** Development kitchen presentation only; no Production continuity, hosted rows, schema, or secrets

## Household outcome

After Hercules answers, a tiny source marker names the responder: Gemini, Groq, OpenAI, Workers AI, or On-device. The marker appears in both phone focus chat and the ordinary bubble without changing the chat layout or provider order.

## Budget delta (5)

`0` — no money meaning, books, commands, Confirm, storage, sync, or provider payload changes.

## Engagement delta (3)

`+1` — Jonathan and Bianca can quietly see which responder handled the latest Hercules reply.

## Verified baseline

- Exact clean branch was created from current `main`, then rebased without conflict onto `origin/main@b44396912823b62c4f6bde025f7e0699651f330d` after the PGlite net-worth view repair landed.
- D-184 already returns a truthful server-side provider label for ordinary chat; the phone previously reduced every remote reply to the generic word `ai`.
- The implementation allowlists provider labels and collapses an unknown label to `AI`; server text cannot become arbitrary marker copy.
- Existing provider order, external/synthetic gates, paid-provider gate, bounded prompt, sanitizers, and local fallback are unchanged.

## Scope

### In scope

- Carry the Worker `provider` field through `chatHercules`.
- Render one 10 px source marker in phone focus chat and the ordinary Hercules bubble.
- Preserve On-device and generic AI fallbacks.
- Focused/full verification, independent release review, GitHub branch/main push, Development Worker deployment, and live synthetic marker smoke.

### Out of scope

- Provider routing, models, keys, prompts, payloads, memory, chat persistence, tool planning, accounting, commands, schema, hosted rows, and Production continuity/data.

## Acceptance evidence

- [x] Gemini, Groq, OpenAI, Workers AI, generic AI, and On-device have fixed human labels.
- [x] Unknown provider text cannot render directly.
- [x] Phone and desktop marker slots exist and retain the existing quiet source style at 10 px.
- [x] Context switches and local-only answers clear or replace stale provider state.
- [x] Focused provider/marker/context checks and exact-head build pass.
- [x] Independent implementation review found no remaining P0–P3 after the sanitizer-truthfulness fix.
- [ ] Branch and `main` are pushed without secrets or private artifacts.
- [ ] GitHub CI and Cloudflare deployment pass; live kitchen response remains healthy.

## Plan

- [x] Implement the smallest UI/provider-result slice on a clean branch.
- [x] Run focused, full-suite, TypeScript, AI-surface, and production-build proof.
- [ ] Seal and independently review the exact release head.
- [ ] Push branch and fast-forward `main` after confirming remote ancestry.
- [ ] Verify workflows and live Development behavior.

## Evidence log

- Pre-rebase focused marker/Hercules proof passed `28/28`; provider-chain-inclusive proof passed `33/33`; TypeScript passed.
- Full `pnpm test` completed `1,378` passing, `3` skipped, and one host-only failure: `test/api.test.ts` could not spawn `bash` on Windows (`spawnSync bash ENOENT`). No product, provider, UI, privacy, or financial test failed; this is recorded as not fully green.
- After rebasing onto `b443969`, exact-head provider/marker/context plus the newly landed PGlite view proof passed `38/38`; `pnpm ai:verify`, TypeScript, Vite production build, Hercules Pro UI build, `_redirects` absence, and diff hygiene passed.
- Independent review found that a tool-path model label could survive even when sanitization restored the deterministic journal wording. The marker now uses a tested display-decision helper and appears only when the displayed reply actually uses that provider result; ordinary local fallback still names On-device.
- Fixed implementation `94cb69521cc2bba38eaf3395952b4717bb6356b4` passed `36/36` modified focused checks and TypeScript locally; independent review passed `47/47` focused checks and found no remaining P0–P3 issue.

## Decisions

- Reuse the existing `hercules-source` line rather than adding a badge, icon, tooltip, or new furniture.
- Display provider family names rather than hard-coding model versions that deployment config may later change.
- No merge or deployment occurs until independent exact-head review returns PASS or an explicitly accepted narrow condition.

## Remaining uncertainty

- A live provider response proves the route and label payload, while the checked UI tests prove both render slots; browser-visible text still requires the deployed bundle and an in-app chat smoke.

## Handoff

Codex owns the clean release branch and authorized Development release. Jonathan owns any future Production or non-synthetic provider decision.
