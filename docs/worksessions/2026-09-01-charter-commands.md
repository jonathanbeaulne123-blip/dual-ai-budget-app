# Hearth worksession — Charter commands

- **Status:** READY FOR REVIEW
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `charter/2-commands`
- **Baseline SHA:** `db0a0a2ae84e490700eaa742bba89a37573c40cc`
- **Head SHA:** pending
- **PR or issue:** pending
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

The household can found one Charter, sign only its own lines, grant and revoke bounded permissions, and change the agreement only through a motion raised by one member and confirmed by another.

## Budget delta (5)

`+2`: custody, split, work ceiling, and permission changes become command-truth without creating a balance, posting money, or moving the Household Fund.

## Engagement delta (3)

`+2`: founding, signing, holding, and motion-and-second become stable household rituals for the later Charter surfaces.

## Verified baseline

- `origin/main@db0a0a2ae84e490700eaa742bba89a37573c40cc` is the squash merge of Charter slice 1 PR #267.
- PR #267 passed exact-head GitHub CI and Cloudflare preview after two P2 continuity/signature repairs.
- Main Cloudflare workflow run `33468844081` completed Build and Deploy successfully for `db0a0a2`.
- A separate live-origin HTTP fetch is not verified from this host because shell DNS and the web safety layer both refused the Workers hostname.
- The two supplied UX plate files are byte-identical. `HEARTH_UX_PACKET.md` is additional product/visual guidance; it reinforces Slice 2 refusal copy and held-motion semantics but does not add pixels to this command-only slice.

## Scope

### In scope

- Founding one Charter with unsigned lines for every recorded household member.
- Signing only the caller's own line.
- Granting only the caller's own Confirm authority and revoking only as granter.
- Raising, holding, and confirming typed Charter amendments by motion-and-second.
- Fund-custody refusal and exact copy fences.
- Command-driven tests for every packet rule.

### Out of scope

- UI, CSS, founding flow, Charter page, badges, notifications, migrations, hosted schema/data, household data, secrets, Production, deployment, and later Charter slices.

## Acceptance evidence

- [x] Founding twice refuses; founder remains unsigned.
- [x] Each real member gets one unsigned signature line and may sign only their own.
- [x] Grant/revoke authority follows the packet exactly.
- [x] Amendments capture `fromText`, require a different confirmer, apply typed values, and stamp `resolvedAt`.
- [x] Held amendments remain open and may later be confirmed.
- [x] A configured Fund blocks Charter custody changes.
- [x] Exact refusal strings and source fences pass.
- [x] Focused tests, TypeScript, diff hygiene, and full Windows gate pass.
- [x] Independent targeted review finds no actionable P0–P3 issue.

## Plan

- [x] Trace current command, value-parsing, ID, and commit conventions.
- [x] Add the seven bounded Charter commands with fail-closed typed amendment application.
- [x] Add one command-driven scenario per rule and source fences.
- [x] Run focused and full verification, then independent review.
- [x] Return a branch/PR handoff without merging or deploying Slice 2.

## Evidence log

- Baseline worktree: `C:\Users\jonat\AppData\Local\Temp\hearth-charter-2-commands`, clean at `db0a0a2ae84e490700eaa742bba89a37573c40cc`.
- Focused Charter, command-log materialization, month-rehearsal, and hosted-CAS proof passes: 5 files, 40 tests.
- `pnpm exec tsc --noEmit` and `git diff --check` pass after the command-log and ceiling-unit repairs.
- Charter facts now survive direct and compacted shared command-log replay; the compacted replay reaches the same Charter and scoped audit identity as the accepted tip.
- Ceiling unit amendments fail closed unless the motion moves the ceiling to `none`, preventing stored hours from being reinterpreted as cents or vice versa.
- Full `pnpm check:windows` passes: AI surface verified; 216 test files passed and 2 skipped; 1,474 tests passed and 3 skipped; TypeScript, Vite, and Hercules Pro builds passed.
- Full-run stderr was limited to existing React `act(...)`, PGlite browser-external/eval, dynamic-import, and bundle-size warnings; no check failed.
- Final independent targeted review reported no actionable P0–P3 findings after the compacted replay repair.

## Decisions

- The attached UX packet and plates are treated as guidance supplied by Jonathan, not as independent authorization to expand scope.
- No new decision number is needed: Slice 2 implements D-189 and the already specified Charter command contract.

## Remaining uncertainty

- GitHub PR checks remain pending until the branch is pushed and the review PR is opened.

## Handoff

Implementation and local verification are complete. No Slice 2 merge, deployment, hosted mutation, or household-data action has occurred; stop at an open review PR.
