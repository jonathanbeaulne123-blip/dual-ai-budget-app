import json,math,time
start=time.monotonic();d=json.load(open(OUT/'clipped.json'));source=json.load(open(INPUT));mesh=d['triangles'];pts=[];idx={};fixed=set();tris=[]
for t in mesh:
 ids=[]
 for p in t['points']:
  key=(round(p[0],8),round(p[2],8))
  if key not in idx:idx[key]=len(pts);pts.append(p)
  ids.append(idx[key])
  if t['type']=='overlap':fixed.add(idx[key])
 tris.append(ids)
# Make all clipped polygon boundaries conforming before moving free vertices.
# A clipped polygon can end in another polygon edge; fitting it independently
# would create a T-junction height crack even though all triangles are shallow.
conforming=[];owners=[]
for ids,owner in zip(tris,mesh):
 queue=[ids]
 while queue:
  face=queue.pop();split=False
  for edge in range(3):
   ai,bi=face[edge],face[(edge+1)%3];ci=face[(edge+2)%3];a,b=pts[ai],pts[bi];dx=b[0]-a[0];dz=b[2]-a[2];den=dx*dx+dz*dz
   if den<1e-18:continue
   interior=[]
   for vi,p in enumerate(pts):
    if vi in face:continue
    t=((p[0]-a[0])*dx+(p[2]-a[2])*dz)/den
    if 1e-7<t<1-1e-7 and math.hypot(p[0]-a[0]-dx*t,p[2]-a[2]-dz*t)<1e-8:interior.append((t,vi))
   if interior:
    vi=min(interior)[1];queue.extend([[ai,vi,ci],[vi,bi,ci]]);split=True;break
  if not split:conforming.append(face);owners.append(owner)
tris=conforming;mesh=owners
# Entire bridge starting cross-section is fixed, not only the six source vertices.
a=source['orchardRows'][26][0];b=source['orchardRows'][26][-1];dx=b[0]-a[0];dz=b[2]-a[2]
for i,p in enumerate(pts):
 v=((p[0]-a[0])*dx+(p[2]-a[2])*dz)/(dx*dx+dz*dz)
 if -1e-7<=v<=1+1e-7 and math.hypot(p[0]-a[0]-dx*v,p[2]-a[2]-dz*v)<1e-7:fixed.add(i)
END=26
# Keep the existing masonry renderer's exact contract: bridge rows are level
# cross-sections; all intermediate vertices remain in those original swept planes.
ownerFor={}
for ids,owner in zip(tris,mesh):
 for i in ids:
  if i not in ownerFor or owner['band']>ownerFor[i]['band']:ownerFor[i]=owner

def oldSource(p,owner):
 i,k=owner['band'],owner['column'];r=source['orchardRows'];candidates=[[r[i-1][k-1],r[i][k-1],r[i][k]],[r[i-1][k-1],r[i][k],r[i-1][k]]]
 for a,b,c in candidates:
  ux=b[0]-a[0];uz=b[2]-a[2];vx=c[0]-a[0];vz=c[2]-a[2];de=ux*vz-uz*vx;px=p[0]-a[0];pz=p[2]-a[2];u=(px*vz-pz*vx)/de;v=(ux*pz-uz*px)/de
  if u>=-1e-6 and v>=-1e-6 and u+v<=1+1e-6:return a[1]+(b[1]-a[1])*u+(c[1]-a[1])*v
 raise ValueError((p,owner))
q=[];rowVars={}
for row in range(8,END):rowVars[row]=len(q);q.append(source['orchardRows'][row][0][1])
forms=[]
for i,p in enumerate(pts):
 owner=ownerFor[i];band=owner['band']
 if i in fixed:forms.append((p[1],{}));continue
 if band>=9:
  y0=source['orchardRows'][band-1][0][1];y1=source['orchardRows'][band][0][1];t=max(0,min(1,(oldSource(p,owner)-y0)/(y1-y0)));constant=0;terms={}
  for row,w in ((band-1,1-t),(band,t)):
   if row==END:constant+=w*y1
   else:terms[rowVars[row]]=w
  forms.append((constant,terms))
 else:forms.append((0,{len(q):1}));q.append(p[1])
