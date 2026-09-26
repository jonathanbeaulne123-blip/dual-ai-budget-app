import json, math

def length(pts, close=False):
    L = 0.0
    n = len(pts)
    for i in range(n - (0 if close else 1)):
        a, b = pts[i], pts[(i + 1) % n]
        L += math.hypot(b[0] - a[0], b[1] - a[1])
    return round(L)

isle = [[900,180],[1200,190],[1420,300],[1600,500],[1690,760],[1620,1080],[1440,1330],[1150,1480],[860,1480],[720,1330],[660,1180],[700,1000],[820,860],[860,720],[780,560],[640,520],[520,620],[500,800],[540,940],[460,1020],[370,940],[300,720],[340,470],[520,300],[700,210]]

V01 = [[1400,1060],[1480,1040],[1540,1000],[1600,860],[1590,700],[1560,500],[1500,340],[1300,260],[1120,250],[900,290],[720,300],[560,360],[400,470],[360,650],[390,850],[460,1030],[660,1170],[760,1250],[900,1360],[1100,1400],[1300,1380],[1350,1345],[1370,1260],[1360,1160],[1400,1060]]
VG  = [[1400,1060],[1330,1090],[1240,1105],[1120,1080],[1000,1000],[960,860],[980,700],[1000,600],[940,460],[930,330],[900,290]]
V02 = [[1500,340],[1445,430],[1445,520],[1400,620],[1370,690]]
VBS = [[960,860],[905,885],[875,940],[840,1000],[800,1065],[775,1125]]

S1 = [[1310,500],[1300,570],[1305,640],[1300,700],[1355,745],[1310,800],[1275,830],[1225,905],[1160,935],[1150,1000],[1195,1075],[1225,1150],[1250,1230],[1265,1290],[1270,1330]]
S2 = [[480,480],[475,580],[465,700],[485,800],[510,900],[480,985],[470,1030],[560,1100],[650,1185],[750,1265],[880,1375],[1000,1405],[1020,1430]]
S3 = [[1480,1060],[1500,1120],[1470,1160],[1440,1200],[1470,1260],[1430,1300],[1390,1330],[1350,1345],[1290,1400],[1200,1425],[1100,1440],[1020,1430]]
S4 = [[1000,520],[940,560],[893,600],[915,665],[920,740],[945,820],[870,930],[905,1015],[900,1120],[950,1230],[990,1330],[1005,1375],[1020,1430]]

W = {
 "garden":[[740,400],[800,480],[880,560],[930,660],[990,780]],
 "lakerim":[[990,780],[1030,740],[1130,720],[1235,755],[1250,840],[1200,900],[1140,905]],
 "prow":[[1560,1000],[1600,880],[1620,760],[1590,640],[1540,560]],
 "bight":[[840,880],[790,950],[745,1010],[720,1090],[700,1150]],
 "bightPier":[[350,880],[430,900],[520,895],[560,890]],
 "coveWalk":[[740,400],[700,330],[650,270],[630,240]],
 "dune":[[1150,1458],[1000,1478],[870,1460],[810,1420]],
 "crown":[[1370,690],[1330,600],[1310,500]],
 "crownFromGondola":[[1360,560],[1330,520],[1310,500]],
 "glasshouseSteps":[[990,830],[1000,805],[1010,790]],
 "flats":[[340,520],[320,700],[350,880]],
 "reach":[[1400,1290],[1330,1250],[1270,1200],[1240,1130]],
 "square":[[1420,1210],[1455,1175],[1490,1130],[1480,1060]],
}
river_upper = [[1170,660],[1165,700],[1160,740]]
river_lower = [[1140,905],[1170,980],[1220,1060],[1250,1140],[1280,1220],[1330,1290],[1350,1345],[1364,1390]]
brook = [[880,480],[900,600],[880,700],[865,800],[820,860]]
wash = [[480,560],[465,700],[485,800],[515,900]]
ferry = [[1470,1340],[1250,1540],[900,1530],[760,1480],[640,1300],[560,1100],[580,980],[560,890],[560,1100],[540,1230],[380,1200],[250,1150],[230,900],[285,720],[280,450],[450,250],[625,212],[900,110],[1200,120],[1500,300],[1720,650],[1712,790],[1700,1000],[1560,1250],[1470,1340]]
ore = [[1090,540],[1160,520],[1225,490],[1270,450],[1300,420],[1360,480],[1375,625],[1345,680]]

speeds = {"walk":1.7,"run":3.4,"board":7.0,"bicycle":6.0,"gondola":6.0,"cart":8.0,"zip":12.0,"glider":11.0,"plane":35.0,"ferry":5.0,"row":1.8}

def t(L, mode):
    return round(L / speeds[mode])

