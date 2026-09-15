# Our Path — personal island privacy review (step 12, before any code)

Status: review only. Nothing is built. Baseline: `claude/our-path-next-level` @ `3f63feed`.
Scope: Jonathan's step 12, "a private island built from personal data". The Personal Plan tab is guardrailed and stays as it is. A personal island would be a **new, separate surface**.
Risk: **High** (privacy boundary, and possibly sync/schema; `.claude/rules/money-trust-boundary.md:21`). A Codex trust review is required before merge.

## 1. What "personal data" means here

A member's Personal rows sit in their own **Personal envelope**. `splitForSync` builds it (`src/core/sync.ts:525-707`), and every row must be owned by that member:
- Transactions with `visibility: "personal"` and `createdBy === memberId` (`sync.ts:528`, `:682`). Shifts (`:532`, `:688`) and potential expenses (`:530`, `:687`) follow the same rule.
- Personal goals: `!goal.shared && ownerMemberId === memberId` (`:535`, `:695`). Their contributions and purchases go with them (`:696-697`).
- Personal accounts: `scope === "personal" && ownerMemberId === memberId` (`:539`, `:677`). Opening checkpoints and history reviews/approvals are included too (`:679-681`).
- `nativeEvents`, `kittyNestDesigns`, `tasks`, `taskLists`, each with `visibility === "personal" && createdBy === memberId` (`:683-686`).
- Plan rows: `planDrafts`, personal `planVersions`/`planReflections`, and `planBridgeDrafts` (`:642-648`). Scenarios, learning progress and coaching preferences are shaped per member (`:736-740`).
- Also included: shift bibles, 7shifts schedules, coworkers, Fund private bindings and source claims (`:721-733`), plus landing/glance/rail preferences (`:649-676`).

**Where the rows live.** They sit in the device's PGlite/local snapshot. They also sit in the hosted **Personal scope** row, keyed by environment, household and member (`docs/CLOUD_CONTINUITY.md:26-27`, D-114/D-117; `docs/DECISIONS.md:314`). The shared cloud projection leaves out Personal transactions, shifts and private goals (`CLOUD_CONTINUITY.md:26`).

**Who can read them.** Only the owner's devices. Three code paths enforce this:
- `personalEnvelopeFromPayload` refuses an envelope whose `kind`/`memberId` does not match (`sync.ts:745-751`), and it re-filters every collection to the owner (`:784-821`).
- `overlayPersonalReplica` refuses a mismatched member (`sync.ts:834`). It overlays only that member's rows onto the Shared snapshot.
- `assembleHousehold(shared, personal)` merges exactly one member's envelope (`sync.ts:977-999`).

The partner's device assembles its household from the Shared envelope plus **its own** Personal envelope. It never receives this member's envelope. Inside one device, `householdForView` hides partner-personal rows in both views (`src/core/visibility.ts:265-302`). `isVisibleInView` in the personal view requires `createdBy === memberId` (`visibility.ts:52`).

Note: on the owner's device, the in-memory `Household` holds **both** Shared rows and the owner's Personal rows. The household island stays shared only because its read-models filter them out.

## 2. Threat model

### (a) Leakage into the shared island
The shared island must keep reading only shared facts. Today's gates:
- `pathMonths` reads transactions through `belongsToSharedLedger` (`src/core/pathSignals.ts:67`), goals through `goal.shared` (`:68`), and events through `visibility === "household"` (`:74`).
- `OurPathWorld` receives the full `household` when `view === "household"` (`src/App.tsx:7047-7049`).

Every one of these places could be fed personal-island data by mistake:
1. `pathMonths(household, today)` in `src/path/OurPathWorld.tsx:189`.
2. `pathMonths` in `src/path/PathMiniMap.tsx:34`.
3. The `worldInput: PathWorldInput` build in `OurPathWorld.tsx:359-391`, type at `src/path/world/pathWorld3d.ts:18`. Its campfires, land, moves, goals, lamps, memories, weather, sunlit and stones must all come from shared read-models.
4. Landmarks and the kiln use `kittyBanksInView(household, "household", …)` (`OurPathWorld.tsx:242-256`).
5. Weather uses `pathWeather`, which skips personal-linked transactions (`src/core/pathWeather.ts:75`, `:125-140`).
6. Stones use `pathStones`, which keeps only household tasks (`src/core/pathStones.ts:12`, `:54`).
7. Recipes and the name come from `effectivePathRecipes` and `pathIslandName` (`OurPathWorld.tsx:190`, `:199`).

