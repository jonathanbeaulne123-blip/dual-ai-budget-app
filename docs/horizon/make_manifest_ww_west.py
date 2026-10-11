# The Water's Way · PR 2 "the land", builder L3: Scholars' Edge, the Flats and the Bight (D-WW80…89, 2026-10-05).
# Executed by make_manifest.py just before it writes MANIFEST.json (`m` and `length` are in scope). Never hand-edit the JSON.
# Sources: the Scholars and Flats prototypes (SPEC.md / LAND-ASKS.md, exact coordinates) and the integrator's RULINGS.

# ---- The Flats ------------------------------------------------------------------------------------------------------------
# D-WW80 · the windsock footing (RULINGS 3). The ruled [466,508] stands at o = 41.6 from the strip centreline, 0.4 m inside the
# 42 m "nothing over 1 m" approach box it was moved to clear; the mast (r 0.12) and the sock streaming north (r 0.62) clear it at
# [467.5,508] (mast o 43.1, sock ≥ 42.5). 9.3 m off S2's edge (≥ 6), 28 m off the strip's edge.
_strip = m["structures"]["strip"]
_strip["windsock_v2_7"] = _strip["windsock"]
_strip["windsock"] = [467.5, 508]
# D-WW81 · the strip's clearances as contracts (the airport brief's approach rule, and the side rule the elevator is proved by).
# The repo has no obstacle-limitation surface (flight collision is the drawn geometry, airport/flight.ts); these are the island's.
_strip["clearances"] = {
    "approach": {"halfWidth_m": 42, "length_m": 230, "maxHeight_m": 1,
                 "note": "nothing taller than 1 m within 42 m of the centreline for 230 m beyond each threshold (s ∈ (−230, 0) ∪ (L, L + 230))"},
    "side": {"fromCentreline_m": 28, "note": "beside the strip nothing taller than 1 m stands nearer the centreline than 15 (paved half-width) + 7 (half the widest wing, the Heron's 14) + 6 (keep-off)"},
    "decided": "D-WW81 (L3, 2026-10-05): the grain elevator on the tower footprint [395,706] clears both (footprint ≤ 9 × 9: |o| ≥ 34.6, s 184)",
}
# D-WW84 · the stargazing deck and the observatory pad in the dark tip [474,381] (STYLE §2.4 amendment), on foot from the Drive.
m["structures"]["stargazing"] = {
    "kind": "lookoutPad", "xy": [474, 381], "h": 38.0, "size_m": [18, 10],
    "deck": {"xy": [470.5, 381], "size_m": [11, 7], "top": 38.35, "note": "a low timber deck for the reclining benches (dressing, PR 4)"},
    "observatory": {"xy": [479.5, 381], "size_m": [5, 5], "top": 38.15, "note": "the domed observatory hut's pad (the hut ≤ 5 m is dressing, PR 4)"},
    "note": "D-WW84: outside both approach boxes (s −136, o +57); the walk link leaves the Drive at a register threshold",
}
m["walks"]["stargazing"] = {"pts": [[484.7, 403.5], [482, 396], [478.5, 386.6]], "profile": "walk", "length_m": 0,
                            "levels": [{"xy": [478.5, 386.6], "h": 38.0, "why": "D-WW84: the stargazing pad's edge"}],
                            "note": "D-WW84: the stargazing walk, from Horizon Drive to the deck and the observatory pad"}
m["walks"]["stargazing"]["length_m"] = length(m["walks"]["stargazing"]["pts"])
# D-WW85 · the Wash Arch (the Wash Run gate) spans S2 just below its start; the clearance over S2 is a contract (≥ the bed's
# rider envelope, S2 clearHeight 2.4) with a baked diagnostic. Legs 6 m clear of S2's edge (the brief's keep-off), outside the
# 42 m approach box. Hoodoo footings: a small cluster on the Wash's east bank, each ≥ 6 m off every bed edge (the drums, 3–9 m,
# are dressing, PR 4).
m["structures"]["washArch"] = {
    "kind": "rockArch", "over": "S2", "at": [479.6, 489], "legOffset_m": 9.6, "legRadius_m": [1.6, 1.45, 1.3, 1.2], "drum_m": 1.8, "lean_m": .25,
    "lintel": {"underside": 45.0, "thickness_m": 2.2, "width_m": 2.6}, "clear_eu": 2.4,
    "note": "D-WW85: two leaning ochre drum stacks and a lintel over the Wash Run 9 m below its start [480,480]",
}
m["structures"]["washHoodoos"] = {
    "kind": "hoodooFootings", "footing_m": 4, "rise_m": .5,
    "xy": [[483.5, 650], [486, 663], [483, 677], [485.5, 690], [482.5, 704]],
    "note": "D-WW85: five footings on the Wash's east bank, ≥ 6 m off every bed edge, mid-strip (no approach box)",
}
# D-WW86 · page H re-posed (the Flats prototype): from over the strip's south end up the strip, the windsock and the balloon in
# frame, the west sea beyond.
for _v in m["views"]:
    if _v["id"] == "H":
        _v["ww_previous"] = {"xy": _v["xy"], "eyeH": _v.get("eyeH"), "target": _v["target"], "target_h": _v.get("target_h"), "portrait": dict(_v.get("portrait", {}))}
        _v["xy"] = [452, 890]; _v["eyeH"] = 58; _v["target"] = [428, 480]; _v["target_h"] = 30
        _v["frames"] = "the strip up to the windsock and the balloon, the west sea beyond"
        _v["portrait"] = {**_v.get("portrait", {}), "xy": [452, 890], "eyeH": 58, "target": [428, 480], "target_h": 30}
        _v["poseNote_ww"] = "D-WW86 (L3, 2026-10-05): the Flats prototype's page H pose, eye [452,58,890] → [428,30,480], fov 55"