m = {
 "title":"The Horizon — MANIFEST",
 "version":"1.5",
 "date":"2026-09-25",
 "status":"Design numbers for implementation. Control points are centreline intent to be solved into splines by the land pass; not navigation or collision data until baked into WorldDefinition v3.",
 "units":{"x":"east, concept metres","y":"south, concept metres (engine z)","height":"metres above sea level (engine y)","scale":"engine units = concept metres × scale.factor (see scale)","north":"-z"},
 "extent":{"w":2000,"h":1800},
 "seaLevel":0,
 "island":{"outline":isle,"note":"Closed smooth curve through these points (Catmull-Rom). Shore is 12 m of sand/rock stroke; shallows extend 50 m."},
 "offshore":[
   {"id":"lamp","label":"The Lamp","xy":[540,1230],"r":40,"heightMax":8,"holds":"lighthouse (25 m gallery: glider launch), rowboat dock"},
   {"id":"needle","label":"The Needle's Eye","xy":[1790,680],"r":34,"heightMax":30,"holds":"natural arch (Ring Run gate 1, sunrise gate)"},
   {"id":"stacks","label":"The Stacks","xy":[[1770,880],[1810,930],[1750,960]],"heightMax":24,"holds":"Ring Run gate 2 between them"},
   {"id":"wreck","label":"The Wreck","xy":[250,1150],"r":30,"heightMax":4,"holds":"a wreck on the reef; boat destination; nothing to do"},
   {"id":"sandbar","label":"Bight sandbar","xy":[620,1000],"note":"shows at full moon"}
 ],
 "landformRule":"polygons are clipped to the island outline; the Hollow, the Stillwater terrace and the Cup are cut INTO the Shoulder (their own band wins inside them); elsewhere where polygons overlap the innermost (higher) band wins; band edges blend over 60 m; a bed (road, skate, rail, walk) overrides the bands within its profile width + 15 m each side and holds its own grade limits, so band steps never appear as cliffs on a route",
 "districts":[
   {"id":"harbour","neighbourhood":"harbour","note":"town + the Terraces + the town quay"},
   {"id":"landing","neighbourhood":"landing","note":"Long Sands, the Landing quay, the Boathouse, Campfire, Tideline park"},
   {"id":"reach","neighbourhood":"landing","note":"the wetland and the river mouth"},
   {"id":"green","neighbourhood":"lakeside","note":"the Green and the Glasshouse steps"},
   {"id":"hollow","neighbourhood":"hollow","note":"the orchard bowl, the Adit"},
   {"id":"scholars","neighbourhood":"scholars","note":"the woodland rise and the north pass"},
   {"id":"flats","neighbourhood":"flats","note":"the arm: strip, hangar, balloon, the Wash"},
   {"id":"bight","neighbourhood":"flats","note":"the lagoon, the sandbar, Bight Shore, the Bight Bridge"},
   {"id":"lakeside","neighbourhood":"lakeside","note":"Stillwater, the dam, L01"},
   {"id":"notch","neighbourhood":"lakeside","note":"the gorge, the High Span"},
   {"id":"prow","neighbourhood":"crown","note":"the cliffs, the zip tower, the Sea Door"},
   {"id":"crown","neighbourhood":"crown","note":"the Shoulder and the summit; the Undercroft is its underground child district"},
   {"id":"offshore","neighbourhood":None,"note":"the Lamp, the Needle's Eye, the Stacks, the Wreck; the sky ring streams by the districts beneath it"}
 ],
 "landforms":[
   {"id":"harbour","label":"Little Harbour","h":[0,18],"poly":[[1380,1060],[1540,1040],[1580,1160],[1520,1280],[1400,1300],[1350,1180]],"faces":"north-west (the dam) and south (the harbour)"},
   {"id":"sands","label":"Long Sands & the Landing","h":[0,5],"poly":[[720,1360],[1000,1400],[1350,1360],[1400,1440],[1150,1500],[860,1480],[740,1420]],"faces":"south"},
   {"id":"reach","label":"The Reach","h":[2,6],"poly":[[1180,1180],[1320,1180],[1370,1300],[1300,1360],[1200,1340],[1160,1260]]},
   {"id":"green","label":"The Green","h":[10,25],"poly":[[1000,900],[1150,960],[1250,1040],[1300,1180],[1150,1200],[950,1200],[820,1100],[830,960]],"faces":"south, open"},
   {"id":"hollow","label":"The Hollow","h":[30,45],"poly":[[880,500],[1060,480],[1090,600],[1040,680],[900,680],[850,600]],"faces":"south-facing bowl"},
   {"id":"scholars","label":"Scholars' Edge","h":[35,60],"poly":[[640,300],[900,260],[960,420],[880,520],[700,520],[600,420]],"faces":"north-west rise, shaded"},
   {"id":"flats","label":"The Flats","h":[30,45],"poly":[[330,480],[520,340],[560,620],[520,900],[430,1000],[320,850]],"faces":"west, sunset"},
   {"id":"stillwater","label":"Stillwater terrace","h":[45,55],"poly":[[1000,720],[1260,720],[1280,900],[1000,900]]},
   {"id":"notch","label":"The Notch","h":"cut 25–45 below the terrace","centreline":river_lower,"width":[40,70],"walls":"strata"},
   {"id":"prow","label":"The Prow","h":[40,70],"poly":[[1560,480],[1640,560],[1700,760],[1660,960],[1600,1080],[1560,1000],[1620,780],[1560,600]],"faces":"east, dawn; sea cliffs"},
   {"id":"shoulder","label":"The Shoulder","h":[90,110],"poly":[[1060,330],[1400,300],[1520,420],[1500,680],[1400,860],[1180,900],[1060,800],[1000,600]],"cutInto":["hollow","stillwater","cup"],"note":"stays ≥ 60 m inland of the north coast so the coast drive is not in its band"},
   {"id":"crown","label":"The Crown","h":[110,160],"poly":[[1120,330],[1330,280],[1500,380],[1520,560],[1420,700],[1240,700],[1120,560]],"summit":[1310,470],"summitH":158,"snow":"Dec–Mar, longest on the north face"},
   {"id":"undercroft","label":"The Undercroft","h":[30,95],"footprint":{"cx":1300,"cy":470,"rx":170,"ry":130}}
 ],
 "protected":{"green":{"cx":1040,"cy":1065,"r":160,"rule":"no building, plot, or prop taller than a bench (0.85 eu); disc-golf baskets and lantern posts ring the outside of it"}},
 "water":{
   "stillwater":{"cx":1130,"cy":820,"rx":110,"ry":85,"surface":50,"note":"natural lake; never encodes money; ice Jan–Feb"},
   "cup":{"cx":1170,"cy":660,"rx":22,"ry":14,"surface":100,"note":"tarn; paper-boat and River Run launch"},
   "river":{"upper":river_upper,"lower":river_lower,"note":"upper feeds the lake; lower leaves the dam through the Notch to the Reach and the harbour"},
   "brook":{"pts":brook,"note":"Orchard Brook: woodland to the Bight under the covered bridge"},
   "wash":{"pts":wash,"note":"dry streambed on the Flats; runs only after almanac rain; the Wash skate bowl at [465,700]"},
   "reachChannels":[[[1280,1220],[1240,1270],[1230,1330]],[[1280,1220],[1320,1260],[1320,1320]]],
   "deep":{"cx":1300,"cy":420,"surface":40,"note":"cavern lake at the foot of the Throat, under the skylight shaft; the underground river leaves it east through the Sea Passage to the sea"},
   "spring":{"xy":[1250,1180],"note":"a decorative spring at the Reach; not the Deep's outflow"},
   "dam":{"xy":[1140,905],"facing":"south (toward the square)","crestLength":44,"instrument":"L01 at [1172,912]"}
 },
 "hostRule":"footprint_m is the building's plan (w × d, concept metres, scales); roofH_eu is ridge height above its ground in engine units (does not scale)",
 "hosts":[
   {"id":"home","footprint_m":[22,16],"roofH_eu":9,"label":"Our home","placeIds":["kitchen","tower","cellar","atlas"],"xy":[1505,1165],"h":14,"door":"west, onto the square; the kitchen window looks north-west at the dam","arrival":"square (walk); upper street spur (wheels)"},
   {"id":"bank","footprint_m":[26,18],"roofH_eu":10,"label":"The Fund bank","placeIds":["bank"],"xy":[1440,1125],"h":16,"door":"south, onto the square (the bank stands on the square's north side)"},
   {"id":"library","footprint_m":[42,30],"roofH_eu":14,"label":"The Library","placeIds":["library"],"xy":[740,400],"h":48,"door":"south-east, onto the reading courtyard","arrival":"garden walk; Green Road north pass spur"},
   {"id":"glasshouse","footprint_m":[30,18],"roofH_eu":9,"label":"The Glasshouse","placeIds":["glasshouse"],"xy":[1010,790],"h":56,"door":"south, onto the Glasshouse steps down to the Green (ramp twin); faces Stillwater across the terrace","arrival":"garden walk; Green Road spur"},
   {"id":"studio","footprint_m":[24,16],"roofH_eu":8,"label":"The Pottery Studio","placeIds":["kiln"],"xy":[1020,540],"h":40,"door":"west, onto the studio terrace; the Adit is 70 m east along the terrace"},
   {"id":"cottage","footprint_m":[18,14],"roofH_eu":7,"label":"Hercules's cottage","placeIds":["cottage"],"xy":[920,620],"h":36,"door":"south, into the orchard"},
   {"id":"boathouse","footprint_m":[20,14],"roofH_eu":7,"label":"The Boathouse","placeIds":["boathouse"],"xy":[1285,1315],"h":3,"door":"east, onto its dock on the harbour's west bank beside the Landing quay; the floatplane dock is the town's, not this one"}
 ],
 "places":[
   {"id":"court","label":"Queen's Court (the square)","xy":[1455,1175],"h":12},
   {"id":"campfire","label":"Campfire","xy":[1200,1430],"h":2},
   {"id":"L01","label":"Fund instrument (beside the dam)","xy":[1172,912],"h":52,"reads":"BasinReading only"},
   {"id":"L02","label":"Summit lookout, observatory, the bell","xy":[1310,470],"h":158}
 ],
 "profileRule":"widths and lengths of routes scale with scale.factor (they are concept metres); clearances, gauges, rises and anything sized to the body or a vehicle are engine units and never scale",
 "profiles":{
   "road":{"surface_m":8,"shoulder_m":1,"clear_m":5,"grade_typ_pct":[4,6],"grade_review_pct":8,"grade_max_pct":12,"exception":"the Prow cliff drive may hold 13 % for ≤ 150 m with a passing place","kerb":True,"parapet_on_drop":True},
   "spur":{"surface_m":5,"clear_m":4},
   "trail":{"surface_m":2.5,"material":"gravel","modes":["feet","bicycle"]},
   "walk":{"surface_m":[2,2.5],"modes":["feet"]},
   "walkable":{"slope_max_deg":38,"lip_step_max_eu":0.5,"note":"the body cannot climb steeper than 38°; a lip above 0.5 eu is an edge, not a step"},
   "skateMain":{"surface_m":[3,4],"bank_deg_max":30,"runout_m":25,"grade_typ_pct":[8,14],"grade_max_pct":18,"note":"grades apply to the bed after the land pass solves it; S1 averages ~15 % with real gravity"},
   "skatePocket":{"surface_m":[5,6]},
   "boardwalk":{"surface_m":3,"onPiles":True,"pace":"flow"},
   "stair":{"width_m":3,"rise_m":0.17,"twin":"ramp ≤ 8 % or path"},
   "rail":{"gauge_m":0.9,"tunnel_clear_m":3.2},
   "cable":{"clear_eu":8,"towerSpacing_m":[120,200],"note":"clear_eu never scales; spacing is concept metres"},
   "cave":{"clear_m":[6,30],"throatMouth_m":[26,18]}
 },
 "surfaces":{
   "paved":{"pace":"fast","footstep":"stone"},
   "packedEarth":{"pace":"fast","footstep":"earth"},
   "apron":{"pace":"flow","footstep":"concrete","note":"the dam's spillway apron"},
   "bankedTurf":{"pace":"flow","footstep":"grass"},
   "boardwalk":{"pace":"flow","footstep":"plank"},
   "cobble":{"pace":"slow","footstep":"cobble"},
   "gravel":{"pace":"slow","footstep":"gravel"},
   "sand":{"pace":"slow","footstep":"sand","prints":True},
   "plaza":{"pace":"threshold","footstep":"stone"},
   "duff":{"pace":"n/a","footstep":"needles"},
   "ochre":{"pace":"fast","footstep":"dust"},
   "snow":{"pace":"slow","footstep":"snow","season":"Dec–Mar"},
   "ice":{"pace":"skate","footstep":"ice","season":"Jan–Feb","where":"stillwater"}
 },
 "roads":{
   "V01":{"label":"Horizon Drive","pts":V01,"closed":True,"profile":"road","length_m":length(V01,True),"structures":["prowTunnel","quayBridge","bightBridge"]},
   "VG":{"label":"Green Road","pts":VG,"profile":"road","length_m":length(VG),"structures":["highSpan","hollowBridge"]},
   "V02":{"label":"Crown Road","pts":V02,"profile":"road","length_m":length(V02),"structures":["shoulderTunnel"],"end":"turning circle at [1370,690]"},
   "VBS":{"label":"Bight Shore spur","pts":VBS,"profile":"spur","length_m":length(VBS)},
   "spurs":{"upperStreet":[[1480,1040],[1480,1060]],"library":[[900,290],[760,360]],"glasshouse":[[960,860],[1000,830]],"studio":[[974,540],[1000,540]],"cottage":[[980,700],[930,650]],"boathouse":[[1300,1380],[1290,1345]]}
 },
 "skate":{
   "S1":{"label":"Summit to Sea","pts":S1,"profile":"skateMain","length_m":length(S1),"segments":[
     {"name":"Crown drop","pace":"fast","surface":"paved","spot":"parapets"},
     {"name":"Shoulder sweep","pace":"flow","surface":"bankedTurf","spot":"rock lip (optional jump)"},
     {"name":"Dam apron","pace":"flow","surface":"apron","spot":"half-pipe wall ride; level line beside"},
     {"name":"Notch shelf","pace":"fast","surface":"paved","spot":"shelf rail grind under the High Span"},
     {"name":"Reach boardwalk","pace":"slow","surface":"cobble","spot":"reed chicane"},
     {"name":"Quay finish","pace":"fast","surface":"paved","spot":"bollards; 25 m run-out"}],
     "gates":17,"finish":[1270,1330],"time_target_s":[70,130],"steep":"the Shoulder sweep is drawn with one switchback; the land pass may add a second to hold grade_max"},
   "S2":{"label":"The Wash Run","pts":S2,"profile":"skateMain","length_m":length(S2),"segments":[
     {"name":"Strip rim","pace":"fast","surface":"ochre"},
     {"name":"The Wash bowl","pace":"flow","surface":"ochre","spot":"bowl walls both sides; hip at the bend; centre [465,700]"},
     {"name":"Bight Bridge","pace":"flow","surface":"boardwalk","spot":"full-length rail"},
     {"name":"Landing road","pace":"slow","surface":"gravel","spot":"dune-ridge hip into the park"}]},
   "S3":{"label":"Town Weave","pts":S3,"profile":"skateMain","length_m":length(S3),"segments":[
     {"name":"Upper street","pace":"fast","surface":"paved"},
     {"name":"Market stair","pace":"flow","surface":"paved","spot":"three flights, a rail each; ramp = ground line"},
     {"name":"The square","pace":"threshold","surface":"plaza","spot":"park, or the cobbled edge lane"},
     {"name":"The quay","pace":"fast","surface":"paved","spot":"lantern posts, bollards"},
     {"name":"Long Sands boardwalk","pace":"flow","surface":"boardwalk","spot":"kicker at each beach stair"}]},
   "S4":{"label":"Hollow Line","pts":S4,"profile":"skateMain","length_m":length(S4),"segments":[
     {"name":"Studio terrace","pace":"flow","surface":"packedEarth","spot":"kiln retaining wall grind"},
     {"name":"Orchard wall","pace":"slow","surface":"cobble","spot":"stone wall gap; covered-bridge rail"},
     {"name":"The Green","pace":"fast","surface":"packedEarth","spot":"fallen-log kickers"},
     {"name":"Dune ridge","pace":"flow","surface":"bankedTurf","spot":"last bank onto sand"}]},
   "park":{"label":"Tideline park","xy":[1020,1430],"size":[60,32],"note":"Skate v2 park, travel assist on; no race"},
   "rules":["no required jumps","ground alternative for every spot","run-out before every door","board never past a threshold"]
 },
 "walks":{k:{"pts":v,"profile":("trail" if k in ("prow","bight","flats","dune","lakerim") else "walk"),"length_m":length(v)} for k,v in W.items()},
 "cable":{
   "G1":{"label":"Gondola","from":[1480,1090],"to":[1360,560],"fromH":18,"toH":112,"towers":[[1450,958],[1420,825],[1390,693]],"towerNote":"three towers at ~150 m spacing; heights solved in pass 1 so the cable clears terrain (the Shoulder band from [1425,848]) by profiles.cable.clear_m and passes ≥ 12 m over plot.terraces.*","clear_eu":8,"length_m":length([[1480,1090],[1360,560]]),"speed":speeds["gondola"],"note":"upper street → Crown station, straight up the south-east face; town falls away, then the whole island; the Crown walk continues from the station to the summit"},
   "ZIP":{"label":"Zipline","from":[1610,640],"to":[1130,1440],"fromH":100,"toH":12,"sag_pct":1,"length_m":length([[1610,640],[1130,1440]]),"speed":speeds["zip"],"minClearAboveRoof_eu":12,"note":"the Prow tower (30 m tower, deck at h 100) → Long Sands 44 m inland, skirting the town's west edge over the Reach; at 1 % sag it overflies no roof, clears V01 by 9 m, S1 by 23 m, the Reach walk by 26 m, and crosses above the gondola cable at [1442,921] with 10.7 m between cables"}
 },
 "rail":{"ORE":{"label":"Ore Line","pts":ore,"profile":"rail","length_m":length(ore),"stations":["the Adit [1090,540] h40","the South Portal [1345,680] h110 (29 m from Crown Road's turning circle)"],"drop":{"at":[1270,450],"fall_m":28,"siding":True},"splash":"the Deep [1300,420]","note":"climbs after the Deep inside the rock, leaves the footprint at [1398,576] and runs a 119 m tunnel to the South Portal"}},
 "water_routes":{
   "FERRY":{"label":"The Ferry","pts":ferry,"closed":False,"note":"clockwise (north up: west along Long Sands, in and out of the Bight under the bridge, round the Lamp and the Wreck, up the west, along the north, down the Prow, home); doubles back at the Bight pier","length_m":length(ferry),"piers":{"landing":[1470,1340],"bight":[560,890],"flats":[285,720],"scholarsCove":[630,235],"seaDoor":[1705,775]},"slowsAt":["the Wreck [250,1150] (no stop)"],"headway_s":370,"hulls":2,"boarding":"walk the gangway (the deliberate action); the Ferry waits 20 s at each pier"},
   "ROW":{"label":"Rowboat / canoe / dinghy water","area":"the Bight, the harbour, the coast to the Sea Door, the river below the Notch, the Deep","docks":["boathouse [1320,1320]","bight pier [560,890]","lamp [540,1250]","bightShore jetty [735,955]","seaDoor jetty [1705,775]","deep jetty [1300,440]"],"range":"the Wreck is reached only by Ferry (it slows there)"},
   "RIVER_RUN":{"label":"River Run (canoe)","pts":[[1160,740]]+river_lower,"gates":9,"note":"starts at the lake inlet [1160,740] (the Cup's outflow is a 62 % cascade, scenery only) → lake → dam portage → Notch → Reach → harbour"},
   "DEEP_RUN":{"label":"Deep Run (canoe)","from":"the Deep [1300,420]","to":"the Sea Door [1690,770]","pts":[[1300,420],[1380,470],[1470,540],[1560,640],[1620,720],[1690,770]],"length_m":length([[1300,420],[1380,470],[1470,540],[1560,640],[1620,720],[1690,770]]),"drop":"the Steps: 3 × 12 m chutes in the first 120 m; then level to the sea","note":"the underground river through the Sea Passage; out under the Prow into daylight, then paddle round to the Landing"}
 },
 "structures":{
   "highSpan":{"xy":[1240,1105],"kind":"bridge","deck":"VG road","h_deck":24,"shelf":"S1 skate shelf on the west wall, h 12","water":"Reach walk at river level, h 9","gate":"Ring Run gate 3 under the deck at h 16","riverbed_h":8},
   "quayBridge":{"xy":[1350,1345],"kind":"bridge","deck":"V01 + S3 separated lane","h_deck":9,"under":"river mouth, rowboat clearance 4 m"},
   "apronBridge":{"xy":[1158,949],"kind":"bridge","deck":"S1","under":"the tailrace below the dam and the River Run"},
   "bightBridge":{"xy":[560,1100],"kind":"bridge","deck":"V01 + S2 separated lane with a full-length rail","span_m":230,"h_deck":12,"clear_m":8,"under":"the Ferry (twice per lap), Ring Run gate 5"},
   "hollowBridge":{"xy":[893,600],"kind":"coveredFootbridge","deck":"garden walk + S4 (separated lane)","under":"Orchard Brook","note":"a covered footbridge, not on Green Road; the ninth disc-golf basket; S4 rail if you dare"},
   "prowTunnel":{"xy":[1600,780],"kind":"tunnel","length_m":90},
   "shoulderTunnel":{"xy":[1445,480],"kind":"tunnel","length_m":110},
   "dam":{"xy":[1140,905],"kind":"dam","face":"south","spillwayArch":"Ring Run gate 4","apron":"S1 half-pipe","crest":"walk with plaques","gallery":"stair in the east abutment from the apron to the crest, past the plaques (does not enter the Undercroft)"},
   "gondolaStations":{"base":[1480,1090],"crownStation":[1360,560]},
   "inletFootbridge":{"xy":[1161,731],"kind":"footbridge","deck":"lake rim walk","under":"the upper river at the lake inlet"},
   "reachFootbridge":{"xy":[1274,1203],"kind":"footbridge on piles","deck":"Reach walk","under":"the river"},
   "duneCulvert":{"xy":[1005,1375],"kind":"underpass","deck":"V01 (Long Sands road)","under":"S4, 3 m clear","note":"a dune tunnel; the last surprise before the sand"},
   "southPortal":{"xy":[1345,680],"kind":"tunnel portal","note":"Ore Line top station, 29 m from the turning circle, 20 m from the Crown walk"},
   "zipPlatforms":{"top":[1610,640],"topH":100,"topNote":"deck of a 30 m tower at the Prow; the glider launch is the same deck","landing":[1130,1440],"landingH":12,"landingNote":"a landing tower on the dune crest, deck 8 m above the Town Weave boardwalk which passes beneath it; a stair and a ramp down to the sand"},
   "oreStations":[[1090,540],[1345,680]],
   "strip":{"from":[425,520],"to":[445,860],"width_m":30,"hangar":[455,600],"windsock":[440,500],"balloonMooring":[520,470],"runwayLamps":True},
   "floatplaneDock":[1520,1275],
   "jetties":{"bightShore":[735,955],"deep":[1300,440],"lamp":[540,1250],"seaDoor":[1705,775],"boathouse":[1320,1320]},
   "landingQuay":{"xy":[1270,1330],"note":"the race finish on the islet between the Reach's west channel and the river; 25 m run-out along the bank; kerb-separated from V01 which passes 45 m south; the Boathouse dock is across the west channel by the Reach boardwalk"},
   "townQuay":{"from":[1420,1335],"to":[1497,1265],"note":"Lantern Row, 8 m inside the waterline; pedestrian; the floatplane dock at its east end"}
 },
 "underground":{
   "doors":{"adit":{"xy":[1090,540],"h":40,"mode":"feet, cart"},"throat":{"xy":[1300,300],"h":110,"mode":"glider only","mouth_m":[26,18],"note":"a diving entry: 139 m of sloping throat at 30° down to the Deep at h 40; flare over the water"},"seaDoor":{"xy":[1690,770],"h":0,"mode":"boat","jetty":[1705,775],"passage":"the Sea Passage: a 504 m boat tunnel from the Deep to the sea, glow-worm lit, with the Steps (three 12 m chute drops in the first 120 m; the Deep Run rides them down like a flume; reduced motion cuts them). Upstream travel: boats tie up at the foot of the Steps [1420,505] and a portage stair (threshold stepsFoot) climbs beside the chutes to the Deep's jetty; nobody paddles up. The Sea Door pier has a cliff stair (the Sea Stair) up to the Prow walk, and the Ferry as its step-free way back"},"southPortal":{"xy":[1345,680],"h":110,"mode":"feet, cart","note":"the Ore Line's top; a walk-in door too"}},
   "footprint":{"cx":1300,"cy":470,"rx":170,"ry":130,"note":"all rooms inside; doors on its rim or reached by a listed tunnel"},
   "rooms":{"lanternCave":{"xy":[1220,480],"h":42},"deep":{"xy":[1300,420],"h":40,"water":True,"skylight":{"to":[1300,400],"topH":138,"shaft_m":98,"note":"opens on the north slope; sun shaft when the sun is above 20°"}},"bellGallery":{"xy":[1310,470],"h":90,"note":"directly under the summit; the bell rope is 68 m"},"sealedDrift":{"xy":[1180,500],"reserve":"plot.under.1"}},
   "damGallery":{"xy":[1165,895],"note":"a stair inside the dam's east abutment from the apron to the crest past the plaques; it does NOT enter the Undercroft"},
   "light":"glow-worms (cool), found lanterns (warm), skylight (sun/moon)"
 },
 "sky":{
   "ceiling_m":300,
   "launches":{"crown":{"xy":[1310,440],"h":160},"prow":{"xy":[1610,640],"h":100,"note":"the zip tower's deck"},"lampGallery":{"xy":[540,1195],"h":25},"plane":"anywhere under the ceiling"},
   "lift":{"thermals":[{"xy":[380,600],"r":150,"hours":[12,18],"note":"the Flats' ochre"},{"xy":[1610,850],"r":120,"hours":[8,18],"note":"the Prow face"}],"ridge":{"along":"the Crown's south face","wind":"south"},"sink":[{"xy":[600,760],"r":200,"note":"the Bight"},{"xy":[1210,1010],"r":90,"note":"the Notch"}]},
   "landings":{"green":{"xy":[1040,1065],"r":60,"target":True,"note":"the Drop Zone target is ground paint inside the protected centre; S4 passes 60 m west"},"reachMeadow":{"xy":[1230,1190],"r":40},"sands":{"xy":[1050,1440],"r":60},"strip":"see structures.strip","water":["harbour","bight"],"deep":"via the Throat, glider only"},
   "gates":[
     {"n":1,"id":"needle","xy":[1790,680],"h":14,"aperture_m":[22,16],"note":"the Needle's Eye; sunrise gate"},
     {"n":2,"id":"stacks","xy":[1780,905],"h":12},
     {"n":3,"id":"highSpan","xy":[1240,1095],"h":16,"aperture_m":[40,14],"note":"under the deck (deck h 24, riverbed h 8)"},
     {"n":4,"id":"damArch","xy":[1140,925],"h":45,"note":"the spillway arch"},
     {"n":5,"id":"bightBridge","xy":[560,1080],"h":6,"note":"under the deck"},
     {"n":6,"id":"lamp","xy":[540,1260],"h":20,"note":"round the lighthouse"},
     {"n":7,"id":"wreck","xy":[250,1150],"h":15},
     {"n":8,"id":"flatsRim","xy":[330,700],"h":60},
     {"n":9,"id":"scholarsCove","xy":[640,280],"h":40},
     {"n":10,"id":"northFace","xy":[1300,200],"h":130},
     {"n":11,"id":"crown","xy":[1310,470],"h":190,"note":"over the summit"},
     {"n":12,"id":"throat","xy":[1300,300],"h":110,"aperture_m":[26,18],"note":"into the mountain; glider only"}
   ],
   "plane":{"speed_ms":speeds["plane"],"stall_ms":18,"floats":True,"wheels":True,"swapAt":"hangar","oneButtonRing":True,"cannot":["enter the Throat","land on a neighbourhood","collide with a person"]},
   "glider":{"speed_ms":speeds["glider"],"sink_ms":1.2,"flare":True},
   "balloon":{"xy":[520,470],"mooringH":40,"tether_m":250,"note":"the Look camera made physical; you ride it up and back down, there is no stepping out at the top"},
   "courses":{"ringRun":{"mode":"plane","gates":[1,2,3,4,5,6,7,8,9,10,11],"note":"the tour, in order"},"damRun":{"mode":"glider","launch":"crown","gates":[4,3],"land":"reach meadow [1230,1190]","note":"514 m to the arch with 115 m of height in hand at a 9:1 glide; the Reach meadow is 130 m past the High Span"},"throatRun":{"mode":"glider","launch":"crown","gates":[10,12],"land":"deep","note":"out over the north sea, turn, dive in"},"lampHop":{"mode":"glider","launch":"lampGallery","gates":[5],"land":"the Bight water beside the sandbar (fade to the sandbar)","note":"the short one"}},
   "rules":["no collisions with people: pass through + gust","reduced motion: cuts between the twelve pages","nothing in the sky reads a balance"]
 },
 "reserves":{
   "rotRule":"rot_deg is the bearing of the 64 m axis, degrees clockwise from +x (east) with y south",
   "terraces":{"plots":[[1552,832],[1528,896],[1512,952],[1596,994]],"rot_deg":[-67,23,23,-67],"size_m":[64,44],"placeIds":["plot.terraces.1","plot.terraces.2","plot.terraces.3","plot.terraces.4"],"served":"plots 1–3 uphill (west) of the Prow cliff drive between [1600,860] and [1540,1000] with a lay-by each; plot 4 is on the seaward side (D12 question: only three fit uphill once the gondola and the zip are cleared); the Prow walk above; the town below"},
   "bightShore":{"plots":[[836,907],[771,973],[729,1032],[705,1107]],"rot_deg":[39,45,24,11],"size_m":[64,44],"spacing_m":"≥ 62 (centres), ≥ 17.5 edge to edge","placeIds":["plot.bight.1","plot.bight.2","plot.bight.3","plot.bight.4"],"served":"VBS spur; jetty [735,955]; all four outside protected.green (r 160)"},
   "small":{"sealedDrift":{"xy":[1180,500],"placeId":"plot.under.1"},"hangarBay":{"xy":[455,600],"placeId":"plot.flats.1"}},
   "plotRule":"1.5 × Library footprint + 6 m clear; graded, walled, served, reserved placeId; no lantern spot inside; no view depends on it being empty"
 },
 "neighbourhoods":[
   {"id":"harbour","label":"Little Harbour","centre":[1470,1180],"r":120,"hosts":["home","bank"],"places":["court"],"porch":"the square's edge facing the dam; the quay wall at night"},
   {"id":"hollow","label":"The Hollow","centre":[970,590],"r":100,"hosts":["studio","cottage"],"porch":"picnic table under the apples by the covered bridge"},
   {"id":"scholars","label":"Scholars' Edge","centre":[760,420],"r":110,"hosts":["library"],"porch":"the reading courtyard facing the Bight"},
   {"id":"flats","label":"The Flats","centre":[440,680],"r":150,"hosts":[],"porch":"the hangar's bench"},
   {"id":"landing","label":"The Landing & Long Sands","centre":[1170,1380],"r":200,"hosts":["boathouse"],"places":["campfire"],"porch":"the Boathouse dock; the log ring"},
   {"id":"lakeside","label":"Lakeside","centre":[1130,830],"r":130,"hosts":["glasshouse"],"places":["L01"],"porch":"the dam crest"},
   {"id":"crown","label":"The Crown & the Undercroft","centre":[1310,500],"r":150,"hosts":[],"places":["L02"],"porch":"the lookout wall; the Deep's jetty"}
 ],
 "viewRule":"each pose: xy is the eye position on the ground; eye height 1.6 eu above ground unless eyeH given; target is the look-at point; fov_deg horizontal at 16:9 (the Sketchbook lens; STYLE's 42°/52° lenses are the walking and ride cameras); radius_eu is the acceptance streaming radius; pageTrigger_eu is how close the player must stand (and face within 25°) for the page to draw",
 "pageTrigger_eu":6,
 "views":[
   {"id":"A","target":[1200,700],"fov_deg":55,"radius_eu":220,"label":"The square, looking north-west","xy":[1455,1200],"frames":"the Reach, the High Span, the dam's glass face, the Crown behind","bestHour":"golden hour","also":"noon"},
   {"id":"B","target":[900,700],"fov_deg":55,"radius_eu":220,"label":"The Lamp gallery","xy":[540,1195],"frames":"the Bight Bridge, the Flats, the whole hook","bestHour":"sunset","also":"noon"},
   {"id":"C","target":[1240,1105],"fov_deg":55,"radius_eu":220,"label":"High Span, three speeds","xy":[1245,1125],"frames":"road above, shelf within, water beside","bestHour":"morning","also":"night"},
   {"id":"D","target":[540,1230],"fov_deg":55,"radius_eu":220,"label":"Long Sands","xy":[900,1470],"frames":"surf, the Lamp, the zipline landing, a bench","bestHour":"afternoon","also":"night"},
   {"id":"E","target":[1000,1000],"fov_deg":55,"radius_eu":220,"label":"The Crown","xy":[1310,430],"frames":"everything, small, and the sea all round","bestHour":"noon","also":"night"},
   {"id":"F","target":[1450,1180],"fov_deg":55,"radius_eu":220,"label":"Dam crest","xy":[1150,905],"frames":"the plaques, L01, the lake behind, the town below","bestHour":"morning","also":"dusk"},
   {"id":"G","target":[1300,300],"fov_deg":55,"radius_eu":220,"label":"The Deep, looking up the Throat","xy":[1300,440],"frames":"from the Deep's jetty north up the Throat to its mouth of daylight, the skylight shaft overhead, a glider flaring onto the water","bestHour":"noon (sun shaft)","also":"night (moon shaft)"},
   {"id":"H","target":[435,690],"fov_deg":55,"radius_eu":220,"label":"The Flats at sunset","xy":[330,800],"frames":"the strip, the windsock, the balloon, the west sea","bestHour":"sunset","also":"dawn"},
   {"id":"I","target":[1280,1150],"fov_deg":55,"radius_eu":220,"label":"Reach boardwalk","xy":[1270,1240],"frames":"reeds at hand height, the spring, the heron","bestHour":"morning","also":"dusk"},
   {"id":"J","target":[1790,680],"fov_deg":55,"radius_eu":220,"eyeH":60,"label":"The Needle's Eye, from the plane","xy":[1790,720],"frames":"the arch under the wing, the Stacks, the Prow","bestHour":"dawn","also":"noon"},
   {"id":"K","target":[1130,820],"fov_deg":55,"radius_eu":220,"label":"The Glasshouse at dusk","xy":[990,810],"frames":"lit from inside, seed pots in silhouette, Stillwater beyond","bestHour":"dusk","also":"noon"},
   {"id":"L","target":[1285,1315],"fov_deg":55,"radius_eu":220,"label":"The quay at night","xy":[1430,1290],"frames":"Lantern Row lit, the floatplane rocking, the Boathouse across the water","bestHour":"night","also":"dawn"}
 ],
 "crossings":[
   {"a":"VG","b":"river lower","at":[1240,1105],"resolution":"over","structure":"highSpan"},
   {"a":"S1","b":"VG","at":[1204,1098],"resolution":"under","structure":"highSpan (shelf, west wall)"},
   {"a":"walk reach","b":"VG","at":[1240,1110],"resolution":"under","structure":"highSpan (water level)"},
   {"a":"walk reach","b":"river lower","at":[1274,1203],"resolution":"over","structure":"reachFootbridge"},
   {"a":"walk lakerim","b":"river upper","at":[1161,731],"resolution":"over","structure":"inletFootbridge"},
   {"a":"walk garden","b":"brook","at":[893,600],"resolution":"over","structure":"hollowBridge"},
   {"a":"S4","b":"brook","at":[893,600],"resolution":"over","structure":"hollowBridge (separated lane; the rail)"},
   {"a":"S4","b":"walk garden","at":[893,600],"resolution":"threshold","note":"the covered bridge is shared: boards to the rail side at walking pace"},
   {"a":"V01","b":"river mouth","at":[1350,1345],"resolution":"over","structure":"quayBridge"},
   {"a":"S3","b":"river mouth","at":[1350,1345],"resolution":"over","structure":"quayBridge (separated lane)"},
   {"a":"S1","b":"Reach west channel","at":[1255,1251],"resolution":"over","structure":"Reach boardwalk on piles; the finish sits on the islet between the west channel and the river"},
   {"a":"S1 finish","b":"V01","at":[1270,1330],"resolution":"threshold","note":"kerb-separated; the run-out ends 20 m before the Long Sands road"},
   {"a":"V01+S2","b":"Bight mouth","at":[560,1100],"resolution":"over","structure":"bightBridge"},
   {"a":"S2","b":"V01","at":"[460,1030] to [660,1170] and the Wash to the bridge","resolution":"over","note":"S2 rides a separated lane 4 m from the carriageway with a kerb, then the bridge's rail-side lane; never the shoulder"},
   {"a":"S2","b":"V01","at":[660,1170],"resolution":"threshold","note":"after the bridge S2 leaves the road at a dismount marker onto its own bed 18–45 m from the carriageway"},
   {"a":"S2","b":"water wash","at":"[465,700] to [485,800]","resolution":"threshold","note":"S2 shares the dry Wash bed; on almanac drizzle days the bowl is wet and the line closes at a marker for six hours"},
   {"a":"S4","b":"VBS","at":[874,941],"resolution":"threshold","note":"at grade: dismount marker + kerb gap"},
   {"a":"S4","b":"VG","at":[973,538],"resolution":"threshold","note":"at grade at the studio terrace: dismount marker + kerb gap"},
   {"a":"VG","b":"walk garden","at":[974,748],"resolution":"threshold"},
   {"a":"V01","b":"walk reach","at":[1367,1271],"resolution":"threshold"},
   {"a":"S3","b":"town quay","at":[1453,1277],"resolution":"threshold","note":"quayWest: park here; Lantern Row is pedestrian"},
   {"a":"DEEP_RUN","b":"V01","at":[1574,658],"resolution":"under","note":"the Sea Passage runs 60+ m below the coast drive"},
   {"a":"DEEP_RUN","b":"V02","at":[1445,520],"resolution":"under","note":"the Sea Passage passes ≥ 40 m beneath Crown Road and its tunnel"},
   {"a":"S4 × VBS threshold","b":"district","at":[874,941],"resolution":"n/a","note":"belongs to district green (Lakeside) unless pass 1 draws the bight district over it"},
   {"a":"DEEP_RUN","b":"walk prow","at":[1605,700],"resolution":"under"},
   {"a":"S4","b":"V01","at":[1005,1375],"resolution":"under","structure":"duneCulvert"},
   {"a":"S3","b":"walk dune","at":"none","resolution":"over","note":"S3's boardwalk runs the dune crest; the dune walk runs the beach foot 30 m south; they never meet"},
   {"a":"S3","b":"V01","at":[1480,1050],"resolution":"threshold","note":"the upper-street spur end is the board pick-up"},
   {"a":"S1","b":"walk lakerim","at":[1160,935],"resolution":"threshold","note":"dam apron: boards on the apron; walkers on the crest above"},
   {"a":"S1","b":"river lower","at":[1158,949],"resolution":"over","structure":"apronBridge"},
   {"a":"ZIP","b":"town","at":"overhead","resolution":"over","note":"≥ 12 m above every roof, sag included; the line skirts the town's west edge"},
   {"a":"ZIP","b":"G1","at":[1442,921],"resolution":"over","note":"zip 10.7 m above the gondola chord at 1 % sag"},
   {"a":"ZIP","b":"V01","at":[1157,1394],"resolution":"over","note":"≥ 9 m clear over the Long Sands road"},
   {"a":"ZIP","b":"VG","at":[1343,1084],"resolution":"over","note":"≈ 24 m clear over Green Road"},
   {"a":"ZIP","b":"S3","at":[1133,1435],"resolution":"over","structure":"landing tower deck 8 m above the boardwalk"},
   {"a":"V01","b":"walk bightPier","at":[407,894],"resolution":"threshold"},
   {"a":"V01","b":"walk coveWalk","at":[686,313],"resolution":"threshold"},
   {"a":"S2","b":"walk bightPier","at":[509,896],"resolution":"threshold","note":"the pier walk crosses the Wash Run bed at a marked gap"},
   {"a":"walk bightPier","b":"water wash","at":[514,895],"resolution":"over","structure":"a plank footbridge at the Wash mouth"},
   {"a":"walk crown","b":"ORE","at":[1356,659],"resolution":"over","note":"the Ore Line is in its tunnel here"},
   {"a":"G1","b":"ORE","at":[1375,625],"resolution":"over","note":"cable above, rail in its tunnel"},
   {"a":"S4","b":"spur studio","at":[974,540],"resolution":"threshold","note":"S4 starts at the studio terrace; the spur ends there"},
   {"a":"G1","b":"V01","at":[1469,1043],"resolution":"over","structure":"cable clear ≥ 8 m; tower 1 beside the road"},
   {"a":"G1","b":"Crown Road","at":[1385,655],"resolution":"over","structure":"cable clear ≥ 8 m"},
   {"a":"ORE","b":"Crown Road","at":"none","resolution":"n/a","note":"the South Portal [1345,680] is 29 m from the turning circle; a path links them"},
   {"a":"V02","b":"walk crown","at":[1370,690],"resolution":"threshold","note":"turning circle is the wheels' end; the Crown walk begins"},
   {"a":"FERRY","b":"bightBridge","at":[560,1100],"resolution":"under","note":"twice per lap"},
   {"a":"DEEP_RUN","b":"ORE","at":"none","resolution":"n/a","note":"the Sea Passage leaves the Deep east; the rail leaves north-east and climbs; separated by 20 m of rock"},
   {"a":"plane","b":"everything","at":"sky","resolution":"over","note":"ceiling 300 m; no landing on a neighbourhood"}
 ],
 "thresholds":[
   {"id":"stairTop","xy":[1480,1150],"modes":["board→feet"],"action":"park"},
   {"id":"quayWest","xy":[1453,1277],"modes":["board→feet"],"action":"park (Lantern Row is pedestrian)"},
   {"id":"upperStreetSpur","xy":[1480,1060],"modes":["wheels→feet"],"action":"park"},
   {"id":"gondolaBase","xy":[1480,1090],"modes":["feet→cable"],"action":"board by offer"},
   {"id":"adit","xy":[1090,540],"modes":["feet→cart"],"action":"sit, lever"},
   {"id":"prowPlatform","xy":[1610,640],"modes":["feet→zip","feet→glider"],"action":"clip in / run off"},
   {"id":"crownLaunch","xy":[1310,440],"modes":["feet→glider"],"action":"run off"},
   {"id":"strip","xy":[435,690],"modes":["feet→plane"],"action":"climb in"},
   {"id":"floatDock","xy":[1520,1275],"modes":["feet→plane"],"action":"climb in"},
   {"id":"balloon","xy":[520,470],"modes":["feet→balloon"],"action":"step in"},
   {"id":"boathouseDock","xy":[1320,1320],"modes":["feet→boat"],"action":"untie"},
   {"id":"ferryPiers","xy":"see water_routes.FERRY.piers","modes":["feet→ferry"],"action":"walk the gangway (the offer appears by proximity)"},
   {"id":"skateLineStarts","xy":[[1310,500],[480,480],[1480,1060],[1000,520]],"modes":["feet→board"],"action":"pick up"},
   {"id":"landingQuay","xy":[1270,1330],"modes":["board→feet"],"action":"park (race run-out)"},
   {"id":"gondolaTop","xy":[1360,560],"modes":["cable→feet"],"action":"step off onto the platform"},
   {"id":"southPortal","xy":[1345,680],"modes":["cart→feet"],"action":"climb out"},
   {"id":"zipLanding","xy":[1130,1440],"modes":["zip→feet"],"action":"unclip on the landing tower; stair or ramp to the sand"},
   {"id":"lampGallery","xy":[540,1195],"modes":["feet→glider"],"action":"run off the gallery"},
   {"id":"deepJetty","xy":[1300,440],"modes":["glider→feet","boat→feet"],"action":"flare onto the water, swim to the jetty (fade)"},
   {"id":"seaDoorJetty","xy":[1705,775],"modes":["boat→feet","ferry→feet"],"action":"tie up / gangway"},
   {"id":"damPortage","xy":[1150,910],"modes":["canoe→feet→canoe"],"action":"carry the canoe down the portage steps beside the apron"},
   {"id":"bightShoreJetty","xy":[735,955],"modes":["boat→feet"],"action":"tie up"},
   {"id":"lampDock","xy":[540,1250],"modes":["boat→feet"],"action":"tie up"},
   {"id":"stepsFoot","xy":[1420,505],"modes":["boat→feet"],"action":"tie up at the foot of the Steps; portage stair to the Deep"}
 ],
 "journeys":{
   "note":"straight-segment lengths between control points at assumed speeds; calibration targets, not promises",
   "square→library by bicycle":{"length_m":length([[1480,1060],[1400,1060],[1330,1090],[1240,1105],[1000,1000],[960,860],[980,700],[1000,600],[1020,460],[1000,330],[900,290],[760,360]]),"mode":"bicycle"},
   "square→summit by gondola + walk":{"legs":[{"length_m":length([[1455,1175],[1490,1130],[1480,1060],[1480,1090]]),"mode":"walk"},{"length_m":length([[1480,1090],[1360,560]]),"mode":"gondola"},{"length_m":length([[1360,560],[1330,520],[1310,500]]),"mode":"walk"}],"note":"time = sum of legs"},
   "crown→quay on the board (S1)":{"length_m":length(S1),"mode":"board"},
   "crown→lamp by glider":{"length_m":length([[1310,440],[540,1230]]),"mode":"glider"},
   "ring by plane":{"length_m":length(V01,True),"mode":"plane"},
   "ring by bicycle":{"length_m":length(V01,True),"mode":"bicycle"},
   "square→green on foot":{"length_m":length([[1455,1175],[1400,1060],[1330,1090],[1240,1105],[1120,1080],[1000,1000]]),"mode":"walk"},
   "square→boathouse on foot":{"length_m":length([[1455,1175],[1420,1265],[1350,1345],[1285,1315]]),"mode":"walk"},
   "adit→south portal by cart":{"length_m":length(ore),"mode":"cart"},
   "prow→sands by zip":{"length_m":length([[1610,640],[1130,1440]]),"mode":"zip"}
 },
 "speeds_ms":speeds,
 "pastimeData":{
   "nineBaskets":[[1189,1151],[1118,1218],[1022,1236],[932,1199],[876,1118],[874,1020],[913,924],[1022,894],[893,600]],
   "nineBasketsNote":"baskets 1–8 ring the protected centre at 172–190 m; the ninth is on the Hollow Bridge",
   "mailDayTargets":"the seven hosts' roofs (MANIFEST.hosts)",
   "riverRunGates":[[1140,760],[1100,850],[1200,880],[1150,935],[1170,980],[1220,1060],[1250,1140],[1290,1225],[1350,1320]],
   "bocce":{"xy":[1455,1150],"note":"the square's small green; single device vs. the ghost until a presence change is trust-reviewed"},
   "lanternQuotas":{"harbour":6,"landing":6,"reach":3,"green":5,"hollow":5,"scholars":5,"flats":6,"bight":4,"lakeside":5,"notch":3,"prow":4,"crown":4,"undercroft":4,"offshore":4,"total":64,"rule":"64 placed, 60 required to fill the Lantern Cave; never inside a reserve; ≥ 8 reachable only by air, ≥ 6 only by water, ≥ 4 only underground"},
   "skating":{"where":"stillwater","months":[1,2]},"sledding":{"where":"the Shoulder's south-east meadow [1400,760]","months":[1,2],"note":"inside the Jan–Feb snowline; 90 m east of S1"}
 },
 "journey":{
   "principle":"one household state and history → one WorldOverlay (derived on read, never stored) → the Journey renderer (L0–L1) and the world renderer (L2–L3) and the Desk; see SCALES.md",
   "stations":[
     {"month":1,"id":"jan","label":"the Shoulder","xy":[1330,640],"why":"snow, sledding, the summit walk"},
     {"month":2,"id":"feb","label":"Lakeside","xy":[1255,860],"why":"ice on Stillwater, the skipping shelf"},
     {"month":3,"id":"mar","label":"Scholars\u2019 floor","xy":[700,470],"why":"the woodland floor thaws first; bloodroot"},
     {"month":4,"id":"apr","label":"the Green (west)","xy":[860,980],"why":"first grass; dandelions; kites nearby"},
     {"month":5,"id":"may","label":"the Hollow (west rows)","xy":[960,640],"why":"apple blossom"},
     {"month":6,"id":"jun","label":"Long Sands","xy":[950,1445],"why":"lupines; the Campfire is here"},
     {"month":7,"id":"jul","label":"the Flats","xy":[380,800],"why":"coneflower, thermals, the strip"},
     {"month":8,"id":"aug","label":"the Reach","xy":[1230,1290],"why":"monarchs, Joe-Pye, the boardwalk"},
     {"month":9,"id":"sep","label":"the Hollow (east rows)","xy":[1040,650],"why":"apples"},
     {"month":10,"id":"oct","label":"the north pass","xy":[800,300],"why":"maples red"},
     {"month":11,"id":"nov","label":"the Prow","xy":[1570,940],"why":"the first storms, the Lamp\u2019s beam"},
     {"month":12,"id":"dec","label":"Little Harbour","xy":[1475,1230],"why":"Lantern Row, the Chapter at home"}
   ],
   "yearWalk":{"profile":"walk","note":"a trail through the twelve stations in calendar order, reusing existing walks and trails where they coincide; link segments authored in pass 1; the walk ahead of the current month is dressed as stakes and string","pts":[[1330,640],[1255,860],[1130,720],[990,780],[930,660],[880,560],[740,400],[700,470],[760,700],[860,980],[960,640],[893,600],[950,1445],[740,1432],[560,1100],[470,1030],[380,800],[430,900],[560,890],[840,880],[1240,1130],[1230,1290],[1040,650],[900,290],[800,300],[1300,260],[1500,340],[1590,700],[1570,940],[1480,1060],[1475,1230],[1370,690],[1330,640]]},
   "stretch":{"rule":"a month is the stretch of the Year Walk from the previous station to its own; one paving stone per day (28\u201331); every seventh stone a flagstone with a lantern post; the camp stands on today\u2019s stone; scheduled items stand on their stone as explicit markers (slip, pennant, stake, chairs); the next stretch is stakes and string until its month begins","stone_m":[2.4,1.6],"flagstone_m":[3.2,2.4],"markers":["bill slip on a post (name, amount)","payday pennant","task or plan-step stake (card name)","goal-deadline stake with ribbon","two chairs (Sitdown)","station gate ajar (Chapter close due)"]},
   "station":{"pad_m":[36,14],"bed_m":[3,2],"bedsPerRow":10,"rows":2,"identity":"site(monthOrdinal) = station(month) + bed(yearIndex); appending never moves a bed","maxHeight":"a bench (0.85 eu)","waymark":"post with the month name and the year count; lit at the camp"},
   "camp":{"rule":"the current month\u2019s bed: lit waymark + tent card; the camp card docks to it on the map","moves":"on Chapter/books close; 1 s card animation, a cut under reduced motion"},
   "eraGates":{"rule":"a gate (two posts + lantern) on the Year Walk at the bed where the era ended; lantern from the existing finish rules"},
   "homestead":{"where":"the land around Our home in Little Harbour: the yard behind the house, the lane down to the quay, the household\u2019s footbridge over the town channel, the Boathouse dock","centre":[1520,1190],"sites":[
     {"id":"home","label":"the home anchor","note":"Our home; never wears, never moves"},
     {"id":"kitchenGarden","label":"the kitchen garden","xy":[1535,1160],"category":"food","maturity":["none","trace","cluster","established","district"],"rule":"qualifying weeks in the trailing 24; one credit per week"},
     {"id":"landing","label":"the landing (cargo)","xy":[1320,1322],"category":"income","note":"cargo on the Boathouse dock when income arrives; never a beauty score"},
     {"id":"workbench","label":"the workbench","xy":[1545,1200],"category":"making","note":"cosmetic; fired pieces as today"},
     {"id":"pavilion","label":"a place in the making \u2192 the ready pavilion","xy":[1510,1215],"category":"goal","rule":"stakes while backing; finished at 100 % backed; a memory only when a kept memory exists"},
     {"id":"reserveBasin","label":"the reserve basin","note":"= L01 [1172,912]; using the buffer shows as water, never damage"},
     {"id":"timberCrossing","label":"the timber crossing","xy":[1500,1250],"category":"connection","note":"the household\u2019s footbridge on the lane over the town channel; the one site with physical wear (D19, D24)"}
   ]},
   "kittyPlaza":{"xy":[1440,1145],"max":6,"note":"Kitty Bank sculptures, step 0\u201310, beside the Fund bank"},
   "lod":{"L0":{"tris":[40000,25000],"drawCalls":[60,40],"coastVerts":400,"heightfieldDecimation":8},"L1":{"tris":[80000,45000]},"note":"[full, lite]; L2\u2013L3 are the world\u2019s budgets (CONTRACT \u00a76)"},
   "camera":{"tiers":{"sky":"the island\u2019s diagonal","region":250,"stop":80,"upClose":25},"handoff":"below upClose the target snaps to the nearest apron or bed and the controller hands to the world\u2019s Look camera, then Walk; one orbit controller, same north","fallback":"the #543 cloud crossfade for reduced motion, no WebGL, or a tier load over 400 ms"},
   "focus":{"fields":["target xy","tier","radius","heading","period (day/week/month/era) + date","selected object","active filters","unsent draft"],"rule":"tools open over it and restore it exactly; the world always shows now (entering from a past month lands at that bed with a banner)"},
   "retired":["weather-from-money (bills\u2192clouds, storm, mist, payday sunrise) \u2192 explicit strip markers (D18)","grow.ts landform generation (coast, coves, noise)","the harbour islet miniature","past eras as separate islands"]
 },
 "names":{
   "island":"The Horizon",
   "landformRule":"polygons are clipped to the island outline; the Hollow, the Stillwater terrace and the Cup are cut INTO the Shoulder (their own band wins inside them); elsewhere where polygons overlap the innermost (higher) band wins; band edges blend over 60 m; a bed (road, skate, rail, walk) overrides the bands within its profile width + 15 m each side and holds its own grade limits, so band steps never appear as cliffs on a route",
 "districts":[
   {"id":"harbour","neighbourhood":"harbour","note":"town + the Terraces + the town quay"},
   {"id":"landing","neighbourhood":"landing","note":"Long Sands, the Landing quay, the Boathouse, Campfire, Tideline park"},
   {"id":"reach","neighbourhood":"landing","note":"the wetland and the river mouth"},
   {"id":"green","neighbourhood":"lakeside","note":"the Green and the Glasshouse steps"},
   {"id":"hollow","neighbourhood":"hollow","note":"the orchard bowl, the Adit"},
   {"id":"scholars","neighbourhood":"scholars","note":"the woodland rise and the north pass"},
   {"id":"flats","neighbourhood":"flats","note":"the arm: strip, hangar, balloon, the Wash"},
   {"id":"bight","neighbourhood":"flats","note":"the lagoon, the sandbar, Bight Shore, the Bight Bridge"},
   {"id":"lakeside","neighbourhood":"lakeside","note":"Stillwater, the dam, L01"},
   {"id":"notch","neighbourhood":"lakeside","note":"the gorge, the High Span"},
   {"id":"prow","neighbourhood":"crown","note":"the cliffs, the zip tower, the Sea Door"},
   {"id":"crown","neighbourhood":"crown","note":"the Shoulder and the summit; the Undercroft is its underground child district"},
   {"id":"offshore","neighbourhood":None,"note":"the Lamp, the Needle's Eye, the Stacks, the Wreck; the sky ring streams by the districts beneath it"}
 ],
 "landforms":["Little Harbour","Long Sands","the Landing","the Reach","the Green","the Hollow","Scholars' Edge","the Flats","the Bight","Stillwater","the Cup","the Notch","the Prow","the Shoulder","the Crown","the Undercroft","the Lamp","the Needle's Eye","the Stacks","the Wreck","the Terraces","Bight Shore"],
   "roads":["Horizon Drive","Green Road","Crown Road","Bight Shore spur"],
   "skate":["Summit to Sea","the Wash Run","Town Weave","Hollow Line","Tideline park"],
   "underground":["the Adit","the Throat","Dam Gallery","the Sea Door","Ore Line","Lantern Cave","the Deep","Bell Gallery"],
   "structures":["High Span","Quay Bridge","Bight Bridge","Hollow Bridge","Apron Bridge","Inlet Footbridge","Reach Footbridge","Dune Culvert","Prow Tunnel","Shoulder Tunnel","Lantern Row","the Landing quay","the town quay","the Glasshouse steps","the Sea Stair","Crown station","the South Portal","the Sea Passage","the Steps"],
   "water":["Orchard Brook","the Wash (streambed)","the Bight sandbar","the Steps"],
   "idRule":"ids are camelCase keys in this manifest (e.g. highSpan, plot.terraces.1); display names above are their labels; STYLE and the guide map use labels, code uses ids",
   "journey":["the Year Walk","the camp","the homestead","the kitchen garden","the landing","the workbench","the ready pavilion","the reserve basin","the timber crossing","the home anchor","the Kitty plaza","era gates"],
   "pastimes":["Lantern Hunt","Summit to Sea","Ring Run","Drop Zone","Mail Day","River Run","Deep Run","Nine Baskets","Bocce","Ring Race","Ore Line ride","the Sketchbook","Campfire","Winter (skating, sledding)"]
 }
}
m["scale"]={
 "factor":0.6,
 "status":"recommended by Claude; decision D13 for Jonathan before the land pass",
 "rule":"engine_units = concept_metres × factor, applied to x, y and height alike; speeds in m/s are engine units per second",
 "why":"at factor 1.0 the island is too big for feet and bicycles (see journeys.at_factor_1_0); at 0.6 the everyday journeys land near the Mountain v2 time-to-place envelope (Library ~2.3 min by bicycle, Green ~1.5 min running, the far corners are meant to be far) while the sky, the ring and the ferry stay long enough to feel like travel",
 "decision":"D13 — Jonathan to confirm 0.6 (or another factor) before the land pass; the heightfield bakes at that factor"
}
def times(f):
    out={}
    for k,j in m["journeys"].items():
        if not isinstance(j,dict): continue
        if "legs" in j:
            L=sum(l["length_m"] for l in j["legs"])*f
            out[k]={"engine_u":round(L),"time_s":round(sum(l["length_m"]*f/speeds[l["mode"]] for l in j["legs"]))}
            continue
        if "length_m" not in j: continue
        L=j["length_m"]*f
        d={"engine_u":round(L),"time_s":round(L/speeds[j["mode"]])}
        if j["mode"]=="walk": d["run_s"]=round(L/speeds["run"])
        out[k]=d
    return out
