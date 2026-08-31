# Hearth worksession — Hercules provider fallback release

- **Status:** CLOSED — MERGED TO MAIN; GITHUB DEPLOYED
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `C:\Users\jonat\OneDrive\Documents\ChatGPT\Budget App - D169 Provider Release`
- **Branch:** `codex/hercules-provider-fallback-release`
- **Baseline SHA:** `f47a2232d8e818f30562dbee347a630ac1632aeb` (`origin/main` after final pre-merge refresh)
- **Head SHA:** `1650910ebe9c9a8343b580116f69807a0d42c9f4` (merged and GitHub-deployed release record; runtime commit `d131571205f9cddad19fecff440e1eb359da2b00`)
- **PR or issue:** none
- **Risk:** Release — external provider secrets plus live Development Worker routing
- **Decision owner:** Jonathan
- **Environment impact:** Development testing; Production continuity remains disabled and no hosted rows/schema are touched

## Household outcome

Ordinary in-app Hercules tries Gemini, then Groq, skips unconfigured OpenAI, then uses Workers AI and finally the existing deterministic phone answer. A provider outage no longer silences synthetic household testing.

## Budget delta (5)

`+1` — the existing read-only, member-scoped, grounded answer path becomes more resilient. No accounting, command, Confirm, sync, or posting behavior changes.

## Engagement delta (3)

`+2` — Ask keeps working through independent provider failures while preserving the same Hercules voice and local fallback.

## Verified baseline

- Clean dedicated worktree refreshed onto exact `origin/main@f47a2232d8e818f30562dbee347a630ac1632aeb` before final review and main sync.
- Pre-change ordinary chat order was Workers AI → opted-in OpenAI → opted-in Anthropic.
- Jonathan explicitly stated every provider payload is synthetic test data and authorized external processing of the normal bounded `/hercules/chat` prompt for full Gemini/Groq integration without OpenAI.
- Every external chat hop stays fail-closed unless deployment config explicitly opts into external providers and attests the testing environment classification `synthetic`; secret presence alone is insufficient. This is a deployment attestation backed by Jonathan's scope authorization, not request-content detection.
- Gemini and Groq user-scope credentials are present. No local OpenAI credential was available; secret-name inspection found an older Worker-side `OPENAI_API_KEY`, but `HERCULES_ALLOW_PAID_PROVIDERS=false` keeps it inert for ordinary chat. No secret value was printed or inspected.
- Google unpaid-service terms and Groq retention controls were disclosed before Jonathan authorized full synthetic integration.
- Existing D-103/D-105/D-112/D-115/D-116/D-121 safeguards remain outside provider choice.

## Scope

### In scope

- Ordinary `POST /hercules/chat`: Gemini → Groq → opted-in OpenAI → Workers AI.
- Checked-in deployment config records `HERCULES_ALLOW_EXTERNAL_PROVIDERS=true` and `HERCULES_EXTERNAL_DATA_CLASSIFICATION=synthetic`; any other classification keeps every ordinary external chat hop inert. OpenAI additionally retains its paid-provider gate.
- Server-only Gemini/Groq secrets, public model names, and 1.8-second third-party attempt deadlines.
- Provider order, timeout, malformed/empty response, sanitizer, disclosure, and configuration tests.
- D-184 living decision/docs, release review, Worker secret installation, Development Worker deployment, Git `main` sync, and synthetic smoke.

### Out of scope

- Planner, document scanning, Hercules Pro, accounting, commands, schema, hosted rows, Production continuity/data, OpenAI key creation, and household mutation.
- Non-synthetic or Production data processing and any household mutation.

## Acceptance evidence

- [x] Exact sequential order and truthful provider labels.
- [x] Third-party failures/timeouts fall through once; providers never race.
- [x] Gemini/Groq keys stay only in Worker secret storage; no `VITE_`, source, docs, logs, or snapshot values.
- [x] OpenAI is skipped without a key and remains behind both the external-provider and paid-provider gates.
- [x] Every provider receives the same already-bounded prompt and the same Worker/phone sanitizers remain authoritative.
- [x] Origin/rate checks precede all provider attempts; local fallback and response-identity rejection remain.
- [x] Focused proof, `pnpm check`, clean diff, independent review, secret metadata, deployment version, and synthetic live smoke are recorded honestly.

## Plan

