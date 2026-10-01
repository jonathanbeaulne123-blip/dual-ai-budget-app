# Applied shared-source crossing review

Read-only source review of applied `src/harbour/horizon/land/mountainV2/sharedRoad.ts`, `world/crossings.ts`, `land/beds/junctions.ts` and `test/horizonMountainSharedSource.test.ts`. No execution/imports or checkout edits. Reviewed after root applied the revised endpoint-touch proposal.

No actionable semantic defect found in the bounded source changes.

- Collection attaches ownership only to the actual sourceId S1 / mountainV2.road bed pair. Full owner road XYZ/length must equal the current native export. Every declared course interval must have unchanged exported XYZ endpoints, a uniquely matched full-XYZ quantization box, correct descending order and <=3 source-segment stride. A modified course interval is skipped, not silently relabelled; later unchanged intervals may retain valid ownership.
- Interior match requires corresponding owner segment indices and finite <=0.02m height difference. Adjacent segments require the correct matching endpoint and the actual intersection inside both exported course and road ±0.005001m plan boxes. The first lane segment receives only a spatially bounded Foot endpoint touch, never a lane source span. An arbitrary nearby switchback or extended town-lane intersection cannot qualify by ID alone.
- Raw segment intersection computation and overlap-collapse logic are unchanged. New metadata is applied to a computed intersection, not used to remove raw records. The rawIntersections result still recomputes actual raw centreline geometry.
- Source-backed pairs become sharedStretch under the existing at-grade contract. Their geometry is skipped in all relevant junction mutation stages: fixed-join pin collection, profile alignment targets, footway apron adjustment, and final threshold/marker emission. Unrelated intersections still take the original paths; no global step/clearance tolerances change.
- Source proof remains visible on crossing records, including actual hit segment, original owning interval and endpoint coordinates where applicable. Existing registered/proposed flags remain unchanged; shared ownership is not a new manifest registration.
- Tests cover full segment partition, changed heights/coordinates/wrong owner rejection, measured adjacent and Foot touches, shifts outside endpoint boxes, retained raw intersections, no artificial pads/markers, unchanged source polylines and ordinary unrelated at-grade crossing behavior.

Limits: this does not claim the current final bake retained all source polylines, generated zero artificial pads, or passed the tests. Those are final runtime/data gates. It also does not certify the unchanged general overlap-collapse algorithm for arbitrary future routes; the new ownership path is constrained to the reviewed native export.