m["journeys"]["at_factor_1_0"]=times(1.0)
m["journeys"]["at_factor_0_6"]=times(0.6)
m["journeys"]["targets_s"]={"square→library by bicycle":150,"square→green running":100,"square→summit by gondola + walk":120,"crown→quay on the board (S1)":[70,130],"crown→lamp by glider":[50,90],"ring by plane":[60,120],"square→home/bank on foot, walking":60,"square→boathouse on foot, walking":100,"note":"targets are at scale.factor; the Library and the Flats are deliberately the far corners"}
# Jonathan's 2026-09-25 prerequisite decisions; canonical input revision 1.6.
m["version"] = "1.6"
m["scale"] = {'factor': 1.0, 'status': 'confirmed by Jonathan 2026-09-25', 'rule': 'engine_units = concept_metres × factor, applied to x, y and height alike; speeds in m/s are engine units per second', 'why': 'Jonathan selected full concept scale. Journey estimates use factor 1.0; the 0.6 table remains a comparison scenario, not the active scale.', 'decision': 'D13 — Jonathan: “1.0 — full concept scale”, confirmed 2026-09-25; applies to x, y and height.'}
for key in ("plots", "rot_deg", "placeIds"):
    m["reserves"]["terraces"][key] = m["reserves"]["terraces"][key][:3]
