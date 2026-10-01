# Pure saved-JSON arithmetic; no source module import, scene build or controller.
import json,math,struct,sys
from pathlib import Path
D=Path('/tmp/mountain-final-plant-comparison');B=json.loads((D/'baseline/snapshot.json').read_text());C=json.loads(Path(sys.argv[1] if len(sys.argv)>1 else D/'current/snapshot.json').read_text());report=json.loads((D/'comparison.json').read_text())
f32=lambda v:struct.unpack('f',struct.pack('f',v))[0]
def sub(a,b):return [x-y for x,y in zip(a,b)]
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def bounds(P):return ([min(p[k]for p in P)for k in range(3)],[max(p[k]for p in P)for k in range(3)])
def overlap(a,b):return all(a[0][k]<=b[1][k]+1e-9 and a[1][k]>=b[0][k]-1e-9 for k in range(3))
def hit(a,b):
 if not overlap(bounds(a),bounds(b)):return False
 ea=[sub(a[(i+1)%3],a[i])for i in range(3)];eb=[sub(b[(i+1)%3],b[i])for i in range(3)];na=cross(ea[0],ea[1]);nb=cross(eb[0],eb[1]);axes=[na,nb]+[cross(x,y)for x in ea for y in eb]+[cross(na,x)for x in ea]+[cross(nb,x)for x in eb]
 for ax in axes:
  l=math.hypot(*ax)
  if l<1e-12:continue
  ax=[x/l for x in ax];ap=[dot(p,ax)for p in a];bp=[dot(p,ax)for p in b]
  if max(ap)<min(bp)-1e-8 or max(bp)<min(ap)-1e-8:return False
 return True
def ico(r,off,scale):
 t=(1+math.sqrt(5))/2;V=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]];I=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];V=[[f32(f32(f32(x/math.hypot(*p)*r)*scale[k])+off[k])for k,x in enumerate(p)]for p in V];return [[V[j]for j in I[i:i+3]]for i in range(0,len(I),3)]
def mesh(p,kind):
 if kind=='tufts':
  T=[]
  for k in range(5):
   a=k/5*math.pi*2+.3;lean=.12+(k%2)*.1;h=.34+(k%3)*.09;w=.045;ca=math.cos(a);sa=math.sin(a);T.append([[f32(x)for x in v]for v in [[-sa*w,0,ca*w],[sa*w,0,-ca*w],[ca*lean*1.6,h,sa*lean*1.6]]])
  scale=[p['size'],p['size']*(1.1+p['tint']*.5),p['size']];y=p['y']-.02
 elif p['kind']=='hedge':
  # Same closed planar box as segmented BoxGeometry(1,1,1,2,1,1); extra
  # coplanar subdivisions change neither its occupied faces nor SAT result.
  V=[[x,y,z]for x in [-.5,.5]for y in [0,1]for z in [-.5,.5]];Q=[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]];T=[[V[q[i]]for i in ids]for q in Q for ids in [[0,1,2],[0,2,3]]];scale=[p['size']*p['stretch'],p['size']*1.25,p['size']*.9];y=p['y']-.05
 elif p['kind'] in ['shrub','flowering']:
  T=ico(.7,[0,.45,0],[1.2,.75,1.1])+ico(.5,[.4,.62,.2],[1,.8,1]);scale=[p['size']]*3;y=p['y']-.05
 else:raise Exception(p['kind'])
 c=math.cos(p['spin']);s=math.sin(p['spin']);out=[]
 for tri in T:
  out.append([[p['x']+c*v[0]*scale[0]+s*v[2]*scale[2],y+v[1]*scale[1],p['z']-s*v[0]*scale[0]+c*v[2]*scale[2]]for v in tri])
 return out
canon=lambda t:tuple(sorted(tuple(p)for p in t['p']))
changed=[]
for br,T in C['branchMeshes'].items():
 old=set(map(canon,B['branchMeshes'][br]));changed +=[dict(t,branch=br,index=i,box=bounds(t['p']))for i,t in enumerate(T)if canon(t)not in old]
out=[]
for r in report['otherCandidates']:
 M=mesh(r['item'],r['kind']);bb=bounds([p for t in M for p in t]);possible=[t for t in changed if overlap(bb,t['box'])];hits=[]
 for j,a in enumerate(M):
  for b in possible:
   if hit(a,b['p']):hits.append({'branch':b['branch'],'triangle':b['index'],'plantTriangle':j,'plantFace':a,'branchFace':b['p']});break
  if hits:break
 out.append({**r,'classification':'Confirmed static primitive intersection' if hits else 'Envelope candidate with no static surface intersection found','retainedInCurrent':r['item'] in C['plans'][r['tier']][r['kind']],'actualStaticPrimitiveIntersection':bool(hits),'hits':hits,'primitiveNote':'Analytic source-defined tuft triangles, Float32 ico0 bushes, or exact planar hedge box; no wind/outline, no full containment test. Final approved Awning geometry is included.'})
Path(sys.argv[2] if len(sys.argv)>2 else '/tmp/mountain-non-tree-final-proof.json').write_text(json.dumps({'method':'Pure saved-JSON plus source primitive arithmetic, not module replay','results':out},indent=2))
for r in out:print(r['tier'],r['kind'],r['index'],r['actualStaticPrimitiveIntersection'],[(h['branch'],h['triangle'])for h in r['hits']])
