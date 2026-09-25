# Hearth worksession — Horizon prerequisites

- **Status:** IMPLEMENTED; verification and release finalization tracked in the delivery packet.
- **Opened:** 2026-09-25 (`America/Toronto`)
- **Owner / decision owner:** Jonathan
- **Assignee:** Codex; independent read-only Codex reviewer
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `codex/horizon-prerequisites`
- **Baseline SHA:** `4e0234a349a64ca9b7c4a784d08b2c04f01a79b9` (merged Pass 0 #545)
- **Risk:** Medium for canonical input/loader changes; recording PIN-0 requires the accepted merge and release decision.
- **Environment impact:** none from local implementation. Main merge triggers the configured Development deployment.

## Household outcome

The Horizon land builder receives one confirmed scale, an aligned reserve inventory, and a crossing register with physical resolutions separated from coordination notes. It must not bake from the old 0.6 recommendation or add the removed seaward plot.

## Budget delta (5)

No financial meaning, posting, household data, ownership, Auth, schema, synchronization, or command change. CAD, local/cloud continuity and Final Confirm remain with their existing owners.

## Engagement delta (3)

The build inputs now express Jonathan's full-size island and three uphill Terraces plots. No terrain or visual change is implemented in this prerequisite slice.

## Verified baseline and authority

PR #545 is merged at the baseline above. Its canonical D12/D13 and PIN-0 remained open; three crossing rows used `n/a`. Jonathan then selected “1.0 — full concept scale” and “Keep only three uphill — seven reserve plots total”, followed by “ok do the 3 prerequisites”. This authorizes applying those decisions and reconciling the supplied input conflicts. The original Pass 1 additions explicitly include twelve station pads and the homestead pads; D21/D25 record that land scope only, with money-overlay decisions still open.

## Scope and decisions

- Manifest v1.6 and its generator: confirmed factor 1.0; retain Terraces indices 0–2 for coordinates, bearings and place IDs; four Bight Shore plots and two small reserves remain. `plot.terraces.4` is retired.
- Attach the S4/VBS district note to the existing threshold. Keep ORE/Crown Road and DEEP_RUN/ORE coordination evidence in `routePairNotes`; these are never exclusions from computed-crossing validation. Both Deep routes include [1300,420], so their vertical profiles and actual crossing must be resolved in Pass 1. No fabricated clearance is claimed.
- Preserve the full `canoe→feet→canoe` portage sequence and validate all nonempty steps.
- Fail loading invalid crossing enums/points, invalid note data, malformed mode sequences, misaligned reserve arrays, duplicate IDs and reuse of retired IDs.
- Keep original journey targets. Active estimates now use factor 1.0; six covered estimates miss the existing targets. Neither speeds nor targets were changed to manufacture a pass.
- Update the contract and active land/kit/neighbourhood references. Inputs remain frozen historical artifacts; the generator reproduces canonical JSON.

No geometry, scene/UI, `src/core`, `reading.ts`, village layout, presence Worker, deployment settings or household data is changed. The current Mountain geography and presence remain `hearth-mountain-geo-2`.

## Acceptance and evidence

The output packet is `~/Downloads/hearth-horizon-p1-land/prerequisites/`. It records final base/head/PR, exact commands, test counts, timings, generator parity, JSON digest, source scope and independent review. Run the existing A1–A5/Desk/Horizon focused suites; then on the final candidate run the change-focused quick gate and `pnpm build`. Full verification was not requested and is not claimed.

The local runtime reuses the Pass 0 dependency installation with the same lockfile. The bundled pnpm's dependency verification is set to `warn` so running checks cannot purge another worktree's shared modules.

## Focused verification before final commit

- `test/horizonManifest.test.ts`: 14/14 passed in 0.379 s after repairing the input admission cases.
- Existing A1–A5, Desk-import and WorldDefinition focused suites: 11 tests across 7 files passed; source-import failures during implementation were repaired and the manifest suite rerun.
- Generator JSON parity, unchanged dependency lockfile and `git diff --check`: passed.
- Final committed quick-gate/build evidence is written separately to the delivery packet; these precommit checks are not substituted for it.

## PIN-0 finalization

See `docs/horizon/PIN-0.md`. A local commit is not a merge pin. Keep the canonical Pins row pending until the accepted prerequisite PR is merged; record the real merge SHA and publish the immutable tag only then. Source checks do not replace physical Mac/iPhone or requested Claude review evidence. No such evidence is claimed in this worksession.
