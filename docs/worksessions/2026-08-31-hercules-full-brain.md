# Hearth worksession — Hercules full synthetic brain

- **Status:** REOPENED — RELEASE AUTHORIZED; EXACT REBASED-HEAD PROOF PENDING
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `C:\Users\jonat\OneDrive\Documents\ChatGPT\Budget App - Hercules Full Brain`
- **Branch:** `codex/hercules-full-brain`
- **Baseline SHA:** `aa56f373ab62dbfec1dfa744e6c8b3606caee4c7` (`origin/main`)
- **Head SHA:** `aa56f373ab62dbfec1dfa744e6c8b3606caee4c7`
- **PR or issue:** none
- **Risk:** High — provider planning, synthetic household disclosure, and CAD-facing answer behavior change
- **Decision owner:** Jonathan
- **Environment impact:** synthetic Development chat only; no Production, schema, secrets, or hosted-row mutation

## Household outcome

Hercules remains the conversational brain. Gemini, then Groq, may plan read-only investigations, receive the deterministic calculator results, and explain the answer in Hercules's voice. A question such as “how much are my bills” returns the scheduled total and source-backed bill rows instead of a generic refusal.

## Budget delta (5)

`+2` — scheduled-bill totals and other multi-variable reads become reliably answerable without changing journal math, posting, or Confirm.

## Engagement delta (3)

`+2` — Hercules answers naturally and uses the selected provider's reasoning instead of sounding like a regex refusal.

## Verified baseline

- `main@aa56f37` routes ordinary voice Gemini → Groq → opted-in OpenAI → Workers AI, but `/hercules/plan` still routes Workers AI → opted-in OpenAI → Anthropic.
- The live screenshot shows a Gemini marker beside the local help fallback “Hercules reads. He doesn't write. Ask a number.” for “how much are my bills.”
- Current code recognizes that literal as a bill read locally, but planner failure can still send ordinary chat without a grounded tool result.
- `bills_due` lists source-backed recurrence rows but its spoken result does not include their total.
- Chat caps Gemini/OpenAI/Workers output at 160 tokens, Groq at 256 tokens with `reasoning_effort: "low"`, third-party attempts at 1.8 seconds, and phone requests at 9 seconds.
- Jonathan explicitly authorized external providers to read all current synthetic testing data and said deterministic tools should assist lower-tier models with complicated calculations rather than replace the model's voice.

## Scope

### In scope

- Give planning the same Gemini → Groq → opted-in OpenAI → Workers AI preference as ordinary voice.
- Enable high reasoning for Gemini 3.1 Flash-Lite and Groq GPT-OSS, with larger completion budgets and deadlines.
- Supply every voice tier the same credential-free full synthetic Development context, because Jonathan explicitly authorized the full chain; deterministic tools still provide calculated facts and source trails.
- Keep deterministic tools authoritative for arithmetic and source cards; increase the validated read-plan budget only as needed.
- Add a deterministic bill-tool fallback when every planner is quiet so the provider voice still receives a grounded calculation.
- Include a scheduled-bill total in both the typed tool result and local fallback.
- Update current decisions, architecture, Hercules docs, tests, and this worksession.

### Out of scope

- Any money write, Command/Confirm authority, SQL, generic code execution, bank action, schema, secret, hosted row, Production data, or deployment.
- Exposing invite codes, credentials, device/sync internals, provider keys, or operational receipts to a model.
- Web search or vendor-hosted code execution from Hercules.

## Acceptance evidence

- [x] “How much are my bills” produces a total plus source-backed scheduled rows and never the generic help refusal.
- [x] Gemini and Groq can each return a valid typed read plan; exact provider order is deterministic and sequential.
- [x] Gemini uses high thinking; Groq GPT-OSS uses high reasoning; completion/deadline budgets no longer force tiny answers.
- [x] Full context requires the explicit Worker deployer flag plus synthetic attestation and a normal Development request, and excludes credentials/operational identifiers.
- [x] Gemini, Groq, opted-in OpenAI, and Workers AI receive the same authorized full synthetic context and deterministic tool answer.
- [x] Unknown/write-shaped tools remain discarded; model text still cannot post, invent CAD, output SQL, or widen Confirm authority.
- [x] Focused tests, TypeScript, AI-surface verification, production build, diff hygiene, and independent High-risk review pass.
- [ ] A literal `pnpm check` cannot be green on this Windows host because repository scripts/tests invoke Unix `rm`, `test`, and `bash`; equivalent build steps passed, and the only residual full-suite failure after changed expectations were repaired is `spawnSync bash ENOENT`.

## Plan

- [x] Establish exact clean baseline and reproduce the routing mismatch from current code.
- [x] Implement the bounded D-187 provider/planner/context change.
- [x] Add focused correctness, provider-order, disclosure, and authority regressions.
- [x] Run focused and full proof, then independent review.
- [x] Return a local branch handoff. Push/deploy requires a fresh explicit instruction.

## Evidence log

- Exact baseline: `origin/main@aa56f373ab62dbfec1dfa744e6c8b3606caee4c7`; clean worktree on `codex/hercules-full-brain`.
- Official Google documentation confirms Gemini 3.1 Flash-Lite supports `thinkingLevel: "high"` and up to 65,536 output tokens.
- Official Groq documentation confirms GPT-OSS 120B supports `reasoning_effort: "high"`; Groq recommends larger completion budgets for reasoning but free-tier token limits still apply.
- Focused D-187 run: 71 passed / 0 failed across bills, tools, provider routing, disclosure, quiet synthetic context, marker truth, and delayed response scope.
- Full repository run before the final two stale expectation repairs: 1,380 passed / 3 skipped / 3 failed. The timeout and quiet-context expectations were repaired and passed in isolation; the remaining `test/api.test.ts` failure is the known Windows `spawnSync bash ENOENT` harness constraint.
- `pnpm exec tsc --noEmit`: passed after the final config-test type repair.
- `pnpm ai:verify`: passed (`41` required files and proof gate).
- Equivalent production build: Vite, Hercules Pro UI, and no-`_redirects` postcheck passed; literal `pnpm build` is blocked only by missing Unix `rm` on this Windows host.
- `git diff --check`: passed.
- Independent High-risk review: PASS, no P0–P3. Reviewer verified full-chain intent, flag-off and Production-labelled bounded fallback, fixed-catalog local tools, CAD/write sanitizers, and provider-marker truth.

## Decisions

- D-187 will supersede D-105/D-115 only for the explicitly authorized synthetic Development provider payload. Production and secrets remain excluded.
- “No limit on thinking” means remove Hearth's tiny artificial reasoning/output caps; vendor context, quota, and safety limits still exist.
- Tools calculate and source facts; the provider interprets and speaks. Tool failure keeps an honest local fallback.

## Remaining uncertainty

- The exact full-context size that stays reliable under each provider's free-tier limits remains an operational measurement. A provider that rejects the payload falls through sequentially; all tiers intentionally receive the same authorized context.
- The Worker enforces a deployer attestation and normal-client guard; it cannot cryptographically prove the provenance of arbitrary browser-supplied JSON. Keep this deployment synthetic Development-only.

## Handoff

Jonathan authorized merge and deployment on 2026-08-31. Upstream assigned D-185 and D-186 while this packet was local, so the Hercules packet is D-187. Rebase onto current `origin/main` and exact-head release proof are in progress. No schema, secret, Production, or household-data mutation is authorized.
