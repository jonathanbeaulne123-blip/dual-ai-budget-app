import json,math,collections,hashlib,pathlib
base=pathlib.Path('/tmp/mountain-funicular-v12-shape');out=pathlib.Path('/tmp/mountain-funicular-v12-review')
A=json.load(open(base/'before-flips.json'));B=json.load(open(base/'candidate-solid.json'));Q=json.load(open(out/'candidate-roundtrip.json'))
def points(m):return [m['positions'][i:i+3] for i in range(0,len(m['positions']),3)]
P=points(B);QP=points(Q)
def normal(f,p=P):
 a,b,c=[p[i] for i in f];u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)]
 return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
def grade(n):return math.degrees(math.atan2(math.hypot(n[0],n[2]),n[1]))
def faces(m):return [tuple(m['indices'][i:i+3]) for i in range(0,len(m['indices']),3)]
def tops(m):return [f for f in faces(m) if normal(f)[1]>1e-9]
def edges(fs):
 e=collections.Counter()
 for f in fs:
  for a,b in zip(f,f[1:]+f[:1]):e[tuple(sorted((a,b)))]+=1
 return e
AF=tops(A);BF=tops(B);ae=edges(AF);be=edges(BF)
old=set(AF)-set(BF);new=set(BF)-set(AF)
def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
def plan(f):return [(P[i][0],P[i][2]) for i in f]
def clip(poly,tri):
 orient=1 if cross(*tri)>0 else -1
 for a,b in zip(tri,tri[1:]+tri[:1]):
  result=[]
  for s,e in zip(poly,poly[1:]+poly[:1]):
   ds=cross(a,b,s)*orient;de=cross(a,b,e)*orient
   if (ds>=0)!=(de>=0):
    t=ds/(ds-de);result.append((s[0]+t*(e[0]-s[0]),s[1]+t*(e[1]-s[1])))
   if de>=0:result.append(e)
  poly=result
  if not poly:break
 return poly
def height(f,xz):
 a,b,c=[P[i] for i in f];x,z=xz;den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den;v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den
 return u*a[1]+v*b[1]+(1-u-v)*c[1]
witnesses=[]
for f in old:
 for g in new:
  for xz in clip(plan(f),plan(g)):
   y0=height(f,xz);y1=height(g,xz);witnesses.append(dict(xz=xz,oldY=y0,newY=y1,delta=y1-y0,oldFace=f,newFace=g))
allF=faces(B);small=[];problems=[];rounded_top=[];minimum=None;original_small_steep=[]
for i,f in enumerate(allF):
 n=normal(f);q=normal(f,QP);ln=math.hypot(*n);lq=math.hypot(*q)
 rec=dict(triangle=i,indices=f,originalNormal=n,roundedNormal=q,originalDegrees=grade(n),roundedDegrees=grade(q),points=[P[j] for j in f],roundedPoints=[QP[j] for j in f])
 if 0<n[1]<=1e-9:small.append(rec)
 if n[1]>0:
  if grade(n)>40:original_small_steep.append(rec)
  if q[1]<=0 or lq<=1e-12 or grade(q)>40:problems.append(rec)
  if q[1]>0:rounded_top.append(rec)
 if n[1]>1e-9:
  maxedge=max(math.hypot(P[f[k]][0]-P[f[(k+1)%3]][0],P[f[k]][2]-P[f[(k+1)%3]][2]) for k in range(3));alt=n[1]/maxedge
  if minimum is None or alt<minimum['altitude']:minimum=dict(altitude=alt,**rec)
zero_original=[i for i,f in enumerate(allF) if math.hypot(*normal(f))<=1e-12]
zero_rounded=[i for i,f in enumerate(allF) if math.hypot(*normal(f,QP))<=1e-12]
index_edges=edges(allF);paired=[]
for i,f in enumerate(allF):
 if normal(f)[1]>1e-9:
  if i+1>=len(allF) or allF[i+1]!=(f[0]+1,f[2]+1,f[1]+1):paired.append(i)
R=dict(method='Pure JSON arithmetic. Exact JS Number(toFixed(9)) matches scripts/horizon/artifacts.mjs; no source/world imports. Common refinement clips every changed old/new triangle pair and evaluates affine height difference at every overlay vertex; numerical double arithmetic, not exact rational arithmetic.',sourceHashes={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [base/'before-flips.json',base/'candidate-solid.json',out/'candidate-roundtrip.json']},positionsUnchanged=A['positions']==B['positions'],indicesChanged=sum(a!=b for a,b in zip(A['indices'],B['indices'])),topFacesBefore=len(AF),topFacesAfter=len(BF),oldChangedTopTriangles=len(old),newChangedTopTriangles=len(new),boundaryEdgesUnchanged={e for e,c in ae.items() if c==1}=={e for e,c in be.items() if c==1},wholeIndexedNonManifoldEdges=sum(c!=2 for c in index_edges.values()),pairedBottomViolations=paired,maxAbsoluteFinalHeightChange=max(witnesses,key=lambda r:abs(r['delta'])),minFinalHeightChange=min(witnesses,key=lambda r:r['delta']),maxFinalHeightChange=max(witnesses,key=lambda r:r['delta']),maxOriginalTopDegrees=max(grade(normal(f)) for f in BF),originalAnyPositiveNyFaces=sum(normal(f)[1]>0 for f in allF),originalPositiveNyBelowShapeExtraction=small,originalPositiveNyOver40=original_small_steep,roundtripProblems=problems,roundtripMaximumPositiveOriginalTopDegrees=max((x['roundedDegrees'] for x in rounded_top),default=None),minimumPlanAltitude=minimum,originalDegenerateIndices=zero_original,roundedDegenerateIndices=zero_rounded)
json.dump(R,open(out/'review.json','w'),indent=2)
print(json.dumps({k:v for k,v in R.items() if k not in ('sourceHashes','originalPositiveNyBelowShapeExtraction','roundtripProblems','minimumPlanAltitude','originalPositiveNyOver40')},indent=2))
print('Small-positive',len(small),'steep-original',len(original_small_steep),'roundtrip-problems',len(problems),'minimum',minimum)
print('First problems',json.dumps(problems[:4],indent=2))
