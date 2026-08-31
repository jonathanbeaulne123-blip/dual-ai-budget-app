# Hearth worksession — P0-03 five-of-five feature gate

- **Status:** CLOSED — harness verified; public-roadmap evidence failed honestly; no feature awarded `5/5`
- **Opened:** 2026-08-30 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/p0-03-5of5-gate`
- **Baseline SHA:** `e19acf09c35c26bda1dba9d01e4806a315e223ab`
- **Head SHA:** closing branch head; the ignored evidence record binds its exact 40-character commit SHA
- **PR or issue:** P0-03; no PR created because push is not authorized
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none; evidence tooling and documentation only

## Household outcome

Jonathan and Bianca can distinguish a tested feature from a feature that was actually completed, recovered, viewed at household widths, checked for accessibility/runtime failures, and observed on the exact Production build. Passing-test count alone can no longer authorize the label `5/5`.

## Budget delta (5)

`+3` — release truth now requires current evidence for Hearth's financial, privacy, date, history, confirmation, and environment invariants before the top feature-quality label is available.

## Engagement delta (3)

`+1` — the gate requires hands-on visible task and recovery proof at 320/390/430/720/1100 px instead of treating jsdom as the kitchen experience.

## Verified baseline

- `git fetch origin --prune` completed in a clean checkout. `origin/main` and the inspected HEAD were both `e19acf09c35c26bda1dba9d01e4806a315e223ab` before editing.
- Classification: **verified-current open gap**. Current main has Vitest/jsdom, Miniflare integration, performance helpers, CI build/test, Cloudflare deployment, and prose browser smokes, but no same-SHA/environment five-dimension feature gate.
- The 2026-08-27 product audit records no browser E2E, visual regression, or field-performance gate and warns that passing tests do not establish visible correctness.
- Existing manual proof covers some 320/390/720/1100 states but is prose-only, omits 430 px in the latest UI packet, and does not retain hash-linked screenshots or complete network/timeout capture.
- No Playwright, Cypress, axe, pa11y, or Lighthouse dependency/config exists. P0-03 therefore defines a runner-neutral, fail-closed evidence contract and keeps a later automated collector separate.

## Scope

### In scope

- Five equal dimensions: truth, task completion, recovery, responsive/accessibility, Production evidence.
- Versioned browser journey manifest for 320/390/430/720/1100 px.
- Dated ignored evidence output with artifact SHA-256, exact source SHA, environment identity, freshness, and human acceptance.
- Console, network, and timeout capture requirements.
- One all-green synthetic evaluator fixture and one intentionally failing feature fixture.
- Local hands-on browser evidence for the harness journey; no claim of feature `5/5` without Production and human acceptance.

### Out of scope

- Runtime feature redesign, money meaning, commands, ledger projection, storage, sync, Auth, Supabase, migrations, secrets, provider activation, Production data, push, merge, deploy, or PR creation.
- Installing a browser framework or asserting automated accessibility standards coverage that the repository does not possess.

## Acceptance evidence

- [x] The evaluator derives rather than accepts a score and exposes `5/5` only after all five dimensions and human acceptance pass.
- [x] Dirty tree, SHA/environment mismatch, stale/future/broken artifacts, incomplete capture, console/network errors, timeout, missing 430 px, non-Production evidence, and missing acceptance fail closed.
- [x] Synthetic green and red fixtures prove the success and failure paths; the green fixture remains permanently non-claimable.
- [x] Task and recovery journeys were exercised hands-on at 320/390/430/720/1100 px with screenshots and runtime-channel evidence. The feature failed keyboard activation at every width, so this is evidence of failure, not acceptance.
- [x] Focused tests, TypeScript/build equivalents, diff/sensitive-file review, and independent verification pass. Full `pnpm test` retains the pre-existing Windows `bash` portability failure recorded below.
- [x] No real Hearth feature is called `5/5` from tests alone.

## Plan

- [x] Read AGENTS and canonical docs, fetch current main, classify P0-03 before editing, and create an isolated branch/worktree.
- [x] Inventory unit, integration, browser, accessibility, performance, screenshot, CI, deploy, and smoke tooling.
- [x] Implement the manifest, output contract, evaluator, docs, and harness fixtures.
- [x] Capture manual viewport proof and runtime channels.
- [x] Run gates, independent review, close the worksession, and return a local PR-ready handoff.

## Evidence log

- 2026-08-30: isolated worktree `tmp/hearth-p0-03-5of5` created from exact `origin/main@e19acf09c35c26bda1dba9d01e4806a315e223ab`; unrelated dirty worktrees were not touched.
- 2026-08-30: three bounded read-only audits confirmed the open gate, lack of real-browser/visual tooling, reusable Vitest/Miniflare/deployment seams, and required anti-false-positive controls. Root remains the sole writer.
- 2026-08-31: focused P0-03 gate passed **1 file / 15 tests**, including genuine JPEG acceptance and corrupt/MIME/content-viewport/DPR rejection; TypeScript `--noEmit`, Node syntax check, AI surface verification, Vite Production build (**362 modules**), Hercules companion build, no-`dist/_redirects`, and diff check passed. Existing Vite PGlite externalization/eval/chunk warnings remain.
- 2026-08-30: compact full Vitest result was **488 files / 1,266 tests: 1,262 passed, 3 pending, 1 failed**. The sole failed test is the pre-existing native-Windows `test/api.test.ts:132` assumption that `bash` exists (`spawnSync bash ENOENT`); no P0-03 test failed.
- 2026-08-30: two final independent reviews found no remaining P0/P1 after fixture/template digest binding, valid PNG decode/CRC/dimension checks, artifact-kind/distinctness rules, exact dated path and environment identity, typed runtime captures, and structured claim-digest human attestation.
- 2026-08-30: hands-on local browser journeys ran at **320, 390, 430, 720, and 1100 px** for both task and recovery. All ten runs rendered without horizontal overflow, exposed visible focus, and recorded zero page-console errors, zero bounded same-origin asset HTTP failures, and zero timeouts. Reload recovery rendered successfully. At every width, however, pressing Enter focused the target roadmap tab without changing `aria-selected`; the expected Engineering/E1 and Experience states remained inactive. Controlled 200% zoom and reduced-motion evidence were not available in this runner and were recorded as incomplete. The public-roadmap feature therefore did not qualify for `5/5`.
- 2026-08-30: the first exploratory artifact correctly rejected screenshots whose `.png` names contained runner-produced JPEG bytes. The contract was then made runner-neutral while remaining fail closed: PNGs must have valid chunks, JPEGs must contain a valid SOF dimension marker, and Sharp must fully decode either codec; decoded pixels must match the recorded content viewport, DPR, extension, and MIME.
- 2026-08-31: the final local ignored evidence record is generated after the closing commit so its source SHA, build id, screenshot hashes, and environment identity all bind the clean branch head. It records the failed feature result and cannot display `5/5`.

## Decisions

- Evidence outputs and screenshots are ignored artifacts generated after a commit, preventing evidence from changing the SHA it claims to prove.
- The environment identity includes kind, live origin, deployment id, and an `environment+household+member+view` privacy-scope fingerprint.
- A synthetic pass verifies the harness only. It cannot emit the literal feature label.
- Production evidence requires exact-SHA deployment and live-origin receipts; local Vite, preview, tests, and prose do not substitute.

## Remaining uncertainty

The current browser surface can support hands-on viewport checks, screenshots, console inspection, and bounded same-origin asset checks, but the repository has no automated network interception, axe-style accessibility audit, controlled zoom, or reduced-motion collector. Named-human identity is procedurally attested rather than cryptographically authenticated. P0-03 fails closed when capture is incomplete; a later slice may automate collection without weakening this contract.

## Handoff

Local PR-ready implementation only. Nothing is pushed, merged, deployed, migrated, activated, or live from this worksession. Rollback is deletion of the isolated branch/worktree or reversal of its local commits; no household or hosted state needs recovery.
