import json,math,pathlib,html
base=pathlib.Path('docs/horizon/evidence/mountain-road');inv=json.load(open(base/'before/inventory.json'));w=json.load(open('public/horizon/world/horizon-geo-1.json'))
v=json.load(open('src/harbour/horizon/land/mountainV2/v2-data.json'));a=json.load(open(base/'before/chain/audit.json'))
links=[('stillwater','Foot to Stillwater rim',[1282,54.649977,720],[1237.119568,53.992993,757.534399],58.507,.657,58.507,'Grade study first. This does not complete the Green Road loop.'),('green-direct','Foot directly to Green Road',[1282,54.649977,720],[995.162826,40.212977,643.031082],296.984,14.437,296.984,'Reject chord: up to 54.594 m cut in the baked terrain.'),('hollow','Orchard Lane to Hollow',[1246,81.6,646],[1000.258287,39.031826,617.314761],247.410,42.568,425.682,'Contour study only. No bridge alignment or clearances approved.'),('clearing','Upper clearing to Green Road',[1214,109.04648,565],[1000,38.213493,600],216.843,70.833,708.330,'Reject this departure: Woodland Clearing plot and excessive descent.'),('north','Summit to north coast',[1325,158.2,470.5],[1300,72.252793,260],211.979,85.947,859.472,'Leave as a view for now. Throat, skylight and flight envelopes remain.'),('shoulder','Sunny Shelf to Shoulder',[1401,81,627],[1450,69.35,650],54.129,11.65,116.5,'View only. Ends in terrain, crosses reserved Sunny Shelf.'),('prow','Existing Prow approach',[1599.5,34.957364,790.8],[1281.5,55.3,742],321.72,-20.343,321.72,'Existing V03 is 327.375 m along its plan; retain and repair handovers.')]
links.append(('scholars','Upper clearing to Scholars’ Edge',[1214,109.04648,565],[940,46.315118732,460],293.429719,62.731361268,627.31361268,'View only. Existing Green Road approach serves this neighbour.'))
json.dump([dict(id=x[0],name=x[1],start=x[2],end=x[3],plan=x[4],drop=x[5],minimum10=x[6],verdict=x[7]) for x in links],open(base/'before/neighbours.json','w'),indent=2)
def svg_start(title):return [f'<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="560" viewBox="0 0 1000 560"><rect width="1000" height="560" fill="#f5f1e7"/><style>text{{font-family:Arial,sans-serif;fill:#203a34}}.small{{font-size:13px}}.label{{font-size:17px}}</style><text x="34" y="42" font-size="25">{html.escape(title)}</text>']
for id,name,start,end,dist,drop,minrun,verdict in links:
 s=svg_start(name);s+=['<text x="34" y="70" class="small">Endpoint chord only — a feasibility drawing, not a fitted road or clearance proof</text>']
 x0,x1=min(start[0],end[0])-35,max(start[0],end[0])+35;z0,z1=min(start[2],end[2])-35,max(start[2],end[2])+35;scale=min(390/(x1-x0),300/(z1-z0));cx=(x0+x1)/2;cz=(z0+z1)/2
 def p(q):return 245+(q[0]-cx)*scale,260+(q[2]-cz)*scale
 for b in w['beds']:
  if b['id'] not in ['V03','VG','V01','mountainV2.road','walk lakerim']:continue
  pts=[p(q) for q in b['points'] if x0-20<q[0]<x1+20 and z0-20<q[2]<z1+20]
  if len(pts)>1:s.append('<polyline fill="none" stroke="#b8b7ac" stroke-width="3" points="'+' '.join(f'{x:.1f},{y:.1f}' for x,y in pts)+'"/>')
 pa,pb=p(start),p(end);s.append(f'<path d="M{pa[0]},{pa[1]} L{pb[0]},{pb[1]}" stroke="#b66136" stroke-width="3" stroke-dasharray="7 5"/>')
 for label,q in [('A',pa),('B',pb)]:s.append(f'<circle cx="{q[0]}" cy="{q[1]}" r="5" fill="#203a34"/><text x="{q[0]+9}" y="{q[1]-8}" class="label">{label}</text>')
 s.append('<text x="40" y="115" class="label">Plan · north ↑</text>');s.append(f'<text x="35" y="446" class="small">A [{start[0]:.1f}, {start[1]:.2f}, {start[2]:.1f}] → B [{end[0]:.1f}, {end[1]:.2f}, {end[2]:.1f}]</text>')
 # Profile is separately scaled so no false visual grade claim.
 hmin=min(start[1],end[1])-8;hmax=max(start[1],end[1])+8;yy=lambda h:390-(h-hmin)/(hmax-hmin)*240
 s.append('<text x="545" y="115" class="label">Profile · vertical scale exaggerated</text>');s.append('<path d="M550,395H940 M550,395V135" fill="none" stroke="#adb3a9"/>')
 s.append(f'<path d="M550,{yy(start[1])} L935,{yy(end[1])}" fill="none" stroke="#b66136" stroke-width="3" stroke-dasharray="7 5"/>')
 for x,h in [(550,start[1]),(935,end[1])]:s.append(f'<text x="{x-16}" y="{yy(h)-12}" class="small">{h:.2f}</text>')
 s.append(f'<text x="552" y="423" class="small">0 m</text><text x="862" y="423" class="small">{dist:.1f} m</text><text x="552" y="448" class="small">At ≤10%: necessary route length ≥{minrun:.1f} m</text>')
 s.append(f'<text x="34" y="502" class="label">{html.escape(verdict)}</text><text x="34" y="535" class="small">Horizon xyz, eu/metres. Measured endpoints at main 324cd5f. Terrain between endpoints is not drawn.</text></svg>')
 (base/'design'/f'{id}.svg').write_text('\n'.join(s))
