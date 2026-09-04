# Hearth worksession — onboarding witness release

- **Status:** OPEN; LOCAL RELEASE REVIEW PASS
- **Opened:** 2026-09-04 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/onboarding-8-witness-release`
- **Baseline SHA:** `759e84bd3529f8762e56f5752c9fe63940e5d872`
- **Head SHA:** pending final release commit
- **PR or issue:** pending
- **Risk:** Release (Medium implementation; Development publication)
- **Decision owner:** Jonathan
- **Environment impact:** Development kitchen; Production continuity remains off

## Household outcome

A witness sees which partner is conducting, sees only Shared chapter status and scope as accepted evidence lands, and never receives a control that writes the conductor's state. A noticed completion announces politely once per persisted probe/evidence event without stealing focus or repeating when Hercules is reopened.

## Budget delta (5)

`+1`: the Shared-only scope label and status vocabulary make the evidence boundary visible without changing accounts, entries, balances, commands, or posting authority.

## Engagement delta (3)

`+2`: the non-conducting partner gets a calm, useful live surface instead of a dead screen or a score.

## Verified baseline

- `origin/main@759e84bd3529f8762e56f5752c9fe63940e5d872` is the current fetched baseline.
- The supplied mail patch was authored against older `main@300cf8d` but applied cleanly with plain `git am` to the current baseline.
- The reviewed companion artifacts are committed at root: `HEARTH_BUILD_MANUAL.md`, `HEARTH_UX_PACKET.md`, and `hearth-ux-plates.html`.
- Slice 7 is already in the baseline. No workbook, chat export, credential, secret, or `.env` file is part of the diff.

## Scope

### In scope

- The Slice 8 witness component and its use from the existing onboarding shell.
- Shared-only witness presentation with `opened`, `waiting`, or `submitted` status words and explicit scope provenance.
- A polite noticed live region keyed first by `probeEvidenceKey`, with a stable accepted-evidence fallback until later probe commands write that field.
- Per-tab claimed-notice persistence so the same event does not reannounce after evidence disappearance or shell remount.
- Focus preservation, privacy, source fences, and responsive release evidence.

### Out of scope

- Chapter-specific forms or scripts, Slice 9 return furniture, probe-writing commands, onboarding auto-entry, money behavior, PGlite/schema, Supabase/hosted rows, secrets, provider settings, migrations, Production continuity, and household-data mutation.

## Acceptance evidence

- [x] The patch applies cleanly to current `origin/main`.
- [x] Witness evidence remains routed through `witnessEvidenceFor` and never shows a self-Personal fixture.
- [x] Witness rows use plain status words and explicit Shared scope rather than conductor evidence values.
- [x] The noticed live region is polite, preserves focus, and is suppressed after a same-event remount.
- [x] Focused Slice 7/8/copy proof passes: 3 files, 66 tests.
- [x] TypeScript and `git diff --check` pass on the amended working tree.
- [x] Refreshed integrated proof covers waiting, noticed, and blocked states at 320, 390, 720, and 1100 px with no horizontal overflow, one pause control, preserved witness focus, and a polite live region only for noticed evidence.
- [x] Independent release and UX re-reviews report no P0–P2 findings.
- [ ] Final quick gate, production build, exact-head GitHub CI, merge, Cloudflare workflow, and live no-store asset proof.

## Plan

- [x] Resolve the authoritative checkout and current `main`.
- [x] Apply and inspect the supplied patch.
- [x] Run focused proof and the Medium quick gate on the unamended patch.
- [x] Repair the two independent-review findings for persistent announcement dedupe and witness status/scope presentation.
- [x] Close independent release and UX review with no P0–P2 findings.
- [ ] Seal the amended release commit and rerun exact-head local proof.
- [ ] Push a PR, wait for exact-head checks, merge, and verify the Development kitchen deployment and live assets.

## Evidence log

- Supplied patch commit applied as `e6d874f8429a54f83a67c45d4093d9bcb837cd68` over `759e84b`; `git diff --check` passed.
- Pre-review focused proof: `test/onboarding-witness.test.ts`, `test/onboarding-conductor.test.ts`, and `test/onboarding-copy.test.ts` passed 63/63.
- Pre-review Medium quick gate passed in 68.629 s: 59 fast plus 22 serial selected tests, AI-surface verification, TypeScript, and diff hygiene; no five-minute breach. This evidence is historical because the independent review required an amendment.
- Amended focused proof passed 66/66; `pnpm exec tsc --noEmit` and `git diff --check` passed.
- Supplied screenshots covered waiting/noticed/blocked at 320, 390, 720, and 1100 px but rendered the child component directly and predate the review repairs.
- Refreshed proof rendered the real `OnboardingChat` shell in React Strict Mode at the same four widths. All 12 captures had `bodyWidth === viewportWidth`, the witness rail remained focused, the only control was `Stop setup for now`, and only the noticed state exposed a polite status announcement.
- The exhaustive full gate was not run. Jonathan requested release execution, not exact-SHA exhaustive verification under D-202.

## Decisions

- The witness card reports status and Shared scope rather than echoing conductor evidence values.
- A persisted `probeEvidenceKey` is authoritative when available. The existing accepted evidence identity is the bounded fallback until a later chapter probe writes the progress field.
- Claimed notice identities are fingerprinted before session storage so source/member identifiers are not stored in the notice key.

## Remaining uncertainty

- The later probe-writing slice may remove the accepted-evidence fallback once every completion has a persisted `probeEvidenceKey`.
- Chapter-specific copy and partial evidence rows land in later chapter slices; this slice keeps the truthful generic waiting row.
- Exact-head hosted checks and live publication proof remain pending.

## Handoff

Codex owns the exact-head release loop. Jonathan already authorized push, merge, and Development deployment for this patch; stop if exact-head checks fail, Production would be affected, or review finds another P0–P2 issue.
