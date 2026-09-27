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

# 5. Manifest self-contradictions.
m["profiles"]["walkable"]["slope_max_deg"] = 40
m["profiles"]["walkable"]["note"] = "the body cannot climb steeper than 40° (Mountain v2's kept body limit, CONTRACT); a lip above 0.5 eu is an edge, not a step"
m["profiles"]["road"]["exceptions"] = [
 m["profiles"]["road"]["exception"],
 "Crown Road (V02) may hold 12 % continuously for its climb from [1454,411] to the Shoulder Tunnel (≈ 300 m): the manifest geometry forces 36 m over 382 m; every other stretch over 8 % is listed in the bake report",
]
m["profiles"]["rail"]["grade_max_pct"] = 6
m["profiles"]["rail"]["chainLift"] = {"from": [1300, 420], "to": [1345, 680], "note": "the Ore Line's climb out of the Deep to the South Portal is a named chain-lift incline (ORE.chainLift) exempt from grade_max_pct; the drop at [1270,450] (rail.ORE.drop) is the other named exception"}
m["underground"]["rooms"]["deep"]["skylight"]["to"] = [1320, 400]
m["underground"]["rooms"]["deep"]["skylight"]["note"] = "opens on the north slope 20 m east of the Throat's centreline (so the Throat's mouth of daylight reads from the Deep's jetty); sun shaft when the sun is above 20°"

# ---------------------------------------------------------------------------
# v1.8 — Stage A integration (design lead), 26 September 2026.
# Every delta below is listed in docs/horizon/README.md → "v1.8 deltas (Stage A integration)".
# Ids never change (CONTRACT §2.13); numbers move, fields are added.
# ---------------------------------------------------------------------------
m["version"] = "1.8"
m["date"] = "2026-09-26"

# 1. The crossings register, re-authored against the merged Stage A build (T2 delta + the integrator's bake).
#    Authored rows keep their resolution; the 12 stale rows (R1-11) are re-pointed to their computed hit or retired
#    to routePairNotes; every other computed intersection gets a row in T4's vocabulary (kind: crossing, junction,
#    sharedStretch, footway, waterBody, waterConfluence, modeTransfer; resolution stays over / under / threshold).
#    Rows with source "bake v1.8" never create register pads or dismount thresholds (a junction is flush, R1-88).
REGISTER_V17 = m["crossings"]
REPOINT_V18 = {
 5: ([898, 611], "the Hollow Bridge carries the Garden Walk over the brook 12 m north of the v1.7 point"),
 6: ([899, 591], "S4's lane on the Hollow Bridge crosses the brook 10 m south-east of the v1.7 point"),
 21: ([1587, 677], "the Deep run passes under the Prow cliff drive 23 m north-east of the v1.7 point"),
 23: ([1611, 710], "the Deep run passes under the Prow walk 11 m east of the v1.7 point"),
 24: ([1009, 1388], "the dune culvert: V01 over S4 13 m south of the v1.7 point"),
 27: ([1160.8, 940.1], "RESERVED R-A7: S1 meets the dam portage stair (was the lake-rim walk) 4.8 eu apart; physically separated until Jonathan rules"),
 38: ([1374, 615], "the Crown walk crosses over the Ore Line 48 m north of the v1.7 point (two more crossings are listed below)"),
}
REPOINT_B = {27: "damPortage"}
RETIRE_V18 = {
 2: "the Reach walk runs under the High Span gallery beside the river; the two centrelines never cross in plan (the High Span's walk-level gallery is the Reach walk's own stretch)",
 11: "S1 finishes on the quay without crossing V01 near [1270,1330]; S1 × V01 has no plan intersection in the v1.8 build",
 14: "S2 is a lane of the Bight Bridge deck (row 13); it passes 17.9 m from the [660,1170] dismount, which does not exist (T2 D-3: S2 cannot descend from the Wash to the deck at 18 %; Jonathan decides)",
 20: "S3 runs beside the town quay, never across it (T0 request 4: S3 at [1433,1298] should come down ≤ 3.5 eu)",
 25: "\"none\": S3 and the dune walk do not cross",
 26: "S3 never reaches [1480,1050]; it meets V01 only on the river-mouth bridge decks ([1350,1345], [1322,1372]), carried below as rows accepted from the bake: a threshold there needs a widened, guarded deck (a register pad would stand in the river)",
 27: None,
 29: "an area rule, not an intersection: the zip line passes over the town's roofs with ≥ 12 eu clearance (checked as cable.ZIP.roofs)",
 40: "S4 starts at [1000,520]; it never meets the Studio spur at [974,540] (the spur meets VG there, listed below)",
 45: "an area rule, not an intersection: planes fly over everything under the sky ceiling",
}
RESERVED_ROWS_V18 = {7: "R-A7", 12: "R-A1", 17: "R-A7", 18: "R-A7", 27: "R-A7", 30: "R-A2", 34: "R-A7", 44: "R-A1"}
register = []
for i, row in enumerate(REGISTER_V17):
    if i in RETIRE_V18 and RETIRE_V18[i] is not None:
        m["routePairNotes"].append({"a": row["a"], "b": row["b"], "kind": "retired register row (v1.8)", "verification": RETIRE_V18[i], "sharedPlanPoints": [], "retiredRow": {k: v for k, v in row.items()}})
        continue
    row = dict(row)
    if i in REPOINT_V18:
        row["movedFrom"] = row["at"]
        row["at"], why = REPOINT_V18[i]
        row["note"] = (row["note"] + "; " if row.get("note") else "") + why
        if i in REPOINT_B: row["b"] = REPOINT_B[i]
    if i in RESERVED_ROWS_V18: row["reserved"] = RESERVED_ROWS_V18[i]
    row.setdefault("kind", "crossing")
    register.append(row)
CANON = {"Crown Road": "V02", "river mouth": "river lower", "water wash": "wash", "Reach west channel": "reachChannel.1", "Reach east channel": "reachChannel.2", "S1 finish": "S1"}
def _canon(name): return {CANON.get(p.strip(), p.strip()) for p in name.split("+")}
def _covered(row):
    for a in register:
        if not isinstance(a["at"], list): continue
        pair = (_canon(a["a"]), _canon(a["b"]))
        same = (row["a"] in pair[0] and row["b"] in pair[1]) or (row["a"] in pair[1] and row["b"] in pair[0])
        if same and ((a["at"][0] - row["at"][0]) ** 2 + (a["at"][1] - row["at"][1]) ** 2) ** .5 <= 10: return True
    return False
