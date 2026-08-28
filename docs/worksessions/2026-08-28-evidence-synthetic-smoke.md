# Hearth worksession — Evidence synthetic vault smoke

- **Status:** COMPLETE; LOCAL SYNTHETIC ONLY
- **Opened:** 2026-08-28 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/evidence-synthetic-smoke`
- **Baseline SHA:** `e342ae9067d4a548489430435f0255f4985dcb41` (merged PR #231)
- **Risk:** High locally; Release before any hosted capture activation
- **Environment impact:** local Miniflare resources only

## Household outcome

Prove the same Worker bundle, D1 migrations, private R2 encryption, Queue extraction, owner checks, integrity failures, and deletion behavior together before any Development capture switch or real evidence is allowed.

## Dual Course

- **Budget delta (5):** `+3` — closes the gap between unit fakes and the real D1/R2/Queue runtime boundary.
- **Engagement delta (3):** `+1` — makes later member capture smoke safer and easier to diagnose.

## Boundaries

- Synthetic official-shape 7shifts bytes only.
- Local Miniflare D1, R2, and Queue only; no hosted rows, objects, messages, or secrets.
- `EVIDENCE_ENABLED=true` exists only inside the disposable local harness.
- Hosted Evidence, email, 7shifts, automation, and Production switches remain false.
- No money command is claimed or posted.

## Plan

- [x] Start from merged `main@e342ae9` on a clean branch.
- [x] Add the exact Miniflare runtime as a direct, pinned test dependency.
- [x] Execute migrations 0001/0002 against local D1.
- [x] Prove selected upload → encrypted R2 → Queue derivation → normalized observation + schema drift.
- [x] Prove partner denial, ciphertext tamper refusal, deletion, key removal, object purge, and zeroed storage counters.
- [x] Add duplicate/out-of-order Queue and hard-limit cases to the runtime harness.
- [x] Run the focused and repository proof set; record the two unchanged Windows-only aggregate failures separately.

## Release gates

This worksession does not authorize hosted capture, real evidence, automation, email routing, extension distribution, TestFlight, Production, push, or merge. Jonathan remains the decision owner.

## Evidence log

- 2026-08-28: PR #231 merged to `main@e342ae9`; exact-head PR checks and post-merge `main` CI/Cloudflare Worker workflows passed. Live Worker version `9a1606cd-a49c-4bef-9da5-c75468e62f5a` reports Evidence unavailable and 7shifts provider calls disabled. Version bindings prove `EVIDENCE_ENABLED`, `EVIDENCE_ALLOW_PRODUCTION`, `EVIDENCE_EMAIL_ENABLED`, `SEVENSHIFTS_ENABLED`, and `SEVENSHIFTS_ALLOW_PRODUCTION` are all `false`.
- 2026-08-28: `pnpm test:evidence:local` passed 2/2 using the bundled Worker with local Miniflare D1/R2/Queue. The smoke preserved an unknown provider field, derived 480 worked minutes, denied a different auth subject, rejected altered ciphertext, removed the wrapped key/object reference, purged R2, returned stored bytes/object count to zero, drained duplicate/out-of-order queue messages without a second derivative, and blocked the 1 GiB storage ceiling before R2.
- 2026-08-28: the combined Evidence harness/Worker/extraction/migration proof passed 22/22. The complete repository run passed 1020 tests with 2 skipped and retained only the two unchanged Windows-only failures: `test/api.test.ts` cannot spawn `bash`, and `test/companion-office-update.test.ts` is CRLF-sensitive. The local harness itself passed inside that full run.
- 2026-08-28: `pnpm exec tsc --noEmit`, the direct Windows production Vite build, Hercules Pro UI build, AI-surface verification, Worker dry-run, changed-file secret scan, and `git diff --check` passed. The dry-run resolved the dedicated Development D1/R2/Queue bindings while proving all three Evidence flags and both 7shifts flags remain `false`.

## Closeout

The local synthetic runtime proof is complete. Branch `codex/evidence-synthetic-smoke` remains local and unpushed. The next slice is a separately approved hosted Development smoke with synthetic bytes only; it must not enable email, 7shifts provider calls, automation, or Production.
