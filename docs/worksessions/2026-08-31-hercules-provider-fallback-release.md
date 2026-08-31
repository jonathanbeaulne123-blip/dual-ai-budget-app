# Hearth worksession — Hercules provider fallback release

- **Status:** OPEN
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `C:\Users\jonat\OneDrive\Documents\ChatGPT\Budget App - D169 Provider Release`
- **Branch:** `codex/hercules-provider-fallback-release`
- **Baseline SHA:** `189ba9785c32b86177c8e8b00eaf990d1cf6c465` (`origin/main` after pre-deploy refresh)
- **Head SHA:** exact local release commit recorded after final amend
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

- Clean dedicated worktree refreshed onto exact `origin/main@189ba9785c32b86177c8e8b00eaf990d1cf6c465` before release sealing.
- Current ordinary chat order is Workers AI → opted-in OpenAI → opted-in Anthropic.
- Jonathan explicitly stated every provider payload is synthetic test data and authorized external processing of the normal bounded `/hercules/chat` prompt for full Gemini/Groq integration without OpenAI.
- Every external chat hop stays fail-closed unless deployment config explicitly opts into external providers and attests the testing environment classification `synthetic`; secret presence alone is insufficient. This is a deployment attestation backed by Jonathan's scope authorization, not request-content detection.
- Gemini and Groq user-scope credentials are present; no OpenAI credential is present. Values were not printed or inspected.
- Google unpaid-service terms and Groq retention controls were disclosed before Jonathan authorized full synthetic integration.
- Existing D-103/D-105/D-112/D-115/D-116/D-121 safeguards remain outside provider choice.

## Scope

### In scope

- Ordinary `POST /hercules/chat`: Gemini → Groq → opted-in OpenAI → Workers AI.
- Checked-in deployment config records `HERCULES_ALLOW_EXTERNAL_PROVIDERS=true` and `HERCULES_EXTERNAL_DATA_CLASSIFICATION=synthetic`; any other classification keeps every ordinary external chat hop inert. OpenAI additionally retains its paid-provider gate.
- Server-only Gemini/Groq secrets, public model names, and 1.8-second third-party attempt deadlines.
- Provider order, timeout, malformed/empty response, sanitizer, disclosure, and configuration tests.
- D-184 living decision/docs, release review, Worker secret installation, direct Development Worker deployment, and synthetic smoke.

### Out of scope

- Planner, document scanning, Hercules Pro, accounting, commands, schema, hosted rows, Production continuity/data, OpenAI key creation, and household mutation.
- Git push/merge unless Jonathan separately requests it.

## Acceptance evidence

- [x] Exact sequential order and truthful provider labels.
- [x] Third-party failures/timeouts fall through once; providers never race.
- [x] Gemini/Groq keys stay only in Worker secret storage; no `VITE_`, source, docs, logs, or snapshot values.
- [x] OpenAI is skipped without a key and remains behind both the external-provider and paid-provider gates.
- [x] Every provider receives the same already-bounded prompt and the same Worker/phone sanitizers remain authoritative.
- [x] Origin/rate checks precede all provider attempts; local fallback and response-identity rejection remain.
- [ ] Focused proof, `pnpm check`, clean diff, independent review, secret metadata, deployment version, and synthetic live smoke are recorded honestly.

## Plan

- [x] Isolate current `origin/main` in a clean dedicated worktree.
- [x] Port and renumber the provider router as D-184.
- [x] Run focused/full proof and independent Release review.
- [ ] Install Gemini/Groq Worker secrets without exposing values.
- [ ] Deploy the exact reviewed candidate and run a synthetic live smoke.

## Evidence log

- Initial proof ran on `da7fe2e2b079d88a8d88e934f0641be932654b86`; pre-deploy `git ls-remote` detected newer `main`, so the candidate was rebased onto `189ba9785c32b86177c8e8b00eaf990d1cf6c465` and renumbered from the newly occupied D-183 to D-184 before deployment.
- `node --check workers/site.js`, `pnpm exec tsc --noEmit`, `pnpm ai:verify`, `git diff --check`, and the credential/VITE assignment scan passed.
- Focused provider/disclosure/authority/context proof passed `40/40`; the deployment-config suite passed `8/8`, including its Bash/Python sanitizer harness.
- The full `pnpm check` test phase completed `1313` passing, `3` skipped, and one pre-existing Development stress projection test timing out at 15 seconds; its isolated retry passed in 10.18 seconds. `pnpm build` then passed separately. This is recorded as a flaky full-check result, not a fully green `pnpm check`.
- Independent Release review found no remaining P0/P1 after Jonathan's explicit external-processing authorization and the all-external-provider activation gate; its two documentation wording findings were corrected before the candidate commit.

## Decisions

- D-183 is assigned to Bianca Month on current `main`; this provider packet is D-184.
- OpenAI stays unconfigured and therefore skips to Workers AI.
- Planner and document-scan routes remain unchanged.

## Remaining uncertainty

- Live Gemini/Groq availability and quota are unproven until the synthetic post-deploy smoke.
- A direct deployment without a matching Git push can later be replaced by the next `main` deployment; this must be disclosed.

## Handoff

Codex owns the clean local candidate and bounded Development release. Jonathan owns any later push/merge and any non-synthetic or Production use.