# Whole chain plan; review schematic, not game capture.
s=svg_start('One chain · Prow to Summit Commons');s.append('<text x="34" y="69" class="small">Measured existing geometry. Orange labels are curve groups; this is not a game capture.</text>');
def p(q):return 75+(q[0]-1200)*1.5,105+(q[2]-450)*.96
for id,col in [('V03','#b66136'),('mountainV2.road','#286b5a')]:
 pts=[p(q) for q in next(b['points'] for b in w['beds'] if b['id']==id)];s.append('<polyline fill="none" stroke="'+col+'" stroke-width="4" points="'+' '.join(f'{x:.1f},{y:.1f}' for x,y in pts)+'"/>')
for h in inv['hairpins']:
 x,y=p(h['at']);s.append(f'<circle cx="{x}" cy="{y}" r="5" fill="#b66136"/><text x="{x+9}" y="{y-7}" class="label">{h["id"]}</text>')
s.extend(['<text x="725" y="152" class="label">V03 327.375 m</text>','<text x="725" y="184" class="label">Lane 22.014 m</text>','<text x="725" y="216" class="label">Ascent 938.787 m plan</text>','<text x="725" y="248" class="small">945.861 m native spatial arc</text>','<text x="725" y="291" class="label">Total plan: 1288.176 m</text>','<text x="34" y="516" class="small">Stations: chain plan arc starts at Prow; native mountain s starts at Foot and includes height.</text></svg>']);(base/'design'/'chain-plan.svg').write_text('\n'.join(s))
# Derive radius/speed table with chain stations mapped to source spatial arc.
ss=v['road']['samples'];plan=[0]
for q,r in zip(ss,ss[1:]):plan.append(plan[-1]+math.hypot(r['at'][0]-q['at'][0],r['at'][2]-q['at'][2]))
def to_plan(s):
 for j in range(1,len(ss)):
  if ss[j]['s']>=s:
   f=(s-ss[j-1]['s'])/(ss[j]['s']-ss[j-1]['s']);return a['chainReaches']['mountainStart']+plan[j-1]+f*(plan[j]-plan[j-1])
 return a['chainReaches']['mountainStart']+plan[-1]
rows=[]
for h in inv['hairpins']:
 row=dict(h);row['passes']=[]
 for lane in [0,2]:
  tele=[p for p in a['telemetry'] if p['dir']=='rev' and p['lane']==lane];entry=min(tele,key=lambda p:abs(p['s']-to_plan(h['s1']+5)));arc=[p for p in tele if to_plan(h['s0'])<=p['s']<=to_plan(h['s1'])]
  margins=[2.4+(1.05-2.4)*min(1,p['speed']/16)-p['speed']/p['radius'] for p in arc if p['radius']]
  row['passes'].append(dict(lane=lane,entrySpeed=entry['speed'],maxLateralDemand=max([p['lateralDemand'] for p in arc]or[0]),minSteerRateMargin=min(margins or [0])))
 rows.append(row)
json.dump(rows,open(base/'before/hairpins.json','w'),indent=2)
print('8 plan/profile sheets; chain plan; hairpin measurements written')
