# Horizon bridge PR and airport integration

## Authority and scope

Jonathan: “create a mergeable pr for this and the airport update”. Risk High; Budget delta(5): 0; Engagement delta(3):+2 target. No merge or deployment requested. Airport #576 is already merged to main at `324cd5f246ab295af5cf64d553ebf78fad57f7b5`. Bridge work `0fd06e0` was integrated with it as `f114a58`.

## Integration review

Retained airport imports, theme updates and disposal together with bridge batches. Independent read-only review identified night lighting initialization after a theme switch; recreated bridge art now receives cached night intensity. No controller, money, Auth, sync or schema change introduced by this integration.

Bridge evidence contains authored-world images, synthetic map harnesses and geometry reports. Tracked/untracked text credential-pattern audit found no matches. No private household export or attachment copy was added.

## Verification

The requested 105 Horizon/Journey/harbour files are running one at a time on the combined branch. TypeScript, focused quick gate, airport flight circuits and PR CI remain pending. Earlier failed gates remain recorded in the build handoff. The known Bianca Month baseline fixture failure is named; the original brief requires Jonathan's word before changing it.

## Limits

Ten bridge families and meeting/map identities are implemented. Drawbridge operation, Ribbon pumpable dip, complete route/vehicle acceptance, whole-scene performance acceptance and physical-device review remain open. Powered aircraft now exist, but prior glider aperture evidence does not certify their swept wings. Bight's 11m gate does not accommodate Heron's 14m wingspan. This is reviewable implementation progress, not full feature/release acceptance.

## Review and sweep repairs

Jonathan explicitly approved the Bianca Month fixture repair during this PR. The fixture now returns a fixed September30 activation, and its App test pins calendar time ten minutes later. Real elapsed-time UI waits use `performance.now()` so date freezing cannot hang their deadline. Production Month behavior is unchanged; fixture lifecycle consumers are included in validation.

The airport had added brake release ahead of skate reset; the old-shell source fence now requires both operations. A night-light regression test checks all three replacement bridge themes using actual baked district membership, retained night intensity and daytime dimming.

The S1/S4 exact-blocker census removes three cleared rail samples: Apron1312/1314 and Hollow148. Independent comparison with main confirms S4 station150 has identical coordinates and board surface y35.95915937: the same existing Hollow neck / D-C10 obstruction is now owned by `hollowBridge.deck`, replacing `walk garden.bed.hollow`. That named exception remains; no route-traversal acceptance is inferred.

Final interaction review restored bridge groups to the tap-to-walk raycast. Their geometry moved out of district cards, so omitting the new group could select terrain below a bridge. The regression proof also raycasts the real meeting deck in each theme.

## GitHub review fixes

The remote quick gate passed on PR head `d59e9a9` (GitHub test merge `ad148cc`): 601 fast + 90 serial assertions, 263.787s, no time-budget breach; TypeScript, AI-surface and diff checks passed. This precedes the following review fixes and is not evidence for their final bake.

- Reach's west-facing meeting rail intersected the existing 40m `reachMeadow` landing disk. Move only that meeting bay to the east side while retaining its end-of-rail entrance and outward face winding. Keep the landing volume unchanged. Add an all-landing-clear regression against the actual bake.
- Preserve extracted `underIds` in the flat map and mask each underpassing line only beneath its bridge deck. Per-instance mask IDs avoid collisions between two maps; carried road lines retain their existing paint order.
- Identify Garden planter colours by `sourceId` after district partitioning, with a partitioned-solid regression.

The local serial sweep has encountered worker-RPC timeouts under concurrent host load despite passing assertions in some heavy files. Those exits remain failures; no limit has been increased. The two unchanged `horizonMoversNoMoney` failures are also the documented pre-branch baseline from the main-road handoff. Final totals and targeted reruns follow.

The requested sweep caught S2's west entry hitting the new suspension end block. End blocks move beyond the full approach corridor onto grounded pier footings; elevated cable ties replace the former low anchor/shoe geometry. Tower positions, road and flyover heights remain unchanged. `horizonWave6` checks the existing full/lite walking route after the fresh bake. The duplicate Wave4 landscape proof now records Quay's already measured page-L improvement (13px with unchanged camera/threshold), matching `horizonViews`.

