"""Refine the two saved V03/terraces AABB suspects by actual triangle/polygon intersection."""
import math,traceback
from evidence_common import start,write,finish
root,out,w,b,manifest=start(__doc__)
try:
 rid='plot.terraces.1';r=next(x for x in w['reserves'] if x['id']==rid);oldreserve=next(x for x in b['reserves'] if x['id']==rid);poly=r['outline']
 def signed(p):
  if len(p)<3:return 0
  a=p[0];return sum((p[i][0]-a[0])*(p[i+1][1]-a[1])-(p[i][1]-a[1])*(p[i+1][0]-a[0]) for i in range(1,len(p)-1))
 sign=math.copysign(1,signed(poly))
 if not signed(poly) or any(sign*((poly[(i+1)%len(poly)][0]-p[0])*(poly[(i+2)%len(poly)][1]-poly[(i+1)%len(poly)][1])-(poly[(i+1)%len(poly)][1]-p[1])*(poly[(i+2)%len(poly)][0]-poly[(i+1)%len(poly)][0])) < -1e-10 for i,p in enumerate(poly)):raise ValueError('Reserve clip requires a nondegenerate convex authored outline')
 def clip(p):
  for i,a in enumerate(poly):
   z=poly[(i+1)%len(poly)];cross=lambda q:sign*((z[0]-a[0])*(q[1]-a[1])-(z[1]-a[1])*(q[0]-a[0]));kept=[]
   for j,q in enumerate(p):
    prev=p[j-1];dq,dp=cross(q),cross(prev)
    if (dq>=0)!=(dp>=0):
     t=dp/(dp-dq);kept.append([prev[k]+t*(q[k]-prev[k]) for k in [0,1]])
    if dq>=0:kept.append(q)
   p=kept
   if not p:break
  return p
 def select(world,sid):return [s for s in world['geometry']['solids'] if s.get('sourceId',s['id'].split('@')[0])==sid]
 def intersections(solids):
  found=[];tiny=[]
  for s in solids:
   for i in range(0,len(s['indices']),3):
    pts=[s['positions'][j*3:j*3+3] for j in s['indices'][i:i+3]];clipped=clip([[p[0],p[2]] for p in pts]);ar=abs(signed(clipped))/2
    if ar>0:(found if ar>1e-7 else tiny).append({'solid':s['id'],'triangle':i//3,'areaXZ':ar,'clippedXZ':clipped,'vertices':pts})
  return {'overlapsAboveNumericalFloor':found,'positiveAreaAtOrBelowNumericalFloor':tiny}
 rows=[]
 for sid in ['V03.corridor.deck.1.prow','V03.corridor.fill.L.2.prow']:
  a,old=select(w,sid),select(b,sid)
  if not a:raise ValueError('Missing expected current source '+sid)
  rows.append({'sourceId':sid,'identicalToFixedBaseline':a==old,'current':intersections(a),'baselineUsingCurrentReserve':intersections(old)})
 has=any(r['current']['overlapsAboveNumericalFloor'] for r in rows)
 write(out/'reserve-refine.json',{'scope':'Two prior V03 suspects against plot.terraces.1 only; not an all-reserve or vertical-clearance audit. Areas are individual projected triangle intersections, not union areas. All positive areas retained; 1e-7m² is the original numerical reporting split, not approval.','baselineCommit':manifest['baselineCommit'],'reserve':r,'reserveIdenticalToBaseline':r==oldreserve,'status':'OVERLAPS_RETAINED' if has else 'NO_OVERLAP_ABOVE_NUMERICAL_FLOOR','sources':rows})
 finish(root,out,manifest)
 raise SystemExit(2 if has else 0)
except SystemExit:raise
except Exception:
 write(out/'error.json',{'error':traceback.format_exc()});raise