# The porch frame (D-WW86): Long Sands is never in sight from the hangar's bench.
for _n in m["neighbourhoods"]:
    if _n["id"] == "flats":
        _n["porchFrames"] = "the take-offs, the strip and the Bight Bridge's arch over the rim"

# ---- Scholars' Edge -------------------------------------------------------------------------------------------------------
# D-WW87 · the Bight lookout spur and the raised lookout deck. The spur leaves the Year Walk at [748.1,449.8] (2.2 m from the
# prototype's start; `walk garden` is 30 m away) as a 2.8 m gravel walk; from [746.5,479] a timber ramp on posts climbs at 6.7 %
# (the climb starts at [747,470], ≤ 7 %) to the deck, 7 × 5 at 52.0 (ground 50.0 at [744,511] + 2), pulled back to the cliff lip
# (south edge z 511.6) on posts that reach the ground; open rails 1.05 (seen through by the ray caster).
m["walks"]["bightLookout"] = {
    "pts": [[748.1, 449.8], [747.6, 460], [747, 470], [746.5, 479]], "profile": "walk", "surface_m": 2.8, "length_m": 0,
    "levels": [{"xy": [748.1, 449.8], "h": 48.58, "why": "D-WW87: flush with the Year Walk"},
               {"xy": [747, 470], "h": 49.53, "why": "D-WW87: the climb to the raised deck starts here (ground)"},
               {"xy": [746.72, 474.94], "h": 49.86, "why": "D-WW87: on the 6.7 % line (the solver would follow the ground)"},
               {"xy": [746.5, 479], "h": 50.13, "why": "D-WW87: the ramp's foot (6.7 % to the deck)"}],
    "note": "D-WW87: the Bight lookout spur (gravel, bollards are dressing) from the Year Walk to the lookout ramp",
}
m["walks"]["bightLookout"]["length_m"] = length(m["walks"]["bightLookout"]["pts"])
m["structures"]["bightLookout"] = {
    "kind": "lookoutDeck", "ramp": [[746.5, 479], [745, 488], [744, 503], [744, 506.6]], "rampWidth_m": 2.4,
    "deck": {"from": [740.5, 506.6], "to": [747.5, 511.6], "top": 52.0}, "rail_m": 1.05, "eye": [744, 511],
    "note": "D-WW87: the Bight lookout (eye = deck + 1.6 = 53.6, the story's bightLookout); the deck stands back from the lip on posts",
}
# D-WW88 · courtyard B's terrace on the Library's south-west gable, level with the Library pad (48): three pads (the north-west
# corner stands back 4.6 m from the Year Walk), joined to the Library pad at its gable and to the apron at the door; their open
# edges are 1 : 1.5 batters (up to 1.8 m of fill on the north-west side), never into the Library pad. Library frame: centre
# [740,400], u NE (0.70711,−0.70711), v SE (0.70711,0.70711).
def _lib(u, v):
    return [round(740 + 0.70711 * (u + v), 2), round(400 + 0.70711 * (v - u), 2)]
def _terrace(u0, u1, v0, v1):
    return {"xy": _lib((u0 + u1) / 2, (v0 + v1) / 2), "size_m": [round(u1 - u0, 2), round(v1 - v0, 2)], "rot_deg": -45, "local": [u0, u1, v0, v1]}
m["structures"]["scholarsTerrace"] = {
    "kind": "terrace", "h": 48, "batter": 1.5,
    "pads": {"main": _terrace(-40.4, -22, -15.4, 17.5), "north": _terrace(-34.5, -22, 17.5, 23.4), "door": _terrace(-22, -4.5, 16, 23.4)},
    "note": "D-WW88: courtyard B's terrace (flags, walls, tables and the sun-window glade are dressing, PR 4)",
}

