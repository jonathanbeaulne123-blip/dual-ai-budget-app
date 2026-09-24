# Hearth Mountain authored art — local integration packet

Base: `a81e43ad034bdec64ebbf6b834add234a68fd64e`, isolated branch
`codex/hearth-mountain-art`. This is one parallel implementation slice of Jonathan's
approved remaining programme. No push, deployment, schema or hosted data operation.

Risk: **Medium-High** for new collision-backed scenery; parent programme remains High.
Budget delta (5): existing destinations remain recognisable at a distance; no financial
meaning, command, Fund calculation or Final Confirm changes. Engagement delta (3):
six distinct biome compositions, crafted transport, a summit landmark and clear
architectural routes replace repeated blockout forms.

## Composition

The supplied local `our-path-living-world--d05247c0.html` was inspected for its low-poly
terrain, calm planting islands, restrained water course, garden rows and material-led
repair vocabulary. It was used as visual reference, not a source of state or finances.

- Hearth Terrace: ordered herb beds, low flowers and timber resting places.
- Orchard Hollow: spreading blossom/apple crowns, clover and a low sunny canopy.
- Library Woods: narrow tiered birches, bark marks and fallen-leaf ground cover.
- Glasshouse Meadows: permeable spires of flowers and seed heads, broad open drifts.
- Reservoir Heights: exposed rock strata and sparse lichen below the existing glass dam.
- Summit Commons: sheltered snow, an inlaid compass and a copper-like observatory dome
  at the existing pavilion address. Its overhead volume and posts are collision-backed;
  there is no new supporting rooftop surface.

Classic uses warm stone, timber and brass with small geometric paving. Taylor uses
muted rose, plum, cream, diamond stitches and station pennants. Newfoundland uses
blue-green timber, slate, pale coastal stone, rope motifs and lilac flowers. These are
original interpretations of the existing Harbour palettes; no album artwork is copied.

All seven distant building types now have a separate lightweight silhouette factory.
Home retains its two floors and dormers; Library its turret; Glasshouse an open iron
nave; cottage its low roof/chimney; Bank its civic crown; Studio its kiln chimney;
Boathouse its wide doors. The existing close exteriors and room cutaways stay authoritative.

## Geometry and ownership

`artGeometry.ts` supplies deterministic district fixture placement, exact station boxes,
and summit bounds to both art and `WORLD_SOLIDS`. Trunks, benches, beds and rocks no
longer appear only in the streamed renderer without collision. Fixture footprints
exclude roads, branch decks, footpaths, entrances, river, stations and reserved plots.

The station's supported platform remains the existing `WORLD_SURFACES` ribbon at its
published height; the older mismatched raised slab is removed. Station posts stand
outside the 6 × 4 platform. Fins are above standing height. Open carriage sides preserve
the camera view; a separate funicular wheelset and gondola suspension match the shared
ride position. No private animation loop or transport authority was added.

Shortcut fascia stays inside the existing deck slab. The old decorative centreline rail
was removed so it no longer appears to obstruct the ride line. Flush deck markings,
plot corner stitches, town fountain mosaic, social-quay compass and channel-edge
mosaics add no supported floor or obstacle.

`MountainArtKit` groups by material and 48-unit spatial cells and releases geometry and
materials exactly once. District detail still streams through the existing ownership
and race pinning. No visitors, wear, growth or basin update logic changes in this slice.

## Integrator hooks

1. `buildMountainLandscape(...).setTransit(at, kind?)` accepts the actual transport kind.
   Pass `ride.kind` through the Court handle; omitted kind keeps gondola compatibility.
2. Replace the generic distant wall/cone in `VillageCourt` with
   `buildDestinationSilhouette(kind, dressing, quality)` from `mountain/architecture.ts`.
   Attach its `.group` to existing `far` and add the factory resource to `owned`.
   Keep existing anchor traversal, streamed exterior toggling and cutaway ownership.
3. `WORLD_SOLIDS` appends `STATION_SOLIDS`, `DISTRICT_ART_SOLIDS`, `SUMMIT_ART_SOLIDS`.
   World surfaces, roads, branches, station addresses and definition version are unchanged.

## Measured local verification

A coordinated, single-worker focused run on 2026-09-24 passed:

- `test/hearth-mountain-art.test.ts`: 5 tests covering collision registration, the entire
  road/branch cross-sections, all station platforms, fixture clearance and finite
  three-theme geometry with bounded district draw counts and exactly-once disposal.
- `test/hearth-mountain.test.ts`: all 16 existing tests. Ordinary input-driven descent
  remains **74.4667 seconds, zero bails, all 22 ordered gates**.
- Total: **21 tests / 2 files, 2.31 seconds**. This is focused evidence, not a broad gate.

No TypeScript project gate, build, browser, GPU measurement or physical-device run was
performed in this parallel slice because the integrator owns the shared test/browser
schedule and the host is under memory pressure.

## Review poses and remaining acceptance

Use existing Mountain & town destinations, then look back toward each destination from
its published district arrival. At Summit Commons, look toward `[5,115,-276]` to inspect
the dome and toward the harbour for silhouette separation. Review every station from
its arrival point; ride both kinds and inspect cabin framing. In town, look at the existing
fountain `[0,0,0]` and social quay `[-14,ground,42]`. Check all three themes, phone framing,
manual station entry/exit and the ordinary race plus optional elevated branches.

Town river water is pre-existing at a low height and can be hidden by island ground.
This slice preserves geography and only marks its banks; a shared terrain/channel cut
belongs to the integrator. Human visual/play-feel acceptance, reduced-motion/screen-reader
walkthroughs, sustained physical-phone performance, and two-device elevated agreement
remain open. The silhouette integration and actual ride-kind hook require parent wiring.
