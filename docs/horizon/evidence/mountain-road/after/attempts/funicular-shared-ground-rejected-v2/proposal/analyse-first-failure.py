"""Pure saved-JSON attribution. No repository/source imports or geometry generation."""
from pathlib import Path
import json,math,hashlib
D=Path('/tmp/mountain-funicular-shared-ground-v2');R=Path('/Users/jonathanbeaulne/Documents/ChatGPT/budget app 2/.codex-work/mountain-road-book')
inputs={'failed':Path('/tmp/mountain-funicular-shared-ground-proof-1/failure.json'),'apron':Path('/tmp/mountain-funicular-v20-shape/candidate-solid.json'),'native':R/'src/harbour/horizon/land/mountainV2/v2-data.json','priorHosts':Path('/tmp/mountain-funicular-foot-candidate-proof-v16/before-source-solids.json')}
proof=json.loads(inputs['failed'].read_text())['proof'];apron=json.loads(inputs['apron'].read_text());native=json.loads(inputs['native'].read_text());solids=json.loads(inputs['priorHosts'].read_text())
def area(p):
 if len(p)<3:return 0
 a=p[0];return sum((p[i][0]-a[0])*(p[i+1][2]-a[2])-(p[i][2]-a[2])*(p[i+1][0]-a[0]) for i in range(1,len(p)-1))/2
def split(p,side):
 inside=[];outside=[]
 for i,A in enumerate(p):
  B=p[(i+1)%len(p)];da=side(A);db=side(B);ia=da>=0;ib=db>=0
  (inside if ia else outside).append(A)
  if ia!=ib:
   t=da/(da-db);q=[a+(b-a)*t for a,b in zip(A,B)];inside.append(q);outside.append(q)
 return inside,outside

def planes(t):
 sign=1 if area(t)>0 else -1
 return [lambda p,a=a,b=t[(i+1)%len(t)],sign=sign:sign*((b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0])) for i,a in enumerate(t)]
def clip(p,bounds):
 for d in bounds:
  p=split(p,d)[0]
  if abs(area(p))<1e-12:return []
 return p

def subtract(p,bounds):
 out=[]
 for d in bounds:
  p,q=split(p,d)
  if abs(area(q))>1e-12:out.append(q)
  if abs(area(p))<1e-12:break
 return out

def top(t,x,z):
 a,b,c=t;den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den;v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;return a[1]*u+b[1]*v+c[1]*(1-u-v)
def box(t):return min(p[0] for p in t),max(p[0] for p in t),min(p[2] for p in t),max(p[2] for p in t)
def overlaps(a,b):return a[1]>=b[0] and b[1]>=a[0] and a[3]>=b[2] and b[3]>=a[2]
def tops(s):
 P=s['positions'];I=s['indices']
 for k in range(0,len(I),3):
  t=[P[i*3:i*3+3] for i in I[k:k+3]]
  if area(t)<-1e-9:yield t
hostFaces=[]
for s in [apron]+solids:
 if s.get('walkable'):
  hostFaces += [(s.get('sourceId',s['id']),t,box(t))for t in tops(s)]
walks=[]
for w in native['nativePlanning']['walks']:
 if len(w['points'])<2:continue
 ribbon=[]
 for A,B in zip(w['points'],w['points'][1:]):
  dx=B[0]-A[0];dz=B[2]-A[2];L=math.hypot(dx,dz)
  if L<1e-9:continue
  nx=dz/L*w['halfWidth'];nz=-dx/L*w['halfWidth'];q=[[A[0]-nx,A[1],A[2]-nz],[B[0]-nx,B[1],B[2]-nz],[B[0]+nx,B[1],B[2]+nz],[A[0]+nx,A[1],A[2]+nz]];ribbon.append((q,box(q)))
 walks.append((w,ribbon))
