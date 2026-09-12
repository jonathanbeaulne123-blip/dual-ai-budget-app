# Nesting eggs + F-010

Jonathan can open a ranked nest from Home or Plan, select exactly one pot, and use a studio appropriate to that pot. All four category amounts add up to one King. Paid pots become keepsakes and recurring bills automatically receive their next pot.

## Authority and delivery

- Repository: `jonathanbeaulne123-blip/dual-ai-budget-app`; branch `codex/nesting-eggs-f010`; initial base `5837bbdf253c8e253bcd53b0029fcfbe8bc796a0` after #464; integrated main `1686ccc4a569c99b5a2d92ae8b311b83873e211d` after #465.
- Decision owner: Jonathan. Implementer/integrator: Codex. Next owner: PR reviewer, then Jonathan for any separately authorized release.
- High risk: monetary presentation, private cosmetic continuity, command compatibility, onboarding and shared studio rendering.
- Budget delta (5): exact cents, original Goals/receipts, no new money authority. Engagement delta (3): authored rank, four studio depths, themed props and optional King chapter.
- Bounded independent reviews: nest arithmetic/history/continuity and studio/visual/accessibility. Findings corrected before delivery; evidence in the worksession.
- Live Sheet F-010 was read on September 12: themes, too bare/white, scene-specific action color and fonts, Not started/P14. No Sheet rows changed.
- One PR; no merge, deployment, schema application or Production changes. No hosted household, provider, or authenticated cross-device acceptance claimed.

## F-010

Plan, Home nest, pottery and the opened King/setup surfaces reuse the current scene language. Classic has paper, timber, ceramic and green actions; Taylor follows Lover/Showgirl on Home and Fearless/Debut on Plan; Newfoundland carries harbour/trail/summit materials. Typography uses the existing scene display/hand fonts. Books/Reputation remains the reference, with no replacement theme or whole-app redesign.

## Nest

| Tier | Amount and source | Editing |
| --- | --- | --- |
| King | Entire Household Fund in Our Home; Books net worth in My Money | Full form, features, painting, extras and kiln |
| Protect / Everyday / Build / Prepare | Exact partition of King; Everyday carries the signed remainder | Category pot and glaze, modeled theme prop |
| Goals | Existing goal IDs, funding and pieces; explicit category, purpose match, then Everyday | Existing deep studio and financial review |
| Bills / future expenses | Source-derived occurrence, never a new money ledger | Optional name, glaze, category and tiny prop |

The allocation gives existing Build/Prepare claims their portions first, then Protect's reserve, buffer and transfer needs, and assigns the exact remainder to Everyday. Child targets drive visual growth, not another financial claim. A target is an intended cost; a displayed amount is its portion of existing money.

Current theme motifs are fixed per category: Classic shield/cup/sprout/clock; Taylor star/flower/guitar/sun; Newfoundland lighthouse/rowhouse/sailboat/lifering. King wears the crown. Both renderers share motif selection; 3D props are modeled volumes.

## Onboarding King

`ch-13-king` is a real optional household chapter, also reachable directly from the setup journey and Home. Save clay, leave, resume, fire, then complete the chapter. Repainting does not revoke completion. Required household financial gates remain required. Development preview includes the King and does not show an unresolved copy key.

## Auto bill/expense banks

Recurrences produce stable occurrence pots; payment evidence breaks the paid occurrence and the current next date produces a new pot. Corrections/reversals use accepted transaction truth. Potential expenses, appointments, undated cost tasks and unlinked active Plan costs also produce pots. Source aliases are excluded. Existing goal archive/restore remains; expense-pot archive/restore changes only its cosmetic visibility. Payment still opens the existing Calendar path and Review → Final Confirm.

Paid pots retain source-linked historical appearances. Later edits affect future pots. Unrelated private activity cannot change shared history or admission. Pre-decoration receipts retain the original source label. Repeated editing cannot exhaust a fixed history limit.

## Continuity and rollback

`kittyNestDesigns` is separate from Goals and financial audit facts. It round-trips through shared/personal envelopes, local materialization, registry commands, worker admission and scoped imports. Commands use optimistic design revisions. Compacted replay checks receipt identity, materialization digest, exact primary receipt, scope, revision and historical keepsakes; unsupported raw catalog fields cannot change source visibility.

The Worker hello and commands negotiate `kittyNestVersion:1`. A future release must ship compatible readers/validators before or with clients. An old writer is rejected once nest data requires the capability. Never roll back accepted or queued nest commands to an implementation that drops these records. No database schema changes are required by this PR.

## How to verify

Use an isolated fictional Development fixture, one browser page, and the installed Node/pnpm runtime:

```sh
pnpm dev --host 127.0.0.1 --port 5181
OUT=/tmp/hearth-nest-proof node scripts/fixtures/kitty-studio/nest-proof.mjs
OUT=/tmp/hearth-nest-interactions node scripts/fixtures/kitty-studio/nest-interactions.mjs
pnpm test -- --risk=high --focus=test/kitty-nest.test.ts --focus=test/kitty-nest-ui.test.ts --focus=test/kitty-studio.test.ts --focus=test/kitty-studio-ui.test.ts --focus=test/onboarding-lifecycle.test.ts --focus=test/onboarding-copy.test.ts --focus=test/onboarding-registry.test.ts --focus=test/materialize-snapshot-from-events.test.ts --focus=test/ledger-sync-authority.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason="Nest projections, paid keepsakes, private continuity, King setup and required App startup/rehearsal coverage"
pnpm build
```

The proof script accepts `ORIGIN`, `CHROME`, `THEMES`, `VIEWS`, `WIDTHS` and `ROUTES`. It fingerprints source content before reusing results. Fixtures are labelled fictional; `window.books()` is an in-memory inspection hook only. No real household export, credentials or provider keys are used. Screenshot/probe summaries are under `docs/evidence/nesting-eggs-f010/`.

## Still open

Authenticated two-device continuity, physical iPhone/VoiceOver and deployment verification require separate evidence. The local matrix covers synthetic Home, Plan, gallery and setup-journey routes; it is not a full live-app or exhaustive WCAG certification. Browser paint parity covers King/Goal strokes and retained data, not every possible shape, stamp and GPU combination. Future dates and corrections continue to use the existing Calendar controls. No exhaustive full-suite run was requested or performed.
