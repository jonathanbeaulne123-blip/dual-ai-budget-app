# Hearth worksession — Charter integrity repair

- **Status:** CLOSED — MERGED #274; DEVELOPMENT KITCHEN PUBLISHED
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/charter-2-integrity-repair`
- **Baseline SHA:** `f9958758547e8d2c99733a2f0f44294c003346d5`
- **Head SHA:** code `56ee6b498201f6d87f921be616642b00d73338df`; merge `450be34b6bc84f5bf5e203154c864cccba198eb5`
- **PR or issue:** [#274](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/274), follow-up to [#269](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/269)
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** Development kitchen code published; no hosted household rows, schema, secrets, or Production continuity changed

## Household outcome

The household Charter survives later Fund setup and independent device edits without losing a signature, permission, or amendment. A ceiling can move between hours, dollars, and none only through one typed motion carrying both its unit and value.

## Budget delta (5)

`+4`: prevents silent loss or invalidation of the household's custody and agreement record across ordinary commands and cross-device convergence.

## Engagement delta (3)

`0`: this is trust repair. It adds no visual ceremony, notification, or companion behavior.

## Verified baseline

- `origin/main@f9958758547e8d2c99733a2f0f44294c003346d5` includes merged Charter Slice 2, the contribution register, and the metadata-revision PGlite receipt repair.
- Slice 2 PR #269 merged after exact-head CI and Cloudflare preview passed.
- Later GitHub review identified two P1 defects: reciprocal Fund custody was not enforced, and whole-record Charter merge could lose independent device edits.
- The same review identified one P2 gap: no atomic command path could change a ceiling's unit and value together.
- Cursor Charter Slice 3 is isolated in PR #271; this repair does not edit its new founding-flow files.

## Scope

### In scope

- Enforce Charter/Fund custodian agreement when the Fund is configured after the Charter.
- Merge one Charter's signatures, permissions, and amendments by stable subrecord identity while keeping scalar terms deterministic.
- Prevent concurrent subrecord ID collisions across members/devices.
- Add one typed ceiling amendment path carrying unit and value atomically.
- Preserve command identity, shared continuity, integer cents/tenths, and exact refusal language.
- Add command, shape, merge, and two-device regression proof.

### Out of scope

- Charter Slice 3, 4, or 5 UI; new notifications; hosted schema/data; Supabase; Production continuity; real household data; secrets.

## Acceptance evidence

- [x] Mismatched later Fund setup refuses without changing either record; matching setup preserves the Charter.
- [x] Independent offline signatures both survive `mergeShared` in either argument order.
- [x] Independent permissions and amendments survive merge without ID collision or whole-record loss.
- [x] Confirmed scalar amendments remain authoritative when the other device only changes a subrecord.
- [x] A typed composite ceiling motion changes kind and value together, including restoration from `none`.
- [x] Existing Charter, Fund, continuity, command-log, and last-entry-wins tests remain green.
- [x] Focused tests, full Windows gate, diff/secret hygiene, trust reviews, verifier, and release review pass.

## Plan

- [x] Trace current Charter shaping, command IDs, Fund configuration, sync merge, and amendment application.
- [x] Implement the smallest coherent record/command/merge repair.
- [x] Add adversarial command and two-device regression tests.
- [x] Run focused proof, independent read-only audits, then the complete Windows gate.
- [x] With Jonathan's confirmation, push, review, merge, publish the Development kitchen, and verify the exact live bundle.

## Evidence log

- Clean isolated worktree: `C:\Users\jonat\AppData\Local\Temp\hearth-charter-2-integrity-repair`.
- Current-main focused Charter/commands/materialization/outbox/CAS plus contribution-register/PGlite-neighbour proof: `100/100` passed.
- Complete rebased `pnpm check:windows`: AI-surface verified; `218` files passed / `2` skipped; `1,499` tests passed / `3` skipped; TypeScript and both production builds passed.
- Independent books/continuity final audit: no P0–P3 findings; focused `55/55` and TypeScript passed.
- Independent trust/concurrency final audit: no P0–P3 findings; focused `46/46` passed.
- Regression proof includes self/outsider-confirm fail-closed behavior, invalid custodian targets, paired ceiling replay, forged collision-alias retention, merge symmetry, and Charter-level idempotence.
- PR [#274](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/274) exact-head CI [`33477214483`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33477214483) and Cloudflare preview [`33477214530`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33477214530) passed; automated code review completed with no findings.
- Merged as `main@450be34b6bc84f5bf5e203154c864cccba198eb5`. Main CI [`33478168942`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33478168942) and Cloudflare Workers [`33478168914`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33478168914) passed.
- Worker version `ae1df573-e6f9-43a2-af78-c67c03d0318e`. Live HTML returned `200` with `Cache-Control: no-store`; `index-ClRSFCAQ.js` contained `termsUpdatedAt`, `ceilingKind`, `custodianMemberId`, `amendments`, and `signatures`.

## Decisions

- This is a D-189 integrity why-note, not Charter Slice 5. Held-everywhere remains a separate slice.
- Cursor's Slice 3/4 lane may remain isolated; this branch owns all Charter core repair writes.

## Remaining uncertainty

- Deliberate collision evidence uses a bounded, identity-derived alternate id. This is longer than an ordinary random id but avoids a lossy digest and appears only for malformed/colliding payloads.
- Live two-device Charter use remains a later Development canary after the UI slices; this repair changes no hosted schema or data.

## Handoff

Repair is merged and published to the Development kitchen. No hosted household row, schema, secret, Production-continuity setting, or real household data changed. The later Charter UI slices may build from `main@450be34` while retaining the live two-device Charter canary as a separate evidence gate.
