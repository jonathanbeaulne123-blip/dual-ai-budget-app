# Hearth worksession — Hercules slice 1

- **Status:** Slice 1 complete locally; contracts tested and independently reviewed; runtime inactive
- **Opened:** 2026-09-10 (`America/Toronto`)
- **Owner / decision owner:** Jonathan
- **Assignee:** Codex; independent Codex read-only trust reviewer; Claude not needed
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/hercules-companion-contracts`
- **Base / HEAD at start:** `2e113f69d03872eddc22ac461378a0f3e33f6c55`, verified remote main
- **PR:** none
- **Risk:** Medium-High for unactivated privacy-sensitive contracts; later persistence activation is High
- **Environment impact:** none; synthetic local validation only

## Outcome

Implement slice 1 of [the approved Hercules plan](../briefs/HERCULES_LIVING_COMPANION_PLAN.md): versioned character/capability/profile/look/intent contracts, strict pure validators, legacy preview mapping and 24 synthetic conversation evaluation scenarios. No production writer, model prompt or UI activation in this slice.

Budget delta (5): define grounded discoverable capabilities and prove companion intent cannot acquire money authority. Engagement delta (3): give future dialogue and wardrobe a coherent character, catalogue and ownership contract.

## Boundary decision

The independent reviewer confirmed every current authority command assembles and re-splits Personal/Shared state. Partially adding a production envelope field would risk dropping it on unrelated commands. Keep slice 1 contracts independently executable but unregistered/unconnected. The complete shape/split/overlay/actor/resources/import-parity/server-compatibility unit belongs to slice 2 before any new profile write is enabled. No change to the approved end-state or scope reduction.

## Evidence and handoff

### Implementation

- `herculesCompanionContracts.ts`: strict private-profile, look, gallery, presentation and nonfinancial intent contracts; explicit trusted scope checks; resource revisions and deletion generations; bounded typed preferences; versioned wear manifests; explicit shared projection; unknown legacy metadata preservation.
- `herculesCapabilities.ts`: twelve stable outcome/action declarations, scope/data requirements and existing read-tool references. No card is exposed without an explicitly supplied handler; actual eligibility and navigation integration remain slice 3.
- `herculesCharacter.ts`: versioned voice principles, situation examples and expression/gesture vocabulary, disconnected from the live Worker.
- Synthetic fixtures: populated member-owned profile, three fixture cosmetics (not production assets), 24 multi-turn/product evaluation scenarios and a human voice-quality rubric.
- Canon/index/roadmap now distinguish the accepted future character direction from current runtime and point to this implementation evidence.

### Independent review and resolved defects

One read-only Codex reviewer performed the boundary investigation, implementation review and focused re-review. It found three concrete contract issues, all fixed with regression coverage:

1. Automatic preference candidates now carry source-conversation generation, source user-turn identity and remembering revision; disabling/re-enabling memory or clearing the source cancels old candidates. Manual settings edits still work while automatic remembering is off.
2. Wearing binds the look's catalogue version to a supplied versioned manifest. Stored future versions/IDs remain readable but cannot be worn without the matching supported manifest.
3. Unknown legacy strings containing spaces, slashes, Unicode and other unsupported selector text remain opaque metadata, matching the old kitchen format. They are never interpreted as a wearable item.

Gallery preflight additionally binds the creator, checks source-look revision and capacity, and rejects foreign edit/delete. Final reviewer result: no remaining material slice-1 findings. This is source/contract review, not proof of deployed authorization.

### Verification

Runtime PATH used:

```sh
export PATH=/Users/jonathanbeaulne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/jonathanbeaulne/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH
pnpm --config.manage-package-manager-versions=false install --frozen-lockfile --ignore-scripts
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never exec vitest run test/hercules-companion-profile.test.ts --maxWorkers=1
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --risk=medium-high --focus=test/hercules-companion-profile.test.ts --focus-reason='Closed companion contracts: ownership, round trips, catalogue compatibility and rejected money authority'
```

Frozen install reused all 205 packages, downloaded none and did not change the lockfile. The initial quick gate stopped at TypeScript (80.845 s, no budget breach): incorrect test import and a union discriminant that could not narrow. Both were corrected. Focused suite passed 46/46 in 3.66 s after the contract fixes.

Final quick gate: **84 passed**, zero failures, in **115.907 seconds**, no five-minute budget breach. TypeScript, AI surface and diff checks passed. Selected suites: companion-profile (46), command-contract (2), command-runtime (29), proof-matrix (7, including PGlite). Gate fingerprint `d8d19f4f48e76c71db547f0d49025f228ecca37cf9246748f8552858f024537f` at the above base/HEAD. Documentation receipts were updated afterward; all five executable/test hashes below were rechecked unchanged. This is a working-tree quick gate, not an exhaustive or release gate.

Production build command: `pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never build` with the runtime PATH above. **Passed:** TypeScript, Vite (640 modules, 19.69 s Vite phase), Hercules Pro UI build and no `dist/_redirects`. Warnings came from unchanged PGlite/node browser externals, eval and existing chunk/import structure; no warning was introduced by these unimported modules. Bundle scan found no new contract/fixture/character markers. Final diff check passed.

Reviewed executable-source fingerprints (SHA-256):

- contracts: `aa215cc69b07882bd6a3bca4b79fd82effd2efb8d2403f4788f462393f49578d`
- capabilities: `bcf01d65e5965139ac1c3133808a453bd9491f441e9d9c68ea0800210b8a6137`
- character: `eccb0ee26b59db21a1df5756e5564e8c0889923e909dc942576c63b9cc60c326`
- focused tests: `5dd614594fef3e80ea83e18770f78e0d4a927f32d7d2b3b70bd4ba1395c5a847`
- fixtures: `84cb875ec9cb3f35a4b16d7ca90e33f5639a9ac25bc25da350d59409ec868333`

### Exact acceptance boundary and next owner

These are executable, synthetic compatibility/projection/precondition tests. Profile data is not yet installed into production envelopes; new operations are absent from `executeIntent`; the live prompt and app are unchanged. `CompanionChatRequestV2` and its context budgets are declarations only: request disclosure, history truncation/redaction, actual retention, automatic extraction and receipt idempotency must be implemented and tested in slice 2. Structural presentation decoding does not replace financial numeric/source validation.

No UI rendering changed, so all-theme screenshot/physical-device acceptance is not applicable to this slice. No Gemini calls or Claude calls were made. The 24 dialogue scenarios are an evaluation asset; no model warmth/continuity score is claimed.

Next owner is Codex for slice 2 when requested: activate the entire private persistence unit with real authority/import/old-client/event tests, then connect personality and memory. Do not skip to a partial envelope field or live conversation-history upload. No push, merge, deployment, hosted schema or private-data transmission occurred.