# ---- The Bight ------------------------------------------------------------------------------------------------------------
# D-WW89 · the Bight Shore plots' lagoon faces battered at 1 : 1.5 (real ground, raise only, over the lagoon floor). The plots,
# their pads and walls stay where they are; the plot (pad + 6 m margin) is filled to its own level where the lagoon reached
# into it. The batter's toe keeps ≥ 6 m off the Greenway line and 4 m off the Bight Shore jetty. Land integration (PR 2): the
# keep-off reference is the built Greenway's own line (structures.greenway.pts, the bed `structure.greenway`); the route-e
# centreline L3 used before the Greenway existed (up to 7.9 m off the built line) is kept beside it as `greenwayLine_routeE`. Where that leaves too little run for the
# full height, the batter rises from the lagoon floor at its toe and the plot's retaining wall keeps the rest (reported).
m["reserves"]["bightShore"]["batter"] = {
    "slope": 1.5, "crest": "the plot's retaining-wall line (pad + margin), at the pad's level", "toeKeepOff": {"greenway_m": 6, "jetty_m": 4},
    "greenwayLine": "structures.greenway.pts", "greenwayLine_routeE": [[755.0, 1202.5], [750.0, 1200.0], [745.0, 1197.5], [740.0, 1195.0], [735.0, 1192.5], [730.0, 1190.0], [732.5, 1185.0], [732.5, 1182.5], [735.0, 1177.5], [737.5, 1172.5], [732.5, 1170.0], [727.5, 1167.5], [722.5, 1165.0], [717.5, 1162.5], [712.5, 1160.0], [707.5, 1157.5], [702.5, 1155.0], [697.5, 1152.5], [692.5, 1150.0], [687.5, 1147.5], [682.5, 1145.0], [680.0, 1145.0], [675.0, 1142.5], [672.5, 1142.5], [670.0, 1142.5], [667.5, 1142.5], [665.0, 1142.5], [660.0, 1140.0], [655.0, 1137.5], [652.5, 1135.0], [650.0, 1130.0], [650.0, 1127.5], [650.0, 1125.0], [650.0, 1122.5], [650.0, 1120.0], [650.0, 1117.5], [650.0, 1115.0], [650.0, 1112.5], [650.0, 1110.0], [650.0, 1107.5], [652.5, 1102.5], [652.5, 1100.0], [655.0, 1095.0], [655.0, 1092.5], [657.5, 1087.5], [657.5, 1085.0], [657.5, 1082.5], [657.5, 1080.0], [657.5, 1077.5], [657.5, 1075.0], [660.0, 1070.0], [660.0, 1067.5], [660.0, 1065.0], [660.0, 1062.5], [660.0, 1060.0], [662.5, 1055.0], [665.0, 1050.0], [667.5, 1045.0], [670.0, 1040.0], [672.5, 1035.0], [675.0, 1030.0], [675.0, 1027.5], [675.0, 1025.0], [677.5, 1020.0], [680.0, 1015.0], [682.5, 1010.0], [685.0, 1005.0], [687.5, 1000.0], [690.0, 995.0], [692.5, 990.0], [695.0, 985.0], [697.5, 980.0], [700.0, 977.5], [702.5, 972.5], [705.0, 967.5], [707.5, 962.5], [710.0, 957.5], [712.5, 952.5], [715.0, 947.5], [717.5, 942.5], [717.5, 940.0], [720.0, 935.0], [722.5, 932.5], [725.0, 930.0], [727.5, 927.5], [730.0, 925.0], [732.5, 922.5], [735.0, 920.0], [737.5, 917.5], [740.0, 915.0], [742.5, 912.5], [745.0, 910.0], [747.5, 907.5], [750.0, 905.0], [752.5, 902.5], [755.0, 900.0], [757.5, 897.5], [760.0, 895.0], [762.5, 892.5], [765.0, 890.0], [767.5, 887.5], [770.0, 885.0], [772.5, 882.5], [775.0, 880.0], [777.5, 877.5], [780.0, 875.0], [782.5, 872.5], [785.0, 870.0], [787.5, 867.5], [790.0, 865.0], [792.5, 862.5], [797.5, 860.0], [800.0, 860.0], [805.0, 857.5], [807.5, 855.0], [810.0, 850.0], [812.5, 847.5], [817.5, 845.0], [822.5, 842.5], [827.5, 840.0], [830.0, 835.0]],
    "decided": "D-WW89 (L3, 2026-10-05)",
}

# ---- registers and names --------------------------------------------------------------------------------------------------
m["crossings"].extend([
    {"a": "walk bightLookout", "b": "yearWalk", "at": [748.1, 449.8], "resolution": "threshold", "kind": "crossing", "note": "D-WW87: the Bight lookout spur leaves the Year Walk (flush; a marked junction)"},
    {"a": "V01", "b": "walk stargazing", "at": [484.7, 403.5], "resolution": "threshold", "kind": "crossing", "note": "D-WW84: the stargazing walk leaves Horizon Drive (wheels park, feet on)"},
])
m["names"]["structures"] = [*m["names"]["structures"], "the Bight lookout", "the lookout spur", "the courtyard terrace", "the stargazing deck", "the observatory", "the Wash Arch", "the hoodoos"]