Rules:
- Do **not** add a `scope` parameter to `pathMonths`. Write a separate pure function, e.g. `personalPathMonths(household, memberId, today)`, in its own module.
- Keep separate component props, so a personal read-model's type cannot be passed where `PathMonth[]` from the shared function is expected. A branded type is the simplest way.

### (b) Leakage through the `pathWorld` synced collection
`pathWorld` is Shared. `splitForSync` copies it into the Shared envelope (`sync.ts:608`), `mergeShared` unions it (`sync.ts:1249`), and the module says so (`src/core/pathWorld.ts:20`).

The partner therefore sees every row in it:
- Recipe names and proposals (`pathWorld.ts:402-434`).
- The island name (`:436-459`).
- Category fixes, which carry the `setByMemberId` of whoever set them (`:484-490`).

A personal island **must never** call `proposePathRecipe`, `proposePathName` or `setPathCategorySignal`, and must never write any row kind into `pathWorld`. Even a recipe name such as "Solo run club" leaks intent.

Options for personal-island state are in §3.

### (c) Leakage through Hercules / model context
`householdForHerculesContext` sets `pathWorld: []` and clears chapters, rituals, moves and wins (`visibility.ts:192-196`). `householdForAiDisclosure` builds on it (`:88-138`). D-115 made this member-scoped disclosure the rule (`docs/DECISIONS.md:310`).

For a personal island, the following must hold:
- No personal-island read-model, recipe or name is added to either projection.
- No island summary goes into the D-105 excerpt.
- Hercules never narrates the personal island in the household view. `gateHerculesQuestion` already refuses "my/personal" questions there (`visibility.ts:238-244`).
- Any Hercules line on the personal island is on-device and grounded, never a model call.

### (d) Screenshots, proofs and evidence
- Use fictional Development/demo households only (`CLAUDE.md`; `AGENTS.md`, "Safety").
- The `proofWorld` hook (`OurPathWorld.tsx:181`) must be driven by a synthetic fixture, e.g. a member "Robin" with a fictional "Pottery class" personal event.
- No real Personal rows go into PR images or into test snapshots committed to the repo.

### (e) Shared-screen glance risk
The household island has a lantern control: Dim / Warm / Bright (`OurPathWorld.tsx:79`, `:842`). Detail lines are filtered by `lantern >= min` (`:879`), and bill sublabels widen only at Bright (`:424`).

A personal island is more sensitive, because a partner may be looking at the same screen:
- Open it **Dim by default**. Do not share the household lantern key `hearth:pathWorld:lantern` (`:89`, `:115-116`).
- Never show amounts, account names, institutions or counts that imply amounts, at any lantern level.
- Show no partner presence. The household island counts live peers (`App.tsx:7059`); a private island must not.

### (f) Tent and deep links
The household island's tent reuses today's household Our Path rooms (`OurPathWorld.tsx:60`, `App.tsx:7062-7066`). `openTentFor` fires only when `herculesSourceScope` matches the `…:${view}` key (`App.tsx:7061`).

A personal island:
- must **not** accept `onOpenInTent`, `onOpenBank` (shared Kitty Banks, `OurPathWorld.tsx:156-159`), `onOpenTogether`, `onOpenCharter` or `onOpenTimeMachine`;
- must never set `herculesSourceFocus` with `view: "household"`.

In the other direction, a household island link must never carry a personal goal, task or event id. Any personal-island link goes only to personal routes, under a `…:personal` scope key.

## 3. Decision options

| Option | What it is | Trade-offs |
|---|---|---|
| **(i) Derived only** | No stored state. The island is computed from the member's own Personal rows. Recipes are read, read-only, from `PATH_BASE_RECIPES` (`pathWorld.ts:80`). The name is fixed: "My island". | No schema, sync, replay or parity change. Nothing new to leak, and no new `IMPORT_FIELD_POLICY` field (`src/ledgerSync/importParity.ts:12-105`). But no personal customisation. Shared *agreed* recipes are not reused, because their names are couple content; base recipes only. |
| **(ii) Personal-envelope `personalPathWorld`** | Owner-only recipes and name, stored in the Personal envelope. | Needs everything `pathWorld` needed: a shaper, a merge, member identity, a replay gate (`docs/briefs/OUR_PATH_TRUST_BOUNDARY.md:17`), a capability flag like `pathWorldVersion` (`:20-24`), and an import-parity policy entry. `personalPrivacy` would need a new clause (`importParity.ts:131-132`); the existing clauses stay unchanged. It also needs `sharedPrivacy` to reject it (`:130`), hosted Personal payload shaping in `personalEnvelopeFromPayload`, and older-client drop analysis. High risk, for a cosmetic gain. |
| **(iii) Device-local only** | `localStorage` name and recipe toggles, owner-scoped key. | Cheapest, with no sync. Lost when the device changes or storage is cleared, and it can throw in private mode (wrap every access in try/catch). On a shared family device it is readable by anyone using that browser profile, so the key must include `memberId`, and it must not hold free text beyond the name. |

