exec((ART/'source-planes.py').read_text(),globals())
from pathlib import Path
end=26;cols=len(lane[0]);endS=samples[end]['s']
def area(poly):return sum(a[0]*b[2]-a[2]*b[0] for a,b in zip(poly,poly[1:]+poly[:1]))/2

def clip(poly,a,b,sign):
 def side(p):return sign*((b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]))
 out=[]
 for p,q in zip(poly,poly[1:]+poly[:1]):
  x=side(p);y=side(q)
  if x>=-1e-10:out.append(p)
  if (x>=0)!=(y>=0):
   t=x/(x-y);out.append([p[k]+(q[k]-p[k])*t for k in range(3)])
 clean=[]
 for p in out:
  if not clean or math.hypot(p[0]-clean[-1][0],p[2]-clean[-1][2])>1e-8:clean.append(p)
 if len(clean)>1 and math.hypot(clean[0][0]-clean[-1][0],clean[0][2]-clean[-1][2])<1e-8:clean.pop()
 return clean
x0=min(p[0] for row in lane[:end+1] for p in row);x1=max(p[0] for row in lane[:end+1] for p in row);z0=min(p[2] for row in lane[:end+1] for p in row);z1=max(p[2] for row in lane[:end+1] for p in row)
local=[t for t in tri if t[8]<=x1+4 and t[9]>=x0-4 and t[10]<=z1+4 and t[11]>=z0-4]
def plane(t,p):
 a,b,c,ux,uz,vx,vz,de,*_=t;px=p[0]-a[0];pz=p[2]-a[2];u=(px*vz-pz*vx)/de;v=(ux*pz-uz*px)/de
 return a[1]+(b[1]-a[1])*u+(c[1]-a[1])*v

def nearest(x,z):
 best=None
 for tr in local:
  a,b,c,*_=tr
  for p,q in [(a,b),(b,c),(c,a)]:
   dx=q[0]-p[0];dz=q[2]-p[2];u=max(0,min(1,((x-p[0])*dx+(z-p[2])*dz)/(dx*dx+dz*dz)));at=[p[0]+dx*u,p[1]+(q[1]-p[1])*u,p[2]+dz*u];dist=math.hypot(x-at[0],z-at[2])
   if best is None or dist<best[0]-1e-9 or (abs(dist-best[0])<1e-9 and at[1]>best[1][1]):best=(dist,at)
 return best

def station(p):
 best=None
 for i in range(end):
  a=samples[i]['at'];b=samples[i+1]['at'];dx=b[0]-a[0];dz=b[2]-a[2];t=max(0,min(1,((p[0]-a[0])*dx+(p[2]-a[2])*dz)/(dx*dx+dz*dz)));dis=math.hypot(p[0]-a[0]-dx*t,p[2]-a[2]-dz*t)
  if best is None or dis<best[0]:best=(dis,samples[i]['s']+(samples[i+1]['s']-samples[i]['s'])*t)
 return best[1]
def outsideY(p):
 s=station(p)
 if s>=endS-1e-8:return p[1]
 d,q=nearest(p[0],p[2]);reach=min(3,max(0,(endS-s)*1.5));w=max(0,1-d/reach) if reach else 0
 return p[1]+(q[1]-p[1])*w
pieces=[]
for i in range(1,end+1):
 for k in range(1,cols):
  for initial in [[lane[i-1][k-1],lane[i][k-1],lane[i][k]],[lane[i-1][k-1],lane[i][k],lane[i-1][k]]]:
   remaining=[initial]
   for tr in local:
    a,b,c,ux,uz,vx,vz,de,tx0,tx1,tz0,tz1,*_=tr
    if max(p[0] for p in initial)<tx0 or min(p[0] for p in initial)>tx1 or max(p[2] for p in initial)<tz0 or min(p[2] for p in initial)>tz1:continue
    rest=[]
    for poly in remaining:
     cur=poly
     for p,q in [(a,b),(b,c),(c,a)]:
      outside=clip(cur,p,q,-1 if de>0 else 1)
      if len(outside)>=3 and abs(area(outside))>1e-10:rest.append(outside)
      cur=clip(cur,p,q,1 if de>0 else -1)
      if len(cur)<3 or abs(area(cur))<=1e-10:break
     else:
      if len(cur)>=3 and abs(area(cur))>1e-10:pieces.append({'type':'overlap','poly':cur,'road':tr,'band':i,'column':k})
    remaining=rest
   for poly in remaining:pieces.append({'type':'blend','poly':poly,'band':i,'column':k})
mesh=[];maxMove={'value':0};minDelta=0;maxDelta=0
for piece in pieces:
 poly=piece['poly'];centre=[sum(p[j] for p in poly)/len(poly) for j in range(3)];ground=[centre]+poly
 y=lambda p:plane(piece['road'],p) if piece['type']=='overlap' else outsideY(p)
 coords=[]
 for p in ground:
  q=[p[0],y(p),p[2]];delta=q[1]-p[1];minDelta=min(minDelta,delta);maxDelta=max(maxDelta,delta)
  if abs(delta)>abs(maxMove['value']):maxMove={'value':delta,'point':q,'sourceY':p[1],'kind':piece['type']}
  coords.append(q)
 for j in range(1,len(coords)):
  mesh.append({'points':[coords[0],coords[j],coords[1 if j==len(coords)-1 else j+1]],'type':piece['type'],'band':piece['band'],'column':piece['column']})
maxGrade={'value':0};overlap={'error':0};minArea=1e9
for t in mesh:
 a,b,c=t['points'];ux=b[0]-a[0];uz=b[2]-a[2];vx=c[0]-a[0];vz=c[2]-a[2];de=ux*vz-uz*vx;dy=b[1]-a[1];ey=c[1]-a[1];minArea=min(minArea,abs(de)/2)
 grade=math.hypot((dy*vz-ey*uz)/de,(ux*ey-vx*dy)/de)
 if grade>maxGrade['value']:maxGrade={'value':grade,**t}
 for u in range(4):
  for v in range(4-u):
   p=[a[j]+(b[j]-a[j])*u/3+(c[j]-a[j])*v/3 for j in range(3)];h=floor(p[0],p[2])
   if h and abs(p[1]-h['y'])>overlap['error']:overlap={'error':abs(p[1]-h['y']),'point':p,'main':h,**{k:v for k,v in t.items() if k!='points'}}
result={'status':'UNAPPLIED PURE SOURCE CANDIDATE; no terrain/runtime proof','sourceSha256':D['sourceSha256'],'sourceTrianglesReplaced':end*(cols-1)*2,'candidateTriangles':len(mesh),'polygons':len(pieces),'fixedFromRow':end,'fixedStation':endS,'minimumTriangleArea':minArea,'deltaRange':[minDelta,maxDelta],'worstDelta':maxMove,'maximumGrade':maxGrade,'maximumSampledOverlapError':overlap,'triangles':mesh}
json.dump(result,open(OUT/'clipped.json','w'),indent=2)
print(json.dumps({k:v for k,v in result.items() if k!='triangles'},indent=2))
