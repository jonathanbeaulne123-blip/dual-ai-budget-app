# Hearth Whole House — local actual-app review

Status: PR handoff for Jonathan and a second opinion; release acceptance remains open.

Jonathan’s latest explicit plan superseded the earlier standalone-only restriction. Implementation is in the real React/TypeScript/Three application on `codex/whole-house-app`, from refreshed main `4de2b28ea9663f635c3c769eef35617602b8f7ef` (PRs #501 and #503). The final code/check candidate is `7fac9972666cb6a55912f3f6b4756ebd52017b99`. The final follow-up changes only test synchronization and handoff documents.

## What changed

The persistent house shell gives both Personal and Household four wings with twelve named levels. Direct furniture and doorway controls are the default; readable HTML work surfaces retain an exact contextual return. Desktop keeps architectural context; phone frames the useful object with reachable utilities. Named floor controls, scroll, interrupted transitions, reduced-motion/fallback paths and optional bounded avatar movement share the route contract. The Pottery Studio is an adjoining room, not a fifth primary destination.

Home integrates the original Bloom V2 Living Presence asset, evidence-led growth and separate appearance preview/save/cancel/reset for crown, flowers, pot, trellis, lighting and minions. Loft and Cellar retain the canonical banks, bill jars, paid transformations and receipt paths. Study provides seven Standing Book divisions, a dated waterline, Goals Glasshouse and exact figures, alongside the existing Planner and Calendar.

Kitchen Table connects Journey, one scoped folio and the existing Plan review. Together connects wishes, explicit lived experience, pottery Shape/Paint/Kiln, author-owned operations, in-app letters, the cooperative encounter and a kept-memory projector. Hercules retains his own conversation, composer and private/shared appearance boundaries. Classic Hearth, Taylor’s Scrapbook and Newfoundland have authored material/room treatments; not every existing working surface has been rebuilt as an independent illustration.

## Authority and continuity

A versioned owner-bound Personal Life document travels through Personal decoding, compatibility capabilities, partition/merge, commands, backup and restore. Reviewed sharing creates a new Shared identity while the private source and mapping remain private. Personal tasks link only to the owner’s active Personal Plan; Household tasks link to the accepted Shared Plan. Workspace context carries audience and owner. Creative operation journals stay in their existing separate document authority.

Returns and unfinished work are partitioned by environment, household, member, scope and object. Plan recovery checks exact source/selection revisions and line fingerprints; Planner keeps the original task ID through interrupted acknowledgement, retains rejected fields and guards pending editor actions. Projector recovery keeps only eligible exact memory revisions and selected order, with a pre-parse size bound. Local recovery is separate from accepted writes.

Rooms hold references to canonical plans, banks, tasks, dates, designs and memories. No new financial formula or health score was introduced. Only the existing editable review, Final Confirm, command acceptance and receipt recovery paths can post money. Spending never marks an experience lived; explicit dated transitions and exact composition approvals remain required.

One foreground renderer lease and native animation scheduler coordinate House, Journey, Queen, pottery/Kitty and wardrobe resources. Stable versioned month/object anchors replace history-length placement. Canonical refund lineage, full-month cadence and planned-release interpretation repair the Journey evidence. A shared device-local support cache freezes Queen/House/Journey interpretation at its last supported date; uncached derived landmarks are suppressed while stale. Canonical figures and commands retain current authority.

## Review and evidence

Working preview: http://127.0.0.1:4186/__review

External packet: `/Users/jonathanbeaulne/Downloads/Hearth_Whole_House_App_Review/` contains README, click-through, browser journey record, validation, source inventory, independent reviews, explicit gaps, timestamped captures and logs. The preview uses a visibly labelled fictional loopback LedgerRoom, creative journals and Vault. Accepted data persists in the ignored `.whole-house-review/authority-state`; browser editor recovery is separately scoped. It loads no `.env` and enables no hosted provider or service.

The web build passed on `7fac9972` in **212.809s**. TypeScript passed in **78.418s**. The change-focused High gate passed **1,512 tests** and failed **one Chapter browser assertion** that read fields before React committed a household remount; the actual App startup subset passed **83/83**. The gate exceeded its **300s budget**, taking **775.209s** wall time. It remains failed. The Chapter test now uses bounded polling for the actual remounted DOM; this final test-only correction was independently reviewed and was not rerun after Jonathan requested immediate PR handoff. The application trees (`src`, `workers`, `scripts`, `public`) are identical to the built/tested candidate. No full green gate is claimed. See the adjacent evidence JSON for exact hashes and outcomes.

Bounded manual proof covers a funded weekend through reviewed financial commands, a free words-only memory, private Plan/task/reload and reviewed Household copy, a fired exact pottery revision, two-person encounter, recipient letter and reordered three-memory projector recovery. The recorded walkthrough was exploratory and crossed source repairs; it is not one continuous final-candidate recording.

## Remaining acceptance

The full twelve-destination/tool-state/theme/scope/density matrix, physical software keyboard, real screen reader, enlarged text, actual device GPU/battery/context-loss and production performance remain open. Shell measurements and focused source/DOM tests are bounded evidence only. Hosted Google identity, real two-device/cloud continuity, provider execution, hosted schema/service compatibility and activation were not performed. The local last-supported scene cache does not roam to a device that never captured that interpretation.

Jonathan subsequently requested immediate PR handoff and took ownership of user-facing testing. This authorizes publishing the source branch and opening a review PR. No merge, deployment, hosted schema/service/provider activation, Production or native work was undertaken. PR #501’s old recovery and activation tracker remains parked. Jonathan/project lead owns the next review decision; this handoff grants no release authority.


## Second-opinion focus

Review owner-bound Personal decoding/merge/restore and the reviewed-copy boundary; confirm scene actions cannot reach financial posting outside existing review/Final Confirm; assess the breadth of the App navigation integration and foreground renderer resource ownership; and recommend a practical split between CI math/command verification and Jonathan’s visual walkthrough. The five-minute gate is still a measured failure, not a waived requirement.

The handoff commit skips automatic GitHub Actions because the repository runs native build jobs for source-changing PRs. No workflow or branch-protection rule is altered; required checks remain unfulfilled. Re-enabling an appropriate web-only verification run and any later merge/deploy are separate review decisions.
