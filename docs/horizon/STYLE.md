# The Horizon — STYLE

Version 1.0 · 25 September 2026 · Owner: Jonathan (product) · Author: Claude (design lead) · Readers: every builder on every pass.

`CONTRACT.md` is the law, `MANIFEST.json` holds the numbers, `LIGHT.md` holds the sun. This file says how the island looks, sounds and lights. If this file contradicts any of those three, they win and this file is corrected in the same PR. Ids and place names below are `MANIFEST.json → names` and manifest ids only; no pass invents a place name from this file.

---

## 0. How to use this file

### 0.1 The one-sentence test

> Hide every building. Could a reviewer tell which neighbourhood a screenshot is from, and could they tell it is still the Horizon?

The first half is proven by §2 (ground, planting, materials, light, sound, weather differ per neighbourhood). The second half is proven by §1 (one card, one ink, one sun, one value range, one planting grammar everywhere). A screenshot that passes only one half fails.

### 0.2 Who reads what

| Reader | Must read | Uses for |
|---|---|---|
| Codex, pass 1 (land & sky) | §0, §1.2, §1.4 (clearings, strata), §1.5, §1.7, §1.8, §1.12, §1.13, §1.14 | slope paint, biome blend, strata, water bodies, fog, sky, horizon cards |
| Kit subagent (pass 2b) | all of §1, §3 | every reusable piece, its three dressings and its night state |
| Neighbourhood subagents (one each) | all of §1, their own sheet in §2, the §3 rows their sheet names | placement, planting, lights, sound, weather |
| Movers subagent | §1.1, §1.2, §1.6, §1.11, §1.12, §3 rows for vehicles and stations | cabins, cart, plane, glider, balloon, boats, running lights |
| Pastimes subagent | §1.9, §1.10, §1.11, §1.12 | lanterns, ghosts, baskets, bocce, kites, boats |
| Reviewer (has not seen the work) | §1.14, the checklist at the end of each §2 sheet, §1.12 | ticks boxes against the twelve pages and the seven porch poses |

### 0.3 Units (read this before any number)

- **m** = concept metre (land, distances, heights above sea, fog, district radii, sightlines). Engine size = m × `MANIFEST.scale.factor` (0.6 recommended, D13).
- **eu** = engine unit at the existing body scale: `BODY_HEIGHT = 1.25 eu` (`src/harbour/body/obstacles.ts`), a standing adult. **Object dimensions (benches, posts, rails, trunks, signs, ink widths, drift sizes, clearances) are in eu and are never multiplied by `scale.factor`.** A D13 change moves land and routes; it never resizes a bench.
- Colours are sRGB hex. `L*` is CIELAB lightness measured on the screenshot.
- Reference distance for line and detail rules: **30 eu** from camera. At 1440 × 900 with the 42° court lens, 1 eu ≈ 39 px there; at 390 × 844 with the 52° phone lens, 1 eu ≈ 29 px.

### 0.4 Fixed masters

The seven hosts, the Mandevilla Queen, the chess pieces and Hercules's figure are fixed asset masters. STYLE governs their **setting** only: plinth, apron, planting, lights, weather, sound. A neighbourhood's dominant material must share at least one material family with its host(s) so the host sits in its place rather than on it.

---

## 1. The island-wide bible (violations are defects)

### 1.1 The card

Everything on the island is made of painted card from `src/harbour/art/cardKit.ts` and `cardScene.ts`. No other material pipeline.

| Property | Rule | Source |
|---|---|---|
| Body | Flat-shaded card with paper grain (`paperGrain()`), grain amplitude 0.02–0.035 | cardKit `tri`, `flat` |
| Thickness | Nothing is a zero-thickness plane that can be seen edge-on. Minimums: petals, leaves, flags, paper tags 0.03 eu (drawn as a darker edge strip); signs 0.08 eu; railings 0.09 eu; walls, decks, slabs 0.3 eu; road and bridge decks 0.6 eu | new |
| Cut side | Sides darken to the foot: `side()` foot 0.72, `box()` foot 0.74–0.75. A flat used as scenery (hedge, tree flat, skyline flat) has a back face at 0.8 value | cardKit |
| Underside | Beams 0.62, eaves 0.55 of the top colour. Every overhang, deck and eave shows its underside from below | cardScene `beam`, `gable` |
| Ink | 1 device-px `LineSegments` on cut edges; opacity 0.78 full, 0.62 lite; colour = the dressing ink (§1.3) | cardScene `finish` |
| Pencil | Joints, slab seams, strata lips: ink × 1.6 value | cardKit |
| Chalk | `#fbf5e6` on top edges that face the sun's daytime arc (south-east to south-west); never on undersides | palette.ts |
| Contact shadow | Every object that touches ground has a soft ellipse: alpha 0.34 centre, 0 at 1.0 r, colour `#1a1714`, radius 1.05–1.15 × footprint, centred (never offset) | cardScene `shadow` |
| Silhouette first | Every object is designed as a silhouette before it is coloured. Its identity must survive being rendered solid black at 390 px width from its porch pose (§1.12) | new |
| Minimum identity detail | No detail that carries identity (a lever, a letter, a bell, a window bar) is smaller than 0.2 eu (≈ 6 px on phone at 30 eu). Smaller detail is texture, not identity | new |

**Depth by layers (the Lantern Row rule).** Every composed view reads as a tunnel book: 3–5 stacked planes (foreground flat, near ground, middle ground, skyline, sky), each a visible value step of ≥ 8 L* from its neighbour, lighter with distance by day and darker with distance by night. Test: blur a 390 px capture by 8 px; at least three distinct value planes remain. The Lantern Row artifact's layering is borrowed; its chart is not. Nothing on the island is a chart except `L01` (CONTRACT §2.2).

**Pop-up motion (the Year in the Round rule).** "One pull raises the whole linkage" is reserved for authored moments: the first time the island is opened after dark (lanterns come on one by one, LIGHT §7), a found lantern lighting, a Sketchbook page being drawn, and (later) a reserve plot receiving its building. Streaming, LOD and weather never pop up; they fade (§1.13). Reduced motion replaces every pop-up with a 300 ms fade.

**Rejected treatments.** Flat CSS-style boxes, single-colour extruded boxes with a pyramid lid, textured billboards, photo textures, "flash card" panels floating face-on to the camera, gradients that are not a cut-side darkening. A storefront is a plinth, walls, a recessed door, a window with depth, an eave with an underside and a sign on brackets, or it is not a storefront.

### 1.2 Line, edge and shadow