**Recommendation for v1: (i) derived only.** The privacy win comes from storing *nothing* new. Every leak path in §2 closes by construction, with no hosted schema, sync or replay change. (ii) can be revisited once people actually use the island and ask to customise it. (iii) is not worth its shared-device risk.

## 4. Guardrail checklist (for the builder)
- [ ] Fictional data only in tests, fixtures, screenshots and proofs.
- [ ] No money: no cents, no account names, no counts that stand in for amounts. The read-model carries shapes (0–1) only.
- [ ] One predicate everywhere: `visibility === "personal" && createdBy === memberId`. For goals and accounts: `!shared && ownerMemberId === memberId` or `scope === "personal" && ownerMemberId === memberId`. Put it in a single helper, and test that helper.
- [ ] Never write to `pathWorld`. Never call any `PATH_WORLD_COMMAND_KINDS` command (`pathWorld.ts:495`) from the personal surface.
- [ ] Never add personal-island data to `householdForHerculesContext` or `householdForAiDisclosure` (`visibility.ts:88-224`).
- [ ] `pathMonths`, `PathMiniMap` and the shared `worldInput` are unchanged. Diff review confirms `pathSignals.ts:67-74` still gates on shared facts.
- [ ] `importParity.ts` `sharedPrivacy`/`personalPrivacy` are unchanged (under option (i) no field is added).
- [ ] Tests:
  - Render the household island as the **partner**, with a fixture where the owner has personal rows. Assert that no owner id, title or name reaches the DOM or `PathWorldInput`.
  - Render the personal island as the owner. Assert that no partner-personal row appears and that no shared-only row is double-counted.
  - Assert that the personal island exposes no tent or household link props.
- [ ] Personal island opens Dim, with its own lantern key.
- [ ] The Personal Plan tab (`tab === "plan"` in the personal view) is untouched.
- [ ] A Codex trust review is recorded before merge, and a `docs/DECISIONS.md` entry is added.

## 5. Open questions for Jonathan
1. **Should a personal island exist in v1 at all?** Recommendation: build it only as option (i), after the shared island's next-level work lands. If time is tight, wait. The shared island is the product; the private one is a companion to it.
2. **Where does it live?** Recommendation: a **door from the Personal Home**, e.g. a small "My island" window, not a new tab. The nav stays unchanged and the Personal Plan tab stays untouched. The door appears only when `view === "personal"`.
3. **Can personal categories be scored with the shared recipes?** Recommendation: reuse the **base** recipes (`PATH_BASE_RECIPES`) and the category *guess* (`guessCategorySignal`, `pathWorld.ts:325`) read-only.
   - Do **not** read the couple's category fixes (`pathCategoryMappings`, `:334`). Those are shared decisions, and personal spending would then be shaped by the partner's choices.
   - Never write fixes from the personal side.
   - If Jonathan wants personal fixes later, that is option (ii) or (iii), and it needs its own review.

## §2(g) addendum — owner-only marks on the household island (D-264, step 6)

Step 6 puts owner-only **footpaths** (the member's own personal tasks) and **stage-1 bridge planks** (the member's own Bridge drafts) on the *household* island. They follow the rules above: derived on the device from the owner's own Personal rows with the single owner predicate, nothing written to `pathWorld` or any synced collection, no amounts (labels pass through `pathWords`), and for the glance risk of §2(e): the Mine toggle is keyed per member (`hearth:pathWorld:mine:<memberId>`), and the marks, outline rows and world geometry never appear at Dim. Presence does not hide them (presence means online, not looking at this screen). The partner-render tests (`test/path-footpaths.test.ts`, `test/our-path-world-ui.test.ts`) prove nothing crosses devices: a partner's device assembled from the Shared envelope and its own Personal envelope has no trace of the owner's footpaths or planks. A Codex trust review is still required before merge.
