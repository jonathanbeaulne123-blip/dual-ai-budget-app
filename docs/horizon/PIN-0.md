# PIN-0 — finalization record

**Pending accepted merge. No PIN-0 tag has been created by this prerequisite branch.**

The prerequisite candidate is based on merged Pass 0 #545 at `4e0234a349a64ca9b7c4a784d08b2c04f01a79b9`. It applies Jonathan's later scale/reserve decisions and repairs the manifest admission checks. The precise final candidate and its verification belong to the prerequisite PR and delivery packet; this file never substitutes a local head for a merge SHA.

To finish after review and Jonathan's release decision:

1. Verify the PR's exact reviewed head, passing required checks, and unchanged target base; handle new main changes and revalidate if needed.
2. Merge the prerequisite PR under the repository's separate merge/deployment authorization. Observe its actual merge SHA, and verify that commit contains manifest v1.6, confirmed scale 1.0, three Terraces plots, valid physical crossings and preserved route-pair notes.
3. Record that actual merge SHA, date, pass `0 Reconcile`, geography `hearth-mountain-geo-2`, and presence `hearth-mountain-geo-2` in `docs/DECISIONS.md → Pins` and in the delivery handoff. Do not use the empty Horizon fixture revision or the planned land revision for the existing Mountain world.
4. Create and publish an annotated `PIN-0` tag pointing to that accepted merge. Refuse to move an existing tag; if it already exists, verify its target. The later pin-record documentation commit does not change the pinned base.
5. Branch `codex/horizon-land` from `PIN-0`; create `land/interfaces.ts` on its first commit, and continue the original Pass 1 request. No rebase during the land pass.

Physical Mac/iPhone acceptance and the requested Claude auditor review have not been produced by this prerequisite task. Any acceptance or explicit deferral must be recorded truthfully by its owner before treating this as complete Pass 0 acceptance. The pin is never a claim that Pass 1 terrain, renders, journeys, cave clearances or device gates have passed.