def combine(ids,coeff):
 const=0;terms={}
 for i,c in zip(ids,coeff):
  a,d=forms[i];const+=a*c
  for k,w in d.items():terms[k]=terms.get(k,0)+c*w
 return const,{k:v for k,v in terms.items() if abs(v)>1e-14}
def value(form):return form[0]+sum(q[k]*w for k,w in form[1].items())
facets=[];linear=[]
for ti,ids in enumerate(tris):
 a,b,c=[pts[i] for i in ids];ux=b[0]-a[0];uz=b[2]-a[2];vx=c[0]-a[0];vz=c[2]-a[2];de=ux*vz-uz*vx;gx=[(uz-vz)/de,vz/de,-uz/de];gz=[(vx-ux)/de,-vx/de,ux/de];X=combine(ids,gx);Z=combine(ids,gz)
 if X[1] or Z[1]:facets.append((X,Z,ti))
 if mesh[ti]['type']=='blend':
  band=mesh[ti]['band'];sa=source['orchard']['samples'][band-1];sb=source['orchard']['samples'][band]
  for w in (-3.2,0,3.2):
   dx=sb['at'][0]+sb['normal'][0]*w-sa['at'][0]-sa['normal'][0]*w;dz=sb['at'][2]+sb['normal'][2]*w-sa['at'][2]-sa['normal'][2]*w;length=math.hypot(dx,dz);form=combine(ids,[(x*dx+z*dz)/length for x,z in zip(gx,gz)]);den=sum(w*w for w in form[1].values());linear.append((form,den,ti))
for it in range(4000):
 worst=0;longWorst=0
 for form,den,ti in linear:
  v=value(form);longWorst=max(longWorst,abs(v));excess=abs(v)-.11999
  if excess<=0 or den<1e-18:continue
  for k,w in form[1].items():q[k]-=math.copysign(excess,v)*w/den
 for X,Z,ti in facets:
  x,z=value(X),value(Z);g=math.hypot(x,z);worst=max(worst,g)
  if g<=.25:continue
  derivatives={k:(x*X[1].get(k,0)+z*Z[1].get(k,0))/g for k in set(X[1])|set(Z[1])};den=sum(w*w for w in derivatives.values())
  if den<1e-18:continue
  for k,w in derivatives.items():q[k]-=(g-.25)*w/den
 if worst<=.2500001 and longWorst<=.1199901:break
newpts=[[p[0],value(forms[i]),p[2]] for i,p in enumerate(pts)];deltas=[p[1]-oldSource(p,ownerFor[i]) for i,p in enumerate(newpts)];bridgeDeltas=[p[1]-oldSource(p,ownerFor[i]) for i,p in enumerate(newpts) if ownerFor[i]['band']>=9]
worstLong=max((abs(value(form)),ti) for form,den,ti in linear);worstFacet=max((math.hypot(value(X),value(Z)),ti) for X,Z,ti in facets)
out={'status':'UNAPPLIED flat-cross-section b0 alternative: static candidate only','sourceSha256':d['sourceSha256'],'triangleCount':len(tris),'oldTriangleCount':END*10,'netTriangles':len(tris)-END*10,'vertexCount':len(pts),'fixedVertices':len(fixed),'iterations':it+1,'elapsedS':time.monotonic()-start,'maximumNewLongitudinalGrade':worstLong,'maxNewFacetGrade':worstFacet,'deltaRange':[min(deltas),max(deltas)],'bridgeDeltaRange':[min(bridgeDeltas),max(bridgeDeltas)],'fixedFromOriginalRow':END,'modifiedBridge':'b0','points':newpts,'triangles':tris,'ownership':[t['type'] for t in mesh],'bands':[t['band'] for t in mesh],'columns':[t['column'] for t in mesh],'bridgeRowY':{row:q[v] for row,v in rowVars.items()}}
json.dump(out,open(OUT/'mesh.json','w'),indent=2);print(json.dumps({k:v for k,v in out.items() if k not in ['points','triangles','ownership','bands','columns']},indent=2))
