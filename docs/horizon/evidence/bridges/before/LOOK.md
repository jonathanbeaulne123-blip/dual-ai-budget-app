# Before — what the island actually shows

Baseline e77309efbc48a76e8328f2b427613ecc6082bb61, September30,2026. All captures here are local headless Chrome with SwiftShader. They are **not device evidence**, phone acceptance or performance proof.

## Driver-height capture set

Eight captures in `road-approaches/`: Bight west/deck/east, Quay, Mountain canal and High Span by day, plus Bight west and Quay by night. The Bight deck image clearly shows the existing overhead S2 construction, carriageway markings, fascia rails and lamps. This is the old bridge, not the proposed Suspension Bridge. One404 resource error was logged; its URL was not retained by the original capture helper, so it remains unresolved.

The recorded whole-scene calls range from71 to348 in these eight views; they do not measure per-district bridge cost. Cold-build frame medians range from16.7ms to4266.5ms, making this run unsuitable for a device frame-rate claim. The low call counts in some views need resident-set review, not celebration.

## Rejected first site-view attempt

`site-views-incomplete/` preserves the failed first attempt. Its pending district lists were nonempty. Visual inspection of the Bight aerial showed the coarse deck with detailed structure missing. These images must not be used to approve geometry, silhouette or clearance. The replacement runner preloads chunks and waits for settled residency; any still-unsettled shot is refused.

## Journey baseline

`map/` contains60 images: ten sites × Region/Stop × Classic/Taylor/Newfoundland. The current board/land renderer is used with fictional fixture data. Whole-map counters range28–30 draws and up to39,937 triangles, within the full Journey L0 cap in these frames; lite and device performance remain untested. One Classic resource404 has no retained URL and remains unresolved. These show generic current bridges, not the proposed named glyphs.

## Site-view candidate run

The settled replacement saved19 candidate images before the Prow below-view screenshot timed out after90s. That is a partial run, not a pass. Pending chunk lists were empty in the saved records, but image inspection is still necessary: Hollow's generic deck-height pose lies inside terrain and is unusable. The saved site-view frames must not be treated as19 accepted bridge views. The new deck-camera pass uses points on the carried route; see its independent report.

Four saved candidate frames exceeded the400-call full-scene cap: Bight deck409, Quay air425, Hollow deck683, Canal deck718. The invalid Hollow pose is not a valid rider-view budget measurement. None provides per-district allocation or device frame-rate acceptance.

## Measurements and rough areas

Real-runtime walking replay:32 direction checks across16 structures;26 destinations reached pending path/envelope review,4 no-route (Apron/Reach Footbridge),2 incomplete (Timber Crossing). See [the controller matrix](CONTROLLERS.md).

- Fresh road audit:0 BLOCKER,23 MAJOR,85 MINOR,0 restarts,166.8s. This matches the road-pass reference.
- Static inventory:16 structures,103 identified baked solids,40,772 triangles. This excludes other runtime scene content.
- Bight opening is40m with38m horizontal clear width; S2 headroom probe5.0eu. A nominal gate5 default reaches above the deck and below water; no valid explicit aperture exists yet.
- High Span gate3 top23 versus deck underside23.4 leaves0.4eu. The proposed under-deck arch is not fitted.
- Apron, Reach and Timber Crossing have1eu centreline ceiling-query witnesses; these need visual/geometry correlation before classifying them as defects.
- Ground probes:96 mode/direction rows;34 end-reached-unverified,40 incomplete-probe,22 cruiser not-applicable. An endpoint projection is not a certified crossing.
- Many board probes fade because ordinary road/walk beds are outside BOARD_PROFILE. These results are not permission to change physics.
- Quay retains the known pageL Boathouse loss. The11/11 view tests preserve named baseline exceptions; they do not mean all authored views pass visual acceptance.

## Still owed

Full walking swept-envelope and trace review; glider/cable/monorail swept envelopes; boat-fleet passage replay; missing ferry/rowboat/plane/zip controllers; every minor connector and Reach Footbridge close capture; per-district runtime budgets; all-theme200eu approaches;64px rendered silhouette test; safe meeting anchors; physical Mac/iPhone evidence. The proposed SVGs are diagrams, not “after” captures.

No bridge geometry changed. No before/after improvement is claimed. Next owner: Codex for evidence gaps, Jonathan for the design choices in BRIDGES.md.

## Corrected carried-deck views

`deck-poses/` contains10 current landmark images, one per proposed cast member, with camera positions taken from the actual carried collision bed. All10 records have empty pending lists and no captured page errors. This is a separate run from the failed19-candidate site set. Visual inspection confirmed Bight, Hollow and Garden frame their carried deck; the original Hollow candidate remains rejected.

Whole-scene calls: Bight323, High Span164, Quay692, Apron71, Hollow372, Canal144, Prow316, Trestle84, Garden774, Reach62. Quay and Garden exceed the400-call full-scene cap. These are captured scene counters, not bridge-only or per-district allocations, and the low-count frames still require full resident-set/visual review. No frame-rate or device pass is inferred.

Remaining capture scope includes Reach Footbridge/minors, complete usable water/air views,200eu approaches in each theme, night details and authored-view comparisons. Proposed bridge art is not rendered yet. All saved PNGs are “before,” never “after.”