Independent bounded anchor review measured all four rotated2.2×2.2 footing footprints against nearby paths. Tightest west-lagoon corner is3.01515m from S2's centre, leaving0.71515m after the 2m half-width and 0.3m body radius. Tie underside15.7 is about3.02m above the nearby S2 route. These are footprint samples; full/lite baked walking replay remains separate.

## Completed integration sweep

All 105 requested files ran one at a time in 1709.85s. Initial result: 95 file exits passed; 1,368 assertions passed /10 failed /2 existing TODO /1 existing skip; 3 worker-RPC errors. Source/test repairs during the sweep are followed by targeted reruns, not a retroactive green label. Full per-file results: `docs/horizon/evidence/bridges/after/validation/pr-sweep.json`. This is the requested feature sweep, not `test:full` or `check:full`.

## Fresh review bake

Baked successfully in 186.34s. World SHA256: `d16ba180ec578c95746d814dc177ccd7feaca28b9f480695e5852add76c08c25`. All 7 landing proofs are clear; all 10 walking envelopes and meeting areas retain measured/built status. All 12 original landscape views pass; portrait exceptions remain unchanged. The byte-exact check and targeted runtime replays are running; their eventual outcome is separate from static proof.

Fresh-bake validation: byte-exact check 129.46s passed; existing full/lite S2 walking 9 tests passed; Wave4 view/body15 tests passed; flat Journey road/map16 tests passed; all 4 bounded real-glider passages passed. Bight remains 3 bridge-only draws in each theme/tier, with full additions7,974/6,840/9,990 and lite 6,770/6,698/6,898 (within18,000/7,000). Updated budget and glider reports carry the compressed-world SHA; the uncompressed-world SHA above is a different byte representation.

## Final review repairs and independent reruns

Code review found positive-side Hollow roof winding reversed and finalized bridge measurements sharing the input's mutable passages/meeting records. Reverse that slope's corner order and copy measurement-owned records. New regressions exercise the actual collision ceiling on both roof slopes and repeat the finalization/measurement pipeline while checking input and earlier output remain unchanged. All 16 bridge assertions pass before the renewed bake. The audit metadata lookup now tolerates non-Git roots, and the two after-audit headings identify their stage correctly. Earlier road reports retain their historical auditor hashes; they are not represented as reruns of this script revision.

All originally interrupted files passed sequential reruns with unchanged limits: hosts 3, structures 23, underground 4, skate-lines 5 with 2 existing TODO. Old-shell 20, blocker inventory 9, onboarding 24 and full App startup 83 pass, including the authorized Bianca Month date fixture. The airport's three headless takeoff/landing circuits pass. The only remaining feature-sweep failures are the same two mover static-fence failures reproduced from an isolated archive of unchanged main324cd5f: `cameraMount` matches the money-word scanner and existing glider clocks match its clock scanner. Neither source nor test is changed here. See `after/validation/last-rechecks.json` and `post.json`.

The first local quick-gate attempt failed immediately because it was invoked directly with Node instead of through pnpm; it is not passing evidence. A correct clean-head invocation follows. Remote CI, Cloudflare PR build and baked-asset verification passed on 27e1052 before these final review repairs. No merge or deployment was performed.

Final roof-corrected bake SHA256: `7ae2357ff113a3eadf195a4e2d95832b621eee2deb3703fd4ffd37af6d60e3bb`. Bake 114.79s, byte-exact check 162.04s, all 16 bridge tests, bridge-only budgets and all 4 glider passages pass. All 7 landing fields remain clear and all 10 walking/meeting proofs remain measured/built. `after/validation/final-review.json` records durations. The non-Git audit metadata fallback was exercised successfully in isolation and the script syntax check passed. Final clean-head local/remote gates are reported in PR #577; this record does not retroactively label the initial sweep green.

Clean High quick gate on `ebbe5dd6d657b81512553d9751e9dd5aa14628f9` passed in 289.329s against main `324cd5f`, within the 300s budget. TypeScript, AI-surface, diff and both fast/serial groups passed. Evidence: `after/validation/clean-quick-gate.json`. The following documentation-only commit fixes count spacing and records this result; final GitHub status is reported in PR #577.