m["reserves"]["terraces"]["served"] = 'plots 1–3 uphill (west) of the Prow cliff drive between [1600,860] and [1540,1000] with a lay-by each; the Prow walk above; the town below. D12 confirmed 2026-09-25: three uphill plots only; no seaward plot.'
crossing_district = next(row for row in m["crossings"] if row["a"] == "S4 × VBS threshold")
crossing = next(row for row in m["crossings"] if row["a"] == "S4" and row["b"] == "VBS")
crossing["district"] = "green"
crossing["districtNote"] = crossing_district["note"]
m["crossings"] = [row for row in m["crossings"] if row["resolution"] != "n/a"]
m["crossingRule"] = 'crossings contains physical resolutions only (over, under, threshold) at authored point, corridor or area locations; Pass 1 resolves these into numeric WorldDefinition geometry. District metadata belongs to its crossing. routePairNotes preserves coordination evidence for Pass 1 verification, including shared plan points; it never exempts a computed intersection from the crossing register.'
m["routePairNotes"] = [{'a': 'ORE', 'b': 'Crown Road', 'note': 'the South Portal [1345,680] is 29 m from the turning circle; a path links them', 'kind': 'nearby-endpoints', 'sharedPlanPoints': [], 'verification': 'Verify the South Portal link against the built Crown Road turning circle; register any actual intersection found in Pass 1.'}, {'a': 'DEEP_RUN', 'b': 'ORE', 'note': 'the Sea Passage leaves the Deep east; the rail leaves north-east and climbs; separated by 20 m of rock', 'kind': 'shared-plan-point', 'sharedPlanPoints': [[1300, 420]], 'verification': 'Both centrelines include [1300,420] at the Deep. The original 20 m rock-separation note describes the departing passages, not proven clearance at this shared point. Pass 1 must compute their vertical profiles and register and build every actual crossing; this note is not an exclusion.'}]
m["reserves"]["retiredPlaceIds"] = ["plot.terraces.4"]
m["journeys"]["at_active_scale"] = times(m["scale"]["factor"])
m["journeys"]["note"] = 'Straight-segment lengths between control points at assumed speeds; calibration estimates, not measured journeys. at_active_scale uses the confirmed scale.factor (1.0); the two at_factor tables are comparison scenarios.'
m["journeys"]["targets_s"]["note"] = 'Original design targets retained after D13 selected 1.0. Pass 1 reports measured pass/fail against these targets; scale approval does not waive them or change speeds.'

