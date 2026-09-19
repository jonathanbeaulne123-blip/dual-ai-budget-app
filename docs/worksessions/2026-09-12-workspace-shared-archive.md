# Hearth worksession — shared Workspace recovery

- Status: IMPLEMENTED LOCALLY; independent integration review and release remain open
- Owner: Jonathan; integration owner: root Codex; implementation: Codex Vault agent.
- Risk: High; local synthetic Development only.
- Branch: `codex/hearthside-workspace-archive`.
- Approved base: `81bc9db83bdd64b924f2c00f39642087aadddb79`.
- Local dependency: `6b2fb5c`, applying the already integrated P9 Worker patch.
  Do not cherry-pick that dependency into root. The archive handoff is a separate commit.
- Local dependency: `54d5441`, applying the already integrated Chapter authority
  patch and root's P9 test UUID type correction. Do not cherry-pick it into root.

A deliberately shared Workspace artifact and its later withdrawal must survive
loss of its local authority. This package journals both legacy shared artifacts
and the new prepared/active/withdrawn experience copies, independently from
private Workspace sources, financial snapshots and Vault content.

Budget delta (5): accepted shared copies and withdrawals have private durable
recovery without a second financial writer or content in household snapshots.
Engagement delta (3): the work a couple chose to keep with their intention remains
available after interruption; deleting a private source does not erase that copy.

Scope: existing shared Agent, a SQL outbox committed with each copy transition,
immutable private R2 chunks/journals/checkpoints, archive-before-success, exact
retry, bounded staged latest-only recovery and migration of existing shared notes.
Root owns canonical household acceptance/withdrawal receipts and route assembly.

Required evidence: actual Agent/SQLite/R2 migration, maximum multibyte content,
lost head acknowledgement, immutable journal tail, real process restart, empty
authority restore, stale-head recovery, corruption denial and source independence;
scoped High gate plus build. Existing component presentation is unchanged, so
the P9 three-theme browser suite is retained rather than creating a new UI.

No hosted schema, bucket, activation, provider call, external message, calendar
write, financial restore or Production operation is authorized by this package.

## Verification

The exact scoped High gate passed **122 tests / 20 files** in **40.781 seconds**,
including TypeScript, actual Agent/SQLite/R2 tests, P9 browser/theme journeys,
Workspace authority/disclosure/grants and month-rehearsal coverage. Budget:
300 seconds; no breach. Base/head before the archive commit:
`54d5441e9883a52ce3819feb289ee96ac694c3f1`. Dirty change fingerprint:
`e5f0bf07f49288e741296de1bc6ac9d88448dfd7920ba7f258b8d8274ccc6543`.
This evidence predates this evidence-only documentation update and is not a
clean root-integration or hosted acceptance claim.

Actual storage proof includes 500,000 multibyte characters and 500,000 characters
whose JSON representation expands past two MiB. Immutable chunks remain at
most 256 KiB. A SQLite trigger deliberately aborts outbox insertion and proves
the copy write rolls back in the same transaction. R2 faults before/after head
publication prove same-copy retries, while missing/offline binding denies reads.
A real Miniflare process restart preserves its persisted SQLite/R2 stores.
Latest-only empty-namespace recovery follows an older head through a later
withdrawal journal, preserves legacy shared notes, resumes checkpoint pages,
refuses a nonempty target and denies malformed chunks without exposing staging.
The existing private/shared Agent test proves source deletion remains independent.

Earlier checks exposed and fixed one owned BufferSource type narrowing. The
predecessor lacked the already integrated Chapter assembly and P9 UUID annotation;
these exact changes are isolated in local dependency `54d5441`, not the archive
handoff. The broader base-429 gate passed TypeScript and 242 tests but failed two
predecessor fixtures: `home-feedback-ui.test.ts:35` changes a Move label while its
canonical Task retains setup meaning; `planner-ui.test.ts:66` tries completing a
money Task before accepting responsibility. Root acknowledged its earlier Planner
fix and will check Home before the final integrated gate. These failures are not
waived or presented as release-green by the narrower passing package gate.

Independent persistence review remains with root integration: the available
reviewer is completing native work. No independent archive-review completion is
claimed. That reviewer did complete the earlier encounter check; its partner-
activity inference finding was fixed in `e0c4709`, confirmed by the reviewer and
verified by 97 tests / 19 files in 60.421 seconds.

`pnpm build` passed after the gate, including app TypeScript, Workspace Worker
TypeScript, Vite and Hercules UI build. Existing PGlite externalization/eval and
large-chunk warnings remain. No build or compiler is left running.

Commands (with the bundled runtime directory prepended to PATH):

```sh
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --risk=high --base=54d5441e9883a52ce3819feb289ee96ac694c3f1 --focus=test/hearthside-workspace-archive.test.ts --focus=test/hearthside-workspace-runtime.test.ts --focus=test/hearthside-workspace.test.ts --focus=test/hearthside-workspace-browser.test.ts --focus=test/workspace-contracts.test.ts --focus-reason="Archive-only changes over assembled P9 and Chapter dependencies: atomic shared copy outbox, chunked recovery, terminal withdrawal and complete Workspace journeys"
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never build
```

Next owner: root Codex. Cherry-pick only the archive handoff commit, preserve
the root's newer canonical acceptance/withdrawal changes, and run its integrated
authority/broad gate. Private hosted storage lifecycle and explicit recovery
operations require release review; no hosted activation was performed here.
