import json,math
D=json.load(open(INPUT));road=D['roadRows'];lane=D['orchardRows'];samples=D['orchard']['samples'];tri=[]
for i in range(1,len(road)):
 for k in range(1,len(road[i])):
  for a,b,c in [[road[i-1][k-1],road[i][k-1],road[i][k]],[road[i-1][k-1],road[i][k],road[i-1][k]]]:
   ux=b[0]-a[0];uz=b[2]-a[2];vx=c[0]-a[0];vz=c[2]-a[2];det=ux*vz-uz*vx
   if abs(det)<1e-10:continue
   tri.append((a,b,c,ux,uz,vx,vz,det,min(a[0],b[0],c[0]),max(a[0],b[0],c[0]),min(a[2],b[2],c[2]),max(a[2],b[2],c[2]),i,k))
def floor(x,z):
 best=None
 for a,b,c,ux,uz,vx,vz,de,x0,x1,z0,z1,i,k in tri:
  if x<x0-1e-7 or x>x1+1e-7 or z<z0-1e-7 or z>z1+1e-7:continue
  px=x-a[0];pz=z-a[2];u=(px*vz-pz*vx)/de;v=(ux*pz-uz*px)/de
  if u< -1e-7 or v< -1e-7 or u+v>1+1e-7:continue
  y=a[1]+(b[1]-a[1])*u+(c[1]-a[1])*v
  if best is None or y>best['y']:best={'y':y,'i':i,'k':k}
 return best
