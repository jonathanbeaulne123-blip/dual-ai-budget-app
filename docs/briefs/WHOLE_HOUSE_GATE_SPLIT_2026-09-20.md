# Splitting the slow gate into useful CI checks

Written 2026-09-20 for the question PR #507 left its second reviewer: *how to split the slow
gate into useful CI checks without weakening math or privacy coverage.*

**Nothing here is applied.** Every item is a change to CI configuration or verification policy,
which is Jonathan's call. The measurements are real; the recommendations are recommendations.

## What is actually slow

From `docs/briefs/WHOLE_HOUSE_REVIEW_EVIDENCE_2026-09-19.json`, the High gate on the #507
candidate:

| | measured |
|---|---|
| whole gate | **775.2s** against a 300s budget |
| `typescript` phase | 78.4s |
| `vitest-fast` | 160 files / 1,329 tests, `--maxWorkers=4` |
| `vitest-serial` | 16 files / 184 tests, `--maxWorkers=1` |
| `pnpm build` (separate) | 212.8s |

Two things matter about that shape:

1. The budget is **already soft**. `createTimeBudgetMonitor` warns
   `time-budget-breached … the soft gate will let this phase finish`, and the run is classified
   `quick-gate-passed; time-budget-breached`. A breach has never failed the gate. So "over
   budget" is a reporting problem, not a red build — the red build was the one Chapter test,
   which is now fixed and verified.
2. `vitest-serial` runs at `--maxWorkers=1` **by necessity**: those files each stand up their own
   Vite dev server and drive a real Chrome. Their parallelism cannot come from workers. It has
   to come from separate CI jobs.

## A measurement that changes the sharding answer

Sweeping the `test:fast` selection (~600 files) on this merge candidate:

```
Duration 539.78s  (transform 24.52s, collect 300.02s, tests 534.19s, environment 65.35s)
```

**Collection is 300s of it.** The majority of the gate's wall clock is Vite resolving and
transforming modules, not assertions running. That has a direct consequence: sharding by test
file multiplies a large *fixed* cost across every shard. Eight thin shards would each pay most
of that 300s again.

So the recommendation is a small number of fat shards plus a warm transform cache, not maximum
fan-out.

## Recommended split

Four jobs, each with its own real five-minute SLA (`HEARTH_TEST_BUDGET_MS` set **per job**, so
"five minutes" finally means the wall clock a person waits):

1. **`static`** — `diff-check`, `ai-surface`, `typescript`. Measured ~85s. Fails fast and tells
   you almost everything about a bad merge; this is the job that should gate the others.
2. **`fast`** — `vitest-fast` at `--maxWorkers=4`, one job, not sharded. It is already parallel
   internally and shares one collection pass.
3. **`serial-1..3`** — the selected browser files split three ways, `--maxWorkers=1` each.
   Three, not eight, for the collection reason above.
4. **`canon`** — see below. Small, fast, and **always the same set**.

Make the per-job budget **hard in CI** and leave it soft locally: a developer wants the phase to
finish so they can read the failure; CI wants a ceiling.

## Not weakening math or privacy coverage

This is the part that needs care, and it is a real hole rather than a hypothetical one.

`planQuickTests` selects tests from the changed files, and `MAX_RELATED_TESTS = 12`
(`scripts/verification-policy.mjs:4`) **trims** the related-test set. On a 141-file PR like
#507, discovery finds far more than twelve related suites, so which money and privacy suites run
is decided by a cap — quietly, and differently from one PR to the next.

Recommendation: the money canary, the permission matrix and the disclosure/privacy suites should
be a **fixed, always-run required job** (`canon`) that does not pass through `planQuickTests` at
all, so no future change to selection, trimming or sharding can reduce them. Today their
presence in a given run is incidental; it should be structural. Splitting the gate without doing
this first is what would weaken the coverage — the split itself is harmless.

## The reason no checks ran at all

Worth separating from the budget question, because it is the actual cause of *"required checks
remain unfulfilled"*:

`47d8100e`, the PR's head, is titled `Document whole-house review handoff [skip ci]`. GitHub
Actions honours `[skip ci]` and skipped every workflow for that push, which is why the PR shows
only `Supabase Preview` and `Workers Builds` as `skipped` and no `CI` run at all. The merge
commit carries no such marker, so pushing it is enough to make `ci.yml` run. No workflow or
branch-protection change is needed for that.

## One more thing worth deciding

`.github/workflows/hearthside-native.yml` triggers on `pull_request` with paths including
`src/**`, `public/**`, `package.json` and `pnpm-lock.yaml`. It then runs **two 45-minute jobs** —
an unsigned iOS build on `macos-15` and an Android emulator build on `ubuntu-24.04`.

#507 is a 141-file presentation PR that changes no native code, and it starts both. That, more
than the 775s gate, is what makes a source PR feel unmergeable.

Options, cheapest first:

- narrow the trigger paths to `native/**`, `packages/**`, `.github/workflows/hearthside-native.yml`;
- keep the broad paths but require an opt-in label (`native`) via `if: contains(github.event.pull_request.labels.*.name, 'native')`;
- move it to `workflow_dispatch` beside `full-verification.yml`, which is already the
  Jonathan-request-only pattern in this repository.

The first is the smallest change and keeps the safety property that native code cannot merge
unbuilt. The trade is that a pure-`src` change can no longer break the native shell without CI
noticing — which is a real trade, and Jonathan's to make.