- [x] Isolate current `origin/main` in a clean dedicated worktree.
- [x] Port and renumber the provider router as D-184.
- [x] Run focused/full proof and independent Release review.
- [x] Install Gemini/Groq Worker secrets without exposing values.
- [x] Deploy the exact reviewed candidate and run a synthetic live smoke.
- [x] Rebase onto current `main`, obtain an exact-head independent pass, push/merge, and verify both GitHub workflows plus the live route.

## Evidence log

- Initial proof ran on `da7fe2e2b079d88a8d88e934f0641be932654b86`; pre-deploy `git ls-remote` detected newer `main`, so the candidate was rebased onto `189ba9785c32b86177c8e8b00eaf990d1cf6c465` and renumbered from the newly occupied D-183 to D-184 before deployment.
- `node --check workers/site.js`, `pnpm exec tsc --noEmit`, `pnpm ai:verify`, `git diff --check`, and the credential/VITE assignment scan passed.
- Focused provider/disclosure/authority/context proof passed `40/40`; the deployment-config suite passed `8/8`, including its Bash/Python sanitizer harness.
- The full `pnpm check` test phase completed `1313` passing, `3` skipped, and one pre-existing Development stress projection test timing out at 15 seconds; its isolated retry passed in 10.18 seconds. `pnpm build` then passed separately. This is recorded as a flaky full-check result, not a fully green `pnpm check`.
- Independent Release review found no remaining P0/P1 after Jonathan's explicit external-processing authorization and the all-external-provider activation gate; its two documentation wording findings were corrected before the candidate commit.
- Exact post-rebase source `f55e45c986f88b209309f2faecb9601fae12a946` passed `68/68` focused provider, disclosure, authority, deployment, and newly landed Month-Rehearsal tests; `pnpm build`, TypeScript, `pnpm ai:verify`, diff hygiene, and credential/VITE scans passed. Independent exact-head review found no P0/P1/P2 source issue and returned a conditional pass only because the full-suite flake above was not a green `pnpm check`. Codex accepted that narrow unrelated timeout exception for this direct Development release after its isolated pass.
- Initial secret installation failed closed because Cloudflare's newest stored version was not active. The reviewed source then deployed as Worker version `6193baaa-5f77-4169-996a-7c9d0266b2a9`; subsequent secret-change deployments were `c26207e0-8a9e-40ef-8dfc-e5263a39287a` and final active `3fd01f32-5f22-4557-95e8-81318e920020`.
- Secret-name metadata confirms `GEMINI_API_KEY` and `GROQ_API_KEY` in Worker secret storage. Values never entered source, docs, logs, snapshots, or chat.
- Live synthetic `POST /hercules/chat` returned HTTP 200 with truthful provider `gemini`. A separate live synthetic Groq request returned HTTP 200 with `finish_reason=stop`; deterministic Worker tests prove automatic Gemini-failure → Groq fallthrough. No debug override was added to force a live app failure.
- After a fresh full `pnpm check` passed (`206` files passed, `2` skipped; `1,344` tests passed, `3` skipped, `0` failed; TypeScript, Vite production build, Hercules Pro UI, and `_redirects` gate green), independent exact-head review returned PASS. The release rebased cleanly onto `origin/main@f47a2232d8e818f30562dbee347a630ac1632aeb` and fast-forwarded `main` to `1650910ebe9c9a8343b580116f69807a0d42c9f4`.
- GitHub CI run `33429616699` and Cloudflare Workers run `33429616590` both completed successfully for exact main `1650910ebe9c9a8343b580116f69807a0d42c9f4`. Cloudflare activated Worker version `9886a685-0ce6-4807-b657-51b99c77fffb`.
- Fresh post-main-deploy synthetic smoke returned HTTP 200 with truthful provider `groq`, proving live app-level Gemini → Groq fallthrough without a debug override. The root route also returned HTTP 200 with `Cache-Control: no-store`.

## Decisions

- D-183 is assigned to Bianca Month on current `main`; this provider packet is D-184.
- The older Worker-side OpenAI secret remains untouched and inert because `HERCULES_ALLOW_PAID_PROVIDERS=false`; ordinary chat therefore skips OpenAI as requested.
- Planner and document-scan routes remain unchanged.

## Remaining uncertainty

- Gemini availability or quota can vary, so Groq may truthfully serve a request when the first hop is unavailable; this is the intended sequential fallback behavior.
- Non-synthetic or Production use remains outside this release authorization.

## Handoff

The release is merged to `main`, both GitHub workflows passed, and the live Development Worker was smoke-tested. Jonathan retains authority over any later non-synthetic or Production use.