rows=[]
for f in proof['facesOverLimit']:
 t=[[p[0]+1308,p[1]+54,p[2]+764] for p in f['points']];B=box(t);pathHits=[]
 for w,ribbon in walks:
  overlapsPath=[clip(t,planes(q))for q,b in ribbon if overlaps(B,b)];a=sum(abs(area(q))for q in overlapsPath)
  if a>1e-9:pathHits.append({'id':w['id'],'kind':w['kind'],'halfWidth':w['halfWidth'],'segmentOverlapAreaSum':a})
 pieces=[t];covering=[]
 for id,h,b in hostFaces:
  if not overlaps(B,b):continue
  boundary=planes(h)+[lambda p,h=h:top(h,p[0],p[2])-p[1]-1e-5]
  nextPieces=[];removed=0
  for q in pieces:
   overlap=clip(q,boundary)
   if overlap:
    removed+=abs(area(overlap));nextPieces+=subtract(q,boundary)
   else:nextPieces.append(q)
  if removed>1e-10:covering.append({'id':id,'area':removed})
  pieces=nextPieces
  if not pieces:break
 uncovered=sum(abs(area(q))for q in pieces)
 uncoveredPathArea=sum(abs(area(clip(q,planes(ribbon))))for q in pieces for w,ribbons in walks for ribbon,b in ribbons if overlaps(box(q),b))
 rows.append({**f,'worldPoints':t,'publishedPathRibbonOverlaps':pathHits,'higherSavedHostCoverage':covering,'uncoveredPlanArea':uncovered,'uncoveredPathRibbonAreaSum':uncoveredPathArea,'faceArea':abs(area(t)),'uncoveredPolygons':pieces})
def nearest(x,z,w):
 best=math.inf
 for A,B in zip(w['points'],w['points'][1:]):
  dx=B[0]-A[0];dz=B[2]-A[2];q=max(0,min(1,((x-A[0])*dx+(z-A[2])*dz)/(dx*dx+dz*dz or 1)));best=min(best,math.hypot(x-A[0]-q*dx,z-A[2]-q*dz))
 return best
boundary=[]
for p in proof['boundarySamples']:
 x=p['x']+1308;z=p['z']+764;hits=[{'id':w['id'],'distance':nearest(x,z,w),'halfWidth':w['halfWidth']}for w,_ in walks if nearest(x,z,w)<=w['halfWidth']+.3]
 if hits:boundary.append({**p,'world':[x,z],'pathProximity':hits})
summary={'faces':len(rows),'exactUnchangedFaces':sum(f['points']==f['baselinePoints'] for f in rows),'improvedFaces':sum(f['degrees']<f['baselineDegrees']-1e-7 for f in rows),'notWorsened':sum(not f['introducedOrWorsened'] for f in rows),'worsened':sum(f['introducedOrWorsened'] for f in rows),'facesIntersectingPublishedPathRibbon':sum(bool(f['publishedPathRibbonOverlaps'])for f in rows),'pathFacesFullyCoveredByHigherSavedHosts':sum(bool(f['publishedPathRibbonOverlaps'])and f['uncoveredPlanArea']<1e-8 for f in rows),'pathFacesWithExposedPathArea':sum(f['uncoveredPathRibbonAreaSum']>1e-9 for f in rows),'pathFacesWithAnyUncoveredArea':sum(bool(f['publishedPathRibbonOverlaps'])and f['uncoveredPlanArea']>=1e-8 for f in rows),'boundarySamplesNearPath':len(boundary),'maxBoundaryDeltaNearPath':max([abs(p['delta'])for p in boundary]or[0]),'maxBoundaryDeltaAnywhere':proof['maxBoundaryPhysicalDelta']}
result={'scope':'Attribution of rejected first canonical mesh only; not current acceptance','inputs':{k:{'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for k,p in inputs.items()},'summary':summary,'faces':rows,'nearPathBoundarySamples':boundary,'limits':['Published nativePlanning widths are swept per segment for conservative plan attribution; this does not assert a real controller completed the route.','Saved pre-join Horizon host mesh is v16 evidence, not a claim about a future bake. Native road/plank hosts are not included, so uncovered area is conservative.','Intersections with a steep terrain face can still have a usable higher host; final actual floor/normal and full-width movement proofs remain mandatory.']}
(D/'first-failure-attribution.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(summary,indent=2));print('worsened',[(f['index'],f['publishedPathRibbonOverlaps'],f['uncoveredPlanArea'],f['higherSavedHostCoverage'])for f in rows if f['introducedOrWorsened']])