YEAR_WALK_V17 = [
 [1330,640],[1355,660],[1350,685],[1375,690],[1415,680],[1445,690],[1445,695],[1465,685],[1460,705],[1470,700],
 [1460,755],[1405,865],[1390,870],[1395,870],[1330,885],[1320,880],[1315,865],[1320,885],[1305,845],[1305,875],
 [1300,855],[1300,880],[1295,860],[1295,880],[1290,860],[1290,885],[1285,870],[1285,880],[1245,855],[1250,845],
 [1250,800],[1235,755],[1145,720],[1100,720],[1080,725],[1055,710],[1100,600],[1085,555],[1070,535],[960,470],
 [930,480],[895,480],[905,470],[885,465],[815,470],[800,480],[755,480],[700,470],[715,450],[770,450],
 [790,440],[855,445],[870,465],[905,470],[895,475],[905,475],[895,480],[915,480],[900,500],[905,545],
 [910,565],[925,585],[905,610],[900,640],[900,628],[899,660],[898,700],[895,740],[892,780],[887,815],
 [890,870],[920,900],[915,910],[930,995],[990,1010],[997,1006.7],[977.4,967.2],[966.1,929.6],[957.3,889.1],[953.3,848.9],
 [956.7,808.9],[962.3,768.6],[969.2,725.7],[975.4,689.6],[986.5,649.9],[994.1,612.3],[970,625],[960,640],[930,605],[910,605],
 [903,628],[902,660],[901,700],[898,740],[895,780],[890,815],[870,835],[870,870],[885,905],[865,920],
 [845,965],[865,985],[885,1065],[885,1120],[900,1180],[920,1220],[960,1355],[970,1365],[945,1385],[950,1445],
 [925,1440],[870,1385],[790,1325],[735,1270],[765,1235],[710,1190],[701.9,1195.9],[679.4,1178.1],[645.9,1154.1],[613.3,1133.2],
 [579.3,1111.5],[546.3,1090],[512.6,1067],[482.5,1044.2],[454.9,1014],[437.3,979.5],[423.4,943.6],[410.5,904],[425,890],[400,745],
 [425,770],[440,860],[440,870],[412.6,903.3],[425.5,942.8],[439.3,978.6],[456.7,1012.8],[483.9,1042.5],[513.9,1065.2],[547.5,1088.2],
 [580.5,1109.6],[614.5,1131.3],[647.1,1152.2],[680.8,1176.4],[703.3,1194.2],[730,1180],[930,1265],[950,1265],[970,1245],[1120,1270],
 [1160,1300],[1205,1290],[1160,1245],[1120,1250],[1100,1245],[975,1155],[960,1130],[955,1095],[990,1010],[994.6,1008.6],
 [974.6,968.2],[963.2,930.4],[954.3,889.7],[950.3,848.9],[953.7,808.6],[959.3,768.2],[966.2,725.2],[972.5,688.9],[983.6,649],[991.1,612],
 [1010,615],[1040,650],[1045,550],[1055,505],[1045,490],[995,470],[980,415],[945,370],[915,370],[820,345],
 [790,320],[810,305],[810,280],[815,275],[895,275],[899.2,283.6],[940,276.6],[980,268.6],[1017.4,261],[1056.8,253.2],
 [1096.5,246.3],[1136.3,242.6],[1178.5,242.2],[1216.7,243.5],[1259.2,246.9],[1297.7,252.8],[1319.7,258.5],[1340.4,281.3],[1379.9,294.4],[1415.6,307.5],
 [1453.6,323.6],[1487.1,341.9],[1508.5,367.9],[1524.1,404.6],[1535.4,441.5],[1545.7,481.6],[1554.7,520.2],[1561,556.4],[1567.4,598.5],[1572.5,635.5],
 [1577.9,678.4],[1581,705],[1570,665],[1575,670],[1600,665],[1615,725],[1630,745],[1630,855],[1620,910],[1645,875],
 [1650,855],[1650,745],[1645,725],[1615,685],[1596.9,703.2],[1601.5,743.6],[1605.7,784.8],[1608.1,827.2],[1605.7,864.9],[1592.8,905.1],
 [1576.5,943.3],[1558.6,980.4],[1536.4,1014.4],[1502.6,1037],[1500.3,1038.1],[1510,1050],[1510,1100],[1525,1175],[1500,1200],[1490,1230],
 [1500,1200],[1545,1160],[1535,1120],[1540,1085],[1530,1055],[1505,1015],[1495,1015],[1490,1020],[1494.7,1026.4],[1527.3,1005.1],
 [1548.8,970.9],[1564.7,937.9],[1580.6,900.4],[1593,862.2],[1595,822.6],[1592.7,785.9],[1588.9,747.7],[1584,704.7],[1579.2,664],[1574.3,626.7],
 [1568.7,586.5],[1562.7,548],[1555.2,508.1],[1546.3,471.5],[1536.1,432.7],[1524.2,396],[1506.8,358.9],[1495.4,344.6],[1505.5,343.5],[1482.9,377.2],
 [1461,411.8],[1449.5,447.4],[1452,485.4],[1449.1,529],[1433.5,565.6],[1417,599.6],[1400.2,635.7],[1383.7,674.4],[1376.8,690.6],[1345,680],
 [1355,675],[1330,660],[1345,650],[1330,640]
]

