# Hearth Mountain — per-task PR delivery

Jonathan requested one PR for each completed task. Five draft PRs preserve the
shared foundation and separate the three parallel task slices from app integration.
No CODEOWNERS or other owner map was present; boundaries follow the authored task
scopes and shared-runtime dependencies. Product risk remains High; this packaging
introduces no additional product behaviour.

| Review order | Pull request | Base |
| --- | --- | --- |
| 1 | [#532 — Connected world foundation](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/532) | main |
| 2 | [#533 — Art and transport presentation](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/533) | codex/mountain-pr-foundation |
| 3 | [#534 — Living interactions and recovery](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/534) | codex/mountain-pr-art |
| 4 | [#535 — Local replay and ghost](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/535) | codex/mountain-pr-life |
| 5 | [#536 — Integration and fictional rehearsal](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/536) | codex/mountain-pr-race |

## Preservation and validation

- Fetched main remains `87f6027098f07cb39482f5f7e13cc652df166c81`.
- Original `codex/hearth-mountain` remains at `aa51621a`; its clean working tree and
  preview were left intact. Backup ref: `refs/backup/hearth-mountain-before-pr-split`.
- Splitting used a separate `.codex-work/hearth-mountain-prs` checkout. Landscape
  and VillageCourt overlaps were resolved using their already integrated versions.
  Accepted storage/freshness corrections are included in the living-world slice.
- At the combined task head `d167db24`, eight focused files / **67 tests passed in
  7.79s**, covering art, full/lite channel geometry, life/recovery, source fences,
  replay, session, HUD and controller pause. Log:
  `/tmp/hearth-mountain-pr-split-tests.log`.
- `pnpm typecheck` passed at that same combined task head (exit 0). Log:
  `/tmp/hearth-mountain-pr-split-types.log`.
- Integration commit `8596bdf2` has exactly the same Git tree as original `aa51621a`.
  Verified with `git diff --exit-code aa51621a HEAD` and staged tree identity before
  commit. This delivery note is the sole additional file after that comparison.
- Diff whitespace checks passed. Published changes were reviewed for private
  exports, workbook files, credentials and secrets; none were added.

Budget delta (5): preserve the implemented Fund explanation and direct tool access.
Engagement delta (3): preserve the integrated mountain, art, life and recreation.
The split itself adds no financial writer, feature or data change. GitHub receives
repository code and PR metadata only; no hosted household writes, schema operations,
merge, deployment or Production activation occurred.

## Acceptance and next owner

These are drafts, not release acceptance. The integrated evidence in the main
mountain worksession remains authoritative: broad quick-gate time-budget breaches,
two unresolved legacy actual-App browser timeouts, and physical iPhone/two-device,
human race, audio, accessibility and final visual acceptance are still open.
The original integrated bundle/type-check results are not a new per-PR full gate.

Jonathan and Codex should review this stack in order and retarget descendants as
their prerequisites land. The final app wiring is in #536, so earlier slices are
not standalone completion of the whole experience. Preserve the October security
milestone and obtain separate merge/deployment authorization. Do not delete the
original branch or backup ref as part of ordinary review.
