# Awning return: actual road-floor solver input

Proposal only: `/tmp/mountain-awning-drawn-road.patch`. No checkout edits, imports, generation, or tests run here.

The prior solver's 4.8m nearest-centreline capsule and linearly interpolated centre height disagree with the approved road's actual swept triangles. Current failed witness at native [25.40953266853415,-91.09377485453899] has landing/native-preferred15.043890817585467 and Horizon15.05912611424826:15.2353mm mismatch. Subsequent reported samples reach larger errors. Native equality in that test does not prove the native road itself equals the landing: the query requests the awning support explicitly and its preferred-support rule selects the landing.

The proposal supplies a callback built with `drawnRoadFloor` over the exact local native road rows, and `worldDeckAt` over the original native coarse road. Membership is the union of those existing footprints. Target Y is the higher existing support. Drawn triangles independently supply the upper-bound reference; a conflicting higher native support therefore fails generation instead of silently raising the visible road lip. The original 40% facet,3cm actual-road lip,1cm composed-support equality, terrain clearance, first-rail preservation, controller physics and fixed-road crest reporting remain unchanged.

The previous solver allowed its deck to lie2.42cm below the road. That was weaker than the existing1cm composed-support equality assertion. This proposal strengthens that lower bound to target−4mm (plus the existing3mm convergence allowance), keeping the upper bound actual-drawn-road+24mm. It changes authored output, not test tolerances. An unresolvable native/drawn conflict remains a real failure.

Boundary constraints now query the actual union footprint and use16 subintervals plus32 bisection steps for detected entry/exit transitions on each landing edge. This is bounded numerical sampling, not an analytic proof of arbitrarily tiny disconnected footprint islands. Existing dense actual-surface regression remains necessary. The regenerated source hash includes full drawn road rows and native coarse road points. Diagnostics add `roadFieldDifferenceAtVertices` (explicitly a vertex measurement, not whole-area clearance).

The old test's centreline comparator becomes `drawnRoadFloor` at the same dense samples, retaining3cm. It adds a1cm maximum exposed support assertion against both fields. Existing exact first-rail, no-fold, actual full-width native/Horizon support, contacts and road-through tests are retained.

Next root checks: regenerate, run mountain-landings and exact8/12 awning controller test/trace; inspect diagnostics and actual native through-road queries near return ownership switches, since a preferred-awning query alone cannot certify those lips. No successful generation or walking/skating outcome is claimed here.