# ---------------------------------------------------------------------------
# v1.7 — Stage A ("Land to GO") design-lead data, 26 September 2026.
# Every delta below is listed in docs/horizon/README.md → "v1.7 deltas (Stage A, design lead)".
# Ids never change (CONTRACT §2.13); numbers move, fields are added.
# ---------------------------------------------------------------------------
m["version"] = "1.7"
m["date"] = "2026-09-26"

# 1. The Year Walk, re-authored on land. Seven station pads sat on a road, a skate line or a channel;
#    they move within their own neighbourhood (old xy kept as movedFrom).
STATION_XY_V17 = {"feb": [1100, 721], "apr": [932, 995], "jul": [401, 745], "aug": [1203, 1292], "oct": [790, 322], "nov": [1622, 912], "dec": [1488, 1228]}
STATION_MOVE_WHY = {
 "feb": "the old pad sat on S1 (0.7 m) and walk lakerim; now on the north-shore lake rim at the rim trail's own height (the skipping shelf)",
 "apr": "the old pad sat across the Bight Shore spur (VBS 7 m) and S4; moved 72 m east onto open Green (west)",
 "jul": "the old pad sat on Horizon Drive (V01 1.0 m); moved 59 m to the gap between V01 and the strip",
 "aug": "the old pad reached into the Reach west channel (3.1 m); moved 27 m west onto dry Reach meadow",
 "oct": "the old pad sat on Horizon Drive (V01 5.7 m); moved 24 m south into the north pass",
 "nov": "the old pad sat on the Prow cliff drive (V01 0.8 m) in its 34 m cutting; moved onto the Prow top beside the Prow walk",
 "dec": "the old pad overlapped Town Weave (S3); moved 13 m east onto the storefront lane",
}
for s in m["journey"]["stations"]:
    if s["id"] in STATION_XY_V17:
        s["movedFrom"] = s["xy"]
        s["xy"] = STATION_XY_V17[s["id"]]
        s["moveWhy"] = STATION_MOVE_WHY[s["id"]]
