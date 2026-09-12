# Hearth worksession — integrated encounter and restore test repair

- **Status:** LOCAL REPAIR VERIFIED; root integration gate remains open
- **Opened:** 2026-09-12 (`America/Toronto`)
- **Owner / decision owner:** Jonathan
- **Assignee:** Codex; root integration owner controls the final gate
- **Repository:** dual-ai-budget-app
- **Branch:** `codex/hearthside-encounter-restore-gate`
- **Baseline / parent gate SHA:** `4ae12f866062a225ab22dfbfef65b15a36ec650a`
- **Risk:** Medium, test harness changes only
- **Environment impact:** local synthetic Development only

## Outcome and scope

The private-answer/reveal test now bundles the actual integrated `HearthsideVault`, without applying the obsolete returned integration patch in esbuild. Its authenticated requests, private-answer isolation, author-only submitted-choice stability, exact-version reveal, no-callback evidence, membership-change rejection, lost-response retry, pause, withdrawal and empty-SQLite recovery assertions are unchanged.

The shared-life restore browser harness explicitly gives Vite its middleware page's TSX entry. Vite no longer defaults to scanning unrelated repository HTML while the first navigation waits. Each invocation uses a fresh temporary optimizer cache and removes only that cache during teardown. The 5-second browser timeout and every restore, paired approval, account/household switch, uncertain-response, keyboard, reduced-motion, enlarged-text, seven-width and three-theme assertion remain unchanged.

Budget delta (5): more reliable proof that uncertain restore responses reuse the accepted request and that both people approve the exact shared-life changes. Engagement delta (3): the existing private reveal and recovery experience is now tested against integrated product code, and its restore UI is checked without unrelated app-entry setup work.

No product, authority, schema, flag, provider, hosted service or external-message behavior changed. The related Encounter Entry test is owned by the integration team's separate repair and is not edited here.

## Verified baseline and diagnosis

The root High gate at the baseline SHA failed the runtime test before execution: `encounter-vault-integration` reported `Integration patch context changed`. The current Vault already creates `HearthsideVaultEncounters` and implements private commands and evidence RPCs. Reapplying the historical patch is invalid after integration.

The same gate timed out in the restore test's first `page.goto` at its existing 5-second limit. Its Vite server had no `optimizeDeps.entries`; the fixture is supplied by middleware rather than a repository HTML entry. The explicit entry addresses this unrelated dependency scan. A fresh cache is mandatory for this evidence, rather than relying on previously optimized files from another checkout.

## Local evidence

Command, with the bundled Node directory prepended to `PATH`:

```sh
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never exec vitest run test/hearthside-encounter-runtime.test.ts test/hearthside-shared-life-restore-browser.test.ts
```

- **Passed:** 3 tests / 2 files, **11.26 seconds**.
- Encounter authority test: **721 ms** against actual Miniflare/SQLite/R2.
- Restore browser file: **7.943 seconds** including setup; first complete restore journey **1.267 seconds**, theme/accessibility case **2.106 seconds**.
- Log: `/tmp/hearthside-encounter-restore-gate.log` (local evidence, not committed).
- `git diff --check` passed.
- No full compiler or build was run; the root integration owner explicitly reserved those for the combined gate. This focused test result is not release, deployment, physical-device or full-program acceptance evidence.

## Handoff

Integrate the two test changes, then rerun the combined High gate on its exact integrated head. No approval or activation action is required for this local test-only repair.
