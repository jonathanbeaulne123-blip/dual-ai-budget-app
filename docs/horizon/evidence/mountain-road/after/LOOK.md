# Mountain Road — draft PR visual record

This is a local, incomplete visual review. All captured images use headless Chromium and SwiftShader. They are not phone, Mac GPU, movement or live-deployment evidence. Jonathan asked to wrap the current work and open a PR on October 1; the remaining capture matrix is deferred explicitly.

## Night lighting and current local preview — 2026-10-04

The local Horizon renderer visibly shows the Mountain Road lanterns and their warm ground pools. The baked world contains 35 Mountain Road lamp anchors and 35 corresponding light IDs. Three actual-render captures and one closer lamp view show the mountain from the air, the road beside the trestle, and the Stillwater tunnel. That completed capture set records parent revision `123319d` (before rebasing on PRs #579 and #580); see the [night capture set](attempts/night-review-2026-10-04/captures.json) and its [source and asset provenance](attempts/night-review-2026-10-04/provenance.json).

That completed capture run used Full / Classic / Night at a 1100×720 review viewport. All 18 loaded assets matched their local bytes, all 26 live source checks matched, the source stayed stable, and the renderer reported no runtime errors. After rebasing on `main`, a fresh attempt at `9e4e398` rendered the Stillwater tunnel, but Library drive did not settle and mountain-air timed out; only one of three required views was captured. The incomplete run and its provenance are retained in [the rebased attempt](attempts/night-review-rebased-incomplete-2026-10-04/README.md). Neither run completes the three-theme/day/night/full-and-lite matrix or device and movement acceptance. The local preview URL is `http://localhost:5173/horizon-review.html?world=horizon&tier=full&shot=F&date=2026-10-01&sun=22:00&theme=classic`; the ordinary app and hosted deployment do not include this worktree until it is merged and released.

The approved Library landing reads as a continuous surface at rider height in Classic and Taylor’s Scrapbook. The Awning return and Orchard approach are present in the standalone native world. One Orchard bridge-entry view shows timber supports close to the riding line; the saved primitive-clearance probe is unrun, so that visual concern remains open. Native authored lighting is fixed daylight; these captures do not pretend to provide a native night mode.

The [interrupted native run](attempts/native-capture-wrap-up-interrupted/captures.json) retained87 views across all three full themes and Classic lite. Newfoundland full’s overview failed its45second settling limit. The user-directed stop is recorded separately; all1,839 captured source/asset inputs were checked for drift in its own provenance record. Read the exact count there if the source inventory changes. Neither the settling failure nor the interrupted remainder is a pass.

Representative rider views:

- [Library landing, Classic](attempts/native-capture-wrap-up-interrupted/classic-full-authored-daylight-library-balcony-landing-down.jpg).
- [Library landing, Taylor](attempts/native-capture-wrap-up-interrupted/taylor-full-authored-daylight-library-balcony-landing-down.jpg).
- [Awning bend, Classic](attempts/native-capture-wrap-up-interrupted/classic-full-authored-daylight-awning-bend-down.jpg).
- [Orchard bridge entry, Classic](attempts/native-capture-wrap-up-interrupted/classic-full-authored-daylight-orchard-bridge-start-out.jpg).

The existing [rendering parity evidence](rendering/shade-passes/README.md) covers the portable lighting/plant batches on its own frozen inputs. It does not establish final combined district budgets or final-world visual acceptance. Earlier rejected capture attempts remain under attempts.

The four inherited C/D/F/L portrait failures have been reframed under Jonathan’s written choice. The baked-world test now passes all twelve landscape and all twelve portrait subjects, including the named-subject and horizon checks for those four views.

Still owed: the completed 132-view native matrix; final Horizon joins, authored views, finish and Journey captures across all requested themes, tiers, times and widths; physical-device acceptance; and a final visual comparison after the runtime-ground correction. The Orchard bridge-entry support clearance and incomplete native/night capture matrix remain open.
