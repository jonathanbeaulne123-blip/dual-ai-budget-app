# Hearth worksession — trustworthy synthetic demo suite

- **Status:** CLOSED — implemented and independently verified locally; Jonathan demo smoke remains
- **Opened:** 2026-08-29 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/trustworthy-demo-suite`
- **Baseline SHA:** `c7c2d56b84f069d8bffcecdbac8c8dcf72b9c405`
- **Head SHA:** `4d26fd75f1a1f3e3fd67bbe79c05622fb0258db7` (audited implementation; this closure record follows)
- **PR or issue:** none
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development

## Household outcome

Jonathan can open one dedicated, visibly synthetic Development showcase, generate a fresh random but replayable twelve-month household, verify every Hercules calculation family against the real books, and rehearse a five-to-seven-minute Hercules Pro investor story without mixing synthetic rows with ordinary Development or Production books.

## Budget delta (5)

`+4` — reproducible domain generators, accounting/scope oracles, provenance, and full Hercules tool coverage make the demo evidence trustworthy instead of merely attractive.

## Engagement delta (3)

`+3` — a fresh investor-ready household, visible readiness report, improved shift science, and a concise Hercules Pro playbook show the living kitchen without replacing its paper-desk grammar.

## Verified baseline

- `origin/main` was fetched immediately before branching and is exactly `c7c2d56b84f069d8bffcecdbac8c8dcf72b9c405`.
- Current D-138 is one monolithic `seedStressHousehold` with a single PRNG stream, fixed shift offsets, exaggerated multiplicative weekday/weather/season weights, and discarded UI seeds.
- Current stress fixtures are Development-only and use ordinary money/work commands, but they can replace the active Development household and do not carry durable synthetic provenance.
- Hercules exposes 65 read tools on this exact baseline plus three confirmed-transaction tools. The packet's earlier 64 count was stale; the implementation derives coverage from the live catalog so future additions fail closed.
- D-172 keeps schedules, mail, OCR, and Evidence proposal-only until visible Shift Confirm. D-173 keeps Shared/Personal presentation floors separate from accepted write authority.

## Scope

### In scope

- Independent deterministic domain random streams and replayable master seed.
- Synthetic provenance, coverage manifest, verified run report, and SHA-256 attestation.
- Improved shift schedule/weighting/time coherence while retaining ordinary `postWorkShift` authority.
- Generated finance, bills, appointments/claims, goals/Fund, schedules/Evidence, reconciliation/audit, privacy canaries, and tool prerequisites.
- Development-only Demo Suite controls under More; no desk or bottom-navigation restyle.
- Hercules Pro synthetic disclosure and a document playbook for the approved five-to-seven-minute sequence.
- Focused, matrix, accounting, scope/export, tool-catalog, and responsive UI proof.

### Out of scope

- Production, hosted schema/migrations, provider calls, Gmail/7shifts/OCR access, secrets, bank feeds, or real household data.
- Automatic money posting, weakened Confirm, broadened Hercules authority, or partner-personal disclosure.
- Push, merge, deployment, provider activation, or remote household cleanup without a later explicit release decision.

## Acceptance evidence

- [x] Same seed/version/date produces the same household, manifest, prompts, and attestation.
- [x] Fresh generation records a replayable seed and refuses Production.
- [x] Every domain engine declares achieved coverage; all 65 current Hercules reads and three write-path tools have a test contract.
- [x] Trial balance, accounting equation, PGlite, statements, desk totals, exports, and scope boundaries agree.
- [x] Shift timestamps, breaks, sales, tips, covariates, settlements, and statistical trends remain coherent across seeds and Toronto DST.
- [x] Synthetic schedules/Evidence never post money without ordinary Confirm.
- [x] Shared/Personal/Hercules/export canaries prove Bianca-personal exclusion from Jonathan and Shared.
- [x] Demo Suite stays inside the existing responsive More paper-room; no route, nav, desk, or bottom-bar structure changed.
- [x] Focused tests, TypeScript, AI-surface verification, and the manual Windows build equivalent pass. The full suite has one known environment-only `bash` ENOENT in `test/api.test.ts`; no product test remains red.
- [x] Independent books, privacy, UX, trust, and verifier review report no open P0–P2.

## Plan

- [x] Introduce the generator contract, keyed PRNG streams, provenance, manifest, validator, and attestation.
- [x] Refactor/enrich stress data through domain engines and improve shift generation.
- [x] Add the Development-only Demo Suite surface and Hercules Pro disclosure/playbook.
- [x] Add final trust/verifier verdicts and close the local handoff.

## Evidence log

- 2026-08-29: clean worktree created from fetched `origin/main@c7c2d56`; no PR, push, deploy, schema, secret, provider, or household-data action.
- 2026-08-29: exact-replay, all-tool, PGlite, privacy/export, proposal-only, legacy stress, worker disclosure, App boot, UI placement, and three-seed shift tests passed locally (focused 31/31 plus 13/13).
- 2026-08-29: live source catalog contains 65 read tools, not the packet's stale 64 count. Coverage is an explicit TypeScript record, so a new tool cannot compile without an assigned generator.
- 2026-08-29: exact-tree full Vitest run reached 1193 passed / 2 skipped. Its two failures were the pre-existing Windows `bash` ENOENT and an assertion that still expected private Activity metadata in Shared. The assertion was corrected to enforce private-token exclusion; the write kernel (5/5), Demo Suite (7/7), and visibility suite (12/12) then passed together.
- 2026-08-29: `pnpm ai:verify`, `pnpm exec tsc --noEmit`, `pnpm exec vite build --emptyOutDir`, and `pnpm build:hercules-pro-ui` passed; `dist/_redirects` is absent. The repository's Unix `rm`/`bash` wrappers remain an honest Windows-only gate limitation.
- 2026-08-29: independent books re-audit passed after every generated worked Shift Bible gained a matching confirmed envelope. Privacy passed after Production provenance fail-closed checks, member-safe Activity/export filtering, and cross-domain canaries. UX passed after 44 px controls and visible per-check failure details were added without changing the desk grammar.
- 2026-08-29: trust audit correctly rejected the first attestation because it hashed a readiness report without comparing loaded facts to a fresh replay. The repair stores a canonical fixture SHA-256, regenerates from every provenance input, compares loaded/stored/manifest/replayed hashes, and marks the report stale on revision change. Posted-row, schedule+envelope, and private-account mutations each return **Not ready**; accepted continuity-only metadata still verifies.
- 2026-08-29: trust re-audit passed on `4d26fd7` with no open P0–P2; the attestation is explicitly client-verifiable Development evidence, not a server-signed Production claim.
- 2026-08-29: final verifier passed on `4d26fd7` with no open P0–P2 and independently reran UI + Confirm-kernel checks (8/8). Exact-head full Vitest reached 1195 passed / 2 skipped; its sole failure remains the pre-existing Windows `bash` ENOENT in `test/api.test.ts`. TypeScript, AI-surface verification, focused 50/50, and manual Vite + Hercules Pro UI builds passed.

## Decisions

- Planning contract: dedicated showcase household; fresh random seed plus exact replay; one coherent investor story plus automated validator; hermetic synthetic Evidence; Jonathan/Bianca names; document playbook; SHA-256 attestation; controlled synthetic Confirm finale.
- D-179 is the integrated decision ID after current `main` assigned D-174 through D-178. Collision-check again before any later PR.

## Remaining uncertainty

- Jonathan still needs to smoke the real Development path with Google sign-in: create the dedicated household, confirm whether cloud sharing is synchronized or pending, open it from Hercules Pro, run the six prompts, and observe the intentional **Not ready** state after the controlled Confirm.
- The SHA-256 attestation is client-verifiable fixture integrity, not server-signed evidence and not proof of Production or investor traction.
- The full matrix takes several minutes locally; CI should keep the bounded seed matrix rather than silently dropping it.

## Handoff

Codex was the sole writer. The branch is local and unpushed. Books, privacy, UX, trust, and final verification are green. Next action is Jonathan's local Development demo smoke; merge/deploy remains a separate decision.