STATION_PAD_H = {"jan": 117, "feb": 53, "mar": 48, "apr": 19.5, "may": 31.5, "jun": 2, "jul": 36, "aug": 4, "sep": 33, "oct": 45.5, "nov": 56.5, "dec": 8}
YW_OLD_V16 = m["journey"]["yearWalk"]["pts"]
m["journey"]["yearWalk"] = {
 "profile": "walk",
 "note": "a trail through the twelve stations in calendar order, entirely on land: it never goes below sea level or into Stillwater, the Bight, a river or a channel except across a named bridge, never through a reserve plot, and never stacked on another bed at a different height; where it shares a corridor it shares the host bed's alignment and height (shares); the walk ahead of the current month is dressed as stakes and string",
 "pts": YEAR_WALK_V17,
 "ptsRule": "centreline control points, solved as the other beds are (Catmull-Rom, 5 m samples) and graded at profiles.walk.grade_max_pct; the builder uses these points verbatim (no inserted controls) and places each station pad at the walk height at its station",
 "pins": [{"station": k, "xy": next(s["xy"] for s in m["journey"]["stations"] if s["id"] == k), "h": v} for k, v in STATION_PAD_H.items()],
 "shares": [
   {"stretch": "feb", "host": "walk lakerim", "via": "structure.inletFootbridge", "side": "on the rim trail", "offset_m": 0, "from": [1250, 800], "to": [1100, 721], "note": "the February stretch walks the lake rim trail round the east and north shore and crosses the upper river on the Inlet Footbridge; one bed, the rim trail's"},
   {"stretch": "may", "host": "VG", "side": "west", "offset_m": 6.5, "from": [997, 1006.7], "to": [994.1, 612.3], "note": "Green Road's west footway"},
   {"stretch": "sep", "host": "VG", "side": "west", "offset_m": 9.5, "from": [994.6, 1008.6], "to": [991.1, 612], "note": "the same footway's outer lane"},
   {"stretch": "jul", "host": "V01", "via": "structure.bightBridge", "side": "lagoon (north-east)", "offset_m": 5.2, "from": [701.9, 1195.9], "to": [410.5, 904], "note": "the Bight Bridge's lagoon-side footway and the Drive's verge down the Flats arm; deck height 12 on the bridge"},
   {"stretch": "aug", "host": "V01", "via": "structure.bightBridge", "side": "lagoon (north-east)", "offset_m": 7.4, "from": [412.6, 903.3], "to": [703.3, 1194.2], "note": "the same footway's outer lane, walked back east a month later"},
   {"stretch": "nov", "host": "V01", "side": "seaward (north)", "offset_m": 6.5, "from": [899.2, 283.6], "to": [1319.7, 258.5], "note": "the north coast drive's seaward verge"},
   {"stretch": "nov", "host": "V01", "side": "inland", "offset_m": 9.5, "from": [1340.4, 281.3], "to": [1581, 705], "note": "crosses the Drive at grade at [1330,270] and takes the inland verge round the north-east corner (the seaward verge there is off the outline) up onto the Prow"},
   {"stretch": "dec", "host": "V01", "side": "seaward (east)", "offset_m": 6.5, "from": [1596.9, 703.2], "to": [1500.3, 1038.1], "note": "down the Prow cliff drive's seaward verge to the harbour"},
   {"stretch": "jan", "host": "V01", "side": "inland (west)", "offset_m": 6.5, "from": [1494.7, 1026.4], "to": [1495.4, 344.6], "note": "up the Prow cliff drive's inland verge, through the Prow Tunnel as its footway"},
   {"stretch": "jan", "host": "V02", "side": "east", "offset_m": 6.5, "from": [1505.5, 343.5], "to": [1376.8, 690.6], "note": "up Crown Road's east verge, through the Shoulder Tunnel as its footway, to the turning circle"}
 ],
 "sharesRule": "a shared stretch is a footway of its host bed: the same alignment at offset_m from the host centreline, the host's solved height at every point (the builder copies it, it does not re-grade), no separate terrain override, retaining or kerb between host and footway; tunnels and bridges on the host carry the footway inside their own section",
 "ownTrails": [
   {"stretch": "apr", "name": "the Hollow lane (west lane)", "from": [900, 628], "to": [887, 815], "note": "a new trail on the valley floor between Orchard Brook and S4; the April and June stretches walk two lanes 3 m apart"},
   {"stretch": "jun", "name": "the Hollow lane (east lane)", "from": [903, 628], "to": [890, 815]},
   {"stretch": "feb", "name": "the Lakeside zig-zag", "from": [1330, 885], "to": [1285, 875], "note": "from the Shoulder's south-west corner down to the lake terrace: seven short switchback legs on the band face (x 1285–1330, z 845–885), outside S1's loop; built as a ramp with retaining walls between legs (the only step-free way off the Shoulder that does not cross S1)"}
 ],
 "crossings": "the walk crosses S1 once, at grade, at [1255,862] (to be regraded flush); every other crossing is at grade on a walk, a spur or a road (thresholds) or on a named bridge (the Inlet Footbridge, the Hollow Bridge, the Bight Bridge)",
 "retired_v1_6_pts": YW_OLD_V16,
}
m["profiles"]["walk"]["grade_max_pct"] = 12
m["profiles"]["walk"]["grade_typ_pct"] = [0, 8]
m["profiles"]["walk"]["note"] = "walks and trails, including the Year Walk: 12 % maximum, ≤ 8 % typical; a stair's step-free twin keeps ≤ 8 %"