CROSSINGS_V18_COMPUTED = [
 {"a":"crownLaunch.stair","b":"underground.bellGallery","at":[1313,480.5],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"RESERVED R-A3: waits on the gondola top station"},
 {"a":"damGallery.flight.1","b":"damGallery.exit","at":[1165,898],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"under by 7 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"damGallery.flight.1","b":"water.stillwater","at":[1165,898],"resolution":"threshold","kind":"waterBody","source":"bake v1.8","note":"bed inside the water outline below its surface: a bridge, causeway or re-route is owed (diagnostic)"},
 {"a":"damGallery.flight.2","b":"damGallery.exit","at":[1165,886],"resolution":"threshold","kind":"sharedStretch","source":"bake v1.8","note":"shared stretch 10 eu at one height"},
 {"a":"damGallery.flight.2","b":"water.stillwater","at":[1165,892],"resolution":"threshold","kind":"waterBody","source":"bake v1.8","note":"bed inside the water outline below its surface: a bridge, causeway or re-route is owed (diagnostic)"},
 {"a":"DEEP_RUN","b":"ZIP","at":[1587.5,677.4],"resolution":"under","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"ferry.bight","b":"FERRY","at":[560,898],"resolution":"threshold","kind":"modeTransfer","source":"bake v1.8","note":"boarding threshold; mover pending"},
 {"a":"ferry.flats","b":"FERRY","at":[285,720],"resolution":"threshold","kind":"modeTransfer","source":"bake v1.8","note":"boarding threshold; mover pending"},
 {"a":"ferry.landing","b":"FERRY","at":[1470,1340],"resolution":"threshold","kind":"modeTransfer","source":"bake v1.8","note":"boarding threshold; mover pending"},
 {"a":"ferry.seaDoor","b":"seaStair","at":[1705,775],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"gondolaBase.walk","b":"G1","at":[1480,1090],"resolution":"threshold","kind":"modeTransfer","source":"bake v1.8","note":"boarding threshold; mover pending; RESERVED R-A3: waits on the gondola top station"},
 {"a":"highSpan.overlook","b":"river lower","at":[1251.2,1143.3],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":"at-grade meeting 2.2 eu apart: regrade owed"},
 {"a":"highSpan.overlook","b":"river lower","at":[1251.2,1143.3],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":"at-grade meeting 2.1 eu apart: regrade owed"},
 {"a":"homestead.lane","b":"town quay","at":[1497,1265],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"jetty.boathouse","b":"reachChannel.2","at":[1320,1318.5],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":"at-grade meeting 0.8 eu apart: regrade owed"},
 {"a":"jetty.deep","b":"stepsPortage","at":[1300,440],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"jetty.deep","b":"underground.deepAccess","at":[1300,440],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"jetty.lamp","b":"lampGallery.ramp","at":[540,1250],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"jetty.lamp","b":"lampGallery.ramp","at":[540,1250],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"under by 9.6 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"jetty.lamp","b":"lampGallery.ramp","at":[540,1250],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"under by 19.2 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"jetty.lamp","b":"lampGallery.stair","at":[540,1250],"resolution":"threshold","kind":"sharedStretch","source":"bake v1.8","note":"shared stretch 6 eu at one height"},
 {"a":"jetty.seaDoor","b":"ferry.seaDoor","at":[1705,781],"resolution":"threshold","kind":"sharedStretch","source":"bake v1.8","note":"shared stretch 12 eu at one height"},
 {"a":"jetty.seaDoor","b":"seaStair","at":[1705,775],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"lampGallery.ramp","b":"FERRY","at":[510.4,1224.4],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":"at-grade meeting 3.2 eu apart: regrade owed"},
 {"a":"lampGallery.ramp","b":"FERRY","at":[510.4,1224.4],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 12.8 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"lampGallery.ramp","b":"FERRY","at":[510.4,1224.4],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 22.4 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"lampGallery.ramp","b":"FERRY","at":[546.1,1190.6],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 6.1 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"lampGallery.ramp","b":"FERRY","at":[546.1,1190.6],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"lampGallery.ramp","b":"lampGallery.stair","at":[540,1195],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"lampGallery.ramp","b":"lampGallery.stair","at":[540,1250],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"lampGallery.ramp","b":"lampGallery.stair","at":[540,1250],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 9.6 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"lampGallery.ramp","b":"lampGallery.stair","at":[540,1250],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 19.2 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"lampGallery.stair","b":"FERRY","at":[540,1230],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"marketRamp","b":"host.home.approach","at":[1482.4,1181.8],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"marketStair.flight.0","b":"marketRamp","at":[1480,1150],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"ORE","b":"DEEP_RUN","at":[1300,420],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"ORE","b":"ORE.siding","at":[1270,450],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"ORE","b":"southPortal.link","at":[1345,680],"resolution":"threshold","kind":"modeTransfer","source":"bake v1.8","note":"boarding threshold; mover pending"},
 {"a":"ORE","b":"stepsPortage","at":[1343.6,463.6],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 25.1 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"ORE","b":"underground.bellGallery","at":[1225.5,489.6],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"ORE","b":"underground.deepAccess","at":[1280,440],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 17.4 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"ORE","b":"underground.lanternCave","at":[1160,520],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"ORE","b":"underground.throat","at":[1300,420],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"reachChannel.1","b":"reachChannel.2","at":[1280,1220],"resolution":"threshold","kind":"waterConfluence","source":"bake v1.8","note":"one waterway"},
 {"a":"river lower","b":"reachChannel.1","at":[1280,1220],"resolution":"threshold","kind":"waterConfluence","source":"bake v1.8","note":"one waterway"},
 {"a":"river lower","b":"reachChannel.2","at":[1280,1220],"resolution":"threshold","kind":"waterConfluence","source":"bake v1.8","note":"one waterway"},
 {"a":"river lower","b":"reachChannel.2","at":[1320,1276],"resolution":"threshold","kind":"waterConfluence","source":"bake v1.8","note":"one waterway"},
 {"a":"river lower","b":"reachChannel.2","at":[1320,1276],"resolution":"threshold","kind":"waterConfluence","source":"bake v1.8","note":"one waterway"},
 {"a":"river lower","b":"river upper","at":[1160,740],"resolution":"threshold","kind":"waterConfluence","source":"bake v1.8","note":"one waterway"},
 {"a":"S1","b":"dam.apron.level","at":[1168,929.2],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":"at-grade meeting 0.5 eu apart: regrade owed"},
 {"a":"S1","b":"damPortage","at":[1159.3,936],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"RESERVED R-A7: physically separated threshold"},
 {"a":"S1","b":"damPortage","at":[1160.8,940.1],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":"at-grade meeting 4.8 eu apart: regrade owed; RESERVED R-A7: physically separated threshold"},
 {"a":"S1","b":"G1","at":[1391.9,701.5],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"RESERVED R-A3: waits on the gondola top station"},
 {"a":"S1","b":"G1","at":[1407.5,770.1],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"RESERVED R-A3: waits on the gondola top station"},
 {"a":"S1","b":"landingQuay","at":[1270,1330],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"S1","b":"underground.bellGallery","at":[1308.2,510.9],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"S1","b":"walk crown","at":[1310,500],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"S1","b":"walk crownFromGondola","at":[1310,500],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":"RESERVED R-A3: waits on the gondola top station"},
 {"a":"S1","b":"walk summit","at":[1310,500],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":"RESERVED R-A3: waits on the gondola top station"},
 {"a":"S1","b":"yearWalk","at":[1254.7,862],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"S1","b":"ZIP","at":[1251.5,1237.5],"resolution":"under","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"S1","b":"ZIP","at":[1251.9,1236.8],"resolution":"under","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"S2","b":"FERRY","at":[560,1100],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"S2","b":"S3","at":[1020,1430],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"S2","b":"S4","at":[1020,1430],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"S2","b":"yearWalk","at":[468.2,1026.4],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":"at-grade meeting 0.7 eu apart: regrade owed"},
 {"a":"S2","b":"yearWalk","at":[553.9,1095],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"S2","b":"yearWalk","at":[742,1258.5],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"S2","b":"yearWalk","at":[944.8,1393.7],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":"at-grade meeting 1.6 eu apart: regrade owed"},
 {"a":"S3","b":"gondolaBase.walk","at":[1480,1060],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"S3","b":"host.home.approach","at":[1456,1175.3],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"S3","b":"S4","at":[1020,1430],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"S3","b":"town.quayLink","at":[1406,1319.1],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"S3","b":"V01","at":[1321.9,1372.3],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"S3","b":"V01","at":[1350,1345],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"S3","b":"walk square","at":[1480,1060],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"S4","b":"brook","at":[896.4,617.8],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"S4","b":"brook","at":[898.5,591.3],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"S4","b":"plot.bight.1.service","at":[874.4,919.5],"resolution":"under","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"S4","b":"walk garden","at":[897.5,620.6],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":"at-grade meeting 1.7 eu apart: regrade owed"},
 {"a":"S4","b":"walk garden","at":[905.9,640.6],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"under by 2.7 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"S4","b":"yearWalk","at":[880.4,909.9],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"S4","b":"yearWalk","at":[884.8,903.6],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":"at-grade meeting 0.9 eu apart: regrade owed"},
 {"a":"S4","b":"yearWalk","at":[900.7,882.8],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"under by 2.6 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"S4","b":"yearWalk","at":[901.2,629.8],"resolution":"under","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"S4","b":"yearWalk","at":[902.6,632.9],"resolution":"under","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"S4","b":"yearWalk","at":[918.6,574.8],"resolution":"under","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"S4","b":"yearWalk","at":[957.9,1248.9],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":"at-grade meeting 0.6 eu apart: regrade owed"},
 {"a":"spur boathouse","b":"host.boathouse.approach","at":[1290,1345],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"spur cottage","b":"walk garden","at":[930,650],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"spur cottage","b":"yearWalk","at":[971.9,691.9],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"spur cottage","b":"yearWalk","at":[974.4,694.4],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"spur library","b":"walk coveWalk","at":[760.1,359.9],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"spur library","b":"yearWalk","at":[806.1,337],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"spur studio","b":"host.studio.approach","at":[1000,540],"resolution":"threshold","kind":"sharedStretch","source":"bake v1.8","note":"shared stretch 1 eu at one height"},
 {"a":"spur upperStreet","b":"gondolaBase.walk","at":[1480,1060],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"spur upperStreet","b":"S3","at":[1480,1060],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"spur upperStreet","b":"walk square","at":[1480,1060],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"town.bankLink","b":"host.bank.approach","at":[1440,1134],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"town.bankLink","b":"host.home.approach","at":[1455,1175],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"town.bankLink","b":"town.northLink","at":[1420,1138],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"town.bankLink","b":"town.quayLink","at":[1455,1175],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"town.quayLink","b":"host.home.approach","at":[1455,1175],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"town.quayLink","b":"town quay","at":[1420,1335],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"town.quayLink","b":"town.riverLink","at":[1400,1290],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"town.storefront","b":"homestead.lane","at":[1497,1265],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"town.storefront","b":"homestead.lane","at":[1498,1250.9],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"town.storefront","b":"town quay","at":[1497,1265],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"underground.bellGallery","b":"underground.deepAccess","at":[1220,480],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"underground.deepAccess","b":"stepsPortage","at":[1300,440],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"underground.lanternCave","b":"underground.bellGallery","at":[1220,480],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"underground.lanternCave","b":"underground.deepAccess","at":[1220,480],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"underground.lanternCave","b":"underground.sealedDrift","at":[1187.3,498.2],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"underground.lanternCave","b":"underground.sealedDrift","at":[1220,480],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"underground.sealedDrift","b":"underground.bellGallery","at":[1220,480],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"underground.sealedDrift","b":"underground.deepAccess","at":[1220,480],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"underground.throat","b":"DEEP_RUN","at":[1300,420],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"V01","b":"DEEP_RUN","at":[1587.3,677.2],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"V01","b":"FERRY","at":[559.3,1104.8],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"V01","b":"FERRY","at":[560,1100],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"V01","b":"FERRY","at":[562.8,1107.1],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"V01","b":"plot.terraces.1.service","at":[1601.6,831.4],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"V01","b":"plot.terraces.2.service","at":[1580.5,918.1],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"V01","b":"plot.terraces.3.service","at":[1554.6,973.9],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"V01","b":"S3","at":[1321.9,1372.3],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"V01","b":"S3","at":[1350,1345],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"V01","b":"S4","at":[1008.6,1387.8],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"V01","b":"spur boathouse","at":[1300,1380],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"V01","b":"spur library","at":[900,290],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"V01","b":"spur upperStreet","at":[1480,1040],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"V01","b":"town.northLink","at":[1370.9,1126.3],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"V01","b":"town.riverLink","at":[1370,1260],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"V01","b":"V02","at":[1500,340],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"V01","b":"VG","at":[900,290],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"V01","b":"VG","at":[1400,1060],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"V01","b":"walk prow","at":[1580.1,620.7],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"under by 11.5 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"V01","b":"yearWalk","at":[756.4,1247.1],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"V01","b":"yearWalk","at":[810.8,294.1],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"V01","b":"yearWalk","at":[952.7,1376.1],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"V01","b":"ZIP","at":[1587.4,677.7],"resolution":"under","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"V02","b":"southPortal.link","at":[1370,690],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"V02","b":"walk crown","at":[1406.5,606.3],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"under by 21.5 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"V02","b":"walk crownFromGondola","at":[1412.8,593.4],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"RESERVED R-A3: waits on the gondola top station"},
 {"a":"V02","b":"walk crownFromGondola","at":[1443.1,526.5],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"RESERVED R-A3: waits on the gondola top station"},
 {"a":"VBS","b":"plot.bight.1.service","at":[880.8,928.6],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"VBS","b":"plot.bight.2.service","at":[832.6,1011.9],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"VBS","b":"plot.bight.3.service","at":[799.1,1066.7],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"VBS","b":"plot.bight.4.service","at":[775,1125],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"VBS","b":"spur glasshouse","at":[960,860],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"VBS","b":"yearWalk","at":[855,974.6],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"VBS","b":"yearWalk","at":[904.2,885.9],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"VBS","b":"yearWalk","at":[951.2,863.4],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"VBS","b":"yearWalk","at":[954.1,862.3],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"VG","b":"highSpan.walk","at":[1228.8,1104.1],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"VG","b":"spur cottage","at":[980,700],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"VG","b":"spur glasshouse","at":[960,860],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"VG","b":"spur library","at":[900,290],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"VG","b":"spur studio","at":[975.5,540],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"VG","b":"VBS","at":[960,860],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"VG","b":"walk garden","at":[969.5,764.2],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"under by 16.5 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"VG","b":"yearWalk","at":[933,369.1],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"under by 5.5 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"VG","b":"yearWalk","at":[943.6,471],"resolution":"under","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"walk bight","b":"plot.bight.3.service","at":[729.5,1056.6],"resolution":"under","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"walk bight","b":"plot.bight.4.service","at":[706.4,1131.1],"resolution":"under","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"walk bightPier","b":"FERRY","at":[560,890],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"walk bightPier","b":"ferry.bight","at":[560,890],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"walk bightPier","b":"walk flats","at":[350,880],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"under by 3.9 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"walk bightPier","b":"yearWalk","at":[415.5,897.6],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 6.2 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"walk bightPier","b":"yearWalk","at":[422.8,899],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 6.6 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"walk coveWalk","b":"ferry.scholarsCove","at":[630,240],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 32.8 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"walk coveWalk","b":"host.library.approach","at":[762,422],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"walk crown","b":"crownLaunch.stair","at":[1343.7,474.9],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change; RESERVED R-A3: waits on the gondola top station"},
 {"a":"walk crown","b":"G1","at":[1365.9,586.1],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"RESERVED R-A3: waits on the gondola top station"},
 {"a":"walk crown","b":"G1","at":[1372.4,615.2],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"RESERVED R-A3: waits on the gondola top station"},
 {"a":"walk crown","b":"G1","at":[1388.3,685.3],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"RESERVED R-A3: waits on the gondola top station"},
 {"a":"walk crown","b":"ORE","at":[1351.2,471.2],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"walk crown","b":"ORE","at":[1370.4,581],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"walk crown","b":"ORE","at":[1373.9,614.8],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"walk crown","b":"southPortal.link","at":[1370,690],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"walk crown","b":"stepsPortage","at":[1355.2,469.9],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 124.3 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"walk crown","b":"stepsPortage","at":[1367.8,476.7],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 126.6 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"walk crown","b":"underground.bellGallery","at":[1317,494.6],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"walk crown","b":"walk crownFromGondola","at":[1310,500],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change; RESERVED R-A3: waits on the gondola top station"},
 {"a":"walk crown","b":"walk crownFromGondola","at":[1376,574.7],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 19.8 eu: a named structure (footbridge, deck or passage) is owed; RESERVED R-A3: waits on the gondola top station"},
 {"a":"walk crown","b":"walk summit","at":[1310,500],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change; RESERVED R-A3: waits on the gondola top station"},
 {"a":"walk crown","b":"yearWalk","at":[1371.2,689.7],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"walk crown","b":"yearWalk","at":[1379.9,687.4],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"walk crown","b":"yearWalk","at":[1414.5,604.8],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 21.1 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"walk crownFromGondola","b":"crownLaunch.stair","at":[1320.4,479.2],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"RESERVED R-A3: waits on the gondola top station"},
 {"a":"walk crownFromGondola","b":"DEEP_RUN","at":[1341.3,445.2],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"RESERVED R-A3: waits on the gondola top station"},
 {"a":"walk crownFromGondola","b":"DEEP_RUN","at":[1437.6,512.9],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"RESERVED R-A3: waits on the gondola top station"},
 {"a":"walk crownFromGondola","b":"G1","at":[1360,560],"resolution":"threshold","kind":"modeTransfer","source":"bake v1.8","note":"boarding threshold; mover pending; RESERVED R-A3: waits on the gondola top station"},
 {"a":"walk crownFromGondola","b":"ORE","at":[1334.3,454.3],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"RESERVED R-A3: waits on the gondola top station"},
 {"a":"walk crownFromGondola","b":"ORE","at":[1369.1,568.4],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"RESERVED R-A3: waits on the gondola top station"},
 {"a":"walk crownFromGondola","b":"stepsPortage","at":[1332.3,457.5],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 117.5 eu: a named structure (footbridge, deck or passage) is owed; RESERVED R-A3: waits on the gondola top station"},
 {"a":"walk crownFromGondola","b":"underground.bellGallery","at":[1315.5,489.2],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"RESERVED R-A3: waits on the gondola top station"},
 {"a":"walk crownFromGondola","b":"V02","at":[1443.1,526.5],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"RESERVED R-A3: waits on the gondola top station"},
 {"a":"walk crownFromGondola","b":"walk summit","at":[1310,500],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change; RESERVED R-A3: waits on the gondola top station"},
 {"a":"walk crownFromGondola","b":"yearWalk","at":[1422.1,589.2],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"RESERVED R-A3: waits on the gondola top station"},
 {"a":"walk crownFromGondola","b":"yearWalk","at":[1446.4,537.2],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"RESERVED R-A3: waits on the gondola top station"},
 {"a":"walk damCrest","b":"damGallery.exit","at":[1162,903],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"walk damCrest","b":"river lower","at":[1140.2,903],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"walk dune","b":"zipLanding.ramp","at":[1079.2,1469],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"under by 6.6 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"walk dune","b":"zipLanding.stair","at":[1144.1,1458.9],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"under by 2.7 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"walk garden","b":"brook","at":[896.9,615.6],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"walk garden","b":"brook","at":[897.8,610.8],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"walk garden","b":"host.cottage.approach","at":[916.5,638.7],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"walk garden","b":"host.glasshouse.approach","at":[990,780],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"walk garden","b":"host.library.approach","at":[762,422],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"walk garden","b":"walk coveWalk","at":[762,422],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"walk garden","b":"walk lakerim","at":[990,780],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"walk garden","b":"yearWalk","at":[780.9,443.7],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"walk garden","b":"yearWalk","at":[807.5,474.1],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"under by 3.9 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"walk garden","b":"yearWalk","at":[899.6,638.9],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"under by 3.9 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"walk garden","b":"yearWalk","at":[900,640],"resolution":"under","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"walk garden","b":"yearWalk","at":[902.3,641.1],"resolution":"under","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"walk garden","b":"yearWalk","at":[961,757],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 14.6 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"walk garden","b":"yearWalk","at":[963.7,759.4],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 15.2 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"walk glasshouseSteps","b":"host.glasshouse.approach","at":[997.1,811.8],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"under by 4.6 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"walk lakerim","b":"damGallery.flight.1","at":[1165,905.2],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"walk lakerim","b":"host.glasshouse.approach","at":[990,780],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"walk lakerim","b":"river lower","at":[1140,905],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"walk lakerim","b":"yearWalk","at":[1244.4,852.1],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":"at-grade meeting 2.3 eu apart: regrade owed"},
 {"a":"walk lakerim","b":"yearWalk","at":[1244.5,851.9],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":"at-grade meeting 2.3 eu apart: regrade owed"},
 {"a":"walk lakerim","b":"yearWalk","at":[1250.5,837.6],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"walk prow","b":"DEEP_RUN","at":[1610.9,709.5],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"walk prow","b":"seaStair","at":[1620,760],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"walk prow","b":"yearWalk","at":[1567.7,600.9],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 11.2 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"walk prow","b":"yearWalk","at":[1571.6,606.8],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 11.3 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"walk prow","b":"yearWalk","at":[1591.5,908.6],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 33.9 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"walk prow","b":"yearWalk","at":[1598.3,664],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 10.8 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"walk prow","b":"yearWalk","at":[1605.7,689.4],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 13.6 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"walk prow","b":"yearWalk","at":[1607.5,847.7],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 26.7 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"walk prow","b":"ZIP","at":[1597.3,661.1],"resolution":"under","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"walk reach","b":"highSpan.walk","at":[1240,1130],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"walk reach","b":"town.quayLink","at":[1400,1290],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"walk reach","b":"town.riverLink","at":[1400,1290],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"walk reach","b":"ZIP","at":[1272.3,1202.8],"resolution":"under","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"walk reach","b":"ZIP","at":[1272.9,1201.8],"resolution":"under","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"walk square","b":"gondolaBase.walk","at":[1480,1060],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"walk square","b":"host.bank.approach","at":[1466.3,1162.9],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"walk square","b":"host.home.approach","at":[1455,1175],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"walk square","b":"town.bankLink","at":[1455,1175],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"walk square","b":"town.quayLink","at":[1455,1175],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"walk summit","b":"stepsPortage","at":[1310.1,445.5],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 120.4 eu: a named structure (footbridge, deck or passage) is owed; RESERVED R-A3: waits on the gondola top station"},
 {"a":"walk summit","b":"underground.bellGallery","at":[1310,470],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"RESERVED R-A3: waits on the gondola top station"},
 {"a":"yearWalk","b":"DEEP_RUN","at":[1450.1,522.8],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"yearWalk","b":"DEEP_RUN","at":[1575.7,660.7],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"yearWalk","b":"DEEP_RUN","at":[1579.4,666],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"yearWalk","b":"DEEP_RUN","at":[1580.8,667.8],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"yearWalk","b":"DEEP_RUN","at":[1600.5,695.7],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"yearWalk","b":"DEEP_RUN","at":[1611.3,710],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"yearWalk","b":"DEEP_RUN","at":[1649.9,743.2],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"yearWalk","b":"FERRY","at":[560,1096.4],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"yearWalk","b":"FERRY","at":[560,1099],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"yearWalk","b":"FERRY","at":[560.2,1099.1],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"yearWalk","b":"FERRY","at":[560.5,1096.7],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"yearWalk","b":"G1","at":[1385.1,671.2],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"RESERVED R-A3: waits on the gondola top station"},
 {"a":"yearWalk","b":"G1","at":[1388.6,686.7],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"RESERVED R-A3: waits on the gondola top station"},
 {"a":"yearWalk","b":"G1","at":[1421.9,833.4],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"RESERVED R-A3: waits on the gondola top station"},
 {"a":"yearWalk","b":"ORE","at":[1345,680],"resolution":"threshold","kind":"modeTransfer","source":"bake v1.8","note":"boarding threshold; mover pending"},
 {"a":"yearWalk","b":"ORE","at":[1349.6,671.6],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"yearWalk","b":"ORE","at":[1355.1,661.5],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"yearWalk","b":"plot.bight.1.service","at":[871.2,914.9],"resolution":"under","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"yearWalk","b":"plot.terraces.1.service","at":[1594.9,834],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"yearWalk","b":"plot.terraces.2.service","at":[1575.6,912.8],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"yearWalk","b":"plot.terraces.3.service","at":[1547,974.1],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"yearWalk","b":"river upper","at":[1161.9,725.2],"resolution":"under","kind":"crossing","source":"bake v1.8","note":"under by 8 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"yearWalk","b":"seaStair","at":[1630.8,761.9],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 5.6 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"yearWalk","b":"seaStair","at":[1650.3,765.4],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 15.2 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"yearWalk","b":"southPortal.link","at":[1345,680],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 3 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"yearWalk","b":"southPortal.link","at":[1347.7,681.4],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 2.8 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"yearWalk","b":"southPortal.link","at":[1349.7,682.4],"resolution":"over","kind":"crossing","source":"bake v1.8","note":"over by 2.9 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a":"yearWalk","b":"town.storefront","at":[1494.5,1211.8],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"yearWalk","b":"town.storefront","at":[1495,1212.4],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"yearWalk","b":"ZIP","at":[1577.6,693.9],"resolution":"under","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"yearWalk","b":"ZIP","at":[1579.6,690.7],"resolution":"under","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"yearWalk","b":"ZIP","at":[1581.9,686.8],"resolution":"under","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"yearWalk","b":"ZIP","at":[1596.1,663.2],"resolution":"under","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"ZIP","b":"river lower","at":[1273.1,1201.5],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"ZIP","b":"river lower","at":[1273.1,1201.5],"resolution":"over","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"zipLanding.ramp","b":"ZIP","at":[1130,1440],"resolution":"threshold","kind":"modeTransfer","source":"bake v1.8","note":"boarding threshold; mover pending"},
 {"a":"zipLanding.stair","b":"ZIP","at":[1130,1440],"resolution":"threshold","kind":"crossing","source":"bake v1.8","note":""},
 {"a":"zipLanding.stair","b":"zipLanding.ramp","at":[1130,1440],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"},
 {"a":"zipLanding.stair","b":"zipLanding.ramp","at":[1145,1460],"resolution":"threshold","kind":"junction","source":"bake v1.8","note":"flush path junction: no marker, no mode change"}
]
register += [row for row in CROSSINGS_V18_COMPUTED if not _covered(row)]
m["crossings"] = register
m["crossingRule"] = m["crossingRule"] + ". v1.8: every computed intersection of the Stage A build has a row; kind names the proof class (crossing, junction, sharedStretch, footway, waterBody, waterConfluence, modeTransfer) and resolution stays over / under / threshold; rows with source 'bake v1.8' are the design lead's acceptance of the computed resolution and never create a register pad or a dismount threshold; reserved names the decision a row waits on"

# 2. Glasshouse footprint drawn in off Stillwater (T2): 25 × 18 centred [1007.5,790], ≥ 3 m clear of the lake.
gh = next(h for h in m["hosts"] if h["id"] == "glasshouse")
gh["v1_7"] = {"footprint_m": gh["footprint_m"], "xy": gh["xy"]}
gh["footprint_m"] = [25, 18]
gh["xy"] = [1007.5, 790]

# 3. High Span sky gate: its v1.7 bottom (h 9) sat under the river pools (9.97–10.8) and bank lip (T1). 40 × 12 at h 17 (11–23).
for g in m["sky"]["gates"]:
    if g["id"] == "highSpan":
        g["v1_7"] = {"h": g["h"], "aperture_m": g["aperture_m"]}
        g["h"] = 17
        g["aperture_m"] = [40, 12]
        g["note"] = "under the deck (deck h 24, riverbed h 8): 40 × 12 at h 17 (11–23), clear of the river pools (≤ 10.8) and the bank lip; the Notch is ≥ 54 m wide there (T1)"

# 4. Views: page A no longer frames "the Crown behind" (the Shoulder's in-band rim hides the summit from the square
#    by 4–16 eu; page E is the Crown's page); page D's portrait drops the Lamp until the Pass 2b lighthouse (2 px at 390).
#    Every page gets a machine subject list in the frame vocabulary (the proof reads it; the code table is the fallback).
SUBJECTS_V18 = {
 "A": ["the High Span", "the dam's glass face", "the Shoulder"],
 "B": ["the Bight Bridge", "the Flats", "the hook"],
 "C": ["the road deck", "the skate shelf", "the walk at the water"],
 "D": ["surf", "the Lamp", "the zipline landing"],
 "E": ["Stillwater", "the Green", "the Hollow", "the Flats", "the Bight", "the sea"],
 "F": ["L01", "the town below"],
 "G": ["the Throat's mouth of daylight", "the skylight shaft"],
 "H": ["the strip", "the west sea"],
 "I": ["the spring", "the Reach water"],
 "J": ["the arch", "the Stacks", "the Prow"],
 "K": ["the Glasshouse", "Stillwater"],
 "L": ["Lantern Row", "the Boathouse"],
}
for v in m["views"]:
    v["subjects"] = SUBJECTS_V18[v["id"]]
    if v["id"] == "A":
        v["v1_7_frames"] = v["frames"]
        v["frames"] = "the High Span's deck line, the dam's glass face, the Shoulder"
        v["deferred"] = v["deferred"] + ["the Crown (hidden from the square by the Shoulder's own rim, 4–16 eu over the sight line inside its band; page E holds it)"]
    if v["id"] == "D":
        v["portrait"]["v1_7_frames"] = v["portrait"]["frames"]
        v["portrait"]["frames"] = ["surf", "the zipline landing"]
        v["deferred"] = v["deferred"] + ["the Lamp in portrait (2 px at 390 × 844 until the Pass 2b lighthouse; it stays a 16:9 subject)"]

# 5. District hearts (the Voronoi partition's seeds) are data, not a code table (R1-67).
HEARTS_V18 = {"harbour": [1470, 1170], "landing": [1060, 1410], "reach": [1280, 1260], "green": [1030, 1060], "hollow": [985, 580], "scholars": [765, 400], "flats": [420, 685], "bight": [745, 995], "lakeside": [1130, 820], "notch": [1205, 1070], "prow": [1600, 780], "crown": [1310, 470]}
for d in m["districts"]:
    if d["id"] in HEARTS_V18: d["heart"] = HEARTS_V18[d["id"]]

# ---------------------------------------------------------------------------
# v1.9 — Stage A fixer wave 3, track W3-A (beds, structures and data), 26 September 2026.
# Every delta below is listed in docs/horizon/README.md → "v1.9 deltas (Stage A, W3-A)".
# Ids never change (CONTRACT §2.13); numbers move, fields are added.
# ---------------------------------------------------------------------------
m["version"] = "1.9"
m["date"] = "2026-09-26"
YW = m["journey"]["yearWalk"]
YW_V18_PTS = [list(p) for p in YW["pts"]]
YW_EDITS_V19 = []
def yw_replace(old, new, why):
    """Replace one run of Year Walk control points (matched exactly, once) and record it."""
    pts = YW["pts"]
    hits = [i for i in range(len(pts) - len(old) + 1) if pts[i:i + len(old)] == old]
    assert len(hits) == 1, (old, hits)
    i = hits[0]
    YW["pts"] = pts[:i] + new + pts[i + len(old):]
    YW_EDITS_V19.append({"was": old, "now": new, "why": why})

# 1. Scholars: the March in-leg ran 3-4 eu over the Garden Walk's shoulder at [802,468] (the Glasshouse and
#    Cottage door walks stopped there). It becomes the north lane of the March out-leg, 3.5 m from it at one
#    height, and crosses the Garden Walk flush beside the out-leg's crossing.
yw_replace([[885,465],[815,470],[800,480],[755,480],[700,470]],
           [[885,465],[872,461.7],[857,441.3],[789.3,436.5],[769.2,446.5],[715,446.5],[700,470]],
           "the March in-leg is the out-leg's north lane (3.5 m, one height) instead of a second line 3-4 eu over the Garden Walk at [802,468]")

# 2. The Hollow (P08 pin clusters at [994,613] and [953,632]: fixed heights 22-53 eu of route short).
#    May's pad sat on the Hollow floor at 31.5, 7.3 eu under the Green Road footway it leaves 45 m
#    before; September's at 33 was 5.8 under the same footway 37 m before it. Both pads rise to a
#    terrace the footway can reach at the walk grade (May 37, September 35), and the April lane
#    gets two levels so it takes the Hollow's 17 eu band face at 12 % (it rode the 8 % typical
#    grade 6-13 eu over the Hollow floor): the plateau edge and the Cottage front walk's bench.
YW_PIN_H_V19 = {"may": 37, "sep": 40, "jan": 112.8}
for p in YW["pins"]:
    if p["station"] in YW_PIN_H_V19:
        p["v1_8_h"] = p["h"]
        p["h"] = YW_PIN_H_V19[p["station"]]
yw_replace([[910,565],[925,585],[905,610]], [[910,565],[935,585],[905,610]],
           "the April lane swings 10 m further east above the Hollow so its 18 eu band-face descent to the S4 footway fits 12 % (148 → 164 m)")
YW["levels"] = [
 {"xy": [1358, 685], "h": 110, "r": 14, "why": "the south portal forecourt: both January legs cross the ORE station's link walk (110) there at its height"},
]
# 3. The Hollow neck (x 893-913, z 600-660): the brook, S4, the Garden Walk and both Hollow lanes run side by side on the
#    brook's east bank. The lanes were 2-8 eu over S4 and the Garden Walk there (separation S4 69 samples, a generated
#    S4 x Year Walk deck across the Garden Walk). Through the neck both lanes are S4's east footway (one height, no wall),
#    and S4 meets the Cottage front walk at grade (36) instead of passing 2.8 eu under it (junction.cross.s4.walkGarden.3).
YW["shares"] += [
 {"stretch": "apr", "host": "S4", "side": "east", "offset_m": 6, "from": [905, 610], "to": [899, 660], "note": "v1.9: the April lane is S4's east footway through the Hollow neck, at S4's height"},
 {"stretch": "jun", "host": "S4", "side": "east", "offset_m": 8, "from": [903, 628], "to": [902, 660], "note": "v1.9: the June lane, 3 m further out on the same footway"},
]
YW["levelsRule"] = "levels are extra height pins on the Year Walk's own (unshared) stretches: the builder pins the nearest walk sample to h, so the grade between two pins can use the walk maximum where the ground demands it"

# 4. January: the pad (117) sat 7 eu over the turning circle with 37 m of walk between them (P08 36 % at [1369,689]);
#    it steps down to 114 (a 3 m sunken terrace on the Shoulder top), see YW_PIN_H_V19 and the south portal level above.
# 5. The Lakeside switchback (T0 #16): the v1.7 zig-zag legs were 20-30 m long, 5 m apart and 12-16 %, and the walk left
#    it by crossing S1 at [1255,862] where S1 is 4 eu under the lake terrace (15-16 % both sides). Seven legs of 30 m on a
#    5.5 m pitch (x 1325-1292, z 852-882) with turning landings; the exit crosses S1 at grade at [1267,842], where S1
#    stands at the terrace height (55), and meets the rim trail at [1251,836] (the February share starts there).
SWITCHBACK_X = [1325, 1317.6, 1310.2, 1302.8, 1295.4, 1288, 1280.6]
sb = [[1330, 885]]
for k, x in enumerate(SWITCHBACK_X):
    top, bottom = (880, 852) if k % 2 == 0 else (852, 880)
    sb += [[x, top], [x, bottom]]
    if k + 1 < len(SWITCHBACK_X):
        nx = SWITCHBACK_X[k + 1]; sb.append([round((x + nx) / 2, 1), bottom - 3.5 if bottom == 852 else bottom + 3.5])
sb += [[1276, 846], [1267, 842], [1251, 836]]
yw_replace([[1330,885],[1320,880],[1315,865],[1320,885],[1305,845],[1305,875],[1300,855],[1300,880],[1295,860],[1295,880],[1290,860],[1290,885],[1285,870],[1285,880],[1245,855],[1250,845]],
           sb,
           "the Lakeside switchback: seven 28 m legs on a 7.4 m pitch (walk surfaces 2.2 m apart, shoulders meeting as the walls between legs) at <= 12 %, leaving at grade across S1 at [1267,842] to the rim trail")
m["structures"]["lakesideSwitchback"] = {"kind": "switchbackRamp", "route": "yearWalk", "bbox": [[1274, 843], [1331, 889]], "legs": 7, "pitch_m": 7.4,
 "note": "v1.9 (T0 #16): the Year Walk's seven legs down the Shoulder's south-west corner to the lake terrace; each leg's downhill shoulder is carried to the leg below as a masonry retaining wall (the builder grounds it: no leg hangs over the next)"}
YW["s1Crossing"] = [1267, 842]
for sh in YW["shares"]:
    if sh["stretch"] == "feb" and sh["host"] == "walk lakerim":
        sh["v1_8_from"] = sh["from"]; sh["from"] = [1251, 836]
YW["crossings"] = YW["crossings"].replace("at [1255,862] (to be regraded flush)", "at [1267,842] (v1.9: flush, where S1 stands at the lake terrace height)")
# 6. Horizon Drive's north-east corner (T0 #14, P09 72.7 / P12 74.3 / P32 pad 70 over the sea): the v1.6 control [1500,340]
#    made the Drive a 330 m chord over the sea from x 1370 to [1545,470] at 65-70 (the NE cliff is vertical from ~105 to the
#    sea). The corner now follows the cliff 10 m inside its top (a cliff drive cut into the headland, like the Prow), and
#    Crown Road (V02) starts from the Drive at [1433.3,335.6] on that ledge (95 m before its tunnel portal: 6.6 %). The Year Walk's November/January verges are
#    re-laid as offsets of the new alignment (same sides and offsets as v1.7).
def spline5(ctrl, step=5):
    out = []
    for i in range(len(ctrl) - 1):
        a, b, c, d = ctrl[max(0, i - 1)], ctrl[i], ctrl[i + 1], ctrl[min(len(ctrl) - 1, i + 2)]
        n = max(1, math.ceil(math.dist(b, c) / step))
        for k in range(n):
            t = k / n; t2 = t * t; t3 = t2 * t
            out.append([(2*t3-3*t2+1)*b[j] + (t3-2*t2+t)*(c[j]-a[j])*.35 + (-2*t3+3*t2)*c[j] + (t3-t2)*(d[j]-b[j])*.35 for j in (0, 1)])
    out.append(list(ctrl[-1])); return out
def offset_run(line, side_point, off, start, end, spacing=40):
    """Points at plan offset `off` from polyline `line` (side toward side_point), from the arc nearest `start` to the arc nearest `end`, every ~spacing m."""
    arcs = [0.0]
    for i in range(1, len(line)): arcs.append(arcs[-1] + math.dist(line[i - 1], line[i]))
    def near(q): return min(range(len(line)), key=lambda i: math.dist(line[i], q))
    i0, i1 = near(start), near(end); step = 1 if i1 >= i0 else -1
    picks = [i0]
    for i in range(i0, i1 + step, step):
        if abs(arcs[i] - arcs[picks[-1]]) >= spacing: picks.append(i)
    if picks[-1] != i1:
        if abs(arcs[i1] - arcs[picks[-1]]) < spacing * .5 and len(picks) > 1: picks[-1] = i1
        else: picks.append(i1)
    out = []
    for i in picks:
        a, c = line[max(0, i - 1)], line[min(len(line) - 1, i + 1)]
        dx, dz = c[0] - a[0], c[1] - a[1]; L = math.hypot(dx, dz) or 1
        n = (-dz / L, dx / L)
        if (side_point[0] - line[i][0]) * n[0] + (side_point[1] - line[i][1]) * n[1] < 0: n = (-n[0], -n[1])
        out.append([round(line[i][0] + n[0] * off, 1), round(line[i][1] + n[1] * off, 1)])
    return out
V01 = m["roads"]["V01"]
V01["v1_8_pts"] = [list(p) for p in V01["pts"]]
i = V01["pts"].index([1500, 340])
NE_V19 = [[1353.8, 295.8], [1397.2, 306.5], [1433.3, 335.6], [1461.6, 373.9], [1493.5, 406.5], [1520.4, 439.7], [1546, 472]]
V01["pts"] = V01["pts"][:i] + NE_V19[::-1] + V01["pts"][i + 1:]
V01["note_v1_9"] = "north-east corner re-laid on the cliff 10 m inside its top (was a chord over the sea through [1500,340]); Crown Road starts at [1433.3,335.6]"
V02 = m["roads"]["V02"]
V02["v1_8_pts"] = [list(p) for p in V02["pts"]]
V02["pts"][0] = [1433.3, 335.6]
v01s, v02s = spline5(V01["pts"]), spline5(V02["pts"])
INLAND = [1300, 700]
nov_sea_end = offset_run(v01s, [1316, 0], 6.5, [1316, 268], [1316, 268])[0]
nov = offset_run(v01s, INLAND, 9.5, [1346, 290], [1554.7, 520.2])
def seg_dist(q, line):
    best = 1e9
    for a, b in zip(line, line[1:]):
        dx, dz = b[0] - a[0], b[1] - a[1]; t = max(0, min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / (dx * dx + dz * dz or 1)))
        best = min(best, math.hypot(q[0] - a[0] - dx * t, q[1] - a[1] - dz * t))
    return best
# January walks up V01's inland verge and turns onto Crown Road's east verge where the two verges meet (the
# inside corner of the junction), without crossing V02.
jn = min(range(len(v01s)), key=lambda i: math.dist(v01s[i], [1433.3, 335.6]))
turn = jn
while turn > 0 and seg_dist(offset_run(v01s, INLAND, 6.5, v01s[turn], v01s[turn])[0], v02s) < 6.5: turn -= 1
# The corner itself (15 m either side of the verges' meeting point) is the walk's own stretch, graded between
# the two hosts' heights (V01 falls to the south-east, V02 climbs to the south).
corner_a = offset_run(v01s, INLAND, 6.5, v01s[turn], v01s[turn])[0]
k02 = min(range(len(v02s)), key=lambda i: math.dist(v02s[i], corner_a))
corner_b = offset_run(v02s, [1600, 400], 6.5, v02s[k02], v02s[k02])[0]
tip = [(corner_a[0] + corner_b[0]) / 2, (corner_a[1] + corner_b[1]) / 2]
jc = [1433.3, 335.6]; bis = [tip[0] - jc[0], tip[1] - jc[1]]; bl = math.hypot(*bis)
corner_t = [round(tip[0] + bis[0] / bl * 3, 1), round(tip[1] + bis[1] / bl * 3, 1)]
corner_a8 = offset_run(v01s, INLAND, 6.5, v01s[max(0, turn - 2)], v01s[max(0, turn - 2)])[0]
corner_b8 = offset_run(v02s, [1600, 400], 6.5, v02s[min(len(v02s) - 1, k02 + 2)], v02s[min(len(v02s) - 1, k02 + 2)])[0]
corner = [corner_a8, corner_t, corner_b8]
jan01 = offset_run(v01s, INLAND, 6.5, [1555.2, 508.1], v01s[max(0, turn - 4)])
jan02 = offset_run(v02s, [1600, 400], 6.5, v02s[min(len(v02s) - 1, k02 + 4)], [1449.5, 447.4])
yw_replace([[1319.7,258.5],[1340.4,281.3],[1379.9,294.4],[1415.6,307.5],[1453.6,323.6],[1487.1,341.9],[1508.5,367.9],[1524.1,404.6],[1535.4,441.5],[1545.7,481.6],[1554.7,520.2]],
           [nov_sea_end] + nov,
           "November's inland verge re-laid 9.5 m inside the re-aligned Drive round the north-east corner")
yw_replace([[1555.2,508.1],[1546.3,471.5],[1536.1,432.7],[1524.2,396],[1506.8,358.9],[1495.4,344.6],[1505.5,343.5],[1482.9,377.2],[1461,411.8],[1449.5,447.4]],
           jan01 + corner + jan02,
           "January's inland verge and Crown Road's east verge re-laid on the re-aligned corner and junction")
for sh in YW["shares"]:
    if sh["stretch"] == "nov" and sh["host"] == "V01" and sh["side"].startswith("seaward"): sh["v1_8_to"] = sh["to"]; sh["to"] = nov_sea_end
    if sh["stretch"] == "nov" and sh["host"] == "V01" and sh["side"] == "inland": sh["v1_8_from"] = sh["from"]; sh["from"] = nov[0]
    if sh["stretch"] == "jan" and sh["host"] == "V01": sh["v1_8_to"] = sh["to"]; sh["to"] = jan01[-1]
    if sh["stretch"] == "jan" and sh["host"] == "V02": sh["v1_8_from"] = sh["from"]; sh["from"] = jan02[0]
# 7. February and September above the Hollow (P12: the February line rode the Crown's flank at 65-67 over the September
#    line at 40-44, 5 m away; 24 eu unsupported runs at [1046-1056,519-529]). February comes down onto the shelf (45) east of
#    September and the two run as adjacent lanes (3.5 m, one height) through the shelf's narrow north end to [1000,480].
yw_replace([[1055,710],[1100,600],[1085,555],[1070,535],[960,470]],
           [[1055,710],[1052,662],[1060,600],[1062,540],[1060,505],[1050,487],[1000,480],[960,470]],
           "February leaves the Crown's flank for the 45 shelf (September no longer uses it)")
vgs = spline5(m["roads"]["VG"]["pts"])
sep_vg = offset_run(vgs, [700, 500], 6.5, [995, 590], [938, 385])
for st in m["journey"]["stations"]:
    if st["id"] == "sep": st["v1_8_xy"] = st["xy"]; st["xy"] = [1032, 652]; st["moveWhy_v1_9"] = "8 m west so February passes east of the pad on the 45 shelf (the pad's level pins held February at 35 there); the pad sits at 40, a 5 m terrace cut into the shelf's edge"
yw_replace([[1010,615],[1040,650],[1045,550],[1055,505],[1045,490],[995,470],[980,415],[945,370]],
           [[1010,615],[1032,652],[1025,626],[1010,604]] + sep_vg,
           "September returns from its pad across Green Road and walks its west footway north to the pass (it ran up the shelf beside February, 24 eu apart)")
YW["shares"].append({"stretch": "sep", "host": "VG", "side": "west", "offset_m": 6.5, "from": sep_vg[0], "to": sep_vg[-1], "note": "v1.9: Green Road's west footway from the September pad's return to the north pass"})
# 11. Terraces plot 3's margin (P31: the January lane 3.2 m from the plot edge, 12 samples in the 6 m margin): the Prow cliff
#     drive's control [1540,1000] moves 3.5 m away from the plots (east-south-east), and the December (seaward 6.5) and
#     January (inland 6.5) verges are re-laid on it.
V01["pts"][V01["pts"].index([1540, 1000])] = [1543.2, 1001.4]
v01s = spline5(V01["pts"])
dec_run = offset_run(v01s, [1800, 1200], 6.5, [1596.9, 703.2], [1500.3, 1038.1])
jan_run = offset_run(v01s, INLAND, 6.5, [1494.7, 1026.4], [1562.7, 548])
yw_replace([[1596.9,703.2],[1601.5,743.6],[1605.7,784.8],[1608.1,827.2],[1605.7,864.9],[1592.8,905.1],[1576.5,943.3],[1558.6,980.4],[1536.4,1014.4],[1502.6,1037],[1500.3,1038.1]],
           dec_run, "December's seaward verge re-laid on the Prow cliff drive after its [1540,1000] control moved 3.5 m off the Terraces plots")
yw_replace([[1494.7,1026.4],[1527.3,1005.1],[1548.8,970.9],[1564.7,937.9],[1580.6,900.4],[1593,862.2],[1595,822.6],[1592.7,785.9],[1588.9,747.7],[1584,704.7],[1579.2,664],[1574.3,626.7],[1568.7,586.5],[1562.7,548]],
           jan_run, "January's inland verge re-laid on the moved Prow cliff drive (6.5 m, now 6 m clear of Terraces plot 3's margin)")
for sh in YW["shares"]:
    if sh["stretch"] == "dec" and sh["host"] == "V01": sh["v1_8_from"], sh["v1_8_to"] = sh["from"], sh["to"]; sh["from"], sh["to"] = dec_run[0], dec_run[-1]
    if sh["stretch"] == "jan" and sh["host"] == "V01": sh["v1_8_from"] = sh["from"]; sh["from"] = jan_run[0]
# 13. January at the south portal (P16: the Year Walk 2.65 over the Ore Line's approach at [1349.6,671.6], rail clearance 3.2):
#     both January legs keep west of the rail's cut, as two lanes 3.5 m apart between the pad and the portal forecourt.
yw_replace([[1330,640],[1355,660],[1350,685],[1375,690]], [[1330,640],[1339,662],[1344,684],[1375,690]],
           "January's first leg leaves the pad west of the Ore Line's approach cut")
yw_replace([[1345,680],[1355,675],[1330,660],[1345,650],[1330,640]], [[1340.5,687.5],[1335.5,663],[1330,640]],
           "January's last leg returns as the first leg's west lane (3.5 m), west of the Ore Line")
for lv in YW["levels"]:
    if lv["xy"] == [1358, 685]: lv["v1_9_first_xy"] = lv["xy"]; lv["xy"] = [1350, 687]; lv["r"] = 9
YW["v1_9_edits"] = YW_EDITS_V19

# 8. Named footbridges (P12 unsupported runs / "two foot routes crossing" with no bridge; R1-04, R1-10, R1-31). Each is
#    built by the structures builder on the route's own grade, with bents outside every lower corridor and a truss over the
#    opening; a bent that would stand in a corridor is refused and reported.
m["structures"]["gardenWalkBridge"] = {"xy": [965.7, 761.1], "kind": "footbridge", "route": "walk garden", "span_m": 40, "opening_m": 26, "width_m": 3.2,
 "deck": "the Garden Walk on its own grade (51-55)", "under": "Green Road (37) and its May/September footway lanes, 15 eu below",
 "note": "v1.9: the Garden Walk hung 16.7 eu over Green Road at [971,765] with no structure (the generated span found no footing within 20 m); the reserved at-grade threshold row VG x walk garden (R-A7) is unchanged"}
m["structures"]["crownWalkBridge"] = {"xy": [1410.1, 605.8], "kind": "footbridge", "route": "walk crown", "span_m": 36, "opening_m": 24, "width_m": 3.2,
 "deck": "the Crown walk on its own grade (119-122)", "under": "Crown Road's cutting (99) and its January footway lane",
 "note": "v1.9: the Crown walk hung 21 eu over Crown Road at [1400-1417,605] (span refused: no footing outside the corridors)"}

# 9. The Prow walk (T0 note 5; P12: 22 runs up to 38.5 eu over V01's cutting and the Year Walk's Prow footways; six
#    "two foot routes crossing" rows 12-34 eu). It keeps to the Prow top east of the cutting: from the south lookout over
#    the harbour, past the November station, between the Year Walk's two Prow lanes, onto the west lane at [1630,790].
m["walks"]["prow"]["v1_8_pts"] = m["walks"]["prow"]["pts"]
m["walks"]["prow"]["pts"] = [[1590, 998], [1606, 950], [1616, 928], [1641, 924], [1641, 880], [1640, 812], [1633, 790]]
m["walks"]["prow"]["note_v1_9"] = "re-laid on the Prow top east of V01's cutting (was along the cutting's lip, over it twice); joins the Year Walk's west Prow lane at [1630,790], short of the sea stair's head"

# 12. Reserves (P31, D-2 for Jonathan, reversible): the Bight trail ran through all four Bight plots (27-28 samples inside
#     each). It becomes the Bight Shore spur's landward footway (builder: `footwayOf`, the spur's heights, no wall between);
#     its v1.8 shore line is kept in `v1_8_pts`. The hangar bay (plot.flats.1) moves 7 m east out of the strip's 6 m margin
#     and is served from the strip edge at its west door (its access walk is its service).
m["walks"]["bight"]["v1_8_pts"] = m["walks"]["bight"]["pts"]
m["walks"]["bight"]["footwayOf"] = {"host": "VBS", "offset_m": 4.2, "side_xy": [1100, 1100], "why": "D-2 (v1.9): the four Bight plots and their 6 m margins fill the land between the spur and the shore; the trail walks the spur's landward verge at the spur's height"}
hb = m["reserves"]["small"]["hangarBay"]
hb["v1_8_xy"] = hb["xy"]; hb["xy"] = [458.2, 600]; hb["size_m"] = [11, 18]; hb["door"] = "west, on the strip edge; its access walk is plot.flats.1.service"
hb["note_v1_9"] = "an 11 m bay facing the strip, 18 m deep, between the strip's 6 m margin and S2's (the 18 m face did not fit the 26 m between them)"
m["structures"]["jettiesV1_8"] = {"bightShore": m["structures"]["jetties"]["bightShore"], "why": "v1.9: the Bight Shore jetty moved 17 m north-west, out of plot bight.2's 6 m margin"}; m["structures"]["jetties"]["bightShore"] = [728, 946]

# 14. The Bight pier (P12: the pier walk ran on at the Flats' height, 36 eu over the Bight, to the ferry stop): the walk
#     stops at the cliff top and a stair takes it down to a jetty at the ferry stop (the stair crosses the wash's dry mouth
#     and S2's bridge lane high above them). The dune walk starts at the zip landing's foot, not under its stair (P16 2.21),
#     and runs 10-18 m south of the landing ramp's trestle (it ran under the trestle's south leg for 60 m: no bent could stand).
#     The Year Walk's two Prow lanes cross the sea stair's cutting on two short named footbridges.
m["walks"]["bightPier"]["v1_8_pts"] = m["walks"]["bightPier"]["pts"]
m["walks"]["bightPier"]["pts"] = [[350, 880], [430, 900], [498, 896]]
m["structures"]["bightPierStair"] = {"kind": "stair", "from": [498, 896], "to": [557.5, 896], "note": "v1.9: from the Flats' cliff top (the pier walk's end) down to the Bight ferry jetty"}
m["structures"]["jetties"]["bightPier"] = [560, 896]
m["walks"]["dune"]["v1_8_pts"] = m["walks"]["dune"]["pts"]
m["walks"]["dune"]["pts"] = [[1148, 1463], [1125, 1481], [1000, 1480]] + m["walks"]["dune"]["pts"][2:]
m["structures"]["seaStairWestLaneBridge"] = {"xy": [1630.9, 762.8], "kind": "footbridge", "route": "yearWalk", "span_m": 14, "opening_m": 7, "width_m": 5.4, "deck": "the Year Walk's west Prow lane (54)", "under": "the sea stair's cutting (49)", "note": "v1.9: the lane crossed the stair 4.9 eu over it with no structure"}
m["structures"]["seaStairEastLaneBridge"] = {"xy": [1650.3, 766.8], "kind": "footbridge", "route": "yearWalk", "span_m": 16, "opening_m": 8, "width_m": 5.4, "deck": "the Year Walk's east Prow lane (50.6)", "under": "the sea stair's cutting (36)", "note": "v1.9: the lane crossed the stair 14.2 eu over it with no structure"}

# 16. S1 through the High Span (W3-C A2, page C): S1 ran at grade 1-6 m east of its own skate shelf (x 1206-1219, 1 m over
#     it), hiding the shelf from camera C. It now rides the shelf (x 1204, z 1078-1135, h 12) — the builder pins it level there.
S1 = m["skate"]["S1"]
S1["v1_8_pts"] = [list(p) for p in S1["pts"]]
i = S1["pts"].index([1195, 1075])
S1["pts"] = S1["pts"][:i + 1] + [[1204, 1080], [1204, 1133]] + S1["pts"][i + 1:]

# 10. Views (W3-C requests A1, A4, A6, A7; each tested on the W3-C land): page A portrait at the viewRule minimum
#     field (45°); page E's eye at the run-off corner of the lookout deck (it stood on the deck centre, 44 % of the frame
#     deck); page K on the rim walk by the Glasshouse steps (the eye stood 1.4 eu under the walk); page L's portrait
#     from the quay's west end.
for v in m["views"]:
    if v["id"] == "A": v["portrait"]["v1_8_fov_deg"] = v["portrait"]["fov_deg"]; v["portrait"]["fov_deg"] = 45
    if v["id"] == "E": v["v1_8_xy"] = v["xy"]; v["xy"] = [1300.5, 485.5]
    if v["id"] == "K": v["v1_8_xy"] = v["xy"]; v["xy"] = [1006, 762]
    if v["id"] == "L": v["portrait"]["v1_8_xy"] = v["portrait"].get("xy"); v["portrait"]["xy"] = [1460, 1300]

# 15. The crossings register against the v1.9 build (every computed intersection keeps a row; the design lead accepts each
#     computed resolution, as in v1.8). Rows accepted from this bake carry source "bake v1.9". Bake rows with no plan hit in the
#     v1.9 build (the geometry they described moved) and duplicate bake rows are retired to routePairNotes; three authored rows
#     whose routes moved are retired with their reason; bake rows now met flush become junctions. Reserved rows are untouched.
REG_ADDED_V19 = [
 {"a": "bightPierStair", "b": "wash", "at": [513.8, 896], "resolution": "over", "kind": "crossing", "source": "bake v1.9", "note": ""},
 {"a": "damGallery.flight.2", "b": "damGallery.exit", "at": [1170.6, 910.8], "resolution": "threshold", "kind": "junction", "source": "bake v1.9", "note": "flush path junction: no marker, no mode change"},
 {"a": "jetty.bightPier", "b": "FERRY", "at": [560, 902], "resolution": "threshold", "kind": "crossing", "source": "bake v1.9", "note": "at-grade meeting 1 eu apart: regrade owed"},
 {"a": "jetty.bightPier", "b": "ferry.bight", "at": [560, 898], "resolution": "threshold", "kind": "sharedStretch", "source": "bake v1.9", "note": "shared stretch 8 eu at one height"},
 {"a": "S1", "b": "yearWalk", "at": [1266.9, 842], "resolution": "threshold", "kind": "crossing", "source": "bake v1.9", "note": ""},
 {"a": "S2", "b": "bightPierStair", "at": [509.9, 896], "resolution": "under", "kind": "crossing", "source": "bake v1.9", "note": ""},
 {"a": "S4", "b": "walk bight", "at": [873.5, 951.1], "resolution": "threshold", "kind": "crossing", "source": "bake v1.9", "note": "at-grade meeting 1 eu apart: regrade owed"},
 {"a": "S4", "b": "yearWalk", "at": [968.6, 540.5], "resolution": "under", "kind": "crossing", "source": "bake v1.9", "note": "under by 2.8 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a": "V01", "b": "V02", "at": [1433.3, 335.6], "resolution": "threshold", "kind": "crossing", "source": "bake v1.9", "note": ""},
 {"a": "V02", "b": "yearWalk", "at": [1436, 355.4], "resolution": "threshold", "kind": "crossing", "source": "bake v1.9", "note": ""},
 {"a": "VG", "b": "walk bight", "at": [960.4, 864.4], "resolution": "threshold", "kind": "crossing", "source": "bake v1.9", "note": ""},
 {"a": "walk bight", "b": "yearWalk", "at": [858.5, 977], "resolution": "threshold", "kind": "junction", "source": "bake v1.9", "note": "flush path junction: no marker, no mode change"},
 {"a": "walk bight", "b": "yearWalk", "at": [907.3, 888.6], "resolution": "over", "kind": "crossing", "source": "bake v1.9", "note": "over by 8.6 eu: a named structure (footbridge, deck or passage) is owed"},
 {"a": "walk bight", "b": "yearWalk", "at": [951.6, 867.7], "resolution": "threshold", "kind": "junction", "source": "bake v1.9", "note": "flush path junction: no marker, no mode change"},
 {"a": "walk bight", "b": "yearWalk", "at": [954.5, 866.6], "resolution": "threshold", "kind": "junction", "source": "bake v1.9", "note": "flush path junction: no marker, no mode change"},
 {"a": "walk bightPier", "b": "bightPierStair", "at": [498, 896], "resolution": "threshold", "kind": "crossing", "source": "bake v1.9", "note": "at-grade meeting 0.9 eu apart: regrade owed"},
 {"a": "walk lakerim", "b": "damGallery.exit", "at": [1166.2, 905.1], "resolution": "threshold", "kind": "junction", "source": "bake v1.9", "note": "flush path junction: no marker, no mode change"},
 {"a": "walk prow", "b": "yearWalk", "at": [1641, 881.6], "resolution": "threshold", "kind": "junction", "source": "bake v1.9", "note": "flush path junction: no marker, no mode change"},
 {"a": "yearWalk", "b": "southPortal.link", "at": [1369.7, 689.9], "resolution": "threshold", "kind": "junction", "source": "bake v1.9", "note": "flush path junction: no marker, no mode change"},
]
REG_RETIRED_V19 = [  # indices into the v1.8 register (each checked against its pair below)
 [38, "damGallery.flight.1", "damGallery.exit"],
 [39, "damGallery.flight.1", "water.stillwater"],
 [40, "damGallery.flight.2", "damGallery.exit"],
 [41, "damGallery.flight.2", "water.stillwater"],
 [49, "highSpan.overlook", "river lower"],
 [55, "jetty.lamp", "lampGallery.ramp"],
 [56, "jetty.lamp", "lampGallery.ramp"],
 [61, "lampGallery.ramp", "FERRY"],
 [62, "lampGallery.ramp", "FERRY"],
 [64, "lampGallery.ramp", "FERRY"],
 [67, "lampGallery.ramp", "lampGallery.stair"],
 [68, "lampGallery.ramp", "lampGallery.stair"],
 [84, "river lower", "reachChannel.2"],
 [94, "S1", "yearWalk"],
 [157, "V01", "S3"],
 [158, "V01", "S3"],
 [164, "V01", "V02"],
 [167, "V01", "walk prow"],
 [192, "VG", "yearWalk"],
 [194, "walk bight", "plot.bight.3.service"],
 [195, "walk bight", "plot.bight.4.service"],
 [196, "walk bightPier", "FERRY"],
 [197, "walk bightPier", "ferry.bight"],
 [227, "walk crownFromGondola", "V02"],
 [233, "walk dune", "zipLanding.ramp"],
 [234, "walk dune", "zipLanding.stair"],
 [241, "walk garden", "yearWalk"],
 [248, "walk lakerim", "damGallery.flight.1"],
 [251, "walk lakerim", "yearWalk"],
 [252, "walk lakerim", "yearWalk"],
 [254, "walk prow", "seaStair"],
 [255, "walk prow", "yearWalk"],
 [256, "walk prow", "yearWalk"],
 [257, "walk prow", "yearWalk"],
 [258, "walk prow", "yearWalk"],
 [259, "walk prow", "yearWalk"],
 [260, "walk prow", "yearWalk"],
 [261, "walk prow", "ZIP"],
 [288, "yearWalk", "ORE"],
 [289, "yearWalk", "ORE"],
 [290, "yearWalk", "ORE"],
 [298, "yearWalk", "southPortal.link"],
 [299, "yearWalk", "southPortal.link"],
 [300, "yearWalk", "southPortal.link"],
 [308, "ZIP", "river lower"],
]
REG_RERES_V19 = [
 {"a": "S4", "b": "walk garden", "at": [905.9, 640.6], "resolution": "threshold", "kind": "junction", "note": "v1.9: now a flush path junction (was under)"},
 {"a": "S4", "b": "yearWalk", "at": [900.7, 882.8], "resolution": "threshold", "kind": "junction", "note": "v1.9: now a flush path junction (was under)"},
 {"a": "S4", "b": "yearWalk", "at": [901.2, 629.8], "resolution": "threshold", "kind": "junction", "note": "v1.9: now a flush path junction (was under)"},
 {"a": "S4", "b": "yearWalk", "at": [902.6, 632.9], "resolution": "threshold", "kind": "junction", "note": "v1.9: now a flush path junction (was under)"},
 {"a": "VG", "b": "yearWalk", "at": [943.6, 471], "resolution": "threshold", "kind": "junction", "note": "v1.9: now a flush path junction (was under)"},
 {"a": "walk bightPier", "b": "walk flats", "at": [350, 880], "resolution": "threshold", "kind": "junction", "note": "v1.9: now a flush path junction (was under)"},
 {"a": "walk garden", "b": "yearWalk", "at": [899.6, 638.9], "resolution": "threshold", "kind": "junction", "note": "v1.9: now a flush path junction (was under)"},
 {"a": "walk garden", "b": "yearWalk", "at": [900, 640], "resolution": "threshold", "kind": "junction", "note": "v1.9: now a flush path junction (was under)"},
 {"a": "walk garden", "b": "yearWalk", "at": [902.3, 641.1], "resolution": "threshold", "kind": "junction", "note": "v1.9: now a flush path junction (was under)"},
]
REG_RETIRED_AUTHORED_V19 = {
 ("DEEP_RUN", "walk prow"): "the Prow walk (v1.9) keeps to the Prow top east of V01's cutting and no longer crosses the Deep run's line at [1611,710]",
 ("S2", "walk bightPier"): "the pier walk (v1.9) ends at the Flats' cliff top; S2 now passes under the Bight pier stair (a row accepted from the v1.9 bake)",
 ("walk bightPier", "water wash"): "the pier walk (v1.9) ends at the Flats' cliff top; the wash footbridge is retired and the Bight pier stair crosses the dry wash mouth",
}
def _same(row, r): return row["a"] == r["a"] and row["b"] == r["b"] and isinstance(row["at"], list) and abs(row["at"][0] - r["at"][0]) < .05 and abs(row["at"][1] - r["at"][1]) < .05
reg, retired_v19 = [], []
for idx, row in enumerate(m["crossings"]):
    if any(k == idx and row["a"] == a and row["b"] == b for k, a, b in REG_RETIRED_V19):
        retired_v19.append(row)
        m["routePairNotes"].append({"a": row["a"], "b": row["b"], "kind": "retired register row (v1.9)", "verification": "no plan intersection of this pair here in the v1.9 build (or a duplicate of a row that matches)", "sharedPlanPoints": [], "retiredRow": dict(row)})
        continue
    if (row["a"], row["b"]) in REG_RETIRED_AUTHORED_V19 and not row.get("reserved") and row.get("source") != "bake v1.8":
        m["routePairNotes"].append({"a": row["a"], "b": row["b"], "kind": "retired register row (v1.9)", "verification": REG_RETIRED_AUTHORED_V19[(row["a"], row["b"])], "sharedPlanPoints": [], "retiredRow": dict(row)})
        continue
    for r in REG_RERES_V19:
        if _same(row, r):
            row = dict(row); row["v1_8_resolution"] = row["resolution"]; row["resolution"] = r["resolution"]; row["kind"] = r["kind"]
            row["note"] = (row["note"] + "; " if row.get("note") else "") + r["note"]
    reg.append(row)
m["crossings"] = reg + REG_ADDED_V19

# v1.9 · Stage A integrator 2 (26 September 2026; README "v1.9 deltas" → "Integrator 2"). The upper river's last
# reach is the lake's inlet pool, level with Stillwater (50), and the rim trail's Inlet Footbridge pin is 55
# (land/water, land/beds, land/structures): the Year Walk's February stretch now crosses the inlet OVER the
# water (clear 4.4) on its generated deck beside the footbridge, not under a pool at 58-60.
for i, row in enumerate(m["crossings"]):
    if row["a"] == "yearWalk" and row["b"] == "river upper" and row.get("resolution") == "under":
        row = dict(row); row["v1_8_resolution"] = row["resolution"]; row["resolution"] = "over"
        row["note"] = "v1.9 (integrator 2): over by 5 eu on its deck beside the Inlet Footbridge; the inlet pool is level with the lake (was under a pool at 58-60)"
        m["crossings"][i] = row
m["structures"]["inletFootbridge"]["deck_h"] = 55
m["structures"]["inletFootbridge"]["note"] = "v1.9 (integrator 2): deck 55 over the inlet pool at the lake level 50 (clear 4.4, a river's 4); was 52 over a pool at 58-60"

# ---------------------------------------------------------------------------
# v2.0 — Stage A Wave 5, design-lead data after Jonathan's rulings of 27 September 2026 (D-A1…D-A8, group B and C
# "recommended on all"). Every delta below is listed in docs/horizon/README.md → "v2.0 (Wave 5, Jonathan's rulings
# 2026-09-27)" with its old value; the old values are also kept beside the new ones (`v1_9_*`). Ids never change.
# ---------------------------------------------------------------------------
m["version"] = "2.0"
m["date"] = "2026-09-27"
RULED = "Jonathan 2026-09-27"
def row_find(a, b, where=None, tol=.6):
    hits = [i for i, r in enumerate(m["crossings"]) if r["a"] == a and r["b"] == b and (where is None or (isinstance(r["at"], list) and abs(r["at"][0] - where[0]) < tol and abs(r["at"][1] - where[1]) < tol))]
    assert len(hits) == 1, (a, b, where, hits)
    return hits[0]
def row_edit(a, b, where=None, **changes):
    i = row_find(a, b, where); row = dict(m["crossings"][i])
    for k, v in changes.items():
        if k in ("resolution", "at", "note", "kind", "structure") and k in row and row[k] != v: row.setdefault("v1_9_" + k, row[k])
        if v is None: row.pop(k, None)
        else: row[k] = v
    m["crossings"][i] = row
    return row
RETIRED_V20 = []
def row_retire(a, b, where, why):
    i = row_find(a, b, where); row = m["crossings"].pop(i)
    RETIRED_V20.append(row)
    m["routePairNotes"].append({"a": row["a"], "b": row["b"], "kind": "retired register row (v2.0)", "verification": why, "sharedPlanPoints": [], "retiredRow": dict(row)})

# 1. D-A1 · The Bight Bridge (Jonathan: "lengthen it … upgrade it and make it useful and cool; agreed on upgrading
#    skateboard paths around it"): Option 1. The deck is the V01 axis between its control points [460,1030] and
#    [660,1170] (244.1 m; span 245 with the abutment seats), a timber viaduct with one 36 m steel through-arch over the
#    ferry channel, abutments on both headlands down to the ground (the headlands and V01's points do not move). S2 becomes
#    a continuous skate ribbon carried on the deck: the lagoon-side lane from the west abutment, one flyover over the road
#    under the arch crown (the original register intent, S2 over V01 at the bridge's middle), the sea-side lane to the
#    east abutment, and a banked descent off the east abutment onto its old line; a ramp from the Wash at the west.
#    Axis frame: s = metres from [460,1030] toward [660,1170]; o = metres off the axis, + toward the Bight (lagoon side).
BB_A, BB_B = [460, 1030], [660, 1170]
BB_L = math.dist(BB_A, BB_B); BB_D = [(BB_B[0] - BB_A[0]) / BB_L, (BB_B[1] - BB_A[1]) / BB_L]; BB_N = [BB_D[1], -BB_D[0]]
def bb(s, o=0.0): return [round(BB_A[0] + BB_D[0] * s + BB_N[0] * o, 1), round(BB_A[1] + BB_D[1] * s + BB_N[1] * o, 1)]
S2_LAGOON_O, S2_SEA_O, S2_CROWN_H, BB_DECK_H = 11.2, -7.5, 17.6, 12
def s2_flyover_o(s): return S2_LAGOON_O + (S2_SEA_O - S2_LAGOON_O) * (s - 100) / 32
bbr = m["structures"]["bightBridge"]
m["structures"]["bightBridge"] = {
 "xy": bbr["xy"], "kind": "bridge", "deck": "V01, the Year Walk's lagoon-side footways, and S2 as a separated skate ribbon (lagoon lane, flyover, sea lane), every deck edge railed",
 "span_m": 245, "h_deck": BB_DECK_H, "clear_m": bbr["clear_m"], "under": bbr["under"],
 "ends": {"west": BB_A, "east": BB_B, "axis_m": round(BB_L, 1), "abutments": "both on the headlands and down to the ground: west a 14 × 24 m embankment from the Flats spit tip [460,1020] to the deck end (it carries S2's lagoon lane and its bank), east on the shore; no bed raises the seabed under the deck"},
 "section": {"from_axis_m": [-10.0, 13.7], "width_m": 23.7, "lanes": {"S2 sea lane": [S2_SEA_O - 2, S2_SEA_O + 2], "V01": [-4, 4], "V01 shoulders": 1, "Year Walk footways (centres)": [5.2, 7.4], "S2 lagoon lane": [S2_LAGOON_O - 2, S2_LAGOON_O + 2]}, "rails": "a rail on both deck edges the whole length, and a kerb rail between each S2 lane and its neighbour", "note": "offsets from the V01 axis, + toward the Bight; the deck widens from 17 m (v1.9) to carry S2 as a lane of its own"},
 "opening": {"at_s": [98, 134], "centre_s": 116, "centre": bb(116), "width_m": 36, "kind": "steel-arch", "clear_eu": 11.4, "clearWidth_m": 34, "arch": "a steel through-arch above the deck (rise ≥ 10 over the deck, crown ≥ 22), its ribs on the deck edges and hangers to the deck", "why": "36 m is past the 30 eu masonry-arch limit (STYLE §1.6.3), so the arch is steel; the opening covers the ferry lane (s 122, in at 46°, out at 58°) and Ring Run gate 5 (s 111); a hull of water_routes.FERRY.beam_m 8 at 46° needs 27.6 m along the axis (proposals/bight-bridge.md)"},
 "bents": {"west": {"count": 8, "bay_m": 10.9, "from_s": 0, "to_s": 98}, "east": {"count": 9, "bay_m": 11.0, "from_s": 134, "to_s": 244}, "arch piers": [98, 134], "note": "timber paired bents, every bay under the 12 eu timber limit; no bent in the opening or in S2's east descent"},
 "lookout": {"id": "bightBridge.lookout", "s": 116, "xy": bb(116, 12.25), "deck_h": BB_DECK_H, "size_m": [24, 7.5], "side": "lagoon", "from_s": 104, "to_s": 128, "reach": "off the Year Walk's lagoon footway at deck level, under the arch, railed on its three open sides", "note": "a bay of the deck (a structure), not a pad: no register pad stands on the deck (D-A1). Under S2's flyover at its inner corner (5.6 above)"},
 "s2Flyover": {"id": "bightBridge.s2Flyover", "from": bb(100, S2_LAGOON_O), "to": bb(132, S2_SEA_O), "h": S2_CROWN_H, "overRoad": bb(100 + 32 * S2_LAGOON_O / (S2_LAGOON_O - S2_SEA_O)), "clear_eu": round(S2_CROWN_H - BB_DECK_H - .6, 1), "carried": "hung from the arch between its ribs", "note": "S2 crosses the road and the Year Walk footways once, over them, at the arch crown (register S2 × V01 'over'); ramps of 8 % up the lagoon lane (s 30 → 100) and down the sea lane (s 132 → 202)"},
 "v1_9": {"span_m": bbr["span_m"], "deck": bbr["deck"], "h_deck": bbr["h_deck"]},
 "decided": "D-A1 option 1 (" + RULED + ")",
}
m["water_routes"]["FERRY"]["beam_m"] = 8
m["water_routes"]["FERRY"]["beamNote"] = "v2.0 (D-A1): each hull's beam, authored so the Bight Bridge's navigable opening is provable (along-axis opening needed = beam / sin(angle) + deck width / tan(angle); 27.6 m at the inbound 46°, the steel arch gives 34 m clear)"
S2 = m["skate"]["S2"]
S2["v1_9_pts"] = [list(p) for p in S2["pts"]]
S2_WEST_RAMP = [[485, 800], [510, 900], [480, 985]]
S2_EAST = [[672, 1192], [690, 1210], [712, 1230]]
S2_DECK = [bb(0, S2_LAGOON_O), bb(30, S2_LAGOON_O), bb(100, S2_LAGOON_O), bb(116, s2_flyover_o(116)), bb(132, S2_SEA_O), bb(202, S2_SEA_O), bb(244, S2_SEA_O)]
i0 = S2["pts"].index([485, 800]); i1 = S2["pts"].index([750, 1265])
S2["pts"] = S2["pts"][:i0] + S2_WEST_RAMP + S2_DECK + S2_EAST + S2["pts"][i1:]
S2["length_m"] = round(length(S2["pts"]))
S2["levels"] = [
 {"xy": [485, 800], "h": 23.7, "why": "the Wash rim: the top of the west ramp"},
 {"xy": S2_DECK[0], "h": BB_DECK_H, "why": "the west abutment's deck end"},
 {"xy": S2_DECK[1], "h": BB_DECK_H, "why": "the lagoon lane starts its 8 % climb to the flyover"},
 {"xy": S2_DECK[2], "h": S2_CROWN_H, "why": "the flyover's west end"},
 {"xy": S2_DECK[4], "h": S2_CROWN_H, "why": "the flyover's east end"},
 {"xy": S2_DECK[5], "h": BB_DECK_H, "why": "back on the sea lane at deck height"},
 {"xy": S2_DECK[6], "h": BB_DECK_H, "why": "the east abutment's deck end: the banked descent starts"},
 {"xy": [712, 1230], "h": 6.5, "why": "the foot of the banked descent on the sea-side shelf"},
]
S2["westRamp"] = {"from": [485, 800], "from_h": 23.7, "to": S2_DECK[0], "to_h": BB_DECK_H, "grade_pct": round((23.7 - BB_DECK_H) / length([[485, 800]] + S2_WEST_RAMP[1:] + [S2_DECK[0]]) * 100, 1),
 "carried": "one even grade from the Wash down to the deck: a timber trestle over the Wash mouth (x 495-515, z 830-925, up to 18.6 over the dry bed, under the Bight pier stair) and a cutting of at most 4 eu through the spit knoll [480-492, 950-1010]",
 "why": "D-A1: S2 could not descend from the Wash to the deck at 18 % (it dipped to 11.9 in the Wash mouth and climbed 18.5 again, v1.8 open item); within profiles.skateMain (grade_max_pct 18, typical 8-14)"}
S2["deckLanes"] = {"structure": "bightBridge", "lagoon": {"from_s": 0, "to_s": 100, "offset_m": S2_LAGOON_O}, "flyover": "bightBridge.s2Flyover (s 100 → 132)", "sea": {"from_s": 132, "to_s": 244, "offset_m": S2_SEA_O}, "note": "offsets from the V01 axis (+ toward the Bight); S2 never rides the road's shoulder and never crosses it at grade"}
S2["eastDescent"] = {"kind": "bankedDescent", "from": S2_DECK[6], "from_h": BB_DECK_H, "to": [712, 1230], "to_h": 6.5, "via": S2_EAST[:2], "bank_deg": [12, 20], "radius_m": 45, "grade_pct": round((BB_DECK_H - 6.5) / length([S2_DECK[6]] + S2_EAST) * 100, 1),
 "why": "D-A1: S2 left the deck at [606.6,1144.1] and came down over the lagoon with nothing under it (the island's worst drop, 24.0 eu); it now stays on the deck to the east abutment and carves a right-hand banked descent down the headland's sea-side shelf onto its old line to [750,1265]",
 "bank": "the outside of the curve is the east abutment's wing wall battered to a bank (spot S2.eastAbutmentBank)"}
S2["spots"] = [
 {"id": "S2.archCrown", "kind": "rail", "bed": "S2", "on": "bightBridge.s2Flyover", "xy": bb(116, s2_flyover_o(116)), "h": S2_CROWN_H, "length_m": 24, "groundLine": "the flyover deck beside the rail: roll over the crown without touching it", "requiredJump": False, "note": "the flyover's crown parapet rail under the steel arch, 5.6 above the road deck"},
 {"id": "S2.westAbutmentBank", "kind": "bank lip", "bed": "S2", "on": "bightBridge west abutment", "xy": bb(-7, S2_LAGOON_O + 2), "h": BB_DECK_H, "length_m": 14, "groundLine": "the lagoon lane itself (the bank is its outer wing wall, battered to 30°)", "requiredJump": False},
 {"id": "S2.eastAbutmentBank", "kind": "bank lip", "bed": "S2", "on": "bightBridge east abutment", "xy": [664, 1184], "h": 11, "length_m": 20, "groundLine": "the descent's inside line", "requiredJump": False},
 {"id": "S2.deckRail", "kind": "rail", "bed": "S2", "on": "bightBridge deck edge", "xy": bb(60, S2_LAGOON_O + 2.3), "h": BB_DECK_H, "length_m": 244, "groundLine": "the lane beside the rail", "requiredJump": False, "note": "the deck-edge rail, full length on the lagoon side to the flyover and on the sea side after it"},
]
S2["spotsRule"] = "Pass 02 M1 'Spots': rails, kerbs, walls, bollards, stairs and bank lips from pass 1's beds only; kind is one of those words; every spot names its groundLine and requiredJump is always false"
for seg in S2["segments"]:
    if seg["name"] == "Bight Bridge": seg["v1_9_spot"] = seg["spot"]; seg["spot"] = "S2.archCrown, S2.westAbutmentBank, S2.eastAbutmentBank, S2.deckRail (skate.S2.spots)"
row_edit("V01+S2", "Bight mouth", reserved=None, decided="D-A1 (" + RULED + ")", note="245 m viaduct with one 36 m steel through-arch (s 98-134); abutments on both headlands to the ground")
row_edit("FERRY", "bightBridge", reserved=None, decided="D-A1 (" + RULED + ")", note="twice per lap, through the steel-arch opening (s 98-134, 34 m × 11.4 clear; beam 8)")
row_edit("S2", "V01", note="v2.0 (D-A1): S2 rides the deck's lagoon lane from the west abutment, crosses over V01 and the Year Walk footways once on bightBridge.s2Flyover at the arch crown (17.6, 5.6 above the deck), then the sea lane to the east abutment and a banked descent onto its line; never the shoulder, never at grade")
m["crossings"].append({"a": "S2", "b": "V01", "at": bb(100 + 32 * S2_LAGOON_O / (S2_LAGOON_O - S2_SEA_O)), "resolution": "over", "kind": "crossing", "structure": "bightBridge.s2Flyover", "source": "design lead v2.0", "note": "D-A1: 5.6 over the road deck at the arch crown (road clear 5 + 0.6)"})
row_edit("S2", "yearWalk", [553.9, 1095], at=bb(100 + 32 * (S2_LAGOON_O - 6.3) / (S2_LAGOON_O - S2_SEA_O), 6.3), resolution="over", structure="bightBridge.s2Flyover", note="v2.0 (D-A1): S2's flyover passes over the Year Walk's lagoon footways (was a crossing on the deck)")
row_retire("S2", "yearWalk", [468.2, 1026.4], "v2.0 (D-A1): S2 comes onto the deck's lagoon lane outboard of the Year Walk footways (+11.2 against +5.2/+7.4); they run side by side and never meet")
row_edit("S2", "FERRY", [560, 1100], note="v2.0 (D-A1): on the flyover under the arch crown, through the navigable opening")

# 2. D-A2 · ZIP × G1 (Jonathan: "leave it"): option A. Nothing physical moves; the register row records the zip passing
#    UNDER the gondola, as built: at [1441.5,920.8] the ZIP is at 60.6 and G1 at 91.1 (30.45 m apart; the cable rule is 8).
row_edit("ZIP", "G1", [1442, 921], resolution="under", reserved=None, decided="D-A2 option A (" + RULED + ")", measured={"at": [1441.5, 920.8], "zip_h": 60.6, "g1_h": 91.1, "separation_eu": 30.45, "bake": "candidate 3 (f1a1ec1)"},
         note="zip under gondola: 30.45 m below the gondola cable where they cross (profiles.cable.clear_eu 8); riders on the zip pass beneath the cabins")
m["cable"]["ZIP"]["v1_9_note"] = m["cable"]["ZIP"]["note"]
m["cable"]["ZIP"]["note"] = m["cable"]["ZIP"]["note"].replace("and crosses above the gondola cable at [1442,921] with 10.7 m between cables", "and crosses under the gondola cable at [1441.5,920.8], 30.45 m beneath it (D-A2: zip under gondola)")
assert "D-A2" in m["cable"]["ZIP"]["note"]

# 3. D-A3 · The gondola top station (Jonathan: "option 2 and a 205 s target"): the station moves ~35 m up the slope onto
#    the summit's south shoulder at grade, [1335,535], deck 150 on ground 148.5. The line turns 1.1° west about the base
#    (573.6 m). Towers stand at the v1.9 distances from the base (135.4 / 271.7 m) except tower 3, which moves from 407 to
#    392 m: at 407 m its footing lands on the Year Walk's January lane at the turning circle (1.7 m from the lane edge),
#    at 392 m it stands 7.9 m clear of S1 with spans of 135 / 136 / 120 / 182 m (profiles.cable.towerSpacing_m 120-200).
#    Heights are not authored: the builder solves each tower to the lowest top that keeps every span 8 clear (the 25 m
#    station throats excepted) and never clamps at the 300 ceiling (a tower above it fails the bake). The proposal's
#    minimum tops at 135 / 272 / 407 m were 83 / 110 / 151 (proposals/gondola-top-station.md).
G1 = m["cable"]["G1"]
G1_TO, G1_TO_H = [1335, 535], 150
G1_L = math.dist(G1["from"], G1_TO); G1_U = [(G1_TO[0] - G1["from"][0]) / G1_L, (G1_TO[1] - G1["from"][1]) / G1_L]
G1_TOWER_S = [135.4, 271.7, 392]
G1["v1_9"] = {"to": G1["to"], "toH": G1["toH"], "towers": G1["towers"], "length_m": G1["length_m"]}
G1["to"], G1["toH"] = G1_TO, G1_TO_H
G1["towers"] = [[round(G1["from"][0] + G1_U[0] * d, 1), round(G1["from"][1] + G1_U[1] * d, 1)] for d in G1_TOWER_S]
G1["towerDistances_m"] = G1_TOWER_S
G1["length_m"] = round(G1_L)
G1["towerSolve"] = "each tower top is solved to the lowest height that keeps every span profiles.cable.clear_eu over the ground (1 % sag; the 25 m throat at each station excepted); no tower height is authored and none is clamped: a tower whose top would pass sky.ceiling (300) fails the bake"
G1["towerMin_h_reference"] = {"at_m": [135, 272, 407], "top_h": [83, 110, 151], "source": "proposals/gondola-top-station.md (Option 2 solver, no terraces rule); tower 3 now stands at 392 m, so re-solve"}
G1["note"] = "upper street → the Crown station on the summit's south shoulder (at grade, [1335,535]), straight up the south-east face; town falls away, then the whole island; a short walk (≈ 70 m, 8 m of climb) continues from the station to the summit lookout"
G1["decided"] = "D-A3 option 2 (" + RULED + ")"
gs = m["structures"]["gondolaStations"]
gs["v1_9_crownStation"] = gs["crownStation"]; gs["crownStation"] = G1_TO
gs["crownStation_deck_h"] = G1_TO_H
gs["note"] = "v2.0 (D-A3): the Crown station stands at grade on the summit's south shoulder (ground 148.5, deck 150); it was in a notch 17 m below the 129.7 ridge at [1360,560] (deck 112), which forced a 275 eu tower"
for t in m["thresholds"]:
    if t["id"] == "gondolaTop": t["v1_9_xy"] = t["xy"]; t["xy"] = G1_TO
cfg = m["walks"]["crownFromGondola"]
cfg["v1_9_pts"] = cfg["pts"]; cfg["pts"] = [G1_TO, [1322, 517], [1310, 500]]
cfg["length_m"] = round(length(cfg["pts"]))
cfg["levels"] = [{"xy": G1_TO, "h": G1_TO_H, "why": "the station deck"}, {"xy": [1310, 500], "h": 154, "why": "the summit junction (walk summit on to L02 [1310,470] at 158)"}]
cfg["note_v2_0"] = "D-A3: a 43 m leg at 9 % from the station at grade to the summit junction (the station → L02 walk is ≈ 70 m of plan and 8 m of climb, step-free); the builder's hard-coded switchback via [1405,595], [1450,565], [1430,500], [1350,440] goes"
jl = m["journeys"]["square→summit by gondola + walk"]
jl["v1_9_legs"] = [dict(l) for l in jl["legs"]]
jl["legs"][1]["length_m"] = G1["length_m"]
jl["legs"][2]["length_m"] = round(math.dist(G1_TO, [1310, 470]))
jl["note"] = "time = sum of legs; v2.0 (D-A3): the gondola runs to the shoulder station [1335,535] and the last walk is the station → L02 leg"
m["journeys"]["at_factor_1_0"] = times(1.0)
m["journeys"]["at_factor_0_6"] = times(0.6)
m["journeys"]["at_active_scale"] = times(m["scale"]["factor"])
m["journeys"]["targets_v1_9"] = {"square→summit by gondola + walk": m["journeys"]["targets_s"]["square→summit by gondola + walk"]}
m["journeys"]["targets_s"]["square→summit by gondola + walk"] = 205
m["journeys"]["targets_s"]["note"] = m["journeys"]["targets_s"]["note"].replace("the summit target is the achievable value until the gondola top station is decided (reserved), then 180", "the summit target is 205 s (D-A3, " + RULED + ": option 2 gives ≈ 185 s; 205 keeps the ≥ 10 % margin; it was 375 while reserved)")
assert "205 s" in m["journeys"]["targets_s"]["note"]
# The register against the moved line (plan intersections of the new G1 chord with the candidate-3 beds). Rows on the
# old station walk that the 43 m leg can no longer meet are retired; the rest drop "RESERVED R-A3".
G1_REPOINT = [("S1", "G1", [1391.9, 701.5], [1378.6, 701.8]), ("S1", "G1", [1407.5, 770.1], [1395.2, 765.5]),
 ("walk crown", "G1", [1365.9, 586.1], [1352.3, 601.4]), ("walk crown", "G1", [1372.4, 615.2], [1357, 619.2]), ("walk crown", "G1", [1388.3, 685.3], [1375.1, 688.6]),
 ("yearWalk", "G1", [1385.1, 671.2], [1375.7, 690.8]), ("yearWalk", "G1", [1388.6, 686.7], [1375.5, 689.9]), ("yearWalk", "G1", [1421.9, 833.4], [1416, 844.9]),
 ("G1", "V01", [1469, 1043], [1468, 1044]), ("G1", "Crown Road", [1385, 655], [1373.4, 682]), ("G1", "ORE", [1375, 625], [1363.9, 645.4]),
 ("walk crownFromGondola", "G1", [1360, 560], G1_TO), ("ZIP", "G1", [1441.5, 920.8], [1437.5, 927.4])]
for a, b, old, new in G1_REPOINT:
    row_edit(a, b, old, at=new)
row_edit("ZIP", "G1", [1437.5, 927.4], predicted_v2_0={"separation_eu": 29.0, "g1_h": 88.8, "zip_h": 59.8, "source": "proposals/zip-over-g1.md, with the station at [1335,535]"})
for a, b, at in [("V02", "walk crownFromGondola", [1412.8, 593.4]), ("V02", "walk crownFromGondola", [1443.1, 526.5]), ("walk crown", "walk crownFromGondola", [1376, 574.7]),
                 ("walk crownFromGondola", "crownLaunch.stair", [1320.4, 479.2]), ("walk crownFromGondola", "DEEP_RUN", [1341.3, 445.2]), ("walk crownFromGondola", "DEEP_RUN", [1437.6, 512.9]),
                 ("walk crownFromGondola", "ORE", [1334.3, 454.3]), ("walk crownFromGondola", "ORE", [1369.1, 568.4]), ("walk crownFromGondola", "stepsPortage", [1332.3, 457.5]),
                 ("walk crownFromGondola", "underground.bellGallery", [1315.5, 489.2]), ("walk crownFromGondola", "yearWalk", [1422.1, 589.2]), ("walk crownFromGondola", "yearWalk", [1446.4, 537.2])]:
    row_retire(a, b, at, "v2.0 (D-A3): the station walk is a 43 m leg [1335,535] → [1310,500]; the v1.9 switchback that met this route here goes (re-check on the next bake)")
for i, row in enumerate(m["crossings"]):
    if "RESERVED R-A3" in row.get("note", ""):
        row = dict(row); row["note"] = row["note"].replace("RESERVED R-A3: waits on the gondola top station", "D-A3 decided " + RULED + " (station [1335,535]); re-point on the next bake"); m["crossings"][i] = row
assert not any("R-A3" in r.get("reserved", "") for r in m["crossings"])


with open("MANIFEST.json", "w", encoding="utf-8") as output:
    json.dump(m, output, indent=1)
    output.write("\n")
print(json.dumps(m["journeys"]["at_active_scale"],indent=0))
print("V01",m["roads"]["V01"]["length_m"],"S1",m["skate"]["S1"]["length_m"],"ferry",m["water_routes"]["FERRY"]["length_m"])
