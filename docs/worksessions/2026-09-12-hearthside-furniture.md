# Hearth worksession — P10 authored furniture arrangement

- Status: OPEN, local implementation and scoped verification
- Opened: 2026-09-12, America/Toronto
- Owner / decision owner: Jonathan
- Assignee: Codex (`/root/shared_life_inventory`), one writer
- Repository: dual-ai-budget-app, isolated `.codex-work/hearthside-furniture`
- Branch: `codex/hearthside-furniture`
- Baseline / head before local commit: `d6db17b041edbd7156e185eecb28d46a3042c562`
- Risk: High; root Codex independently reviews canonical integration.
- Environment impact: none hosted; synthetic local browser and Worker tests only.

The couple can move actual authored furniture, cancel a draft, save an exact per-piece revision, and preserve the reviewed layout in history and guest visits. Budget delta (5): zero money mutation, no alternate financial state. Engagement delta (3): arranging the house changes the corresponding visual furniture across all themes and devices.

Scope: 14 furniture identities across four rooms and three themes, bounded pointer/keyboard arranging with explicit Save/Cancel, immutable complete layouts and guest copy binding, strict canonical helper, integration patch for root-owned authority/history/UI. Existing authored room composition and personal-object pointer/range controls remain. No external actions, package changes, schema/flag activation, manufacture or financial writes. Root owns actual App/auth/physical acceptance.

Read the repository worksession, implementation-packet and release-review workflow. Root canonical files were used read-only to generate exact integration hunks. Base RoomScene/CSS blobs are in the integration packet; their original prior commit is not confused with this branch's base.

Evidence so far:

- First TypeScript pass exited 0, compiler slot released.
- Initial scoped helper + guest regression tests: 21 passed in 2.75s.
- First real browser proof: one test passed in 62.505s (63.03s total), 84 room/theme/width checks and all furniture IDs per combination, 12 axe scans, per-piece race, existing object drag and scope/reload recovery.
- Visual inspection prompted a correction to fireplace-grate depth ordering and removal of phone arrangement letterboxing. Added direct-art dragging, an active-arranger axe scan, StrictMode exercise, and actual guest Worker activation denial after furniture changes. Final gate pending.

Local proof directory: `/tmp/hearthside-furniture-proof/`. Fixtures contain synthetic labels and test-only state endpoints; none ship in production. No actual household data, credentials, exports or private conversations are committed. No full-suite or physical/authenticated release evidence is claimed.

Next owner: root integrates the exact patch, validates actual LedgerRoom/Vault/history/restore boundaries, then makes any release request with Jonathan separately.

## Final local verification and handoff

Status: **CONDITIONAL — scoped package ready for integration**. No hosted or full-program acceptance is claimed.

The final High quick gate passed **25 tests in six files**, including both actual browser journeys and the real Guest Worker/SQLite/R2 plus SQL boundary tests. Total **92.263s**, TypeScript **23.173s**, budget **300s**, **no breach**. Executed base/head: `d6db17b041edbd7156e185eecb28d46a3042c562` plus the uncommitted package. Executable-source evidence fingerprint: `c340301cf208e75181a24c95e420265e1da125e745c938bd20ef326150acfbda`. Only this completion record and integration evidence text were added after the gate; executable source was unchanged.

Exact command (bundled Node and fallback runtime directories prepended to PATH):

```sh
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --risk=high --base=d6db17b041edbd7156e185eecb28d46a3042c562 --focus=test/hearthside-furniture.test.ts --focus=test/hearthside-furniture-browser.test.ts --focus=test/hearthside-guests.test.ts --focus=test/hearthside-guests-runtime.test.ts --focus=test/hearthside-guests-browser.test.ts --focus-reason='P10 exact authored furniture movement, strict per-piece CAS, immutable guest layouts and actual shared room/browser regressions'
```

- Furniture browser: **62.215s** test work. 84 room/theme/width combinations, every furniture identity moved through its actual SVG transform and cancelled per combination; 12 matrix axe scans plus one active-arranger scan, all without violations. Direct-art and handle pointer drag, 0.001 / Shift 0.01 keyboard precision, theme-preserved draft, failed network save/retry, exact-piece two-page conflict, reload/member/household return, existing object dragging, native action, reduced motion and 200% text passed. Local test fixture runs React StrictMode. It uses a serialized synthetic HTTP authority invoking the production CAS helper, not the app's authenticated LedgerRoom.
- Guest browser: **19.676s** test work. Existing complete paired-publish/invitation/cross-household visit journey passed with furniture-enabled shared RoomScene. 126 room/publishing/Street geometry cases and nine axe scans passed. Those are regressions of the actual guest Worker endpoints, using synthetic control-plane identities.
- Guest Worker: four tests passed, including new activation denial after a furniture change, unchanged active copy after subsequent rearrangement, and R2 recovery of the exact stored layout. The test initially expected 409 for changed source content; the established privacy-preserving guest endpoint returns 404. The assertion was corrected to the verified deny behavior; no service semantics were weakened.
- Eight pure furniture/guest-layout tests cover strict shape/accessors/sparse arrays, exact resources, CAS races, unchanged input, complete detached history values, guest allowlists and the absence of any live layout read during a visit. Existing ten guest tests and one SQL test passed.
- Production minified RoomScene and GuestRoomView module bundles built with esbuild into `/tmp/hearthside-furniture-production/`; seven root integration patch targets parse. `git diff --check` passed. `git apply --check` against current root passed without applying it. These are module builds; root owns the integrated application production build.

Inspected updated full-size Classic common-room desktop and Newfoundland phone-arranger captures after correcting depth and letterboxing. Furniture proof has 24 room captures plus the active phone arranger at `/tmp/hearthside-furniture-proof/`; guest captures are at `/tmp/hearthside-guests-proof/`. Art is the existing authored RoomScene from the root program; the paper conservatory now has an actual folded planter in place of the blank envelope. No personal memorabilia were invented.

Limits: bounded authored illustration placement, not collision physics or automatic attachment of independently placed personal objects to furniture. Historical and guest layouts are complete immutable versioned values, but root must prove their canonical integration, physical devices and authenticated cross-device behavior before program acceptance. Root already preserves complete shared-life metadata during financial recovery; the exact furniture/history preservation tests in the integration packet remain required in that real boundary. Source and browser readiness do not imply deployment or flag activation. No exhaustive gate was requested or run.
