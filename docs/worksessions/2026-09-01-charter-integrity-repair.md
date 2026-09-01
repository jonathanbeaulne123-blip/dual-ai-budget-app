# Hearth worksession — Charter integrity repair

- **Status:** READY FOR REVIEW — LOCAL VERIFIED; PUSH PENDING
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/charter-2-integrity-repair`
- **Baseline SHA:** `f9958758547e8d2c99733a2f0f44294c003346d5`
- **Head SHA:** pending
- **PR or issue:** follow-up to [#269](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/269)
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** none

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

- Charter Slice 3, 4, or 5 UI; new notifications; hosted schema/data; Supabase; Production; deployment; real household data; secrets.

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
- [ ] With Jonathan's confirmation, push and open one repair PR; stop without merge or deployment.

## Evidence log

- Clean isolated worktree: `C:\Users\jonat\AppData\Local\Temp\hearth-charter-2-integrity-repair`.
- Current-main focused Charter/commands/materialization/outbox/CAS plus contribution-register/PGlite-neighbour proof: `100/100` passed.
- Complete rebased `pnpm check:windows`: AI-surface verified; `218` files passed / `2` skipped; `1,499` tests passed / `3` skipped; TypeScript and both production builds passed.
- Independent books/continuity final audit: no P0–P3 findings; focused `55/55` and TypeScript passed.
- Independent trust/concurrency final audit: no P0–P3 findings; focused `46/46` passed.
- Regression proof includes self/outsider-confirm fail-closed behavior, invalid custodian targets, paired ceiling replay, forged collision-alias retention, merge symmetry, and Charter-level idempotence.

## Decisions

- This is a D-189 integrity why-note, not Charter Slice 5. Held-everywhere remains a separate slice.
- Cursor's Slice 3/4 lane may remain isolated; this branch owns all Charter core repair writes.

## Remaining uncertainty

- Deliberate collision evidence uses a bounded, identity-derived alternate id. This is longer than an ordinary random id but avoids a lossy digest and appears only for malformed/colliding payloads.
- Live two-device Charter use remains a later Development canary after the UI slices; this repair changes no hosted schema or data.

## Handoff

Local repair is verified and ready to push as one prerequisite PR after Jonathan confirms. Nothing is pushed, merged, deployed, or applied to hosted or household data.
