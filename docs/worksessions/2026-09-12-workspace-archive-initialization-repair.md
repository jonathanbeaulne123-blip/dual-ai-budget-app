# Hearth worksession — atomic shared archive initialization

- Status: implemented locally; scoped High gate and build passed; root integration pending.
- Owner: Jonathan; integration owner: root Codex; implementation/review: Codex.
- Risk: High; synthetic local Development only.
- Branch: `codex/hearthside-workspace-archive-repair`.
- Approved base: `6a4040e19cab1047b1f9be2b22a637bc3350531e`.

An independent read-only review reproduced an acknowledged-copy recovery defect
on the exact approved base: aborting the first owner INSERT left committed archive
metadata. A retry then acknowledged a prepared copy without an owner journal row,
and trusted recovery into empty SQLite failed with `SHARED_ARCHIVE_CORRUPT`.
Jonathan's integration agent authorized this isolated follow-up repair.

Budget delta (5): shared-copy recovery is durable without a financial mutation.
Engagement delta (3): a couple's deliberately kept work survives a failed first
save and retry. No presentation, public route, Auth, deployment, binding, schema
application, private source or activation changes are included.

The fix makes initial metadata, legacy adoption outbox, first owner and owner
outbox one synchronous SQLite transaction. Ready also denies ownerless metadata,
so a previously corrupt namespace cannot acknowledge further work. This change
does not silently reconstruct damaged archives or assign a guessed household.

Regression evidence uses the actual shared Agent, SQLite and R2: first owner
failure, complete rollback, clean retry, then exact empty-namespace restore, with
and without legacy adoption. A separate adversarial journey exercises stale-head
discovery beyond 128 journals, paged staging, a newer withdrawal between pages,
unreadable partial state and terminal withdrawal after recovery.

The continued review found no further independently reproduced blocker in the
archive code. This is not an upstream Auth review or a hosted recovery exercise;
the existing requirement to stop/fence the former authority before recovery
remains. Root owns current household publication receipts, financial-restore
integration and broad program acceptance.

## Verification

The focused High gate passed **43 tests / 6 files** in **35.681 seconds**;
TypeScript took 23.027 seconds. Its 300-second budget was not breached. Exact
base/head: `6a4040e19cab1047b1f9be2b22a637bc3350531e`; dirty change fingerprint:
`6c726d8fbc3f2c25048ae9d1e2e655a2e9defa0551e6c6637f513d718d12728a`.
Only this evidence documentation changes after that gate. This is scoped local
evidence, not a clean integrated-root or hosted acceptance claim.

The five actual Agent/SQLite/R2 archive tests cover the original maximum-length
multibyte and JSON-escaped copies, outbox rollback, uncertain head acknowledgment,
real process restart, migration, corruption/offline denial and terminal recovery,
plus the fresh/adopted initialization fault cases and long-tail/newer-withdrawal
case. The existing actual P9 private/shared runtime test also passed, along with
Workspace contracts, environment isolation and continuity context checks.

No browser matrix is repeated for this storage-only repair; the existing P9 UI
evidence is unchanged. The required build passed, including app TypeScript,
Workspace Worker TypeScript, Vite and Hercules UI. Existing PGlite/browser
externalization, eval and large-chunk warnings remain. No compiler is left
running; the slot was released to the design agent.

Commands, with the bundled Node and fallback runtime directories on PATH:

```sh
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --risk=high --base=6a4040e19cab1047b1f9be2b22a637bc3350531e --focus=test/hearthside-workspace-archive.test.ts --focus=test/hearthside-workspace-runtime.test.ts --focus=test/workspace-contracts.test.ts --focus-reason='Archive initialization repair only: atomic owner, metadata and adopted-row outbox; actual SQLite/R2 retry and latest terminal recovery with unchanged UI'
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never build
```

Integrate only this follow-up commit over the already integrated archive package.
Root's newer authority and furniture work are not dependencies of this fix and
are not replaced by it. No shared configuration or package dependency changed.