# 2. The twelve Sketchbook poses re-authored against the built land, with a portrait rule.
m["viewRule"] = {
 "landscape": m["viewRule"] + "; target_h is the look-at height in engine units (it replaces the per-page constants and the terrain-height default); frames lists the Pass 1 subjects the page must hold, deferred the props that arrive in Pass 2/2b/3",
 "portrait": "on a portrait capture (width < height, e.g. 390 × 844) the camera holds the page's HORIZONTAL field of view, never its vertical one: horizontal FOV = portrait.fov_deg (never below 45°), aimed at portrait.target at portrait.target_h (the page's target when absent), from the landscape eye unless portrait.xy / portrait.eyeH are given; portrait.frames names the subjects that must be legible on the phone — the other landscape subjects may fall outside the portrait crop",
}
VIEWS_V17 = {
 "A": {"xy": [1470, 1186], "target": [1175, 960], "target_h": 30, "fov_deg": 60, "radius_eu": 480, "frames": "the High Span's deck line, the dam's glass face, the Shoulder and the Crown behind", "deferred": ["the Reach (outside any lens that holds the dam from the square; page I carries it)"], "portrait": {"fov_deg": 50, "target": [1195, 1005], "target_h": 28, "frames": ["the High Span", "the dam's glass face"]}},
 "B": {"xy": [540, 1195], "target": [515, 880], "target_h": 20, "fov_deg": 55, "radius_eu": 520, "portrait": {"fov_deg": 50, "target": [522, 940], "target_h": 18, "frames": ["the Bight Bridge", "the hook"]}},
 "C": {"xy": [1268, 1145], "target": [1210, 1098], "target_h": 16, "fov_deg": 55, "radius_eu": 220, "portrait": {"fov_deg": 50, "target": [1222, 1102], "target_h": 16, "frames": ["the road deck", "the skate shelf", "the walk at the water"]}},
 "D": {"xy": [1185, 1445], "target": [700, 1462], "target_h": 6, "fov_deg": 55, "radius_eu": 720, "frames": "surf, the Lamp, the zipline landing", "deferred": ["a bench (Pass 3 dressing)"], "portrait": {"fov_deg": 50, "target": [700, 1454], "target_h": 5, "frames": ["surf", "the Lamp", "the zipline landing"]}},
 "E": {"xy": [1305, 482], "target": [870, 860], "target_h": 20, "fov_deg": 55, "radius_eu": 900, "frames": "from the lookout's run-off deck: Stillwater, the Green, the Hollow, the Flats and the Bight, the sea beyond (the harbour, the Reach, Long Sands and the Prow lie behind the Shoulder from here)", "portrait": {"fov_deg": 55, "target": [1000, 880], "target_h": 20, "frames": ["the Green", "Stillwater", "the sea"]}},
 "F": {"xy": [1158, 905], "target": [1400, 1150], "target_h": 14, "fov_deg": 55, "radius_eu": 420, "frames": "the plaques and L01 on the crest, the town below (the lake is behind the camera)", "portrait": {"fov_deg": 45, "target": [1260, 990], "target_h": 30, "frames": ["L01", "the town below"]}},
 "G": {"target_h": 110, "radius_eu": 220, "portrait": {"fov_deg": 45, "target": [1300, 300], "target_h": 110, "frames": ["the Throat's mouth of daylight", "the skylight shaft"]}},
 "H": {"xy": [440, 760], "target": [100, 560], "target_h": 30, "fov_deg": 55, "radius_eu": 260, "frames": "the strip in copper, the west sea under the sunset", "deferred": ["the windsock (Pass 2b kit: mast and sock; only its footing is built)", "the balloon at its mooring (Pass 2 mover and 2b kit)"], "portrait": {"fov_deg": 50, "target": [100, 560], "target_h": 30, "frames": ["the strip", "the west sea"]}},
 "I": {"xy": [1275, 1226], "target": [1250, 1180], "target_h": 5, "fov_deg": 55, "radius_eu": 220, "frames": "the spring and the Reach water", "deferred": ["reeds at hand height", "the heron"], "portrait": {"fov_deg": 45, "target": [1250, 1180], "target_h": 5, "frames": ["the spring"]}},
 "J": {"xy": [1840, 1000], "eyeH": 60, "target": [1780, 700], "target_h": 14, "fov_deg": 55, "radius_eu": 340, "frames": "the arch ahead of the wing, the Stacks, the Prow", "portrait": {"fov_deg": 50, "target": [1760, 760], "target_h": 14, "frames": ["the arch", "the Stacks", "the Prow"]}},
 "K": {"xy": [1000, 758], "target": [1120, 812], "target_h": 52, "fov_deg": 55, "radius_eu": 220, "frames": "the Glasshouse in front of Stillwater", "deferred": ["lit from inside", "seed pots in silhouette"], "portrait": {"fov_deg": 45, "target": [1060, 800], "target_h": 55, "frames": ["the Glasshouse", "Stillwater"]}},
 "L": {"xy": [1484, 1295], "target": [1285, 1315], "target_h": 4, "fov_deg": 55, "radius_eu": 240, "frames": "Lantern Row along the quay, the Boathouse across the water", "deferred": ["the floatplane rocking (Pass 2 mover; its dock is at the quay's east end, behind this pose)", "lantern cards"], "portrait": {"fov_deg": 45, "target": [1285, 1315], "target_h": 4, "frames": ["Lantern Row", "the Boathouse"]}},
}
VIEWS_V16 = {v["id"]: {k: v[k] for k in ("xy", "target", "fov_deg", "radius_eu", "eyeH") if k in v} for v in m["views"]}
for v in m["views"]:
    v.update(VIEWS_V17[v["id"]])
    v.setdefault("target_h", 110 if v["id"] == "G" else 14 if v["id"] == "J" else 16 if v["id"] == "C" else None)
    v.setdefault("deferred", [])
    v["v1_6"] = VIEWS_V16[v["id"]]

# 3. Journeys at scale 1.0: speeds, targets (achievable with ≥ 10 % margin on the measured path graph) and anchors.
speeds.update({"walk": 2.4, "run": 5.0, "bicycle": 8.0, "board": 10.0, "plane": 45.0, "gondola": 7.0})
m["sky"]["plane"]["speed_ms"] = speeds["plane"]
m["cable"]["G1"]["speed"] = speeds["gondola"]
m["journeys"]["at_factor_1_0"] = times(1.0)
m["journeys"]["at_factor_0_6"] = times(0.6)
m["journeys"]["at_active_scale"] = times(m["scale"]["factor"])
m["journeys"]["anchors"] = {"square→green running": [1053.9, 1043.4], "note": "the Green's edge on Green Road (the centre has no bed within the snap distance); measurements snap to this point"}
TARGETS_V17 = {"square→library by bicycle": 185, "square→green running": 125, "square→summit by gondola + walk": 375, "crown→quay on the board (S1)": [110, 150], "crown→lamp by glider": [85, 120], "ring by plane": [60, 120], "square→home/bank on foot, walking": 60, "square→boathouse on foot, walking": 180}
TARGETS_V16 = {k: v for k, v in m["journeys"]["targets_s"].items() if k != "note"}
m["journeys"]["targets_s"] = dict(TARGETS_V17, note="v1.7 targets at scale 1.0: each is achievable with ≥ 10 % margin on the Stage A path graph (README v1.7 table); the summit target is the achievable value until the gondola top station is decided (reserved), then 180")
m["journeys"]["targets_v1_6"] = TARGETS_V16

# 4. Sky envelope (and the Crown launch folded into the summit lookout, which also settles the launch-over-summit contradiction).
# The Crown launch folds into the summit lookout: a timber run-off deck on L02's south-west side, 12 eu above the summit ground.
m["sky"]["launches"]["crown"] = {"xy": [1305, 482], "h": 170, "note": "the run-off deck of the summit lookout (L02), a structure on the summit's south-west lip; the terrain summit (landforms.crown.summitH 158) stays the island's highest ground and no bed may raise the ground above it"}
next(t for t in m["thresholds"] if t["id"] == "crownLaunch")["xy"] = [1305, 482]

SKY_GATE_H = {"throat": 119, "scholarsCove": 48, "lamp": 20.5}
for g in m["sky"]["gates"]:
    if g["id"] in SKY_GATE_H: g["h"] = SKY_GATE_H[g["id"]]
    if g["id"] == "throat": g["aperture_m"] = [24, 16]; g["note"] = "into the mountain; glider only; centred on the mouth (110–128), 24 × 16 inside the 26 × 18 mouth"
    if g["id"] == "highSpan": g["note"] = "under the deck (deck h 24, riverbed h 8); needs the Notch widened to ≥ 40 eu between h 9 and 23 (terrain)"
m["sky"]["landings"]["green"]["xy"] = [1028, 1112]
m["sky"]["landings"]["green"]["note"] = "the Drop Zone target is ground paint inside the protected centre, clear of Green Road (its edge 65 m north-east) and the Year Walk"
m["sky"]["landings"]["reachMeadow"]["xy"] = [1143, 1167]
m["sky"]["landings"]["sands"]["xy"] = [1095, 1362]
m["sky"]["waterLandings"] = {
 "bight": {"xy": [592, 804], "r": 60, "note": "the inner Bight, clear of the ferry pier and the Year Walk; the landing field is wet below level − 2 all round"},
 "deep": {"xy": [1278, 423], "r": 8, "note": "the only clear water in the Deep: the west lobe beside the Throat's foot; an r 20 field needs the Ore Line's splash moved ≥ 20 m east or the Deep widened 15 m west (underground track)"},
 "harbour": {"note": "found by the envelope beside the floatplane dock (world/sky.ts); unchanged"},
 "rule": "the envelope reads these centres; before v1.7 it used the water outline's centroid"
}
m["sky"]["courses"]["damRun"]["land"] = "reach meadow [1143,1167]"
m["sky"]["courses"]["damRun"]["note"] = "514 m to the arch with 115 m of height in hand at a 9:1 glide; under the High Span, then a west turn onto the Reach meadow, 115 m past it"


with open("MANIFEST.json", "w", encoding="utf-8") as output:
    json.dump(m, output, indent=1)
    output.write("\n")
print(json.dumps(m["journeys"]["at_active_scale"],indent=0))
print("V01",m["roads"]["V01"]["length_m"],"S1",m["skate"]["S1"]["length_m"],"ferry",m["water_routes"]["FERRY"]["length_m"])
