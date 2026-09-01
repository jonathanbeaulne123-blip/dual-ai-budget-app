# Hearth worksession — PGlite metadata re-anchor

- **Status:** CLOSED — RELEASE CANDIDATE VERIFIED; APPROVED RELEASE IN PROGRESS
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/pglite-stale-receipt-reanchor`
- **Baseline SHA:** `bad020c1b3541630bcd93408fb1a15365edb80dd`
- **Head SHA:** approved release-candidate commit; exact SHA in the final handoff
- **PR or issue:** none
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development incremental PGlite only; Production remains on the full writer

## Household outcome

Ordinary non-financial interactions no longer leave the next Confirm trapped behind a stale-revision receipt warning. When PGlite is behind only in revision and still proves the same accepted financial hash, the next books write performs one transactional full re-anchor before acceptance.

## Budget delta (5)

`+4` — restores dependable Confirm after metadata-only interactions while preserving exact-hash, balance, projection, and stale/ahead refusal gates.

## Engagement delta (3)

`+1` — routine kitchen interactions stop producing a repeating technical warning. No Hercules or cosmetic scope is added because books trust takes priority.

## Verified baseline

- Fresh release baseline `origin/main@effd7b382bde313fc80a0b4aa218322c6052450a`; the candidate was rebased as the household-charter record and command slices landed during verification.
- `persistKnownMetadataHousehold` intentionally persists and adopts financially identical metadata without ingesting PGlite.
- The next Development incremental ingest currently rejects whenever the PGlite household revision differs from the newer snapshot revision, even when the accepted financial hash is identical.
- Production does not enable the incremental path.

## Scope

### In scope

- Reproduce a metadata-only revision gap followed by a financial write.
- Permit only a behind-PGlite, exact-financial-hash match to fall back to the existing transactional full writer.
- Keep a mismatched hash, PGlite-ahead revision, altered projection, and unbalanced candidate blocked.
- Record focused and full verification.

### Out of scope

- Canonical receipt-version expansion, account/catalog hash migration, cloud transport, hosted rows, schema, secrets, Production continuity, or household-data mutation.
- UI restyling or new interaction behavior.
- Production data, schema, secrets, or household-row mutation.

## Acceptance evidence

- [x] A metadata-only revision gap followed by a balanced post succeeds through a full re-anchor.
- [x] The re-anchored PGlite projection matches a clean full rebuild.
- [x] A PGlite receipt ahead of the proposed previous snapshot remains rejected.
- [x] Existing mismatched-hash and altered-projection tests remain green.
- [x] Focused tests and the full `pnpm check` component gate pass on the final tree.

## Plan

- [x] Trace the repeating warning to the exact revision/hash comparison.
- [x] Add the failing regression.
- [x] Implement the bounded fallback.
- [x] Run focused and full verification.
- [x] Record evidence and hand off the release decision.

## Evidence log

- Before the fix, `pnpm exec vitest run test/books.test.ts -t "re-anchors before posting"` reproduced the exact warning and failed at the revision/hash guard.
- Focused exact tree after the charter command merge: books, browser command path, charter record, charter commands, and event materialization — 5 files, 62 tests passed.
- Exact `5c8552b` `pnpm check` on `effd7b3` — AI verification passed; 216 files passed, 2 skipped; 1,477 tests passed, 3 skipped, 0 failed; TypeScript, production Vite build, Hercules Pro UI build, and `_redirects` refusal passed.
- `pnpm build` — TypeScript, production Vite build, Hercules Pro UI build, and `_redirects` refusal passed. Existing PGlite externalization/eval and large-chunk warnings remain non-failing.
- `pnpm ai:verify` — 41 required AI files and guards passed.
- The first two `pnpm check` attempts exposed Windows runner PATH omissions for `bash` and then `rm`; the affected API test and build passed after adding Git's `bin` and `usr/bin`. No application assertion failed.
- Jonathan approved push, merge, and deploy on 2026-09-01. The candidate was rebased onto `origin/main@01e962d24038d3047c361df12d24b30a879f13fb`; its monthly-obligations decision record was preserved beside D-190.
- Exact post-rebase focused gate — books, browser command path, charter record, charter commands, event materialization, and monthly obligations: 6 files, 68 tests passed.
- Exact post-rebase `pnpm check` — AI verification passed; 217 files passed, 2 skipped; 1,483 tests passed, 3 skipped, 0 failed; TypeScript, production Vite build, Hercules Pro UI build, and `_redirects` refusal passed. Existing React `act`, PGlite externalization/eval, and large-chunk warnings remained non-failing.
- Before merge, `main` advanced again to `bad020c1b3541630bcd93408fb1a15365edb80dd` with the separate contribution-register projection. The candidate was rebased again, retaining both independent decision records; exact final-tree verification follows below.
- Exact final-tree focused gate — books, browser command path, contribution register, Household Fund, and monthly obligations: 5 files, 66 tests passed.
- Exact final-tree `pnpm check` — AI verification passed; 218 files passed, 2 skipped; 1,492 tests passed, 3 skipped, 0 failed; TypeScript, production Vite build, Hercules Pro UI build, and `_redirects` refusal passed. Existing React `act`, PGlite externalization/eval, and large-chunk warnings remained non-failing.

## Decisions

- The canonical financial hash remains mandatory. Only a lower PGlite revision with the exact same accepted financial hash may re-anchor.
- Re-anchor uses the existing full transactional writer; no second mutation path is introduced.

## Remaining uncertainty

- Live browser confirmation remains pending until the approved deployment completes.
- The existing accepted hash covers canonical posted-money facts rather than every catalog byte; expanding that contract remains a separate migration.

## Handoff

Local implementation and exact post-rebase release verification are complete. Jonathan approved release; push, merge, deployment, and live proof are in progress. No hosted data, schema, secret, Production flag, or household row is in scope.