1. **One sun.** A single directional light from `LIGHT.md`'s sun clock by day; the paper moon (real phase) by night. Hemisphere light for ambient. No other light casts shadows. No dynamic point lights anywhere on the island: every lamp is a light card (§1.11).
2. **Stacked shadows.** The terrain, every card body (`card`, `steel` buckets) and every tree crown cast into the one shadow map. Pads, paint, decals, glass, water and glow receive only.
3. **No shadow that disagrees with the clock.** The only baked darkening allowed is sun-independent: cut-side foot darkening, undersides, contact ellipses, and the dark foot of a wall on grass (`shadeQuad`, ≤ 0.6 eu tall). A painted cast shadow is a defect. A reviewer tests with `?sun=09:00` and `?sun=17:00`: every cast shadow must swing; nothing directional may stay put.
4. **Shadow cadence.** Re-rendered on the 60 s sun step and on district load only (CONTRACT §6); a 400 ms cross-fade on the step.
5. **Shadow strength by sun elevation `e`:** `e ≥ 30°` 0.42 opacity; `6–30°` 0.50; `0–6°` 0.58 (long golden shadows); moon shadows 0.22 when the moon is ≥ 20° up and ≥ 50 % lit, otherwise none. Shadow colour is never black: the hemisphere sky colour × 0.45.
6. **Softness with distance.** Full tier: shadow-map filtering soft (PCF, ≥ 3 × 3); cast shadows within 60 eu of the camera keep a crisp edge; strength eases to 60 % at 250 eu and is carried by the terrain's own shading beyond. Lite: half-resolution map (CONTRACT §6), same strength curve.
7. **Ink weight.** Edge ink is 1 device px and cannot be widened; its *apparent* weight is controlled by distance: full opacity to 60 eu, linear to 0 at 180 eu. Beyond 180 eu an object is carried by value and cut sides, never by a mesh of 1-px lines. **Silhouette ink** (back-face shell, as `plantArt` does for crowns) is used on tree crowns, the seven hosts, and the landmarks (the Crown's summit, the dam, the High Span, the Bight Bridge, the Lamp, the Glasshouse, the hangar), full tier only, offset 0.0015 × camera distance (≈ 1.5–2 px at every distance). Lite uses edge ink only.
8. **Chalk at night** drops to 30 % and turns to the moon's side when the moon is up.
9. **Sun-facing terrain.** All-direction slope paint, but the rendered value of a south-facing slope at noon is ≥ 8 L* above the north-facing slope of the same biome. A reviewer checks the Crown's south face against the Throat's face in page E.

### 1.3 Palette system

#### 1.3.1 Classic base palette (day albedo)

Existing values are from `src/harbour/mountain/art/palette.ts`, `court/dressing.ts` and `theme/scenes.ts`; values marked * are new in this file.

| Family | Light | Mid | Dark | Notes |
|---|---|---|---|---|
| Ink / pencil / chalk | chalk `#fbf5e6` | pencil `#4d3b31` | ink `#30251f` | dressing ink |
| Warm stone | coping `#e6d6b6` | stone `#d3bf99` | stoneDark `#a99270` | mortar `#8f7d60`; court stone `#cbb48f` |
| Timber | `#9a7250` | `#6b4a32` | `#4a3526`* | plank `#b08a5e`; mine timber = dark |
| Terracotta | `#d98a5f`* | `#b8683f`* | `#8a5a3c` | roof tile, pots; `#8a5a3c` is the old roofAlt |
| Porcelain / trim | porcelain `#f4efe6` | trim `#f2e6c8` | — | window surrounds, bollard caps, Hercules |
| Plaster / render | `#efe2c6` | `#eadcbc` | `#d9c3a0` | |
| Foliage (crowns) | `#7f9a56` | `#6f8d4d`, `#5f7f45` | `#4f6b3a` | pine `#445f3c`, `#3a5236` |
| Turf / ground | long grass `#a9a86c`* | lawn `#7d9a58` | moss `#6d7f4f` | verge `#9c8663` |
| Coastal water | foam `#f4f7f2` | sea `#7fb2b8` | deep `#4f8a93` | glass `#bcd9d2` |
| Ochre | `#d7ac6b` | `#b9864b`* | `#8f6236`* | the Flats, the Wash, render in the Hollow |
| Slate | `#9db0ba` | `#5f6f78`* | `#3f4a52`* | Lakeside roofs and flags |
| Sand | dry `#e0cfa5`* | wet `#b9a57c`* | shingle `#b3aa9a`* | road `#c9b891`, gravel `#cbbb98` |
| Rock | lit ledge `#c4bba9`* | rock `#a3998a` | strata `#7c7268` | |
| Snow | `#f1f1ec`* | shade `#b9c6d6`* | — | |
| Sky | horizon `#e8dcc4` | zenith `#9cc3e0`* | — | hemi sky `#dbe9f4`, hemi ground `#5c4230` |
| Metals | brass `#caa252` | iron `#3f3a33` | — | lamp glass `#ffd98e` |
| House accents | accent `#a94429` | second `#315c49` | — | theme tokens, not neighbourhood accents |

Neighbourhood accents (each used only in its own neighbourhood, §2): porcelain `#f4efe6` (Little Harbour), sumac red `#c4553a` (the Hollow), copper `#b8734a`* with verdigris `#7fa495`* (Scholars' Edge), bush-plane yellow `#e8c547` (the Flats), hull blue `#35637f`* (the Landing & Long Sands), brass `#caa252` (Lakeside), lichen orange `#d9892f`* (the Crown & the Undercroft).

#### 1.3.2 Value-range rules (tested on screenshots)

- **Midtone dominance.** In any daytime capture, ≥ 55 % of pixels fall in L* 40–82.
- **Never muddy.** In any daytime surface capture, ≤ 15 % of pixels have chroma < 10 and L* 25–50 (the grey-brown mud of the last build). The Undercroft is exempt; its own rules are in §2.7.
- **Darks are ink.** ≤ 8 % of pixels below L* 20 by day (ink, deep shade, openings).
- **Highs are rare.** ≤ 6 % above L* 92 by day (chalk, foam, porcelain, snow), except the Crown in snow season.
- **Accents ≤ 10 %.** Pixels within ±12° hue and chroma > 35 of the neighbourhood accent are ≤ 10 % of any frame; the house accent `#a94429` and flower colours count together toward a separate 12 % cap.
- **Crowns are not grass.** A tree crown's mid value is ≥ 10 L* darker than the turf beneath it and ≥ 8° different in hue.
- **Night.** At 02:00 the mode of the L* histogram is 12–35; only light cards, their pools, lit windows and moon glints exceed L* 75.

#### 1.3.3 Night response by material family (LIGHT §4)

Each dressing therefore carries six palettes (day and night × three). The night column is the rendered colour in open ground under a half moon, away from any light card; inside a light pool the family's "lamplit" behaviour applies.

| Family | Classic night | Lamplit behaviour | Taylor night | Newfoundland night |
|---|---|---|---|---|
| Stone | cools to `#6c7282` | holds lantern light: pool reads `#e7c48c` at centre | paper stone to moonlit lilac `#7d6f86` | granite to `#4d5a63` |
| Timber | `#3a2c26` | warm brown `#8a5a3c` | rose card `#5e4a5a` | `#33302e` |
| Roof (tile / shingle) | `#5a4048` | unlit (roofs sit above pools) | `#5f4a62` | `#242f36` |
| Glass | unlit `#2c3b45`; lit windows are interior glow `#ffcf7a` | — | vellum glows `#ffe2b8` | wavy glass glows `#ffd58a` |
| Foliage | blue-black green `#2c3a33`, moon chalk on crown tops | lamp-side crown `#5f6b3e` | `#4a5a58` | `#25342f` |
| Turf | `#37453c` | `#6f7a45` | `#56605e` | `#2f3d36` |
| Water | `#1f3441` with the moon path (§1.7) | lantern reflections as broken glint cards | `#3a4660` | `#17303a` |
| Snow | goes blue `#8fa3c7` | `#e9d7b5` | `#a9a3c9` | `#7f95b8` |
| Paper (Taylor only) | — | lamplit cream `#f3e3c8` | moonlit `#8c8098` | — |
| Clapboard (NF only; Classic Landing too) | Classic Landing `#8b8f97` | lamp-side keeps hue at 60 % | — | fog-lit grey: hue kept at 30 % chroma, value × 0.5 (`#c8453a` → `#6a5856`) |
| Ochre rock | holds warmth: `#8a5f45` for 40 min after sunset, then `#5d5660` | `#c79a63` | `#6f5f6a` | `#5a5550` |
| Metals | `#5f5443`; brass glints only within a pool | glint card on edges | `#7a6a80` | `#3d4449` |

Ink at night shifts to `#1a1a24` at 0.8 of its day opacity in every dressing.

#### 1.3.4 Three dressings re-materialise; they never re-tint

A dressing swaps what an object is made of and how it is built (roof shape, joinery, edge treatment, surface ornament). Changing hue alone is a defect (CONTRACT §2.11). The existing mountain palettes already encode the architecture: Classic `gable` + `stone-timber`, Taylor `scallop` + `paper`, Newfoundland `saltbox` + `clapboard`.

| Object | Classic | Taylor | Newfoundland |
|---|---|---|---|
| Ink | `#30251f` | `#523349` | `#283f50` |
| Stone | dressed warm stone `#d3bf99`, pencil joints, chalked coping | pastel card blocks `#dcc8c4` with white deckled paper edges `#ffffff`, no mortar lines | split grey granite `#8e9a9c`, irregular joints `#59656b` |
| Timber | sawn honey timber `#6b4a32`, pegged joints | rose card `#b08a92` with scalloped cut edges and washi-taped joints | weathered plank `#6d4b36`, painted where it faces the street |
| Glass | clear `#bcd9d2` in timber frames `#6b4a32` | vellum (frosted tracing paper) `#cfe3ea` in lilac frames `#8c6f93` | wavy glass `#bfd9df` in white frames `#f5f3ea` |
| Roof | gable, terracotta tile `#b8683f` or green tile `#4d664b`, chalked ridge | scalloped eave, paper shingles `#8c6f93` / `#c3899f` with a white paper edge | saltbox, dark shingle `#3b4a52` / `#2f5b63`, white fascia |
| Walls | plaster `#eadcbc` over a stone plinth, timber frame | pastel card `#f1d6de` `#dcd3ec` `#f3e2cf` `#d4e4d8`, white edge, stencilled hearts and stars | jellybean clapboard `#c8453a` `#e7b53c` `#2f8a96` `#3f6fb0` `#79a353` `#d9772f`, white corner boards |
| Fence | post-and-rail timber, brass caps | paper-doily pickets, washi tape at joints `#e8a6bd` `#a9c9dd` `#f2d38a` | white pickets; rope fence on driftwood posts with buoys |
| Sign | timber board `#6b4a32`, engraved cream letters `#f2e6c8` (`EngravedPlate`) | scrapbook tag `#fff8f4` on string, taped corners, letters `#6d4a64` | hand-lettered painted board `#2f5b63`, letters `#f5f3ea` |
| Lantern | brass lantern `#caa252`, four glass panes | washi paper lantern with a heart cut-out; concert-light strings in Taylor only | storm (hurricane) lantern, galvanised, hung from a rope bracket |
| Paving | warm stone flags | pressed-paper tiles with a gingham or floral print | granite setts, plank boardwalk |
| Plants | painted species cards | the same species cut from patterned paper, pressed cosmos and tulips at edges | species swaps (§1.4.4) |
| Water | painted wave cards | layered tissue paper, sea `#a9c9dd`, deep `#7aa3bd` | slate-blue `#4f98aa`, deep `#2f6f80`, more foam, more fog |
| Sky (day horizon) | `#e8dcc4` | `#f2e3ea` | `#dfe9ec` |

**Friendship bracelets** are subtle background easter eggs in all three dressings: at most one per neighbourhood, on a railing, post or porch object, never in the central third of a Sketchbook page, never a lantern spot, never lit. **Concert-light strings** (small multicolour light cards) exist in Taylor only, one string per neighbourhood at most.

### 1.4 Planting rules

#### 1.4.1 Grammar

1. **Clearings first.** Each neighbourhood's plan draws its open spaces (aprons, porches, sightlines, landing fields, lawns) before any plant is placed. Planting fills what remains.
2. **Groves of 5–12 trees**, trunk spacing 2.5–5 eu inside a grove, groves separated by a clearing ≥ 1.5 × grove diameter. Single trees only where a sheet names one (the Green's bur oak, the Flats' wind-shaped pine).
3. **Rows only in the orchard** (the Hollow): row spacing 6 eu, tree spacing 4.5 eu, rows follow the contour, and rows break at their ends (drop 1 tree in 4 in the last three positions; last two trees jitter ±1 eu). Hedgerows follow roads 2–4 eu outside the kerb and are not "rows".
4. **Drifts.** Flowers and grasses grow in drifts of one species 3–8 eu long, with a second species threading the edge (≤ 25 % of the drift). Never bullseye rings, never mixed confetti.
5. **Archetypes.** Every species has 3–5 archetypes (full tier), 3 (lite). No two adjacent instances share archetype + rotation + scale; scale 0.8–1.2; value ±4 %.
6. **Doors.** Within 6 eu of a door apron, only the neighbourhood's own flower (§2) and its own tree species grow.
7. **No bald rings.** Planting clearance around a host is footprint + apron + 1.5 eu; biome density is reached within 4 eu beyond that. Test (top-down or page capture): no unpaved, unplanted band wider than 3 eu encircles any structure.
8. **Trunks visible.** Broadleaf trunks show ≥ 30 % of tree height below the crown; conifers show ≥ 10 % trunk under a skirt. Crowns sit on trunks, never on the ground.
9. **Rocks follow strata.** Boulders take their neighbourhood's strata set (§3.3), long axis along the contour, sunk 30 % into the ground.
10. **Clearance.** Nothing grows on a road, lane, walk, trail, stair, bed, bridge, platform, apron, plot or skate line, or in a Sketchbook page's framed subject.
11. **Biome blend.** Biomes meet in a soft band 8–20 m wide where drifts of both interleave; never a hard seam, never a colour gradient without plants.
12. **The Green's protected centre** (`protected.green`, r 160 m) holds no prop taller than a bench (0.85 eu, the top of a bench back): no lantern posts, no baskets, no signs on posts there. The Drop Zone target is paint on the turf. The bur oak is a tree, not a prop.

#### 1.4.2 How bloom is drawn

Bloom follows the month strings in the Grand Plan's flora table (`b` bloom/colour, `e` leaf, `s` snow/bare), interpolated by day-of-month so change is soft.

| Stage | When | Drawn as |
|---|---|---|
| Bud | the month before the first `b` | green-tipped petal cards at 25 % of drift density, colour at 40 % chroma |
| Bloom | `b` months | petal cards: 5-petal clusters (the Grand Plan's flower icon), full density; for trees, blossom cards over 60 % of the crown |
| Fade | first 3 weeks after the last `b` | 40 % density, chroma −30 %, falling-petal cards on the ground under the drift |
| Seed / fruit | the 2 months after fade | seed heads: dandelion clocks (June), goldenrod plumes, milkweed pods, coneflower cones, rose hips, apples, partridgeberries |
| Leaf | `e` | foliage only |
| Bare / snow | `s` | trunks and branch flats; snow caps on crowns and ground in snow season |
| Autumn colour | trees' `b` in Sep–Oct | crown cards swap to the species' fall colour (maple `#c4553a`, birch and tamarack `#e3b92e`, sumac `#c4553a`, bluestem `#c89a5b`) |

#### 1.4.3 Species lists

The species per biome and their bloom months are the Grand Plan's (Chapter 11); §3.2 lists the card set per biome. Taylor draws the same species from patterned paper (§2 names the paper stock per neighbourhood).

#### 1.4.4 Newfoundland species swaps

Clover → lupine; sugar maple → black spruce; the Reach adds bakeapple and pitcher plant; the Crown's dwarf spruce becomes tuckamore (wind-clipped, flat-topped mats); the Flats add crowberry and reindeer lichen under the bluestem. Everything else stays.

### 1.5 Ground paint by surface id

Surface ids and footsteps are `MANIFEST.surfaces`. Each state is a paint change on the same lattice, never a new mesh.

| Surface | Looks like (Classic) | Footstep | Wet | Snow / ice |
|---|---|---|---|---|
| `paved` | worn road `#c9b891` / quay flags, paler wheel lane, pencil seams every 1.2 eu on flags | stone | value −12 %, lantern reflections in puddle decals | snow on edges, cleared centre |
| `packedEarth` | ochre-brown `#b39f78` with lighter tyre/foot line, pebble flecks | earth | darker `#8f7d60`, puddles in dips | snow full cover |
| `apron` | pale concrete `#d9d2c2`, board-mark lines, the dam's training walls | concrete | wet sheen strip at the spillway foot always | snow on flats only |
| `bankedTurf` | mown turf `#7d9a58` with mowing stripes on the bank's fall line | grass | +8 % saturation | snow full |
| `boardwalk` | planks `#b08a5e` across the direction of travel, pencil gaps 0.02 eu, nail dots | plank | planks darken, gaps stay light | snow in plank gaps only |
| `cobble` | setts `#bfa982`, each a 0.25 eu cell with pencil outline, crown chalk | cobble | glossy tops, dark joints | snow in joints |
| `gravel` | `#cbbb98` with edge stones every 1.5 eu | gravel | darker, no puddles | snow full |
| `sand` | dry `#e0cfa5`, wet `#b9a57c` below the tide line; footprints last 60 s (MANIFEST `prints`) | sand | all wet shade; rain pocks | rare dusting |
| `plaza` | the square: large warm flags `#d3bf99`, a porcelain inlay line marking the threshold | stone | reflections of the Court's lanterns | snow swept to the edges |
| `duff` | needles `#8a6f4f` with moss islands on north faces | needles | darker, moss brighter | snow in clearings only |
| `ochre` | dust `#d7ac6b`, cracked plates in the Wash | dust | deep ochre `#b9864b`, the Wash runs | light dusting only |
| `snow` | `#f1f1ec`, blue shade `#b9c6d6`, footprints and sled lines | snow | — | Dec–Mar |
| `ice` | `#cfe3e6` plates with pencil cracks and skate arcs | ice | — | Jan–Feb, Stillwater only |

### 1.6 Structures

1. **Thickness.** Road and bridge decks ≥ 0.6 eu; walk decks and platforms ≥ 0.35 eu; stair treads show a riser face; roofs show eave thickness 0.14 eu.
2. **Undersides.** Every deck, eave, stair and canopy has a coloured underside (0.55–0.62 of top) that a camera below can see.
3. **Supports.** Every span shows its load path: deck → bearing → pier or bent → footing. Timber bents every ≤ 12 eu; masonry arches ≤ 30 eu span; steel piers as drawn by `bridgeArt`. Footings sink ≥ 0.2 eu into ground; piles into water carry a waterline ring.
4. **Edges.** Kerb 0.15 eu high × 0.25 wide on roads (`profiles.road.kerb`). Parapet 1.0 eu with a 0.15 eu coping on every road edge with a drop greater than body height (`parapet_on_drop`), piers at ends and every 12 eu. Handrails 1.05 eu on stairs, walks with a drop, jetties over deep water. Railings are real bars, never a painted strip.
5. **"Would it stand up."** A reviewer traces each object's weight to the ground in the screenshot. If any part of the path is missing (a deck with no support within 15 eu of either end, a sign with no post, a lantern with no bracket, a cable with no tower), it fails.
6. **No floating props.** Maximum gap between an object's foot and the ground 0.02 eu; posts sink 0.1 eu; every grounded object has its contact shadow. Nothing hovers, including pennants, tori, lantern spots and hunt lanterns (which hang from something).
7. **Signs on posts.** Boards wider than 1.2 eu stand on two posts. Signs on walls hang from brackets or are fixed flush.
8. **Labels never in the sky.** No world-space billboard text. Place names appear on signs, milestones and plates in the world, and on the screen-space guide map. Nothing with text floats.
9. **Trick spots are architecture.** Rails, kickers and walls on the skate lines are the kerbs, walls, logs, bollards, stairs and bridge rails that would be there anyway (CONTRACT §2.5).

### 1.7 Water

- **Sea.** Paper-wave cards in three bands parallel to the shore (1, 4 and 10 eu out), the foam line a chalk card 0.3–0.6 eu wide breathing ±0.4 eu over 7 s; open-sea crest chevrons (cut-paper ticks) at ~1 per 60 m² within 150 eu of the camera. Shallows are the 50 m band from `island.note`, one value step lighter. Reduced motion: foam still, sheen still.
- **River and brooks.** `waterMaterial` sheen along the flow, foam cards at every drop, the dam foot and culvert mouths; wet-stone banks (value −15 %) 0.5 eu either side.
- **Mirrors.** No real-time reflections. Stillwater (wind < 2 m/s) and the Bight (golden hour, calm) carry a flipped silhouette card of what they face (the Crown; the Lamp and the west sky) at 35–40 % opacity, broken by cat's-paw ripple cards when the wind rises.
- **Moon path.** At night a strip of chalk wavelets from below the moon's azimuth toward the camera, width ∝ illuminated fraction, 0 at new moon. Stillwater, the Bight, the harbour and the open sea all carry it; the Deep carries the skylight's version (§2.7).
- **Ice (Stillwater).** Dec 20–Jan 5 skim ice: a 2 eu band at the shore, no skating. Jan 6–Feb 28 full ice: pale plates `#cfe3e6`, pencil cracks, snow drifts at the rim, skate arcs accumulating, no sheen. Mar 1–15 break-up: floes with dark leads. Then open water. The level of Stillwater never changes with anything (CONTRACT §2.2).
- **The Wash.** Dry ochre bed with cracked plates. After almanac rain it runs (a thin braided water card in the bed's low line) during rain and 6 h after, stays damp (value −15 %, puddle decals) for 24 h, then dries.
- **The Deep.** Black-green `#1d2f2e` with the skylight's shaft pool, drip rings every 2–5 s near the walls, no waves.

### 1.8 Sky and weather

**Sky gradient by sun elevation `e`** (Classic; interpolated continuously, LIGHT §1):

| `e` | Zenith | Horizon, sun side | Horizon, away | Sun colour × intensity |
|---|---|---|---|---|
| ≥ 30° | `#8fbbe0` | `#e8dcc4` | `#e8dcc4` | `#ffe6be` × 1.0 |
| 6–30° | `#9cc3e0` | `#f0d9b0` | `#dfe0d6` | `#ffdcaa` × 0.9 |
| 0–6° (golden) | `#86a9cc` | `#f4bf86` | `#c9ccd6` | `#ffc58a` × 0.7 |
| −6–0° (civil twilight) | `#4d6390` | `#e59a78` | `#7d7fa3` | none; hemisphere only |
| −12–−6° | `#26335a` | `#4f5478` | `#3a4262` | moon if up |
| < −12° | `#121a2e` | `#27304a` | `#27304a` | moon if up |

Taylor: day horizon `#f2e3ea`, zenith `#cfe0f0`, golden sun side `#f6c4c8`, night zenith `#2e2748`, night horizon `#5a4a6e`. Newfoundland: day horizon `#dfe9ec`, zenith `#9fc0d2`, golden sun side `#f0c89a`, night zenith `#0f1c26`, night horizon `#22333d`.

**Fog.** Fog colour = the horizon colour in the camera's heading. Distances in eu (m at 0.6 in brackets); near/far grow with eye height above ground by +0.9 × h and +1.35 × h (as `fogRange` does today).

| Tier | Near | Far | Why |
|---|---|---|---|
| Full | 150 eu (250 m) | 700 eu (1170 m) | the Crown's summit from the square (720 m) sits at ~50 % fog: a silhouette, not a void |
| Lite | 110 eu (185 m) | 520 eu (870 m) | ≤ 3 districts resident; horizon cards carry the rest |
| Almanac fog day | 40 eu | 220 eu | local banks per §2 sheets; Newfoundland doubles fog-day frequency |

**Horizon cards.** The landmarks a Sketchbook page frames at a distance (the Crown, the dam, the High Span, the Bight Bridge, the Lamp, the Needle's Eye, the Stacks, the Glasshouse) each have a ≤ 300-triangle silhouette card resident in the sky ring at all times, fogged but capped at 70 % fog so they never vanish.

**Paper clouds.** 2–4 layers of cut-paper cloud flats (lite: 1 layer) between 180 and 280 m, below the 300 m flight ceiling so the plane flies among them. Flat bottoms, ink on top edges only, chalk on the sun side, drift with the almanac wind at 2–6 m/s. Coverage: clear ≤ 10 %, fair 25 %, overcast 70 % plus one stratus sheet.

**Rain.** Card streaks 0.6 eu long, sky-grey `#9aa6b0` at 35 %, slanted with the wind up to 20° from vertical, drawn only within 40 eu of the camera (lite 40 % of the count); splash rings on water and paved; surfaces take their wet state (§1.5). Reduced motion: no falling streaks, wet surfaces only.

**Snow.** The Crown holds seasonal snow Dec–Mar above a snowline: Dec ≥ 125 m, Jan ≥ 95 m, Feb ≥ 90 m, Mar ≥ 120 m; north faces 15 m lower; the Shoulder's sledding meadow is inside the Jan–Feb line. Lowland snow only on almanac snow days, melting over 2 days. Snowfall is drifting chalk flakes, lite 40 %.

**Aurora.** Newfoundland only, Nov–Mar, after 22:00, clear almanac: 2–3 translucent ribbon cards over the Crown, green `#7fe0b0` into violet `#9f8fe0`, moving over 20–40 s. Never in Classic or Taylor.

**Wind.** One shared wind clock drives crowns, grass tufts, flags, halyards, the windsock, clouds and surf. Trunks never move. The windsock and the Crown's vane always agree with the sky sim's wind.

### 1.9 Life

| Creature | Where | When | Drawn as |
|---|---|---|---|
| Gulls | Little Harbour, Long Sands, the Lamp, the ferry's wake | all year, day | white cut-paper V, 2-frame flap, glide on the wind |
| Heron | the Reach (one) | Apr–Oct | standing card at the reeds, lifts when a board passes (S1 Reach segment) |
| Loons | Stillwater (a pair) | open-water months | low swimming card, a dive every 40–90 s |
| Chickadees | Scholars' Edge | all year | small hopping cards on branches and the courtyard wall |
| Robins, orchard birds | the Hollow | Apr–Oct | hop in the mown rows |
| Swallows | the Flats over the strip | May–Aug | fast low arcs |
| Hawks | circling in the thermals (`sky.lift.thermals`) | 12:00–18:00 | slow circles; they mark lift for pilots |
| Ravens | the Crown | all year | perched on the lookout wall, one call |
| Butterflies | monarchs on the Green's milkweed (Jul–Sep, peak Aug); cabbage whites in the Hollow (May–Sep); sulphurs on the Flats (Jun–Aug); dragonflies at Lakeside and the Reach (Jun–Aug) | day, `e` > 15° | 2-card wings, flutter paths ≤ 3 eu off the ground |
| Fireflies | within 30 m of the Campfire; over the orchard; the Reach; the Green's edges | Jun–Aug, dusk–23:00 | tiny warm light specks (not light cards; do not count toward the 48) |
| Moths | at lantern posts within 20 eu of the camera | May–Sep, night | 1–3 cards orbiting the lamp |
| Cats | on porches, the quay wall, the Boathouse dock | day and dusk | card figures, one per porch at most; names and colours are Jonathan's open decision; until then a neutral tabby placeholder `#9a7250` |
| Hercules | fixed master; the cottage, the orchard, "Where's Hercules" spots | — | STYLE sets only his settings |

Rules: ≤ 24 animated creatures per resident district (lite 10). Nothing lives above the Shoulder except ravens; nothing lives underground except glow-worms and moss. Reduced motion: every creature perches still. **Never counterfeit the partner:** Bianca's figure appears only from real presence; a timed pastime's household ghost is translucent paper at 40 % with a dotted ink outline, appears only during that run, and never stands at a porch.

### 1.10 Type and signage

- One hand-lettered face per dressing, from fonts the app already loads (no new downloads): **Classic** Fraunces, engraved into timber or stone (`EngravedPlate`), cream `#f2e6c8` fill; **Taylor** Caveat, written on scrapbook tags in `#6d4a64`; **Newfoundland** Figtree 800 in capitals, letter-spaced 0.06 em, sign-writer paint `#f5f3ea` on `#2f5b63`.
- Cap height ≥ 0.16 eu on signs read from a path, ≥ 0.10 eu on milestones and plaques read from 6 eu.
- **A milestone reads:** line 1, the next neighbourhood's name from `MANIFEST.names`; line 2, an arrow and whole minutes on foot from the path graph at the current `scale.factor` ("the Hollow ← 4 min"). At most two destinations per milestone. Taylor tapes its milestones; Newfoundland paints them. Milestones are never lit (LIGHT §3): their letters use reflective paint and read 1.6 × brighter inside a lantern pool.
- No text is ever about money outside the tools; no text scores, nudges or counts play (CONTRACT §2.1).

### 1.11 Lights

**Light-card kit.** Every light is a card, never a dynamic point light: a **glow card** (unlit `MeshBasicMaterial`, the lamp shape), a **halo** (soft radial alpha, 2–4 × the glow), and a **pool decal** on the ground (additive, radius per type). On rules are `LIGHT.md §3`; lights on a line come on in sequence 1 s apart (Lantern Row west to east), never all at once.

| Card | Colour | Glow / halo | Pool radius | Motion |
|---|---|---|---|---|
| Lantern post | `#ffd98e` | 0.35 / 1.2 eu | 4 eu | still |
| Window glow | `#ffcf7a` | the pane / 1.3 × pane | 2 eu spill on the ground outside | on/off per LIGHT §3 |
| Glasshouse interior | `#ffe7a8` | whole glazing / 1.15 × | 8 eu | brightest light on the island |
| The Lamp | `#fff4d6` | lantern room 1.5 eu; beam: long translucent wedge at 18 % | none (the beam sweeps land as a moving pool 6 eu wide) | 8 s sweep |
| Runway lamp | `#fff1c2` | 0.12 / 0.5 eu | 1.2 eu | still |
| Windsock lamp | obstruction red `#e5533d` | 0.15 / 0.6 eu | none | still |
| Campfire | `#ffb35c` | flame cards 0.8 eu / 3 eu | 6 eu | flicker 0.3 Hz ±12 % (reduced motion: still) |
| Glow-worm cluster | `#9fe3d0` | 20–60 dots on one card | none | twinkle 4–9 s |
| Found lantern (Hunt) | `#ffc76b` | 0.3 / 1.0 eu | 2 eu | slight sway |
| Running lights (cabins, the Ferry, the plane, the cart) | port `#e0463a`, starboard `#3fb07a`, white `#f6f4ea` | 0.08 / 0.4 eu | none | move with the vehicle |
| Crown observatory | `#ffd98e` | 0.4 / 2 eu | none | the highest light |
| Mine lamp (Undercroft thresholds) | `#ffc27a` | 0.25 / 1 eu | 3 eu | still |

**Lite cap: 48 visible light cards**, nearest first (LIGHT §6). A pool counts with its card. Distant lines collapse: beyond 120 eu a line of lamps draws as one dotted strip card (counts as 1). The Lantern Cave collapses lanterns beyond the nearest 24 into one cluster glow.

### 1.12 Camera-facing rules: the twelve pages

Captures at 1440 × 900 and 390 × 844, at `bestHour` and at `also` (`MANIFEST.views`). "Legible" = a reviewer can point to it on the 390 px capture without zooming.

| Page | At best hour, legible | At the `also` hour, legible | Fails if |
|---|---|---|---|
| A The square (golden hour / noon) | the Reach, the High Span's deck line, the dam's glass face lit, the Crown's summit behind; the square in warm shade | the same four silhouettes; flag seams on the plaza | anything between the square's north-west edge and the dam taller than 6 eu |
| B Lamp gallery (sunset / noon) | the Bight Bridge deck and rail, the Flats' rim, the hook's whole curve, the Bight as a mirror | bridge underside and bents, Long Sands' line | the hook reads as a blob with no rim line |
| C High Span (morning / night) | three levels: road deck, skate shelf, walk at the water, each with its own edge line | each level lit by its own light kind (road lanterns, shelf strip lamps, walk bollards) | two levels merge into one value |
| D Long Sands (afternoon / night) | foam line, the Lamp, the zipline landing, a bench, dune shadows | the Lamp's beam, the campfire, the moon path | an empty beach with no wrack line or footprints |
| E The Crown (noon / night) | every neighbourhood by its ground and planting alone, the sea all round | every neighbourhood by its light pattern: Lantern Row's line, the Glasshouse block, the strip's two rows, the campfire point, the observatory dot | two neighbourhoods identical in value and hue from above |
| F Dam crest (morning / dusk) | the plaques, `L01`, the lake behind, the town below | crest lamps, the Glasshouse lit across the lake, Lantern Row far below | `L01` indistinguishable from other furniture; any other gauge-like object |
| G The Deep, looking up (noon / night) | the Throat's skylight, the sun shaft, a glider in the opening | the moon shaft or its faint column, the jetty lamp, glow-worms | pitch-dark floor; the jetty edge unreadable |
| H The Flats at sunset (sunset / dawn) | the strip in copper, the windsock, the balloon, the west sea | the runway lamps' two rows, the balloon in silhouette | trees in the strip's approach |
| I Reach boardwalk (morning / dusk) | reeds at hand height, the spring, the heron | boardwalk edge lamps, reed silhouettes against the harbour lights | reeds below the rail line or as a flat green band |
| J The Needle's Eye (dawn / noon) | the arch against the rising sun, the Stacks, the Prow | the arch's thickness and underside, the Stacks' strata | the arch as a flat ring |
| K Glasshouse at dusk (dusk / noon) | lit from inside, seed pots in silhouette, Stillwater beyond | glazing bars, the Crown reflected in Stillwater | glassless frames (last build's defect) |
| L The quay at night (night / dawn) | Lantern Row lit in sequence, the floatplane rocking, the Boathouse across the water | the quay's layered skyline (quay, lane, square, upper street) catching first light | lanterns all at one height and value with no layering |

**Porch poses.** Each §2 sheet adds one review pose (not a Sketchbook page, not in `MANIFEST.views`): the camera at the porch, eye 0.98 eu above ground, facing the named target, captured at the sheet's best hour and at 02:00. The Hollow and Scholars' Edge have no Sketchbook page of their own; their porch poses are their proof.

### 1.13 Performance rules that are also style rules

Budgets are `CONTRACT.md §6`. How they are met is a style decision:

1. **LOD by card simplification, never by popping.** L0 (< 60 eu): all flats, ink, pencil, chalk. L1 (60–180 eu): merged flats, no pencil, no chalk, ink fading (§1.2). L2 (180 eu to the district edge): silhouette cards, side darkening only. Beyond: horizon cards. Transitions cross-fade over 0.5 s (dithered alpha); a visible jump is a defect.
2. **Districts fade, never swap.** A district streams in from the fog colour over 0.8 s; it never appears at full contrast, and never replaces a different version of itself. The Walk↔Look switch never rebuilds a district synchronously.
3. **Instancing.** Every planting card and every repeated kit item is instanced. A district's triangles split roughly: terrain 25 %, planting 30 %, structures 30 %, props and lights 15 %.
4. **Lite differences are subtractions, not substitutes.** Lite drops archetypes 5 → 3, silhouette ink, chalk beyond 30 eu, cloud layers 4 → 1, rain and snow to 40 %, creatures to 10; it never swaps a material or an architecture. A lite capture must pass the same neighbourhood test as full.
5. **Night costs nothing extra** beyond light cards (LIGHT §6): sky, fog and lit-window state are uniforms.

### 1.14 Not this (reviewer's checklist, from the Mountain v2 dissection)

- [ ] No tree crown the colour of the grass; every crown on a visible trunk.
- [ ] No cone-on-stick tree stamped uniformly; groves, clearings and drifts instead.
- [ ] No bald ring around any building or district.
- [ ] No bullseye rings of flowers.
- [ ] No neighbourhood that differs from another only by tint or by a handful of props.
- [ ] No box-plus-pyramid storefront; no glassless glasshouse.
- [ ] No floating prop, pennant, torus, text plane or label; nothing in the sky with text.
- [ ] No zero-thickness road, deck or ramp; every edge with a drop has a kerb or parapet.
- [ ] No rail-less plank in the air; no invisible rail; no bridge without supports and underside.
- [ ] No dam buried in a pit; no furniture inside a basin.
- [ ] No cable bowing upward; every cable sags between visible towers.
- [ ] No slope lit head-on with no shadow; shadows present and swinging with `?sun=`.
- [ ] No fog so far that the island reads flat, nor so near that the Crown vanishes from the square.
- [ ] No district pop-in; no LOD jump.
- [ ] No cliff without strata; no summit sheared by an edge fade.
- [ ] No sea visible through inland ground.
- [ ] The painted-card kit used for every object on screen.
- [ ] No palette-only dressing difference.

---

## 2. Neighbourhood sheets

Every sheet uses the same fields. Hex values are from §1.3. "Paper stock" names the Taylor pattern, borrowed from the app's own Taylor scenes (`theme/scenes.ts`); it is a material, not a place name.

### 2.1 Little Harbour

- **Personality.** A warm stone town tumbling downhill to the water: you are always on a step, and the dam is always in view.
- **Dominant material + accent.** Warm stone `#d3bf99` walls and flags, terracotta roofs `#b8683f`, timber shutters `#6b4a32`. Accent porcelain `#f4efe6` (window surrounds, bollard caps, the Court's inlay).
- **Roof and silhouette.** Gables at 35–40°, ridges parallel to the contour, so the town reads as four tiers stepping down: upper street, square, storefront lane, quay. A chimney on every second roof. From the water, at least three roof tiers are visible above the quay wall.
- **Ground.** `plaza` (the square), `cobble` (the square's edge lane, the market lane), `paved` (upper street, quay), `boardwalk` at the ferry pier and floatplane dock.
- **Planting.** Own flower: red clover in the square's small green; geraniums in window boxes. Trees: three street maples on the upper street, alders at the quay's east end. Tree cover ≤ 5 % of unbuilt ground; the town is planted in pots and boxes (2–4 per storefront).
- **Porch.** The square's edge facing the dam; the quay wall at night. Porch pose: from the square's north-west edge toward the dam `[1140,905]`.
- **Thresholds.** `stairTop` (board → feet, park), `quayWest` (board → feet, park: Town Weave onto Lantern Row), `upperStreetSpur` (wheels → feet), `gondolaBase` (board by offer), `floatDock` (climb in), the ferry pier (`FERRY.piers.landing`). Each has a threshold marker (§3) and a rack.
- **Sound.** The harbour bell at noon (once, LIGHT §7) and its answer to the summit bell; halyards ticking on masts; the floatplane's engine ticking as it cools; gulls; stone and cobble footsteps.
- **Light at best hour.** Golden hour (page A): the square in warm shade, the dam and the Crown lit across the gorge. Dawn: the harbour is the first thing the sun touches; the square's stone goes gold while the dam is still blue.
- **Night face, in order.** Lantern Row on the quay (civil dusk, west to east, 1 per s) → the Court's lanterns → the windows of Our home and the Fund bank → the Lamp's beam crossing the harbour → the floatplane's running lights. At 23:00 each house drops to one lit window until dawn (LIGHT §3).
- **Weather.** Sea fog rolls in over the quay first and stays below 12 m, so the square (h 12) looks down onto it. Wind rings the halyards and lifts pennants on the ferry pier. Rain darkens the flags and puts lantern reflections into puddle decals on the quay.
- **Dressings.** Classic: warm stone, terracotta, timber, porcelain. Taylor (paper stock *Lover*: hearts, pink-lilac vellum): pastel card walls with scalloped eaves, washi-taped lantern posts, paper bunting across the market lane, pressed geraniums. Newfoundland: jellybean clapboard with white corner boards, saltbox roofs, a granite quay with rope and buoys, root cellars dug into the slope.
- **Must never have.** Anything taller than 6 eu between the square's north-west edge and the dam line; a flat town.
- **Pages that prove it.** A, L; C shows its edge; porch pose.
- **Reviewer checklist.**
  - [ ] Four stepping tiers readable in page L at dawn.
  - [ ] The dam's glass face visible from the square in page A.
  - [ ] Lantern Row lights in sequence, west to east.
  - [ ] Terracotta roofs and porcelain accent ≤ 10 % of frame.
  - [ ] Every stair has its ramp twin in frame or signposted.
  - [ ] Harbour fog stays below the square in a fog-day capture.

### 2.2 The Hollow

- **Personality.** Sheltered, warm and a little untidy: an orchard bowl where things get made.
- **Dominant material + accent.** Ochre render `#d7ac6b`, kiln brick `#a9573d`*, mine timbers `#4a3526`. Accent sumac red `#c4553a` (doors, the picnic table's cloth, sumac in fall).
- **Roof and silhouette.** Low hipped roofs with deep eaves, cottage scale; the only tall thing made by people is the kiln chimney. Round apple crowns in contour rows, breaking at the edges.
- **Ground.** `packedEarth` (the studio terrace), `cobble` (the orchard lane between rows), mown turf strips with long grass `#a9a86c` at the row ends, `gravel` on the garden walk.
- **Planting.** Own flowers: apple blossom in May, chicory in July; wild strawberry at the wall foot; a lilac hedge; sumac at the bowl's rim; crabapples at the edges. The island's only rows (§1.4.1). Tree cover ~35 %.
- **Porch.** The picnic table under the apples by the covered bridge (Hollow Bridge). Porch pose: from the table toward Scholars' Edge along the garden walk.
- **Thresholds.** `adit` (feet → cart: sit, lever), Hollow Line start (`skateLineStarts` `[1000,520]`, pick up), the S4 × garden walk threshold on the Hollow Bridge `[893,600]` (boards to the rail side at walking pace), S4 × Green Road at the studio terrace `[973,538]` (dismount, kerb gap), bike racks at the studio and cottage spurs.
- **Sound.** The kiln's tick as it cools; cart wheels from inside the hill; the brook under the covered bridge; robins; cobble footsteps.
- **Light at best hour.** Afternoon (LIGHT §2): the rows cast parallel shadow lines across the mown strips.
- **Night face, in order.** The kiln mouth glows orange from dusk → the cottage window → a lantern at each portal of the covered bridge → the Adit's mine lamp → fireflies over the rows (Jun–Aug).
- **Weather.** Ground fog pools in the bowl at dawn (≤ 2 eu thick), gone by 09:00. May wind sheds blossom petals across the lane. Rain drips from the covered bridge's eaves; the brook rises by one value step.
- **Dressings.** Classic: ochre render, kiln brick, timber. Taylor (paper stock *evermore*: plaid, autumn leaves): gingham and plaid paper orchard, pressed apple blossom, scrapbook tape on the covered bridge's portals. Newfoundland: red-ochre outbuildings `#9b3b2a`* with white trim, turf-roofed root cellars in the bank, a black-spruce windbreak on the bowl's north rim.
- **Must never have.** A neat lawn or a regular grid.
- **Pages that prove it.** E (from above); porch pose.
- **Reviewer checklist.**
  - [ ] Rows visible from E; rows broken at their ends.
  - [ ] Kiln chimney the only tall built element.
  - [ ] The Adit framed in mine timbers with a lamp.
  - [ ] The covered bridge has sides, a roof and an underside over the brook.
  - [ ] Long grass at every row end; no mown edge meets a path.
  - [ ] Sumac red ≤ 10 % of frame outside September–October.

### 2.3 Scholars' Edge

- **Personality.** Quiet, cool and tall: a woodland rise where the light comes through in shafts.
- **Dominant material + accent.** Dark timber boards `#4a3526`, glass `#bcd9d2`, verdigris roofs `#7fa495`. Accent copper `#b8734a` (gutters, lamp hoods, the courtyard's handrail).
- **Roof and silhouette.** Steep (≈ 50°) verdigris roofs; the skyline is trunks, vertical against the Bight. White pines rise above the hemlock canopy.
- **Ground.** `duff` under the trees, `gravel` on the garden walk, `plaza` flags in the reading courtyard, moss on north faces.
- **Planting.** Own flowers: white trillium (May–June), foxglove along the garden walk (June); bloodroot, wild columbine, ostrich fern. Trees: white pine, hemlock, sugar maple, paper birch, cedar. The densest canopy on the island (60–70 % cover) with a glade every 60–80 m and the courtyard open to the Bight.
- **Porch.** The reading courtyard facing the Bight. Porch pose: from the courtyard toward the Flats across the Bight.
- **Thresholds.** The Library spur's end (wheels → feet), the garden walk's start, the cove walk down to the Scholars' cove ferry pier (`walks.coveWalk`, `FERRY.piers.scholarsCove`) and its Horizon Drive crossing `[686,313]`.
- **Sound.** Pages; chickadees; the ferry's horn far below; wind in the pines (a higher hiss than broadleaf); needles underfoot.
- **Light at best hour.** Golden hour: low west light rakes between trunks in shafts (visible light-shaft cards, 8 % opacity), the courtyard warm, the woods behind blue.
- **Night face, in order.** The Library's tall reading-room windows → low bollard lanterns along the garden walk (knee height, dim, 2 eu pools) → the courtyard lantern with its moths → the Ferry's running lights below on the Bight.
- **Weather.** Fog sits in the trees (fog density × 1.3 under canopy). Rain is heard on the canopy before it is seen; drips continue 20 min after it stops. Wind moves crowns; trunks never move.
- **Dressings.** Classic: dark timber, copper and verdigris, glass. Taylor (paper stock *folklore*: linen, forest): layered tissue-paper forest in greens and greys, vellum library windows, pressed trillium taped to the milestones. Newfoundland: black spruce and balsam replace the maples, silver-grey shingle walls, galvanised lamp hoods.
- **Must never have.** Open lawn, saturated warm colour, or a view without a trunk in the foreground.
- **Pages that prove it.** B (the hook from the Lamp) and E from a distance; porch pose.
- **Reviewer checklist.**
  - [ ] Vertical trunk rhythm dominates the porch pose.
  - [ ] At least one light shaft in the golden-hour capture.
  - [ ] Trillium drifts in May–June captures; none outside.
  - [ ] Duff ground, not turf, under trees.
  - [ ] The Bight visible from the courtyard.
  - [ ] Copper accent ≤ 10 %; verdigris roofs read as roofs, not foliage.

### 2.4 The Flats

- **Personality.** Wide, dry, windy and loud with engines: the sky is the building.
- **Dominant material + accent.** Ochre rock `#d7ac6b` / `#b9864b`, canvas `#e9dfc6`*, corrugated tin `#9aa3a6`* with rust `#a8603a`*. Accent bush-plane yellow `#e8c547` (the plane is yellow in all three dressings; only its materials change).
- **Roof and silhouette.** Horizontal: the strip, the plateau's rim, the hangar's shallow barrel roof. Verticals are rare and meaningful: the windsock mast, the balloon, the one wind-shaped pine by the hangar.
- **Ground.** `ochre` (strip rim, the Wash), the strip painted as mown turf that goes copper in golden light (surface id per the land pass; `packedEarth` recommended), `gravel` on the Flats trail.
- **Planting.** Own flowers: little bluestem (copper in fall), purple coneflower, eastern prickly pear; yarrow, wild bergamot, harebell. Trees: red cedar and juniper in clumps of 3–5 in the lee of rocks, the one pine. Tree cover ≤ 3 %; ≥ 70 % open ground.
- **Porch.** The hangar's bench, watching take-offs. Porch pose: from the bench toward the Bight Bridge and Long Sands.
- **Thresholds.** `strip` (feet → plane, climb in), `balloon` (step in), the Wash Run's start (`skateLineStarts` `[480,480]`) and its wet-day closure marker, the Flats ferry pier, the Bight pier `[560,890]` at the end of the Bight pier walk (`walks.bightPier`).
- **Sound.** Wind in the sock, grass hiss, the plane's engine, the balloon's burner, dust footsteps.
- **Light at best hour.** Sunset (page H): the strip's grass copper, the balloon lit, long shadows from the rim.
- **Night face, in order.** The windsock's red lamp → runway lamps, two rows, lit from the threshold end → the hangar door lamp → the balloon's burner glow when it rises. The darkest surface neighbourhood: the most stars.
- **Weather.** The windiest place: grass, sock and cedar tips always show direction. Thermals marked by circling hawks 12:00–18:00. Rain fills the Wash (§1.7). Fog density × 0.6.
- **Dressings.** Classic: ochre rock, canvas, tin, the yellow plane. Taylor (paper stock *Fearless*: gold thread, stars): the windsock a striped paper streamer, paper-star decals on the plane, the hangar a scrapbook box with a taped lid. Newfoundland: the hangar a fish-store shed painted barn red, crowberry and reindeer lichen under the bluestem, lupines at the strip edge.
- **Must never have.** Trees in a line, anything tall in the strip's approach, or lush green.
- **Pages that prove it.** H, B; porch pose.
- **Reviewer checklist.**
  - [ ] ≥ 70 % open ground in the porch pose.
  - [ ] The windsock agrees with the cloud drift.
  - [ ] Runway lamps in two parallel rows at night.
  - [ ] The Wash reads as a bowl (walls both sides) in page H.
  - [ ] Yellow ≤ 10 % of frame.
  - [ ] No tree within the strip's approach.

### 2.5 The Landing & Long Sands

- **Personality.** Salt, sun and one long straight line: where the day ends up.
- **Dominant material + accent.** Weathered clapboard `#e7e1d2`*, rope `#c9b38a`*, silver driftwood `#b5aa98`*. Accent hull blue `#35637f`.
- **Roof and silhouette.** Low horizontals: the dune ridge, the boardwalk, the Boathouse's shallow gable; the zipline cable the one diagonal; the Lamp on the far horizon.
- **Ground.** `sand` with prints, `boardwalk` on the dune, `gravel` on the Landing road, shingle and wrack line (driftwood, weed) at high water.
- **Planting.** Own flowers: lupine and beach pea (June–July); beach rose (hips in fall), sea thrift, marram on the dunes, eelgrass in the shallows. Trees: wind-bent pines behind the dunes only, leaning away from the prevailing wind. Tree cover ~8 %.
- **Porch.** The Boathouse dock; the log ring at the fire. Porch pose: from the dock across the river mouth to the quay.
- **Thresholds.** `boathouseDock` (untie), `landingQuay` (the Summit to Sea finish, park), `zipLanding` (unclip on the landing tower's deck, then its stair or ramp to the sand), Tideline park (travel assist, no race), the ends of Town Weave and Hollow Line, the Campfire.
- **Sound.** Surf, gulls, the zipline's whir, fire crackle, sand and plank footsteps.
- **Light at best hour.** Afternoon (page D): dunes throw long shadows at both ends of the day because the beach runs east–west.
- **Night face, in order.** The Boathouse window → the Lamp's beam over the water → the Campfire (21:00–01:00, or when the Chapter is open) → fireflies within 30 m (Jun–Aug) → the moon path on the sea.
- **Weather.** Wind sets surf: the foam line's breathing and the crest-chevron count double on windy days; sand drifts onto the boardwalk's edges. Rain pocks the sand and darkens it. In Newfoundland, sea fog arrives from the south first here.
- **Dressings.** Classic: weathered white clapboard, hull-blue trim, rope, driftwood. Taylor (paper stock *1989*: instant photos, gulls): pastel beach-hut stripes, shell stencils, paper bunting, paper boats at the tide line. Newfoundland: fishing stages and flakes on stilts, net lofts of unpainted shingle, lobster pots, jellybean dories.
- **Must never have.** A clean empty beach (no wrack, no prints), or anything tropical.
- **Pages that prove it.** D, L (the Boathouse across the water); porch pose.
- **Reviewer checklist.**
  - [ ] Wrack line and footprints present.
  - [ ] Pines lean with the wind, only behind the dunes.
  - [ ] Dune shadows long in the afternoon capture.
  - [ ] Campfire and moon path in the night capture.
  - [ ] Hull blue ≤ 10 %.
  - [ ] The zipline cable sags between its platforms.

### 2.6 Lakeside

- **Personality.** Still, cool and exact: glass and water and the hush of the spillway.
- **Dominant material + accent.** Glass `#bcd9d2`, slate `#5f6f78` (roofs, flags), wet stone `#8f8a7e`*. Accent brass `#caa252` (rails' caps, the plaques' frames, lamp fittings).
- **Roof and silhouette.** Two horizontals: the dam's crest and the lake's far shore; the Glasshouse ridge between. Small structures take flat or shallow slate roofs.
- **Ground.** `apron` (the dam), `paved` crest walk, `gravel` on the lake rim walk, wet stone at the water's edge, `ice` in Jan–Feb.
- **Planting.** Own flowers: blue flag iris and water lily (June–July); marsh marigold, cattail, Joe-Pye weed. Trees: willow at the inflow, tamarack (gold in October), red-osier dogwood (red stems in winter). Tree cover ~20 %, never between the Glasshouse and the lake.
- **Porch.** The dam crest, with the plaques. Porch pose: from the crest south over the town.
- **Thresholds.** The Dam Gallery door (stair), the S1 × lake rim crossing at the apron (board on the apron, walkers on the crest), the Glasshouse spur's end.
- **Sound.** The spillway's hush (continuous, louder near the apron), loons, skates on ice in January, gravel footsteps.
- **Light at best hour.** Morning (page F): the dam's glass face lit from the side, the lake flat; dusk (page K) for the Glasshouse.
- **Night face, in order.** The Glasshouse glows first (brightest on the island) → the crest lamps → the Dam Gallery door lamp → the moon path on Stillwater.
- **Weather.** Calm: the lake is a mirror of the Crown (§1.7). Wind: cat's-paw ripple cards. Dawn fog lies as a flat sheet 3 eu above the water. Jan–Feb: ice, snow at the rim, skate arcs.
- **The dam and `L01`.** Stillwater's level and colour are constant. The dam's glass face shows the lake at that constant level; its old gauge strip is removed. `L01` beside the dam is the only instrument on the island and the only object that reads `BasinReading` (CONTRACT §2.2); no other object near it may look like a gauge, meter or level mark.
- **Dressings.** Classic: glass, slate, wet stone, brass. Taylor (paper stock *debut*: botanical, butterflies): vellum glazing, pressed water lilies, paper lanterns on the crest. Newfoundland: granite, galvanised rails, rope, drizzle more often than sun.
- **Must never have.** The lake level, colour or ice changing with money; any gauge-like object other than `L01`.
- **Pages that prove it.** F, K, A (the dam's face); porch pose.
- **Reviewer checklist.**
  - [ ] Glazing bars and panes visible on the Glasshouse.
  - [ ] `L01` distinct from every other object on the crest.
  - [ ] Crown reflection in a calm capture.
  - [ ] Ice state correct for the capture's date.
  - [ ] Brass ≤ 10 %.
  - [ ] Crest parapets on both sides with coping.

### 2.7 The Crown & the Undercroft

- **Personality.** High, bare and old: wind above, drip below.
- **Dominant material + accent.** Bare rock strata `#a3998a` / `#7c7268` with lit ledges `#c4bba9`, snow `#f1f1ec` in season, mine timber `#4a3526`, glow-worm light `#9fe3d0`. Accent lichen orange `#d9892f` (lichen on rock tops, the lookout wall's stones).
- **Roof and silhouette.** Stepped strata from summit to Shoulder; the observatory's small white dome, the lookout wall and the Crown station the only built shapes. No trees above the Shoulder (110 m).
- **Ground.** Rock and scree, alpine turf, `paved` on the Crown walk and the Crown drop, `snow` Dec–Mar. Underground: `gravel` in the drifts, `boardwalk` on the Deep's jetty, `paved` on the Bell Gallery stair.
- **Planting.** Own flowers: fireweed (July–August) and harebell; mountain avens, partridgeberry. Trees: dwarf spruce only, below the Shoulder. Underground: moss only.
- **Porch.** The lookout wall; the Deep's jetty. Porch pose: from the lookout wall toward Little Harbour down the gondola line.
- **Thresholds.** `crownLaunch` (run off), the Crown walk at the Crown Road turning circle, `gondolaTop` (step off), `southPortal` (the Ore Line's top: cart → feet), the Throat (glider only), `deepJetty`, the Adit, the Sea Door (by boat) and `seaDoorJetty` (also the Ferry's pier) with the Sea Stair up to the Prow walk; `prowPlatform` (the zip tower's deck, also the glider launch).
- **Sound.** Wind; the summit bell from above and, in the Bell Gallery, from below; dripping water; the cart's wheels and lever clunk.
- **Light at best hour.** Noon (page E): the south face lit toward town, the Throat a dark mouth in shade all day (LIGHT §2).
- **Night face, in order.** The observatory's single warm dot (dusk) → the gondola cabins' running lights → below ground nothing changes (always lit) → in Newfoundland, Nov–Mar after 22:00, aurora over the summit.
- **Weather.** Wind strongest at the summit (vane and spruce tips). Cloud can sit on the summit (a paper cloud card clipping it) on overcast days. Snow per §1.8; north face last to clear.
- **Dressings.** Classic: bare rock, snow, mine timber. Taylor (paper stock *Midnights*: midnight paper, constellations): the observatory dome in star-printed paper, constellation stencils on the Undercroft's ceilings among the glow-worms, lavender snow shade. Newfoundland: tuckamore mats replace the dwarf spruce, sea-fog banks on the Prow side, the aurora.
- **Must never have.** A tree above the Shoulder; a pitch-black passage.
- **Pages that prove it.** E, G; porch pose.

**The Undercroft (additional rules).**

- **Darkness floor.** Every floor on a route renders at L* ≥ 14 at any hour; every door, threshold, drop edge, rail and jetty edge has a contrast ratio ≥ 3 : 1 against its surroundings on a 390 px capture, carried by a chalk lip line where light alone is not enough. Ambient is lower than the surface's night minimum, never zero.
- **Three light sources only.** (1) Glow-worms: cool clusters on the Lantern Cave ceiling and the Throat's walls. (2) Lanterns: warm; the found lanterns hanging in the Lantern Cave (empty on day one), plus a fixed mine lamp at each of the four doors and each room's entrance. (3) The skylight: the shaft over the Deep (`underground.rooms.deep.skylight`, opening on the north slope).
- **The skylight shaft by day.** When the sun's elevation is ≥ 20° (every day at solar noon; ~08:00–16:30 in June) a shaft card (additive, 12 % opacity, with dust-mote specks) falls down the skylight shaft to the Deep and lays a bright pool on the water; the pool drifts with the sun's azimuth. Below 20°, a pale column at 5 % only.
- **By night.** Moon shaft (`#c9d6ee`, 7 %) when the moon is ≥ 20° up and ≥ 25 % lit; otherwise a faint column `#6f86b0` at 4 %.
- **Wet stone.** Floors within 6 eu of water and every wall below a drip line are wet: roughness 0.35 (vs 0.9), a sheen strip catching the nearest light, drip cards every 2–5 s with ripple rings.
- **Mine timbers.** Sets (post–cap–post) every 2.5 eu in the Adit and the Ore Line's drifts, dark timber `#4a3526` with chalk on the lit edge, a mine lamp every fourth set.
- **The cart.** An iron-banded timber box on four flanged wheels, a plank seat for two, one brake lever (≥ 0.2 eu so it reads), a headlamp (running light). Rails 0.9 gauge on sleepers (`profiles.rail`).
- **The Lantern Cave** fills over the year; the hanging lanterns keep the order in which the household found them.

- **Reviewer checklist.**
  - [ ] Strata visible on every cliff; the Throat in shade at noon.
  - [ ] No tree above the Shoulder.
  - [ ] Page G has its shaft at noon and a readable jetty edge at night.
  - [ ] Every Undercroft threshold has a warm mine lamp.
  - [ ] Snowline matches the capture's month.
  - [ ] Lichen orange ≤ 10 %; the observatory the highest light at night.

---

## 3. The kit inventory (the kit pass produces all of it)

Dressings column: C = Classic, T = Taylor, N = Newfoundland. "Night" is the night state beyond §1.3.3's family response. "Lite" is what changes on the lite tier (§1.13 rule 4 applies to all rows: lite subtracts, never substitutes).

### 3.1 Pieces

| Item | Where used | Dressings | Day / night | Lite variant |
|---|---|---|---|---|
| Threshold marker | every threshold in `MANIFEST.thresholds`, every reserve plot | inset plate 2 × 0.6 eu in the neighbourhood accent with a mode stencil (cardKit `ICON`); C brass-edged stone, T taped paper tile, N painted granite | day plate; night reflective stencil, 1.6 × inside a pool | stencil only, no bevel |
| Bike / board rack | beside every threshold | C timber and brass hoops, T pastel paper hoops, N galvanised pipe | — | 1 card, no ink |
| Hoarding fence + stakes + string + timber stack + sign | reserves (`plot.terraces.*`, `plot.bight.*`, `plot.under.1`, `plot.flats.1`) | C painted board hoarding, sign "Not yet"; T scrapbook "someday" tag; N hand-lettered board (CONTRACT §5); wildflowers and a bench beside | never lit | hoarding as one flat per side |
| Milestone | every junction of walks, trails and the ring | C stone post 0.9 eu, bevelled top, engraved; T stone with a taped tag; N painted granite | never lit; reflective letters | no bevel |
| Lantern post | quay (Lantern Row), roads, walks outside the Green's protected centre | 2.6 eu post, bracket arm; C brass lantern, T washi lantern, N storm lantern on rope bracket | lit dusk–dawn in sequence | glow card only beyond 30 eu |
| Low lantern (bollard light) | garden walk, High Span walk level, Lakeside crest, Reach boardwalk | 0.8 eu; same three lantern languages | lit dusk–dawn, 2 eu pool | pool only beyond 40 eu |
| Bench | every porch, reserves, the Green (0.85 eu back, allowed in the protected centre) | C timber slats on stone ends, T paper slats with scalloped back, N painted plank on driftwood | — | no slats beyond 30 eu |
| Picnic table | the Hollow's porch, Long Sands, the Flats | C timber, T gingham paper top, N weathered plank | — | — |
| Stone wall with gap | the Hollow (S4 orchard wall), field edges | C warm drystone, T card blocks with paper edge, N granite fieldstone | — | merged blocks |
| Rope fence | the Landing, the Lamp, dunes, the Deep's jetty | C manila rope `#c9b38a` on timber posts, T ribbon on paper posts, N rope on driftwood with buoys | — | rope as a strip |
| Jetty | `structures.jetties`, ferry piers, Boathouse dock; the Sea Door pier with the Sea Stair (treads with riser faces, a rail per flight, lamps at the landings) | 0.35 eu deck on piles with waterline rings, handrail where deep; C timber, T painted pastel planks, N weathered plank with tyre fenders | lamp at the end | 1 pile per 3 eu |
| Bollard | quay, Quay Bridge, docks | C iron with porcelain cap, T paper cylinder with ribbon, N painted iron with rope turns | — | 6-sided |
| Storefront | the market lane, the upper street | plinth, walls, recessed door 0.2 eu, window with interior layer flats, eave with underside, sign on brackets; C gable + stone-timber, T scallop + paper, N saltbox + clapboard (`buildingArt`) | window glow dusk–23:00 | interior layer 1 flat |
| Market stair + ramp | Little Harbour (three flights) | 3 eu wide, riser faces, cheek walls, a rail per flight (1.05 eu), ramp ≤ 8 % beside; C stone, T paper steps, N granite and plank | handrail lamps at landings | — |
| Retaining wall | the Terraces, roads on cuts, the studio terrace | stacked-stone card, pencil joints, 0.15 eu coping, batter 1 : 6, weep holes every 3 eu; C/T/N per stone row of §1.3.4 | — | no joints beyond 60 eu |
| Parapet | road edges with a drop, bridges, the lookout wall, dam crest | 1.0 eu + 0.15 coping, piers every 12 eu | — | no coping ink |
| Kerb | all roads, gaps at thresholds | 0.15 × 0.25 eu stone | wet sheen | strip |
| Culvert | brook and Wash under roads and walks; the Dune Culvert (S4 under V01, 3 m clear, a dune tunnel with a ceiling) | headwall with arch ring and wingwalls, foam at the mouth | — | — |
| Covered bridge | Hollow Bridge | timber truss, board-and-batten sides with windows, shingle gable, portal lanterns, S4 rail outside, the ninth basket; C timber, T taped paper truss, N red-ochre boards | portal lanterns lit | windows as decals |
| Bridge deck + underside | High Span (masonry deck-arch, shelf corbelled through the spandrel, walk at the water); Quay Bridge (masonry, three segmental arches; V01 with S3's separated lane); Bight Bridge (timber trestle, S2's separated lane with the full-length rail, 8 m clear); Hollow Bridge (covered footbridge); the inlet and Reach footbridges (timber on piles); the Apron Bridge (S1 over the tailrace); the plank footbridge at the Wash mouth | three `bridgeArt` languages per §1.6; dressings swap stone and timber per §1.3.4 | deck lanterns; shelf strip lamps on the High Span | underside one flat per bay |
| Tunnel portal | Prow Tunnel, Shoulder Tunnel, the Ore Line's South Portal | dressed-stone portal, voussoirs, wingwalls, paler lining, lamps every 15 eu inside | interior lamps always on | lining without joints |
| Dam parts (exist: `damArt`, `damParts`, `damSolids`) | Lakeside | re-face to the south toward the square; keep glass, steel fins, abutments, crest walk, apron, spillway arch (Ring Run gate 4). The gauge strip and the BasinReading binding stay on the dam until the Lakeside pass (03) builds `L01` and moves the binding in the same PR under a trust review; the kit pass only prepares the L01 chamber card. Kitty chambers retire from the dam (D14) | crest lamps; Dam Gallery door lamp | existing lite path |
| Gondola cabin + tower | G1 (three towers, `cable.G1.towers`) | tapered steel lattice towers (existing), cable sagging; cabins C porcelain with a `#315c49` band, T pastel pod with a heart window, N red cabins | running lights, dim interior | cabins without interior |
| Mine cart + rail + timber set | Ore Line, the Adit | §2.7; C oiled timber and iron with a brass number plate, T pastel cart with washi stripes and a paper-heart headlamp, N barn-red cart with white letters | headlamp | sets every 5 eu beyond 40 eu |
| Zip platform | the Prow (top: a 30 m tower, deck `h` 100, shared with the glider launch); Long Sands (landing: a tower on the dune crest, deck `h` 12, the Town Weave boardwalk passing beneath it) | timber towers with roof and clip rail; the landing deck with a buffer, a stair and a ramp down to the sand | platform lamps | — |
| Glider wing card | launches, the Throat, the Deep | ribbed paper wing with visible spars; C canvas cream with terracotta leading edge, T pastel with a star, N yellow and red | white tail light | ribs as lines |
| The plane (floats and wheels) | the strip, the floatplane dock, the hangar | yellow bush plane, card body with rivet pencil lines; floats and wheels swap at the hangar; C yellow `#e8c547` with brown trim, T pastel yellow with paper stars, N yellow with a red stripe | running lights; cockpit glow | no rivets |
| Balloon | the Flats mooring | paper gores with ink seams, wicker basket, tether line; C terracotta and porcelain gores, T pastel gores with hearts, N red-yellow-blue | burner glow when rising | 8 gores instead of 16 |
| Rowboat / canoe / dinghy | the Bight, the harbour, the coast to the Sea Door, the river, the Sea Passage, the Deep | C varnished timber, T pastel painted, N jellybean dories with white gunwales | a lantern on the bow when out at night | — |
| Ferry | `FERRY` route and piers (two hulls) | small painted-card ferry with deck, wheelhouse, railings, a gangway; C white hull, green upper, brass; T pastel scrapbook with bunting; N red hull, white house | running lights, lit wheelhouse | no railings beyond 60 eu |
| Runway lamp + windsock | the strip | lamps 0.35 eu every 12 eu both edges; sock C terracotta/porcelain, T striped paper streamer, N orange/white | lamps lit dusk–dawn; mast lamp red | lamps as a dotted strip beyond 120 eu |
| Hangar shed | the Flats | corrugated barrel roof, timber doors, the bench, the empty bay (`plot.flats.1`) | door lamp | no corrugation lines beyond 60 eu |
| Lighthouse | the Lamp | tower, gallery at 25 m, lantern room; C porcelain white with a brass lantern room, T pink-and-white paper stripes, N red-and-white bands | beam sweep 8 s | beam wedge only |
| Sundial | the square | stone dial, brass gnomon; the gnomon's shadow is the shadow map, never painted; C engraved stone, T paper clock-face dial, N granite with painted numerals | moon shadow when the moon is up | — |
| Disc-golf basket | Nine Baskets, outside the Green's protected centre; the ninth on the covered bridge | chain basket on a pole, number plate; C brass band, T ribbon band, N buoy-colour band | never lit | chains as lines |
| Bocce court | the square's small green | crushed-stone court, timber boards, balls and jack | — | — |
| Kite | Long Sands | diamond paper kite, bow tail; C terracotta/porcelain, T patterned paper, N primaries | flown at any hour (LIGHT: nothing waits for the sun); at night the kite carries a small lantern | — |
| Paper boat | from the Cup | folded paper with visible creases; C cream paper, T printed patterned paper, N newsprint | — | — |
| Planting cards | per biome, §3.2 | species cards, 3–5 archetypes | night family response | 3 archetypes; drifts as one card beyond 40 eu |
| Rock strata sets | per landform, §3.3 | — | moon chalk on ledges | fewer ledges beyond 60 eu |
| Light cards | everywhere, §1.11 | lantern language per dressing | per LIGHT §3 | 48 cap |

### 3.2 Planting cards per biome

| Biome (Grand Plan) | Trees (archetypes) | Flower / grass cards | Newfoundland swap | Taylor paper |
|---|---|---|---|---|
| The Green · open meadow | sugar maple (round, 4), white elm (poplar-like vase, 3), bur oak (1 authored) | red clover, ox-eye daisy, black-eyed Susan, milkweed (+ monarchs), goldenrod, dandelion (clocks in June), timothy/fescue tufts | clover → lupine; maple → black spruce | per neighbourhood stock |
| Scholars' Edge · woodland | white pine (pine, 4), hemlock (pine, 3), sugar maple (round, 3), paper birch (birch, 4), cedar (poplar, 3) | white trillium, bloodroot, wild columbine, ostrich fern, foxglove | maple → black spruce / balsam | *folklore* |
| The Hollow · orchard | apple and pear (fruit, 5), crabapple (fruit, 3), lilac hedge | apple blossom, apples, lilac, wild strawberry, chicory, sumac | — | *evermore* |
| The Flats · dry prairie | red cedar (poplar, 3), juniper (alpine, 3), wind-shaped pine (1 authored) | little bluestem, yarrow, wild bergamot, purple coneflower, harebell, eastern prickly pear | + crowberry, reindeer lichen | *Fearless* |
| Stillwater, the Notch & the Reach · water | willow (round-weeping, 3), tamarack (pine, 3), red-osier dogwood (shrub, 3) | marsh marigold, blue flag iris, water lily, cattail, Joe-Pye weed | + bakeapple, pitcher plant (the Reach) | *debut* |
| The Bight & Long Sands · shore | wind-bent pine (pine, 3, leaning), alder (round, 3) | lupine, beach pea, beach rose, sea thrift, marram, eelgrass | — | *1989* |
| The Crown & the Shoulder · highland | dwarf spruce (alpine, 3), below the Shoulder only | fireweed, harebell, mountain avens, partridgeberry, lichen patches, moss (underground) | dwarf spruce → tuckamore | *Midnights* |

### 3.3 Rock strata sets

| Set | Where | Beds | Colours (Classic) | Character |
|---|---|---|---|---|
| Crown | the Crown, the Shoulder, the Throat | ledges every 2.5–4 eu | `#a3998a`, lit `#c4bba9`, lip pencil | stepped, lichen orange on tops |
| Notch | the Notch walls, the High Span abutments | ledges every 1.5–3 eu, thinner | warmer `#b3a58f` | layered, cliff ferns and cedar in cracks |
| Ochre | the Flats rim, the Wash walls | thick horizontal beds 3–5 eu | `#d7ac6b` / `#8f6236` | rounded tops, wind-carved |
| Sea cliff | the Prow, the Needle's Eye, the Stacks | vertical joints every 2 eu across horizontal beds | `#9a9489` | blocky, foam at the foot |
| Undercroft | all rooms and drifts | irregular, wet | `#5a5550`, wet sheen | moss on the lower 1 eu, drip lines |

### 3.4 Light cards

As §1.11's table; the kit ships each card with its three dressing lantern housings and the pool decal, and a single `LightAnchor` adapter so neighbourhood passes place anchors, never meshes.

## Reconciled to MANIFEST v1.1 (reviewer)

Scope: §2 and §3 only (§0–§1 untouched; their v1.1 disagreements are reported to the design lead).

- §2.1: `quayWest` is Town Weave's quay threshold, no longer the race run-out (the race finishes at the Landing quay).
- §2.2: the S4 × garden-walk crossing is the Hollow Bridge threshold `[893,600]`, not `[930,660]`.
- §2.5: `landingQuay` and `zipLanding` thresholds named.
- §2.7: "the Ore Line's Crown station" → `southPortal`; the Dam Gallery removed from the Crown's thresholds (it no longer enters the Undercroft); `gondolaTop`, `deepJetty`, `seaDoorJetty` named; the skylight is its own shaft over the Deep, not the Throat's opening.
- §3.1: the Dune Culvert, the inlet and Reach footbridges and the separated skate lanes on the Quay and Bight Bridges added; the Ore Line "twin bore" → its South Portal; boats reach the Sea Door and the Sea Passage; the Ferry has two hulls and a gangway.

### v1.2 deltas (reviewer, MANIFEST v1.2)

- §2.2: S4 × Green Road at the studio terrace. §2.3: the cove walk. §2.4: the Wash Run, its wet-day marker, the Bight pier and its walk.
- §2.5 and §3.1: the zip lands on a landing tower (deck h 12) over the S3 boardwalk; the Prow tower (deck h 100) is shared with the glider launch.
- §2.7: the Sea Door pier and the Sea Stair; `prowPlatform`.
- §3.1: the gondola's three towers; the Sea Stair on the jetty row; the Apron Bridge and the Wash-mouth plank bridge on the bridge row.
