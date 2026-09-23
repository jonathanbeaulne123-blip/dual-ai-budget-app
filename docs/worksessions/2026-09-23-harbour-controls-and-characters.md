# Hearth worksession — Harbour walking and visible characters

## Request and current base

Jonathan reported reversed turning and generic characters even though Bianca and Jonathan models had been added. PR #529 for building camera and collision merged into `origin/main` at `3ef0d0d7cb54d8d5177943eba760ab1774ee34bd` while this follow-up was underway. This change belongs in a new PR based on that merge.

## Scope and risk

Risk: Medium-High. Walking direction, board steering and the opt-in Walk Together presence wire change. Budget (5): +0; no ledger meaning, writer, Auth, scope or Final Confirm changes. Engagement (3): +2; directional control agrees with the view and both supplied character models can be selected at the point of play. Classic Hearth, Taylor's Scrapbook and Newfoundland retain the shared world geometry and model assets; each has a themed chooser surface.

The preference is explicit and device-local for the environment, household and member. It is not inferred from a person's name. A partner's model appears only when they choose one and opt in to Walk Together. The wire carries an allowlisted avatar identifier with an otherwise ephemeral position sample; no choice is sent while sharing is off. The generic body remains the failure fallback.

## Implementation

- Correct the screen-right camera basis for walking and the sign of ground/air board steering.
- Put the Bianca/Jonathan chooser in the village scene, open it for first use, leave a visible change control, and report model-load failure with a retry path.
- Give each loaded model its own materials so partner fade never fades the local player.
- Forward the selected avatar through the validated, opt-in world-presence step and use it for the live partner figure.

## Verification and limits

- Local fictional demo preview: both choices changed the visible 3D character in the Village Square; first-use chooser was visible without opening the map.
- Focused walking, skating, character, choice and presence suites passed before final integration.
- On clean source commit `3f6c635c6d9dd1786360d46cd8d609368ceaa8fe`, the required Medium-High quick gate passed: diff and AI-surface checks, TypeScript, 82 fast test files and 6 serial test files (117 serial tests). It took 492.8 seconds against a 300-second target, so the time budget was breached; this is not a within-budget gate result.
- Workspace TypeScript and the feature-enabled Vite production build passed on the same source. The build retained its existing dependency externalization and large-chunk advisories.
- The docs-only evidence update after that run does not change the source tested by the gate.
- A local preview cannot prove an authenticated two-device Walk Together session, real-phone touch feel, or a hosted Worker deployment. This PR is for review; no hosted release is included.
